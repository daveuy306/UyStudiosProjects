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
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area
} from 'recharts';
import { 
  LayoutDashboard, Briefcase, Receipt, Plus, Users, MapPin, 
  ChevronLeft, ChevronRight, Menu, X, DollarSign, Calendar,
  ExternalLink, Trash2, Camera, Clock, UserPlus, TrendingUp, 
  AlertCircle, Link2, HardDrive, Info, CheckCircle2, Edit3, Save, Search
} from 'lucide-react';

// --- Firebase Configuration & Initialization ---
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : null;

const appId = typeof __app_id !== 'undefined' ? __app_id : 'lumina-studio-pro';

// CRITICAL: Initialize outside components to prevent re-init loops
let db, auth;
if (firebaseConfig && firebaseConfig.apiKey) {
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
}

const PROJECT_STATUSES = ['Not Started', 'Ongoing', 'Completed', 'Cancelled'];
const EXPENSE_TYPES = ['Equipment', 'Rentals', 'Travel', 'Software', 'Marketing', 'Office', 'Other'];

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(!!firebaseConfig);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [projects, setProjects] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [editingProject, setEditingProject] = useState(null);

  // RULE 3: AUTHENTICATE FIRST
  useEffect(() => {
    if (!firebaseConfig || !auth) return;

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth Error:", err);
      } finally {
        setAuthLoading(false);
      }
    };

    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  // RULE 1: STRICT PATHS & RULE 2: SIMPLE QUERIES
  useEffect(() => {
    if (!user || !db) return;

    // MANDATORY PATH STRUCTURE: /artifacts/{appId}/public/data/{collection}
    const pRef = collection(db, 'artifacts', appId, 'public', 'data', 'projects');
    const eRef = collection(db, 'artifacts', appId, 'public', 'data', 'expenses');

    const unsubP = onSnapshot(pRef, 
      (s) => setProjects(s.docs.map(d => ({ id: d.id, ...d.data() }))),
      (err) => console.error("Project Sync Error:", err)
    );

    const unsubE = onSnapshot(eRef, 
      (s) => setExpenses(s.docs.map(d => ({ id: d.id, ...d.data() }))),
      (err) => console.error("Expense Sync Error:", err)
    );

    return () => { unsubP(); unsubE(); };
  }, [user]);

  // Financial Logic
  const chartData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();
    
    return months.map((month, idx) => {
      const mProjects = projects.filter(p => {
        const d = p.date ? new Date(p.date) : null;
        return d && d.getMonth() === idx && d.getFullYear() === currentYear;
      });
      const mExpenses = expenses.filter(e => {
        const d = e.date ? new Date(e.date) : null;
        return d && d.getMonth() === idx && d.getFullYear() === currentYear;
      });

      const revenue = mProjects.reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0);
      const budget = mProjects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
      const teamCosts = mProjects.reduce((sum, p) => sum + (p.team?.reduce((tSum, m) => tSum + (Number(m.cost) || 0), 0) || 0), 0);
      const overhead = mExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

      return { 
        name: month, 
        revenue, 
        owed: Math.max(0, budget - revenue), 
        expenses: overhead + teamCosts
      };
    });
  }, [projects, expenses]);

  const handleProjectAction = async (e) => {
    e.preventDefault();
    if (!user) return; // Guard clause
    
    const fd = new FormData(e.target);
    const teamNames = fd.getAll('teamName');
    const teamRoles = fd.getAll('teamRole');
    const teamCosts = fd.getAll('teamCost');
    const team = teamNames.map((name, i) => ({
      name, role: teamRoles[i], cost: Number(teamCosts[i]) || 0
    })).filter(m => m.name);

    const payload = {
      clientName: fd.get('clientName'),
      eventType: fd.get('eventType'),
      duration: fd.get('duration'),
      location: fd.get('location'),
      mapsLink: fd.get('mapsLink'),
      budget: Number(fd.get('budget')),
      amountPaid: Number(fd.get('amountPaid')),
      date: fd.get('date'),
      status: fd.get('status'),
      team,
      updatedAt: serverTimestamp()
    };

    try {
      const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'projects');
      if (editingProject) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', editingProject.id), payload);
      } else {
        await addDoc(colRef, payload);
      }
      setIsAddingProject(false);
      setEditingProject(null);
    } catch (err) {
      console.error("Firestore Save Error:", err);
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!user) return;
    
    const fd = new FormData(e.target);
    const payload = {
      type: fd.get('type'),
      amount: Number(fd.get('amount')),
      date: fd.get('date'),
      reason: fd.get('reason'),
      createdAt: serverTimestamp()
    };

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'expenses'), payload);
      setIsAddingExpense(false);
    } catch (err) {
      console.error("Firestore Expense Error:", err);
    }
  };

  const handleDeleteProject = async (id) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', id));
    } catch (err) {
      console.error("Delete Error:", err);
    }
  };

  // Nav Item Component
  const NavItem = ({ id, icon: Icon, label }) => (
    <button
      onClick={() => { setActiveTab(id); setIsMobileMenuOpen(false); }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
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
    <div className="flex h-screen bg-[#08080a] text-slate-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className={`hidden md:flex flex-col border-r border-white/5 bg-[#0d0d0f] transition-all duration-300 z-50 ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
        <div className="p-6 flex items-center justify-between mb-4">
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Camera size={18} className="text-white" />
              </div>
              <h1 className="text-lg font-black tracking-tighter uppercase italic text-white">Lumina</h1>
            </div>
          )}
          <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="p-2 hover:bg-white/5 rounded-lg text-slate-500">
            {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          <NavItem id="dashboard" icon={LayoutDashboard} label="Dashboard" />
          <NavItem id="projects" icon={Briefcase} label="Projects" />
          <NavItem id="expenses" icon={Receipt} label="Expenses" />
        </nav>
        <div className="p-4">
           <div className="p-3 rounded-xl border border-white/5 bg-white/5 flex justify-center">
              {user ? (
                <div className="flex items-center gap-2 text-emerald-500">
                   <CheckCircle2 size={16} />
                   {!isSidebarCollapsed && <span className="text-[10px] font-black uppercase">Connected</span>}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-amber-500">
                   <Info size={16} />
                   {!isSidebarCollapsed && <span className="text-[10px] font-black uppercase tracking-wider">Demo Mode</span>}
                </div>
              )}
           </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between px-6 h-16 bg-[#0d0d0f] border-b border-white/5">
          <div className="flex items-center gap-2">
            <Camera size={20} className="text-indigo-500" />
            <h1 className="font-black text-sm uppercase italic">LUMINA</h1>
          </div>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-400">
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </header>

        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 bg-[#0a0a0c] z-[60] p-6 pt-20 space-y-4">
            <NavItem id="dashboard" icon={LayoutDashboard} label="Dashboard" />
            <NavItem id="projects" icon={Briefcase} label="Projects" />
            <NavItem id="expenses" icon={Receipt} label="Expenses" />
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-10">
          {!user && (
            <div className="mb-8 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3 text-amber-400 text-xs font-bold uppercase animate-pulse">
              <AlertCircle size={18} />
              <span>Running in Demo Mode. Connect Firebase to sync data.</span>
            </div>
          )}

          <div className="max-w-7xl mx-auto">
            {activeTab === 'dashboard' && (
              <div>
                <div className="mb-10">
                  <h2 className="text-5xl font-black text-white mb-2">Insights</h2>
                  <p className="text-slate-500">Live studio performance.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                  {[
                    { label: 'Revenue', val: chartData.reduce((a, b) => a + b.revenue, 0), color: 'text-emerald-400', icon: TrendingUp },
                    { label: 'Owed', val: chartData.reduce((a, b) => a + b.owed, 0), color: 'text-amber-400', icon: Clock },
                    { label: 'Expenses', val: chartData.reduce((a, b) => a + b.expenses, 0), color: 'text-rose-400', icon: Receipt }
                  ].map((stat, i) => (
                    <div key={i} className="bg-[#111114] border border-white/5 p-8 rounded-[2rem]">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">{stat.label}</p>
                      <p className={`text-4xl font-black ${stat.color}`}>${stat.val.toLocaleString()}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-[#111114] border border-white/5 p-8 rounded-[2.5rem] h-[450px]">
                    <ResponsiveContainer width="100%" height="100%">
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
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} opacity={0.2} />
                        <XAxis dataKey="name" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                        <Tooltip contentStyle={{ backgroundColor: '#0d0d0f', border: '1px solid #1e293b', borderRadius: '12px' }} />
                        <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fill="url(#colorRev)" />
                        <Area type="monotone" dataKey="expenses" stroke="#f43f5e" strokeWidth={3} fill="url(#colorExp)" />
                      </AreaChart>
                    </ResponsiveContainer>
                </div>
              </div>
            )}

            {activeTab === 'projects' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-4xl font-black text-white">Productions</h2>
                  <button onClick={() => setIsAddingProject(true)} className="bg-indigo-600 px-6 py-3 rounded-xl font-bold flex items-center gap-2">
                    <Plus size={18}/> New
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {projects.map(p => (
                    <div key={p.id} className="bg-[#111114] border border-white/5 p-8 rounded-[2rem] relative group">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <span className="text-[10px] font-black text-indigo-400 uppercase bg-indigo-500/10 px-2 py-1 rounded mb-2 inline-block">
                            {p.status}
                          </span>
                          <h4 className="text-2xl font-black text-white">{p.clientName}</h4>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingProject(p); setIsAddingProject(true); }} className="p-2 text-slate-500 hover:text-white"><Edit3 size={16}/></button>
                          <button onClick={() => handleDeleteProject(p.id)} className="p-2 text-slate-700 hover:text-rose-500"><Trash2 size={16}/></button>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-slate-400 text-sm mb-6">
                        <div className="flex items-center gap-1"><Calendar size={14}/> {p.date}</div>
                        <div className="flex items-center gap-1"><MapPin size={14}/> {p.location}</div>
                      </div>
                      <div className="flex justify-between items-end border-t border-white/5 pt-6">
                        <div>
                          <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Budget</p>
                          <p className="text-xl font-black text-emerald-400">${p.budget?.toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Crew</p>
                          <p className="text-lg font-black text-white">{p.team?.length || 0}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'expenses' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-4xl font-black text-white">Ledger</h2>
                  <button onClick={() => setIsAddingExpense(true)} className="bg-rose-600 px-6 py-3 rounded-xl font-bold flex items-center gap-2">
                    <Plus size={18}/> Add Entry
                  </button>
                </div>
                <div className="bg-[#111114] border border-white/5 rounded-[2rem] overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-white/5 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        <th className="p-6">Date</th>
                        <th className="p-6">Category</th>
                        <th className="p-6">Reason</th>
                        <th className="p-6 text-right">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {expenses.map(e => (
                        <tr key={e.id} className="text-sm">
                          <td className="p-6 text-slate-500">{e.date}</td>
                          <td className="p-6"><span className="text-rose-400 font-bold">{e.type}</span></td>
                          <td className="p-6 text-slate-300 italic">{e.reason}</td>
                          <td className="p-6 text-right font-black text-white">-${e.amount?.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Expense Modal */}
      {isAddingExpense && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-[100]">
           <div className="bg-[#11141d] border border-white/10 p-10 rounded-[2.5rem] w-full max-w-md">
              <div className="flex justify-between mb-8">
                <h3 className="text-2xl font-black text-rose-500 uppercase italic">New Expense</h3>
                <button onClick={() => setIsAddingExpense(false)}><X/></button>
              </div>
              <form onSubmit={handleAddExpense} className="space-y-4">
                <select name="type" className="w-full bg-black/40 border border-white/5 p-4 rounded-xl outline-none">
                  {EXPENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input name="amount" type="number" placeholder="Value ($)" className="w-full bg-black/40 border border-white/5 p-4 rounded-xl outline-none text-rose-400 font-black" required />
                <input name="date" type="date" className="w-full bg-black/40 border border-white/5 p-4 rounded-xl outline-none" defaultValue={new Date().toISOString().split('T')[0]} required />
                <textarea name="reason" placeholder="Details..." className="w-full bg-black/40 border border-white/5 p-4 rounded-xl outline-none h-24" required></textarea>
                <button type="submit" className="w-full bg-rose-600 p-4 rounded-xl font-black uppercase tracking-widest">Commit</button>
              </form>
           </div>
        </div>
      )}

      {/* Project Form Modal */}
      {(isAddingProject || editingProject) && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-[100] overflow-y-auto">
          <div className="bg-[#11141d] border border-white/10 p-10 rounded-[2.5rem] w-full max-w-2xl my-auto">
            <div className="flex justify-between mb-8">
              <h3 className="text-2xl font-black text-indigo-500 uppercase italic">{editingProject ? 'Edit' : 'New'} Production</h3>
              <button onClick={() => { setIsAddingProject(false); setEditingProject(null); }}><X/></button>
            </div>
            <form onSubmit={handleProjectAction} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <input name="clientName" defaultValue={editingProject?.clientName} placeholder="Client" className="w-full bg-black/40 border border-white/5 p-4 rounded-xl outline-none font-bold" required />
                <input name="eventType" defaultValue={editingProject?.eventType} placeholder="Type" className="w-full bg-black/40 border border-white/5 p-4 rounded-xl outline-none" required />
                <input name="date" type="date" defaultValue={editingProject?.date} className="w-full bg-black/40 border border-white/5 p-4 rounded-xl outline-none" required />
                <select name="status" defaultValue={editingProject?.status} className="w-full bg-black/40 border border-white/5 p-4 rounded-xl outline-none">
                  {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <input name="budget" type="number" defaultValue={editingProject?.budget} placeholder="Budget" className="w-full bg-black/40 border border-white/5 p-4 rounded-xl outline-none text-emerald-400 font-bold" required />
                  <input name="amountPaid" type="number" defaultValue={editingProject?.amountPaid} placeholder="Paid" className="w-full bg-black/40 border border-white/5 p-4 rounded-xl outline-none text-emerald-400 font-bold" required />
                </div>
                <input name="location" defaultValue={editingProject?.location} placeholder="Location" className="w-full bg-black/40 border border-white/5 p-4 rounded-xl outline-none" />
                <input name="mapsLink" defaultValue={editingProject?.mapsLink} placeholder="Maps Link" className="w-full bg-black/40 border border-white/5 p-4 rounded-xl outline-none text-xs text-indigo-400" />
                <button type="submit" className="w-full bg-indigo-600 p-4 rounded-xl font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20">
                  {editingProject ? 'Save Changes' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}