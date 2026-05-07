import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Edit2, Trash2, X, Film, CheckCircle2, 
  TrendingUp, Calendar, Sparkles, Loader2, LayoutDashboard,
  Briefcase, Receipt, ArrowDownCircle
} from 'lucide-react';
import { 
  XAxis, YAxis, Tooltip, ResponsiveContainer, 
  AreaChart, Area
} from 'recharts';

// Firebase Imports
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, onSnapshot, addDoc, 
  updateDoc, deleteDoc, doc, query
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';

// --- DEFENSIVE CONFIGURATION ---
const getFirebaseConfig = () => {
  try {
    if (typeof __firebase_config !== 'undefined') {
      return JSON.parse(__firebase_config);
    }
  } catch (e) {
    console.error("Firebase config parse error", e);
  }
  return null;
};

const config = getFirebaseConfig();
const appId = typeof __app_id !== 'undefined' ? __app_id : 'uystudios-prod';

// Initialize Firebase only if config exists
let app, auth, db;
if (config) {
  app = initializeApp(config);
  auth = getAuth(app);
  db = getFirestore(app);
}

const STATUS_OPTIONS = ['Completed', 'In Progress', 'Pending', 'Cancelled'];
const EXPENSE_CATEGORIES = ['Equipment', 'Travel', 'Software', 'Marketing', 'Catering', 'Other'];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [projects, setProjects] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  
  // Editing states
  const [editingProject, setEditingProject] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);

  // AI State
  const [aiInput, setAiInput] = useState('');
  const [aiProcessing, setAiProcessing] = useState(false);

  // 1. Authentication Effect (Rule 3)
  useEffect(() => {
    if (!auth) return;

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) {
        console.error("Auth Error:", e);
      }
    };

    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (!user) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Data Sync Effect (Rule 1 & 2)
  useEffect(() => {
    if (!user || !db) return;
    
    setLoading(true);
    const projectsRef = collection(db, 'artifacts', appId, 'public', 'data', 'projects');
    const expensesRef = collection(db, 'artifacts', appId, 'public', 'data', 'expenses');

    const unsubProjects = onSnapshot(projectsRef, (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    }, (err) => console.error("Projects Sync Error:", err));

    const unsubExpenses = onSnapshot(expensesRef, (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
      setLoading(false);
    }, (err) => {
      console.error("Expenses Sync Error:", err);
      setLoading(false);
    });

    return () => {
      unsubProjects();
      unsubExpenses();
    };
  }, [user]);

  // Derived State
  const stats = useMemo(() => {
    const safeProjects = projects || [];
    const safeExpenses = expenses || [];
    
    const totalRevenue = safeProjects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
    const totalCosts = safeExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const trendsObj = {};
    
    safeProjects.forEach(p => {
      if (!p.date) return;
      const d = new Date(p.date);
      const m = monthNames[d.getMonth()];
      if (!trendsObj[m]) trendsObj[m] = { name: m, revenue: 0 };
      trendsObj[m].revenue += (Number(p.budget) || 0);
    });

    const incomeChartData = monthNames.map(m => trendsObj[m] || { name: m, revenue: 0 });
    return { totalRevenue, totalCosts, netProfit: totalRevenue - totalCosts, incomeChartData };
  }, [projects, expenses]);

  const filteredProjects = useMemo(() => {
    return (projects || []).filter(p => 
      (p.client?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (p.event?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );
  }, [projects, searchTerm]);

  const filteredExpenses = useMemo(() => {
    return (expenses || []).filter(e => 
      (e.title?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (e.category?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );
  }, [expenses, searchTerm]);

  const handleSaveProject = async (e) => {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.target);
    const data = {
      client: fd.get('client'),
      event: fd.get('event'),
      date: fd.get('date'),
      budget: Number(fd.get('budget')),
      status: fd.get('status') || 'Pending',
      updatedAt: new Date().toISOString()
    };
    const path = ['artifacts', appId, 'public', 'data', 'projects'];
    if (editingProject) await updateDoc(doc(db, ...path, editingProject.id), data);
    else await addDoc(collection(db, ...path), { ...data, createdAt: new Date().toISOString() });
    setIsProjectModalOpen(false);
    setEditingProject(null);
  };

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.target);
    const data = {
      title: fd.get('title'),
      category: fd.get('category'),
      amount: Number(fd.get('amount')),
      date: fd.get('date'),
      updatedAt: new Date().toISOString()
    };
    const path = ['artifacts', appId, 'public', 'data', 'expenses'];
    if (editingExpense) await updateDoc(doc(db, ...path, editingExpense.id), data);
    else await addDoc(collection(db, ...path), { ...data, createdAt: new Date().toISOString() });
    setIsExpenseModalOpen(false);
    setEditingExpense(null);
  };

  // Safe Loading UI
  if (!config) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 bg-indigo-600/20 rounded-2xl flex items-center justify-center text-indigo-500 mb-6">
          <Film size={32} />
        </div>
        <h1 className="text-xl font-black text-white uppercase tracking-widest mb-2">Configuration Missing</h1>
        <p className="text-slate-400 text-sm max-w-xs">Firebase environment is not yet initialized. Please wait or reload.</p>
      </div>
    );
  }

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500/50">Establishing Secure Link</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 flex flex-col md:flex-row font-sans selection:bg-indigo-500/30">
      {/* Navigation */}
      <aside className="w-full md:w-72 bg-[#0F172A] border-b md:border-r border-white/5 flex flex-col md:h-screen sticky top-0 z-[60]">
        <div className="p-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Film size={24} />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tighter uppercase text-white leading-none">UY Studios</h1>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Production Hub</span>
            </div>
          </div>
        </div>
        <nav className="flex md:flex-col px-4 pb-6 md:space-y-2 overflow-x-auto md:overflow-x-visible no-scrollbar">
          <NavItem icon={<LayoutDashboard size={20}/>} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={<Briefcase size={20}/>} label="Productions" active={activeTab === 'projects'} onClick={() => setActiveTab('projects')} />
          <NavItem icon={<Receipt size={20}/>} label="Expenses" active={activeTab === 'expenses'} onClick={() => setActiveTab('expenses')} />
        </nav>
      </aside>

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-24 px-6 md:px-10 flex items-center justify-between bg-[#020617]/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50">
          <div className="relative w-full max-w-md hidden lg:block">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
              type="text" 
              placeholder="Search database..." 
              className="bg-white/5 border border-white/10 rounded-2xl px-12 py-3.5 text-sm w-full outline-none focus:border-indigo-500/50 focus:ring-4 ring-indigo-500/10 transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex gap-3">
             <button 
               onClick={() => { activeTab === 'expenses' ? setIsExpenseModalOpen(true) : setIsProjectModalOpen(true); }} 
               className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3.5 rounded-2xl text-[10px] font-black flex items-center gap-2 shadow-xl shadow-indigo-600/20 uppercase tracking-widest transition-all active:scale-95"
             >
               <Plus size={18} /> <span>Create New</span>
             </button>
          </div>
        </header>

        <main className="p-6 md:p-10 space-y-10">
          {activeTab === 'dashboard' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard label="Total Revenue" value={`$${stats.totalRevenue.toLocaleString()}`} color="indigo" icon={<TrendingUp size={20}/>} />
                <StatCard label="Total Expenses" value={`$${stats.totalCosts.toLocaleString()}`} color="rose" icon={<ArrowDownCircle size={20}/>} />
                <StatCard label="Net Profit" value={`$${stats.netProfit.toLocaleString()}`} color="emerald" icon={<CheckCircle2 size={20}/>} />
              </div>

              <div className="bg-[#0F172A] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl">
                <div className="flex items-center justify-between mb-10">
                  <h3 className="text-[11px] font-black uppercase text-slate-400 tracking-[0.2em]">Revenue Flow</h3>
                  <div className="flex gap-2">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                      <div className="w-2 h-2 rounded-full bg-indigo-500"></div> Projection
                    </div>
                  </div>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.incomeChartData}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} dy={10} />
                      <Tooltip contentStyle={{background: '#1e293b', border: 'none', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}} />
                      <Area type="monotone" dataKey="revenue" stroke="#6366f1" fillOpacity={1} fill="url(#colorRev)" strokeWidth={4} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          {activeTab === 'projects' && (
            <div className="bg-[#0F172A] rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] uppercase font-black tracking-widest text-slate-500 border-b border-white/5 bg-white/[0.01]">
                      <th className="px-10 py-6">Production Identity</th>
                      <th className="px-10 py-6 text-right">Budget</th>
                      <th className="px-10 py-6">Status</th>
                      <th className="px-10 py-6"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredProjects.map(p => (
                      <tr key={p.id} className="hover:bg-white/[0.02] group transition-all">
                        <td className="px-10 py-8">
                          <div className="text-sm font-bold text-white mb-1">{p.client}</div>
                          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">{p.event} • {p.date}</div>
                        </td>
                        <td className="px-10 py-8 text-right font-black text-white text-sm">${(Number(p.budget) || 0).toLocaleString()}</td>
                        <td className="px-10 py-8">
                          <span className={`text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider ${p.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
                            {p.status || 'Pending'}
                          </span>
                        </td>
                        <td className="px-10 py-8 text-right">
                          <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditingProject(p); setIsProjectModalOpen(true); }} className="p-3 bg-white/5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all"><Edit2 size={16}/></button>
                            <button onClick={async () => { if(confirm("Confirm Deletion?")) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', p.id)) }} className="p-3 bg-rose-500/5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all"><Trash2 size={16}/></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'expenses' && (
            <div className="bg-[#0F172A] rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] uppercase font-black tracking-widest text-slate-500 border-b border-white/5 bg-white/[0.01]">
                      <th className="px-10 py-6">Transaction</th>
                      <th className="px-10 py-6">Category</th>
                      <th className="px-10 py-6 text-right">Amount</th>
                      <th className="px-10 py-6"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredExpenses.map(e => (
                      <tr key={e.id} className="hover:bg-white/[0.02] group transition-all">
                        <td className="px-10 py-8">
                          <div className="text-sm font-bold text-white mb-1">{e.title}</div>
                          <div className="text-[10px] text-slate-500 uppercase font-black">{e.date}</div>
                        </td>
                        <td className="px-10 py-8">
                          <span className="text-[9px] uppercase font-black bg-white/5 px-3 py-1.5 rounded-lg text-slate-400 border border-white/5">{e.category}</span>
                        </td>
                        <td className="px-10 py-8 text-right font-black text-rose-400 text-sm">-${(Number(e.amount) || 0).toLocaleString()}</td>
                        <td className="px-10 py-8 text-right">
                          <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditingExpense(e); setIsExpenseModalOpen(true); }} className="p-3 bg-white/5 rounded-xl text-slate-400 hover:text-white transition-all"><Edit2 size={16}/></button>
                            <button onClick={async () => { if(confirm("Confirm Deletion?")) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'expenses', e.id)) }} className="p-3 bg-rose-500/5 rounded-xl text-slate-400 hover:text-rose-400 transition-all"><Trash2 size={16}/></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      {isProjectModalOpen && (
        <Modal title={editingProject ? "Update Production" : "New Production"} onClose={() => setIsProjectModalOpen(false)}>
          <form onSubmit={handleSaveProject} className="space-y-6">
            <FormInput label="Client Name" name="client" defaultValue={editingProject?.client} required placeholder="e.g. Paramount" />
            <FormInput label="Event Description" name="event" defaultValue={editingProject?.event} required placeholder="e.g. Brand Launch 2024" />
            <div className="grid grid-cols-2 gap-4">
              <FormInput label="Scheduled Date" name="date" type="date" defaultValue={editingProject?.date} />
              <FormInput label="Project Budget" name="budget" type="number" defaultValue={editingProject?.budget} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Current Status</label>
              <select name="status" defaultValue={editingProject?.status || 'Pending'} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white outline-none focus:border-indigo-500 transition-all">
                {STATUS_OPTIONS.map(s => <option key={s} value={s} className="bg-[#0F172A]">{s}</option>)}
              </select>
            </div>
            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-5 rounded-[1.5rem] uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-indigo-600/20 transition-all active:scale-95 mt-4">
              {editingProject ? 'Apply Changes' : 'Initialize Production'}
            </button>
          </form>
        </Modal>
      )}

      {isExpenseModalOpen && (
        <Modal title="Log Studio Expense" onClose={() => setIsExpenseModalOpen(false)}>
          <form onSubmit={handleSaveExpense} className="space-y-6">
            <FormInput label="Expense Description" name="title" defaultValue={editingExpense?.title} required placeholder="e.g. Camera Rental" />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Category</label>
                <select name="category" defaultValue={editingExpense?.category || 'Equipment'} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white outline-none focus:border-indigo-500 transition-all">
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c} className="bg-[#0F172A]">{c}</option>)}
                </select>
              </div>
              <FormInput label="Amount ($)" name="amount" type="number" defaultValue={editingExpense?.amount} required placeholder="0.00" />
            </div>
            <FormInput label="Date of Transaction" name="date" type="date" defaultValue={editingExpense?.date || new Date().toISOString().split('T')[0]} />
            <button type="submit" className="w-full bg-rose-600 hover:bg-rose-500 text-white font-black py-5 rounded-[1.5rem] uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-rose-600/20 transition-all active:scale-95 mt-4">
              Finalize Expense
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function NavItem({ icon, label, active, onClick }) {
  return (
    <button 
      onClick={onClick} 
      className={`flex md:w-full items-center gap-4 px-6 py-4 rounded-2xl text-[11px] font-black transition-all shrink-0 uppercase tracking-widest ${active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/20' : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'}`}
    >
      {icon} <span className="hidden md:inline">{label}</span>
    </button>
  );
}

function StatCard({ label, value, color, icon }) {
  const styles = { 
    indigo: 'border-indigo-500/20 text-indigo-400 bg-indigo-500/[0.02]', 
    rose: 'border-rose-500/20 text-rose-400 bg-rose-500/[0.02]', 
    emerald: 'border-emerald-500/20 text-emerald-400 bg-emerald-500/[0.02]' 
  };
  return (
    <div className={`p-8 rounded-[2.5rem] border ${styles[color]} relative overflow-hidden group`}>
      <div className="relative z-10 flex flex-col gap-4">
        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-[0.2em] opacity-60">
          {label}
          <div className="p-2 rounded-xl bg-white/5">{icon}</div>
        </div>
        <div className="text-3xl font-black text-white tracking-tighter">{value}</div>
      </div>
      <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
        {React.cloneElement(icon, { size: 100 })}
      </div>
    </div>
  );
}

function FormInput({ label, ...props }) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">{label}</label>
      <input {...props} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:border-indigo-500 focus:ring-4 ring-indigo-500/5 outline-none transition-all placeholder:text-slate-600" />
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-[#020617]/95 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-[#0F172A] border border-white/10 w-full max-w-xl rounded-[3rem] p-10 shadow-3xl relative animate-in fade-in zoom-in duration-300">
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-xl font-black text-white uppercase tracking-widest leading-none">{title}</h2>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-white transition-colors"><X size={24}/></button>
        </div>
        {children}
      </div>
    </div>
  );
}