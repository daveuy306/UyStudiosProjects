import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, 
  onSnapshot, query, serverTimestamp 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged 
} from 'firebase/auth';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { 
  LayoutDashboard, Briefcase, Receipt, Plus, Users, MapPin, 
  ChevronLeft, ChevronRight, Menu, X, DollarSign, Calendar,
  ExternalLink, Trash2, Camera, Clock, UserPlus, TrendingUp
} from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : { /* Fallback for local dev if needed */ };

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'lumina-studio-v2';

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

  // --- Auth Logic (RULE 3) ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // --- Firestore Sync (RULE 1 & 2) ---
  useEffect(() => {
    if (!user) return;

    // Use standard paths for public data syncing
    const projectsRef = collection(db, 'artifacts', appId, 'public', 'data', 'projects');
    const expensesRef = collection(db, 'artifacts', appId, 'public', 'data', 'expenses');

    const unsubProjects = onSnapshot(projectsRef, (snap) => {
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Firestore Projects Sync Error:", err));

    const unsubExpenses = onSnapshot(expensesRef, (snap) => {
      setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Firestore Expenses Sync Error:", err));

    return () => {
      unsubProjects();
      unsubExpenses();
    };
  }, [user]);

  // --- Financial Analytics ---
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
      const cost = monthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

      return { 
        name: month, 
        revenue, 
        owed: Math.max(0, totalBudget - revenue), 
        expenses: cost 
      };
    });
  }, [projects, expenses]);

  // --- Handlers ---
  const handleAddProject = async (e) => {
    e.preventDefault();
    if (!user) return;
    const form = e.target;
    const formData = new FormData(form);

    const team = [];
    if (formData.get('teamMember')) {
      team.push({
        name: formData.get('teamMember'),
        role: formData.get('teamRole'),
        cost: Number(formData.get('teamCost')) || 0
      });
    }

    const payload = {
      clientName: formData.get('clientName'),
      eventType: formData.get('eventType'),
      duration: formData.get('duration'),
      location: formData.get('location'),
      mapsLink: formData.get('mapsLink'),
      budget: Number(formData.get('budget')),
      amountPaid: Number(formData.get('amountPaid')),
      date: formData.get('date'),
      status: formData.get('status'),
      team,
      createdAt: serverTimestamp()
    };

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'projects'), payload);
      setIsAddingProject(false);
      form.reset();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!user) return;
    const form = e.target;
    const formData = new FormData(form);

    const payload = {
      type: formData.get('type'),
      amount: Number(formData.get('amount')),
      date: formData.get('date'),
      reason: formData.get('reason'),
      createdAt: serverTimestamp()
    };

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'expenses'), payload);
      setIsAddingExpense(false);
      form.reset();
    } catch (err) {
      console.error(err);
    }
  };

  const updateStatus = async (id, newStatus) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', id), { status: newStatus });
  };

  const deleteItem = async (col, id) => {
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', col, id));
  };

  const NavItem = ({ id, icon: Icon, label }) => (
    <button
      onClick={() => { setActiveTab(id); setIsMobileMenuOpen(false); }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
        activeTab === id 
        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
        : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
      }`}
    >
      <Icon size={20} />
      {(!isSidebarCollapsed || isMobileMenuOpen) && <span className="font-semibold text-sm">{label}</span>}
    </button>
  );

  return (
    <div className="flex h-screen bg-[#0a0a0c] text-slate-100 font-sans selection:bg-indigo-500/30 overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside className={`hidden md:flex flex-col border-r border-slate-800/50 bg-[#0d0d0f] transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
        <div className="p-6 flex items-center justify-between">
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-2">
              <Camera size={22} className="text-indigo-500" />
              <h1 className="text-lg font-black tracking-tighter">LUMINA</h1>
            </div>
          )}
          <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-500">
            {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          <NavItem id="dashboard" icon={LayoutDashboard} label="Dashboard" />
          <NavItem id="projects" icon={Briefcase} label="Projects" />
          <NavItem id="expenses" icon={Receipt} label="Expenses" />
        </nav>
        <div className="p-4 mt-auto">
          <div className="bg-slate-900/50 border border-slate-800 p-3 rounded-xl">
             <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">User ID</p>
             <p className="text-[10px] font-mono truncate text-indigo-400">{user?.uid || 'Connecting...'}</p>
          </div>
        </div>
      </aside>

      {/* Main View */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-6 h-16 bg-[#0d0d0f] border-b border-slate-800/50 z-50">
          <div className="flex items-center gap-2">
            <Camera size={20} className="text-indigo-500" />
            <h1 className="font-black text-sm tracking-tighter">LUMINA</h1>
          </div>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-400">
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </header>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 bg-[#0a0a0c] z-40 p-6 pt-20 space-y-4">
            <NavItem id="dashboard" icon={LayoutDashboard} label="Dashboard" />
            <NavItem id="projects" icon={Briefcase} label="Projects" />
            <NavItem id="expenses" icon={Receipt} label="Expenses" />
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-10 custom-scrollbar">
          <div className="max-w-6xl mx-auto space-y-10">
            {/* DASHBOARD TAB */}
            {activeTab === 'dashboard' && (
              <div className="space-y-8 animate-in fade-in duration-500">
                <header>
                  <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Studio Overview</h2>
                  <p className="text-slate-500 mt-1">Real-time performance metrics for the year {new Date().getFullYear()}</p>
                </header>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                  {[
                    { label: 'Annual Revenue', val: chartData.reduce((a, b) => a + b.revenue, 0), color: 'text-emerald-400', icon: TrendingUp },
                    { label: 'Pending Payments', val: chartData.reduce((a, b) => a + b.owed, 0), color: 'text-amber-400', icon: Clock },
                    { label: 'Total Overhead', val: chartData.reduce((a, b) => a + b.expenses, 0), color: 'text-rose-400', icon: Receipt }
                  ].map((stat, i) => (
                    <div key={i} className="bg-slate-900/40 border border-slate-800/60 p-6 rounded-2xl relative overflow-hidden group">
                      <stat.icon className="absolute -right-4 -bottom-4 w-24 h-24 text-slate-800/10 group-hover:text-slate-800/20 transition-all" />
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{stat.label}</p>
                      <p className={`text-3xl font-black ${stat.color}`}>${stat.val.toLocaleString()}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-slate-900/40 border border-slate-800/60 p-6 rounded-3xl h-[400px]">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Financial Performance</h3>
                    <div className="flex gap-4 text-[10px] font-bold uppercase">
                      <span className="flex items-center gap-1.5 text-emerald-400"><div className="w-2 h-2 rounded-full bg-emerald-400" /> Revenue</span>
                      <span className="flex items-center gap-1.5 text-rose-400"><div className="w-2 h-2 rounded-full bg-rose-400" /> Expenses</span>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height="90%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="name" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis stroke="#475569" fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                        itemStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                      <Area type="monotone" dataKey="expenses" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorExp)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* PROJECTS TAB */}
            {activeTab === 'projects' && (
              <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h2 className="text-3xl font-bold">Project Pipeline</h2>
                  <button 
                    onClick={() => setIsAddingProject(true)}
                    className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
                  >
                    <Plus size={20} /> Create Project
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {projects.map(project => (
                    <div key={project.id} className="bg-[#111114] border border-slate-800/80 rounded-2xl p-6 hover:border-indigo-500/40 transition-all flex flex-col group">
                      <div className="flex justify-between items-start mb-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                             <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${
                                project.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-500' :
                                project.status === 'Ongoing' ? 'bg-blue-500/10 text-blue-500' :
                                project.status === 'Cancelled' ? 'bg-rose-500/10 text-rose-500' : 'bg-slate-800 text-slate-400'
                              }`}>
                                {project.status}
                              </span>
                          </div>
                          <h3 className="text-xl font-bold">{project.clientName}</h3>
                          <p className="text-slate-500 text-xs font-medium">{project.eventType}</p>
                        </div>
                        <button onClick={() => deleteItem('projects', project.id)} className="text-slate-600 hover:text-rose-500 p-2 transition-colors">
                          <Trash2 size={18} />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs text-slate-400 mb-6 bg-slate-900/40 p-4 rounded-xl border border-slate-800/50">
                        <div className="flex items-center gap-2"><Calendar size={14} className="text-indigo-400" /> {project.date}</div>
                        <div className="flex items-center gap-2"><Clock size={14} className="text-indigo-400" /> {project.duration}</div>
                        <div className="flex items-center gap-2 col-span-2">
                          <MapPin size={14} className="text-indigo-400 shrink-0" /> 
                          <span className="truncate">{project.location}</span>
                          {project.mapsLink && (
                            <a href={project.mapsLink} target="_blank" rel="noreferrer" className="ml-auto text-indigo-400 hover:text-indigo-300">
                              <ExternalLink size={14} />
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="space-y-4 flex-1">
                        <div>
                          <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                            <span>Payment Progress</span>
                            <span className="text-slate-300">${project.amountPaid} / ${project.budget}</span>
                          </div>
                          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-indigo-500 rounded-full transition-all duration-1000" 
                              style={{ width: `${Math.min(100, (project.amountPaid / project.budget) * 100)}%` }}
                            />
                          </div>
                        </div>

                        {project.team && project.team.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Team Assigned</p>
                            {project.team.map((member, i) => (
                              <div key={i} className="flex justify-between items-center bg-slate-900/60 px-3 py-2 rounded-lg border border-slate-800/30 text-xs">
                                <span className="text-slate-300 font-medium">{member.name} <span className="text-slate-500 font-normal">({member.role})</span></span>
                                <span className="font-mono text-indigo-400">${member.cost}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="mt-6 pt-4 border-t border-slate-800/50">
                        <select 
                          value={project.status}
                          onChange={(e) => updateStatus(project.id, e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 text-xs font-bold rounded-lg p-2.5 focus:ring-1 focus:ring-indigo-500 transition-all outline-none"
                        >
                          {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                  ))}
                  {projects.length === 0 && (
                    <div className="lg:col-span-2 text-center py-20 border-2 border-dashed border-slate-800 rounded-3xl">
                      <p className="text-slate-500 font-medium">No projects in the pipeline. Start by creating one!</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* EXPENSES TAB */}
            {activeTab === 'expenses' && (
              <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h2 className="text-3xl font-bold">Expense Ledger</h2>
                  <button 
                    onClick={() => setIsAddingExpense(true)}
                    className="w-full sm:w-auto bg-rose-600 hover:bg-rose-500 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-rose-500/20"
                  >
                    <Plus size={20} /> Add Expense
                  </button>
                </div>

                <div className="bg-[#0d0d0f] border border-slate-800/60 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-slate-900/50 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800/50">
                        <tr>
                          <th className="px-6 py-4">Date</th>
                          <th className="px-6 py-4">Category</th>
                          <th className="px-6 py-4">Notes</th>
                          <th className="px-6 py-4 text-right">Amount</th>
                          <th className="px-6 py-4 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/30">
                        {expenses.sort((a,b) => new Date(b.date) - new Date(a.date)).map(exp => (
                          <tr key={exp.id} className="hover:bg-slate-800/10 text-sm group transition-colors">
                            <td className="px-6 py-5 text-slate-400 font-mono text-xs">{exp.date}</td>
                            <td className="px-6 py-5">
                              <span className="bg-indigo-500/10 text-indigo-400 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase">
                                {exp.type}
                              </span>
                            </td>
                            <td className="px-6 py-5 text-slate-300 max-w-xs truncate">{exp.reason}</td>
                            <td className="px-6 py-5 text-right font-mono font-bold text-rose-400">-${exp.amount.toLocaleString()}</td>
                            <td className="px-6 py-5">
                              <button onClick={() => deleteItem('expenses', exp.id)} className="text-slate-700 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {expenses.length === 0 && (
                    <div className="p-20 text-center text-slate-600">
                      <Receipt size={40} className="mx-auto mb-3 opacity-20" />
                      <p className="font-bold text-xs uppercase tracking-widest">No transactions logged</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* --- MODALS --- */}
      
      {/* New Project Modal */}
      {isAddingProject && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#111114] border border-slate-800 rounded-3xl w-full max-w-2xl animate-in zoom-in-95 duration-300">
            <form onSubmit={handleAddProject} className="p-6 md:p-8 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-bold">New Project Setup</h3>
                <button type="button" onClick={() => setIsAddingProject(false)} className="text-slate-500 hover:text-white p-2">
                  <X size={24}/>
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[
                  { label: 'Client Name', name: 'clientName', placeholder: 'Brand/Individual', type: 'text', required: true },
                  { label: 'Shoot Type', name: 'eventType', placeholder: 'Commercial / Wedding / MV', type: 'text', required: true },
                  { label: 'Event Date', name: 'date', type: 'date', required: true },
                  { label: 'Duration', name: 'duration', placeholder: 'e.g. 10 Hours', type: 'text' },
                  { label: 'Location Name', name: 'location', placeholder: 'Studio A / City Park', type: 'text' },
                  { label: 'Maps Link', name: 'mapsLink', placeholder: 'https://maps...', type: 'url' },
                  { label: 'Total Budget ($)', name: 'budget', type: 'number', required: true },
                  { label: 'Amount Paid ($)', name: 'amountPaid', type: 'number' }
                ].map((f, i) => (
                  <div key={i} className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">{f.label}</label>
                    <input 
                      {...f} 
                      className="w-full bg-black/40 border border-slate-800 rounded-xl p-3.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" 
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-4 pt-6 border-t border-slate-800/50">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <UserPlus size={14}/> Add Primary Team Member
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <input name="teamMember" placeholder="Name" className="bg-black/40 border border-slate-800 rounded-xl p-3 text-sm outline-none col-span-1" />
                  <input name="teamRole" placeholder="Role" className="bg-black/40 border border-slate-800 rounded-xl p-3 text-sm outline-none col-span-1" />
                  <input name="teamCost" type="number" placeholder="Cost $" className="bg-black/40 border border-slate-800 rounded-xl p-3 text-sm outline-none col-span-1" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Initial Status</label>
                <select name="status" className="w-full bg-black/40 border border-slate-800 rounded-xl p-3.5 text-sm outline-none font-bold">
                  {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="pt-6 flex flex-col sm:flex-row gap-3">
                <button type="submit" className="flex-1 bg-indigo-600 py-4 rounded-xl font-bold hover:bg-indigo-500 transition-all text-white shadow-lg shadow-indigo-500/20">Launch Project</button>
                <button type="button" onClick={() => setIsAddingProject(false)} className="px-8 bg-slate-800 py-4 rounded-xl font-bold hover:bg-slate-700 transition-all">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Expense Modal */}
      {isAddingExpense && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-[#111114] border border-slate-800 rounded-3xl w-full max-w-md animate-in zoom-in-95 duration-300">
            <form onSubmit={handleAddExpense} className="p-8 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-bold text-rose-500">Log Expense</h3>
                <button type="button" onClick={() => setIsAddingExpense(false)} className="text-slate-500 hover:text-white"><X size={24} /></button>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Category</label>
                  <select name="type" className="w-full bg-black/40 border border-slate-800 rounded-xl p-3.5 text-sm outline-none">
                    {EXPENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Amount ($)</label>
                  <input type="number" name="amount" required step="0.01" className="w-full bg-black/40 border border-slate-800 rounded-xl p-3.5 text-sm outline-none font-mono text-rose-400" placeholder="0.00" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Date</label>
                  <input type="date" name="date" required className="w-full bg-black/40 border border-slate-800 rounded-xl p-3.5 text-sm outline-none text-slate-300" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Reason / Notes</label>
                  <textarea name="reason" rows="3" className="w-full bg-black/40 border border-slate-800 rounded-xl p-3.5 text-sm outline-none text-slate-300" placeholder="Describe the overhead..."></textarea>
                </div>
              </div>

              <button type="submit" className="w-full bg-rose-600 py-4 rounded-xl font-bold hover:bg-rose-500 transition-all shadow-lg shadow-rose-500/20 text-white">Record Transaction</button>
            </form>
          </div>
        </div>
      )}

      {/* CSS for custom scrollbar */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #334155; }
      `}</style>
    </div>
  );
}