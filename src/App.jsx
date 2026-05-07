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
        </div>
      )}

    </div>
  );
}