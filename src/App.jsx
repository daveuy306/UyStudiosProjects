import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged 
} from 'firebase/auth';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area 
} from 'recharts';
import { 
  LayoutDashboard, Briefcase, Receipt, Plus, Users, MapPin, 
  ChevronLeft, ChevronRight, Menu, X, DollarSign, Calendar,
  ExternalLink, Trash2, Camera, Film, Clock, UserPlus, Info
} from 'lucide-react';

// --- Firebase Configuration & Initialization ---
const getFirebaseConfig = () => {
  try {
    return typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
  } catch (e) {
    return null;
  }
};

const firebaseConfig = getFirebaseConfig();
const appId = typeof __app_id !== 'undefined' ? __app_id : 'lumina-studio-v1';

let app, auth, db;
if (firebaseConfig) {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
}

// --- Constants ---
const PROJECT_STATUSES = ['Not Started', 'Ongoing', 'Completed', 'Cancelled'];
const EXPENSE_TYPES = ['Equipment', 'Rentals', 'Travel', 'Software', 'Marketing', 'Office', 'Other'];

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Data State
  const [projects, setProjects] = useState([]);
  const [expenses, setExpenses] = useState([]);
  
  // UI Modal State
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [isAddingExpense, setIsAddingExpense] = useState(false);

  // --- Authentication (RULE 3) ---
  useEffect(() => {
    if (!firebaseConfig) return;

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth failed:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  // --- Data Sync (RULE 1 & 2) ---
  useEffect(() => {
    if (!user || !db) return;

    const projectsPath = collection(db, 'artifacts', appId, 'public', 'data', 'projects');
    const expensesPath = collection(db, 'artifacts', appId, 'public', 'data', 'expenses');

    const unsubProjects = onSnapshot(projectsPath, (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error("Sync error:", err));

    const unsubExpenses = onSnapshot(expensesPath, (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error("Sync error:", err));

    return () => {
      unsubProjects();
      unsubExpenses();
    };
  }, [user]);

  // --- Business Logic & Analytics ---
  const chartData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();
    
    return months.map((month, index) => {
      const monthProjects = projects.filter(p => {
        const d = new Date(p.date);
        return d.getMonth() === index && d.getFullYear() === currentYear;
      });
      const monthExpenses = expenses.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === index && d.getFullYear() === currentYear;
      });

      const revenue = monthProjects.reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0);
      const totalBudget = monthProjects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
      const owed = totalBudget - revenue;
      const cost = monthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

      return { name: month, revenue, owed: Math.max(0, owed), expenses: cost };
    });
  }, [projects, expenses]);

  // --- Handlers ---
  const handleAddProject = async (e) => {
    e.preventDefault();
    if (!db || !user) return;
    
    const formData = new FormData(e.target);
    const teamData = [];
    // Basic team parsing logic (just one for the form, can be expanded)
    if (formData.get('teamMember')) {
      teamData.push({
        name: formData.get('teamMember'),
        role: formData.get('teamRole'),
        cost: Number(formData.get('teamCost')) || 0
      });
    }

    const newProject = {
      clientName: formData.get('clientName'),
      eventType: formData.get('eventType'),
      duration: formData.get('duration'),
      location: formData.get('location'),
      mapsLink: formData.get('mapsLink'),
      budget: Number(formData.get('budget')),
      amountPaid: Number(formData.get('amountPaid')),
      date: formData.get('date'),
      status: formData.get('status'),
      team: teamData,
      createdAt: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'projects'), newProject);
      setIsAddingProject(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!db || !user) return;
    
    const formData = new FormData(e.target);
    const newExpense = {
      type: formData.get('type'),
      amount: Number(formData.get('amount')),
      date: formData.get('date'),
      reason: formData.get('reason'),
      createdAt: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'expenses'), newExpense);
      setIsAddingExpense(false);
    } catch (err) {
      console.error(err);
    }
  };

  const updateStatus = async (id, newStatus) => {
    if (!db) return;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', id), { status: newStatus });
  };

  const NavItem = ({ id, icon: Icon, label }) => {
    const isActive = activeTab === id;
    return (
      <button
        onClick={() => { setActiveTab(id); setIsMobileMenuOpen(false); }}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
          isActive 
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
          : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
        }`}
      >
        <Icon size={20} />
        {!isSidebarCollapsed && <span className="font-semibold text-sm">{label}</span>}
      </button>
    );
  };

  return (
    <div className="flex h-screen bg-[#0a0a0c] text-slate-100 font-sans selection:bg-indigo-500/30">
      {/* Desktop Sidebar */}
      <aside 
        className={`hidden md:flex flex-col border-r border-slate-800/50 bg-[#0d0d0f] transition-all duration-300 ${
          isSidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className="p-6 flex items-center justify-between">
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-2">
              <div className="bg-indigo-600 p-1.5 rounded-lg">
                <Camera size={18} className="text-white" />
              </div>
              <h1 className="text-lg font-black tracking-tight">LUMINA</h1>
            </div>
          )}
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-500"
          >
            {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
        
        <nav className="flex-1 px-3 space-y-1">
          <NavItem id="dashboard" icon={LayoutDashboard} label="Dashboard" />
          <NavItem id="projects" icon={Briefcase} label="Projects" />
          <NavItem id="expenses" icon={Receipt} label="Expenses" />
        </nav>

        <div className="p-4 border-t border-slate-800/50">
          <div className="flex items-center gap-3 bg-slate-900/50 p-3 rounded-xl border border-slate-800">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-xs font-bold">
              {user?.uid?.substring(0, 2).toUpperCase() || '...'}
            </div>
            {!isSidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate text-slate-300">{user?.uid || 'Connecting...'}</p>
                <p className="text-[10px] text-slate-500 font-medium">Cloud Sync Active</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-[#0d0d0f]/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-6 z-50">
        <div className="flex items-center gap-2">
          <Camera size={20} className="text-indigo-500" />
          <h1 className="text-lg font-black tracking-tight">LUMINA</h1>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-400">
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-[#0a0a0c] z-40 pt-20 px-6 animate-in fade-in slide-in-from-top-4">
          <nav className="space-y-4">
            <NavItem id="dashboard" icon={LayoutDashboard} label="Dashboard" />
            <NavItem id="projects" icon={Briefcase} label="Projects" />
            <NavItem id="expenses" icon={Receipt} label="Expenses" />
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6 md:p-10 pt-24 md:pt-10">
        <div className="max-w-6xl mx-auto space-y-10">
          
          {/* Dashboard */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight">Studio Overview</h2>
                  <p className="text-slate-500">Business performance metrics for {new Date().getFullYear()}</p>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {[
                  { label: 'Annual Revenue', val: chartData.reduce((a, b) => a + b.revenue, 0), color: 'text-emerald-400', icon: DollarSign },
                  { label: 'Pending Collections', val: chartData.reduce((a, b) => a + b.owed, 0), color: 'text-amber-400', icon: Clock },
                  { label: 'Total Overhead', val: chartData.reduce((a, b) => a + b.expenses, 0), color: 'text-rose-400', icon: Receipt }
                ].map((stat, i) => (
                  <div key={i} className="bg-slate-900/40 border border-slate-800/60 p-6 rounded-2xl relative overflow-hidden group">
                    <stat.icon className="absolute -right-4 -bottom-4 w-24 h-24 text-slate-800/20 group-hover:text-slate-800/40 transition-colors" />
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{stat.label}</p>
                    <p className={`text-3xl font-black ${stat.color}`}>${stat.val.toLocaleString()}</p>
                  </div>
                ))}
              </div>

              {/* Chart */}
              <div className="bg-slate-900/40 border border-slate-800/60 p-6 rounded-3xl h-[400px]">
                <h3 className="text-sm font-bold text-slate-400 mb-6 uppercase tracking-widest">Financial Trends</h3>
                <ResponsiveContainer width="100%" height="90%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="name" stroke="#475569" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#475569" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                      itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                    />
                    <Legend verticalAlign="top" align="right" height={36}/>
                    <Area type="monotone" dataKey="revenue" stroke="#10b981" fillOpacity={1} fill="url(#colorRev)" strokeWidth={3} name="Revenue" />
                    <Area type="monotone" dataKey="expenses" stroke="#f43f5e" fillOpacity={1} fill="url(#colorExp)" strokeWidth={3} name="Expenses" />
                    <Line type="monotone" dataKey="owed" stroke="#f59e0b" strokeWidth={3} dot={false} strokeDasharray="5 5" name="Owed" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Projects List */}
          {activeTab === 'projects' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold">Project Manager</h2>
                <button 
                  onClick={() => setIsAddingProject(true)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all"
                >
                  <Plus size={18} /> New Project
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {projects.map(project => (
                  <div key={project.id} className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 hover:border-indigo-500/50 transition-all">
                    <div className="flex justify-between mb-4">
                      <div>
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest ${
                          project.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-500' :
                          project.status === 'Ongoing' ? 'bg-blue-500/10 text-blue-500' :
                          project.status === 'Cancelled' ? 'bg-rose-500/10 text-rose-500' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {project.status}
                        </span>
                        <h3 className="text-xl font-bold mt-2">{project.clientName}</h3>
                        <p className="text-slate-500 text-sm">{project.eventType}</p>
                      </div>
                      <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', project.id))} className="text-slate-600 hover:text-rose-500 p-2">
                        <Trash2 size={18} />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs text-slate-400 mb-6">
                      <div className="flex items-center gap-2"><Calendar size={14}/> {project.date}</div>
                      <div className="flex items-center gap-2"><Clock size={14}/> {project.duration}</div>
                      <div className="flex items-center gap-2 truncate"><MapPin size={14}/> {project.location}</div>
                      {project.mapsLink && (
                        <a href={project.mapsLink} target="_blank" className="text-indigo-400 flex items-center gap-2 hover:underline">
                          <ExternalLink size={14}/> Maps
                        </a>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="bg-black/20 p-4 rounded-xl">
                        <div className="flex justify-between items-end mb-2">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Payment Progress</span>
                          <span className="text-xs font-mono font-bold">${project.amountPaid} / ${project.budget}</span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className="bg-indigo-500 h-full transition-all duration-1000" 
                            style={{ width: `${Math.min(100, (project.amountPaid / project.budget) * 100)}%` }}
                          />
                        </div>
                      </div>

                      {project.team && project.team.length > 0 && (
                        <div className="space-y-2">
                           <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Team Assigned</p>
                           {project.team.map((member, idx) => (
                             <div key={idx} className="flex justify-between items-center text-xs bg-slate-800/30 px-3 py-2 rounded-lg">
                               <div className="flex items-center gap-2">
                                 <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[8px]">{member.name[0]}</div>
                                 <span>{member.name} <span className="text-slate-500">({member.role})</span></span>
                               </div>
                               <span className="font-mono text-slate-300">${member.cost}</span>
                             </div>
                           ))}
                        </div>
                      )}

                      <select 
                        value={project.status}
                        onChange={(e) => updateStatus(project.id, e.target.value)}
                        className="w-full bg-slate-800 border-none text-xs font-bold rounded-lg p-2.5 cursor-pointer focus:ring-1 focus:ring-indigo-500"
                      >
                        {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expenses List */}
          {activeTab === 'expenses' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
               <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold">Expense Tracker</h2>
                <button 
                  onClick={() => setIsAddingExpense(true)}
                  className="bg-rose-600 hover:bg-rose-500 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all"
                >
                  <Plus size={18} /> Add Expense
                </button>
              </div>

              <div className="bg-slate-900/40 border border-slate-800/60 rounded-3xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-800/30 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                      <tr>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Category</th>
                        <th className="px-6 py-4">Notes</th>
                        <th className="px-6 py-4 text-right">Amount</th>
                        <th className="px-6 py-4 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/30">
                      {expenses.sort((a,b) => new Date(b.date) - new Date(a.date)).map(expense => (
                        <tr key={expense.id} className="hover:bg-slate-800/20 text-sm group">
                          <td className="px-6 py-5 text-slate-400">{expense.date}</td>
                          <td className="px-6 py-5">
                            <span className="bg-indigo-500/10 text-indigo-400 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest">
                              {expense.type}
                            </span>
                          </td>
                          <td className="px-6 py-5 text-slate-300 max-w-xs truncate">{expense.reason}</td>
                          <td className="px-6 py-5 text-right font-mono font-bold text-rose-400">-${expense.amount}</td>
                          <td className="px-6 py-5">
                            <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'expenses', expense.id))} className="text-slate-700 hover:text-rose-500 transition-opacity opacity-0 group-hover:opacity-100">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {expenses.length === 0 && (
                    <div className="p-20 text-center text-slate-600">
                      <Receipt size={40} className="mx-auto mb-3 opacity-20" />
                      <p className="font-bold text-xs uppercase tracking-widest">No expenses recorded</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Project Modal */}
      {isAddingProject && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <form onSubmit={handleAddProject} className="p-8 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-bold">Initialize New Project</h3>
                <button type="button" onClick={() => setIsAddingProject(false)} className="text-slate-500"><X /></button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[
                  { label: 'Client Name', name: 'clientName', placeholder: 'Brand Name', type: 'text', required: true },
                  { label: 'Shoot Type', name: 'eventType', placeholder: 'Photography/Film', type: 'text', required: true },
                  { label: 'Event Date', name: 'date', type: 'date', required: true },
                  { label: 'Duration', name: 'duration', placeholder: 'e.g. 4 Hours', type: 'text' },
                  { label: 'Location Name', name: 'location', placeholder: 'Studio A', type: 'text' },
                  { label: 'Google Maps Link', name: 'mapsLink', placeholder: 'https://...', type: 'url' },
                  { label: 'Total Budget ($)', name: 'budget', type: 'number', required: true },
                  { label: 'Amount Paid ($)', name: 'amountPaid', type: 'number' }
                ].map((f, i) => (
                  <div key={i} className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{f.label}</label>
                    <input {...f} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none" />
                  </div>
                ))}
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-800">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <UserPlus size={14}/> Core Team Member (Initial)
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <input name="teamMember" placeholder="Name" className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm outline-none col-span-1" />
                  <input name="teamRole" placeholder="Role" className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm outline-none col-span-1" />
                  <input name="teamCost" type="number" placeholder="Cost $" className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm outline-none col-span-1" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Initial Status</label>
                <select name="status" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm outline-none font-bold">
                  {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="submit" className="flex-1 bg-indigo-600 py-3.5 rounded-xl font-bold hover:bg-indigo-500 transition-colors">Launch Project</button>
                <button type="button" onClick={() => setIsAddingProject(false)} className="px-6 bg-slate-800 py-3.5 rounded-xl font-bold">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {isAddingExpense && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md animate-in zoom-in-95">
            <form onSubmit={handleAddExpense} className="p-8 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-bold text-rose-500">Add Expense</h3>
                <button type="button" onClick={() => setIsAddingExpense(false)} className="text-slate-500"><X /></button>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Category</label>
                  <select name="type" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm outline-none">
                    {EXPENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Amount ($)</label>
                  <input type="number" name="amount" required step="0.01" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm outline-none font-mono text-rose-400" placeholder="0.00" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Date</label>
                  <input type="date" name="date" required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm outline-none" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Reason / Notes</label>
                  <textarea name="reason" rows="3" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm outline-none" placeholder="Purchase details..."></textarea>
                </div>
              </div>

              <button type="submit" className="w-full bg-rose-600 py-3.5 rounded-xl font-bold hover:bg-rose-500 transition-colors">Record Transaction</button>
            </form>
          </div>
        </div>import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, collection, doc, addDoc, onSnapshot, 
  query, serverTimestamp, setDoc 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged 
} from 'firebase/auth';
import { 
  Plus, X, Wallet, MapPin, Link as LinkIcon, 
  TrendingUp, Calendar, FileText, CheckCircle2, AlertCircle
} from 'lucide-react';

// --- FIREBASE CONFIGURATION ---
const getFirebaseConfig = () => {
  try {
    return typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
  } catch (e) {
    return null;
  }
};

const firebaseConfig = getFirebaseConfig();
const appId = typeof __app_id !== 'undefined' ? __app_id : 'asset-tracker-default';

let db, auth;
if (firebaseConfig) {
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
  db = getFirestore(app);
  auth = getAuth(app);
}

// --- UTILS ---
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount || 0);
};

// --- COMPONENTS ---

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [assets, setAssets] = useState([]);
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);

  // 1. AUTHENTICATION (Mandatory Rule 3)
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const initAuth = async (retries = 0) => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        if (retries < 5) {
          const delay = Math.pow(2, retries) * 1000;
          setTimeout(() => initAuth(retries + 1), delay);
        } else {
          setError("Connection failed. Please check your Firebase settings.");
        }
      }
    };

    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. DATA SYNC (Mandatory Rule 1)
  useEffect(() => {
    if (!user || !db) return;

    // Public collection path as per environment requirements
    const assetCol = collection(db, 'artifacts', appId, 'public', 'data', 'assets');
    
    const unsubscribe = onSnapshot(assetCol, 
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAssets(data);
      },
      (err) => {
        console.error("Firestore Error:", err);
        setError("Unable to sync data. Ensure security rules allow access.");
      }
    );

    return () => unsubscribe();
  }, [user]);

  // --- ACTIONS ---

  const handleAddAsset = async (formData) => {
    if (!user || !db) return;
    try {
      const assetCol = collection(db, 'artifacts', appId, 'public', 'data', 'assets');
      await addDoc(assetCol, {
        ...formData,
        expenses: [],
        createdAt: serverTimestamp(),
        createdBy: user.uid
      });
      setShowAssetModal(false);
    } catch (err) {
      setError("Failed to create asset.");
    }
  };

  const handleAddExpense = async (assetId, expenseData) => {
    if (!user || !db) return;
    try {
      const assetRef = doc(db, 'artifacts', appId, 'public', 'data', 'assets', assetId);
      const asset = assets.find(a => a.id === assetId);
      const updatedExpenses = [...(asset.expenses || []), { ...expenseData, id: crypto.randomUUID(), createdAt: Date.now() }];
      
      await setDoc(assetRef, { ...asset, expenses: updatedExpenses }, { merge: true });
      setShowExpenseModal(false);
    } catch (err) {
      setError("Failed to record transaction.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f111a] flex items-center justify-center text-white font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 animate-pulse font-medium">Connecting to Secure Vault...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f111a] text-slate-200 font-sans selection:bg-indigo-500/30">
      {/* Top Bar */}
      <nav className="border-b border-slate-800 bg-[#0f111a]/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500 rounded-lg">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-black tracking-tight text-white italic">ASSET LENS</h1>
          </div>
          
          <div className="flex items-center gap-4">
            {error && (
              <div className="hidden md:flex items-center gap-2 text-rose-400 bg-rose-400/10 px-3 py-1.5 rounded-full text-xs font-bold">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
            <button 
              onClick={() => setShowAssetModal(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              <span>Initiate Asset</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6">
        {assets.length === 0 ? (
          <div className="mt-20 flex flex-col items-center text-center max-w-sm mx-auto">
            <div className="w-20 h-20 bg-slate-900 rounded-3xl flex items-center justify-center mb-6 border border-slate-800">
              <TrendingUp className="w-10 h-10 text-slate-700" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">No Assets Tracked</h2>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">
              Start by initiating your first project or asset to begin tracking budgets and expenses in real-time.
            </p>
            <button 
              onClick={() => setShowAssetModal(true)}
              className="text-indigo-400 font-bold hover:text-indigo-300 transition-colors underline underline-offset-4"
            >
              Initialize your first asset →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {assets.map(asset => (
              <AssetCard 
                key={asset.id} 
                asset={asset} 
                onAddExpense={() => {
                  setSelectedAsset(asset);
                  setShowExpenseModal(true);
                }} 
              />
            ))}
          </div>
        )}
      </main>

      {/* MODALS */}
      {showAssetModal && (
        <AssetModal onClose={() => setShowAssetModal(false)} onSubmit={handleAddAsset} />
      )}
      {showExpenseModal && (
        <ExpenseModal 
          asset={selectedAsset} 
          onClose={() => setShowExpenseModal(false)} 
          onSubmit={(data) => handleAddExpense(selectedAsset.id, data)} 
        />
      )}
    </div>
  );
}

function AssetCard({ asset, onAddExpense }) {
  const totalExpenses = (asset.expenses || []).reduce((sum, exp) => sum + Number(exp.amount), 0);
  const remaining = Number(asset.budget) - totalExpenses;
  const progress = Math.min((totalExpenses / Number(asset.budget)) * 100, 100);

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 hover:border-indigo-500/50 transition-all group overflow-hidden relative">
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
        <TrendingUp className="w-24 h-24 text-indigo-500" />
      </div>
      
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-lg font-bold text-white mb-1 group-hover:text-indigo-400 transition-colors uppercase tracking-tight">
              {asset.title}
            </h3>
            <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
              <MapPin className="w-3 h-3" />
              {asset.location}
            </div>
          </div>
          <button 
            onClick={onAddExpense}
            className="p-2 bg-slate-800 hover:bg-rose-500 text-slate-400 hover:text-white rounded-xl transition-all"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-black text-slate-500 mb-1">Spent</p>
              <p className="text-xl font-black text-white">{formatCurrency(totalExpenses)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest font-black text-slate-500 mb-1">Budget</p>
              <p className="text-sm font-bold text-slate-400">{formatCurrency(asset.budget)}</p>
            </div>
          </div>

          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ${progress > 90 ? 'bg-rose-500' : 'bg-indigo-500'}`}
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800/50 flex justify-between items-center">
          <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(asset.createdAt?.seconds * 1000 || Date.now()).toLocaleDateString()}
          </div>
          <div className={`text-[10px] font-black uppercase px-2 py-1 rounded-md ${remaining >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
            {remaining >= 0 ? 'Under Budget' : 'Over Budget'}
          </div>
        </div>
      </div>
    </div>
  );
}

function AssetModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({ title: '', location: '', mapUrl: '', budget: '', deposit: '' });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#08090d]/90 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#12141c] w-full max-w-lg rounded-[2.5rem] p-8 border border-slate-800 shadow-2xl">
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-2xl font-black text-white italic tracking-tight">INITIATE ASSET</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-500"><X /></button>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Title</label>
            <input 
              autoFocus
              className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-700"
              placeholder="e.g. PROJECT X"
              onChange={e => setForm({...form, title: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Location</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input 
                  className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl pl-12 pr-5 py-4 text-white focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-700"
                  placeholder="City"
                  onChange={e => setForm({...form, location: e.target.value})}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Map URL</label>
              <div className="relative">
                <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input 
                  className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl pl-12 pr-5 py-4 text-white focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-700"
                  placeholder="Link"
                  onChange={e => setForm({...form, mapUrl: e.target.value})}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Budget ($)</label>
              <input 
                type="number"
                className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-700"
                placeholder="0"
                onChange={e => setForm({...form, budget: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Deposit ($)</label>
              <input 
                type="number"
                className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-700"
                placeholder="0"
                onChange={e => setForm({...form, deposit: e.target.value})}
              />
            </div>
          </div>

          <button 
            disabled={!form.title || !form.budget}
            onClick={() => onSubmit(form)}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-indigo-500/10 mt-4 uppercase tracking-widest"
          >
            Create Asset
          </button>
        </div>
      </div>
    </div>
  );
}

function ExpenseModal({ asset, onClose, onSubmit }) {
  const [form, setForm] = useState({ category: 'Equipment', amount: '', date: new Date().toISOString().split('T')[0], note: '' });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#08090d]/90 backdrop-blur-sm animate-in zoom-in duration-200">
      <div className="bg-[#12141c] w-full max-w-lg rounded-[2.5rem] p-8 border border-slate-800 shadow-2xl">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-black text-rose-500 tracking-tight">ADD EXPENSE</h2>
            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1">FOR {asset?.title}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-500"><X /></button>
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Category</label>
            <select 
              className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-rose-500 transition-all appearance-none"
              onChange={e => setForm({...form, category: e.target.value})}
              value={form.category}
            >
              <option>Equipment</option>
              <option>Location Fee</option>
              <option>Travel</option>
              <option>Maintenance</option>
              <option>Other</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Amount ($)</label>
            <input 
              type="number"
              autoFocus
              className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl px-5 py-4 text-rose-400 font-bold text-lg focus:outline-none focus:border-rose-500 transition-all placeholder:text-slate-700"
              placeholder="0.00"
              onChange={e => setForm({...form, amount: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Date</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
              <input 
                type="date"
                className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl pl-12 pr-5 py-4 text-white focus:outline-none focus:border-rose-500 transition-all"
                value={form.date}
                onChange={e => setForm({...form, date: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Reason / Notes</label>
            <textarea 
              rows="3"
              className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-rose-500 transition-all placeholder:text-slate-700 resize-none"
              placeholder="Add details..."
              onChange={e => setForm({...form, note: e.target.value})}
            />
          </div>

          <button 
            disabled={!form.amount}
            onClick={() => onSubmit(form)}
            className="w-full bg-rose-500 hover:bg-rose-600 disabled:opacity-30 text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-rose-500/20 mt-4 uppercase tracking-widest flex items-center justify-center gap-3"
          >
            <CheckCircle2 className="w-5 h-5" />
            Record Transaction
          </button>
        </div>
      </div>
    </div>
  );
}
      )}

    </div>
  );
}