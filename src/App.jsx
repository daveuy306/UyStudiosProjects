import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Edit2, Trash2, X, Film, CheckCircle2, 
  TrendingUp, Calendar, Sparkles, Loader2, LayoutDashboard,
  Briefcase, Receipt, ArrowDownCircle, AlertCircle
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

// --- CONFIGURATION LOGIC ---
const getSafeConfig = () => {
  try {
    if (typeof __firebase_config !== 'undefined' && __firebase_config) {
      return JSON.parse(__firebase_config);
    }
  } catch (e) {
    console.warn("External Firebase config not found, using Local Mode.");
  }
  return null;
};

const firebaseConfig = getSafeConfig();
const appId = typeof __app_id !== 'undefined' ? __app_id : 'uystudios-preview';

// Initialize Firebase only if config is available
let db = null;
let auth = null;

if (firebaseConfig) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
  } catch (e) {
    console.error("Firebase Init Failed", e);
  }
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
  const [isLocalMode, setIsLocalMode] = useState(!firebaseConfig);
  
  // Modals
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);

  // 1. Authentication Layer
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) {
        console.error("Auth Failure", e);
        setIsLocalMode(true);
      }
    };

    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Data Sync Layer
  useEffect(() => {
    // If we have Firebase and a User, sync with Cloud
    if (user && db && !isLocalMode) {
      const projPath = ['artifacts', appId, 'public', 'data', 'projects'];
      const expPath = ['artifacts', appId, 'public', 'data', 'expenses'];

      const unsubP = onSnapshot(collection(db, ...projPath), (s) => {
        setProjects(s.docs.map(d => ({ ...d.data(), id: d.id })));
      }, (e) => console.error("Sync Error", e));

      const unsubE = onSnapshot(collection(db, ...expPath), (s) => {
        setExpenses(s.docs.map(d => ({ ...d.data(), id: d.id })));
        setLoading(false);
      }, (e) => setLoading(false));

      return () => { unsubP(); unsubE(); };
    } 
    
    // Fallback: Local Persistence (localStorage) for external viewing
    if (isLocalMode) {
      const lp = localStorage.getItem('uy_projects');
      const le = localStorage.getItem('uy_expenses');
      if (lp) setProjects(JSON.parse(lp));
      if (le) setExpenses(JSON.parse(le));
      setLoading(false);
    }
  }, [user, isLocalMode]);

  // Save changes locally if in Local Mode
  useEffect(() => {
    if (isLocalMode) {
      localStorage.setItem('uy_projects', JSON.stringify(projects));
      localStorage.setItem('uy_expenses', JSON.stringify(expenses));
    }
  }, [projects, expenses, isLocalMode]);

  // --- Handlers ---
  const handleSaveProject = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      client: fd.get('client'),
      event: fd.get('event'),
      date: fd.get('date'),
      budget: Number(fd.get('budget')),
      status: fd.get('status'),
      updatedAt: new Date().toISOString()
    };

    if (!isLocalMode && db && user) {
      const path = ['artifacts', appId, 'public', 'data', 'projects'];
      if (editingProject) await updateDoc(doc(db, ...path, editingProject.id), data);
      else await addDoc(collection(db, ...path), { ...data, createdAt: new Date().toISOString() });
    } else {
      // Local Mode Handler
      if (editingProject) {
        setProjects(prev => prev.map(p => p.id === editingProject.id ? { ...p, ...data } : p));
      } else {
        setProjects(prev => [...prev, { ...data, id: Date.now().toString(), createdAt: new Date().toISOString() }]);
      }
    }
    setIsProjectModalOpen(false);
    setEditingProject(null);
  };

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      title: fd.get('title'),
      category: fd.get('category'),
      amount: Number(fd.get('amount')),
      date: fd.get('date'),
      updatedAt: new Date().toISOString()
    };

    if (!isLocalMode && db && user) {
      const path = ['artifacts', appId, 'public', 'data', 'expenses'];
      if (editingExpense) await updateDoc(doc(db, ...path, editingExpense.id), data);
      else await addDoc(collection(db, ...path), { ...data, createdAt: new Date().toISOString() });
    } else {
      if (editingExpense) {
        setExpenses(prev => prev.map(exp => exp.id === editingExpense.id ? { ...exp, ...data } : exp));
      } else {
        setExpenses(prev => [...prev, { ...data, id: Date.now().toString(), createdAt: new Date().toISOString() }]);
      }
    }
    setIsExpenseModalOpen(false);
    setEditingExpense(null);
  };

  const deleteItem = async (id, type) => {
    if (!confirm("Are you sure you want to delete this record?")) return;
    if (!isLocalMode && db && user) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', type, id));
    } else {
      if (type === 'projects') setProjects(prev => prev.filter(p => p.id !== id));
      else setExpenses(prev => prev.filter(e => e.id !== id));
    }
  };

  // Calculations
  const stats = useMemo(() => {
    const revenue = projects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
    const cost = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    return { revenue, cost, profit: revenue - cost };
  }, [projects, expenses]);

  const filteredProjects = projects.filter(p => 
    p.client?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.event?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 flex flex-col md:flex-row font-sans">
      {/* Sidebar */}
      <aside className="w-full md:w-72 bg-[#0F172A] border-b md:border-r border-white/5 flex flex-col md:h-screen sticky top-0 z-[60]">
        <div className="p-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
              <Film size={24} />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tighter uppercase text-white leading-none">UY Studios</h1>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Database v2.1</span>
            </div>
          </div>
        </div>
        
        <nav className="flex md:flex-col px-4 pb-6 md:space-y-2 overflow-x-auto no-scrollbar">
          <NavItem icon={<LayoutDashboard size={20}/>} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={<Briefcase size={20}/>} label="Productions" active={activeTab === 'projects'} onClick={() => setActiveTab('projects')} />
          <NavItem icon={<Receipt size={20}/>} label="Expenses" active={activeTab === 'expenses'} onClick={() => setActiveTab('expenses')} />
        </nav>

        {isLocalMode && (
          <div className="mt-auto p-6">
            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex gap-3 items-start">
              <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <div className="text-[10px] text-amber-200/70 leading-relaxed font-medium">
                <strong className="text-amber-400 block mb-1">LOCAL MODE</strong>
                Cloud sync is disabled. Data is saved to your browser cache.
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-24 px-6 md:px-10 flex items-center justify-between bg-[#020617]/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50">
          <div className="relative w-full max-w-md hidden lg:block">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
              type="text" 
              placeholder="Search productions or expenses..." 
              className="bg-white/5 border border-white/10 rounded-2xl px-12 py-3.5 text-sm w-full outline-none focus:border-indigo-500/50 transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          
          <button 
             onClick={() => { activeTab === 'expenses' ? setIsExpenseModalOpen(true) : setIsProjectModalOpen(true); }} 
             className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3.5 rounded-2xl text-[10px] font-black flex items-center gap-2 uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-indigo-600/20"
           >
             <Plus size={18} /> <span>Create New</span>
          </button>
        </header>

        <main className="p-6 md:p-10 space-y-8">
          {activeTab === 'dashboard' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <StatCard label="Total Revenue" value={`$${stats.revenue.toLocaleString()}`} color="indigo" icon={<TrendingUp size={20}/>} />
                <StatCard label="Expenses" value={`$${stats.cost.toLocaleString()}`} color="rose" icon={<ArrowDownCircle size={20}/>} />
                <StatCard label="Profit Margin" value={`$${stats.profit.toLocaleString()}`} color="emerald" icon={<CheckCircle2 size={20}/>} />
              </div>

              <div className="bg-[#0F172A] p-8 rounded-[2.5rem] border border-white/5">
                <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] mb-8">Production Overview</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {projects.slice(0, 4).map(p => (
                    <div key={p.id} className="p-6 rounded-3xl bg-white/[0.02] border border-white/5">
                      <div className="text-[9px] font-black uppercase text-indigo-400 mb-2">{p.status}</div>
                      <div className="text-sm font-bold text-white truncate mb-1">{p.client}</div>
                      <div className="text-[10px] text-slate-500">{p.event}</div>
                    </div>
                  ))}
                  {projects.length === 0 && (
                    <div className="col-span-full py-12 text-center text-slate-500 text-xs italic">No active productions logged.</div>
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === 'projects' && (
            <div className="bg-[#0F172A] rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] uppercase font-black tracking-widest text-slate-500 border-b border-white/5">
                    <th className="px-10 py-6">Production</th>
                    <th className="px-10 py-6">Budget</th>
                    <th className="px-10 py-6">Status</th>
                    <th className="px-10 py-6"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredProjects.map(p => (
                    <tr key={p.id} className="hover:bg-white/[0.02] group transition-all">
                      <td className="px-10 py-8">
                        <div className="text-sm font-bold text-white mb-1">{p.client}</div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase">{p.event} • {p.date}</div>
                      </td>
                      <td className="px-10 py-8 font-black text-white text-sm">${(p.budget || 0).toLocaleString()}</td>
                      <td className="px-10 py-8">
                        <span className={`text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider ${p.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
                          {p.status || 'Pending'}
                        </span>
                      </td>
                      <td className="px-10 py-8 text-right">
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => { setEditingProject(p); setIsProjectModalOpen(true); }} className="p-2 text-slate-400 hover:text-white transition-all"><Edit2 size={16}/></button>
                          <button onClick={() => deleteItem(p.id, 'projects')} className="p-2 text-slate-400 hover:text-rose-400 transition-all"><Trash2 size={16}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'expenses' && (
             <div className="bg-[#0F172A] rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] uppercase font-black tracking-widest text-slate-500 border-b border-white/5">
                      <th className="px-10 py-6">Item</th>
                      <th className="px-10 py-6">Category</th>
                      <th className="px-10 py-6 text-right">Amount</th>
                      <th className="px-10 py-6"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {expenses.map(e => (
                      <tr key={e.id} className="hover:bg-white/[0.02] group transition-all">
                        <td className="px-10 py-8 text-sm font-bold text-white">{e.title} <span className="block text-[10px] text-slate-500 font-normal uppercase mt-1">{e.date}</span></td>
                        <td className="px-10 py-8"><span className="text-[9px] uppercase font-black bg-white/5 px-2 py-1 rounded-md text-slate-400 border border-white/5">{e.category}</span></td>
                        <td className="px-10 py-8 text-right font-black text-rose-400 text-sm">-${(e.amount || 0).toLocaleString()}</td>
                        <td className="px-10 py-8 text-right">
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => { setEditingExpense(e); setIsExpenseModalOpen(true); }} className="p-2 text-slate-400 hover:text-white transition-all"><Edit2 size={16}/></button>
                            <button onClick={() => deleteItem(e.id, 'expenses')} className="p-2 text-slate-400 hover:text-rose-400 transition-all"><Trash2 size={16}/></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
          )}
        </main>
      </div>

      {/* Project Modal */}
      {isProjectModalOpen && (
        <Modal title={editingProject ? "Edit Production" : "New Production"} onClose={() => { setIsProjectModalOpen(false); setEditingProject(null); }}>
          <form onSubmit={handleSaveProject} className="space-y-6">
            <FormInput label="Client" name="client" defaultValue={editingProject?.client} required />
            <FormInput label="Event Title" name="event" defaultValue={editingProject?.event} required />
            <div className="grid grid-cols-2 gap-4">
              <FormInput label="Date" name="date" type="date" defaultValue={editingProject?.date} />
              <FormInput label="Budget" name="budget" type="number" defaultValue={editingProject?.budget} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Status</label>
              <select name="status" defaultValue={editingProject?.status || 'Pending'} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white outline-none">
                {STATUS_OPTIONS.map(s => <option key={s} value={s} className="bg-[#0F172A]">{s}</option>)}
              </select>
            </div>
            <button type="submit" className="w-full bg-indigo-600 py-5 rounded-2xl font-black uppercase tracking-widest text-[10px]">Save Record</button>
          </form>
        </Modal>
      )}

      {/* Expense Modal */}
      {isExpenseModalOpen && (
        <Modal title="Log Expense" onClose={() => { setIsExpenseModalOpen(false); setEditingExpense(null); }}>
          <form onSubmit={handleSaveExpense} className="space-y-6">
            <FormInput label="Item Name" name="title" defaultValue={editingExpense?.title} required />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Category</label>
                <select name="category" defaultValue={editingExpense?.category || 'Equipment'} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white outline-none">
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c} className="bg-[#0F172A]">{c}</option>)}
                </select>
              </div>
              <FormInput label="Amount ($)" name="amount" type="number" defaultValue={editingExpense?.amount} required />
            </div>
            <FormInput label="Transaction Date" name="date" type="date" defaultValue={editingExpense?.date || new Date().toISOString().split('T')[0]} />
            <button type="submit" className="w-full bg-rose-600 py-5 rounded-2xl font-black uppercase tracking-widest text-[10px]">Log Expense</button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function NavItem({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className={`flex md:w-full items-center gap-4 px-6 py-4 rounded-2xl text-[11px] font-black transition-all shrink-0 uppercase tracking-widest ${active ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-white/5'}`}>
      {icon} <span className="hidden md:inline">{label}</span>
    </button>
  );
}

function StatCard({ label, value, color, icon }) {
  const c = { indigo: 'text-indigo-400', rose: 'text-rose-400', emerald: 'text-emerald-400' };
  return (
    <div className="bg-[#0F172A] p-8 rounded-[2.5rem] border border-white/5">
      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">
        {label} {icon}
      </div>
      <div className={`text-3xl font-black ${c[color]} tracking-tighter`}>{value}</div>
    </div>
  );
}

function FormInput({ label, ...props }) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">{label}</label>
      <input {...props} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white outline-none focus:border-indigo-500" />
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-[#020617]/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-[#0F172A] border border-white/10 w-full max-w-xl rounded-[3rem] p-10 shadow-3xl">
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-xl font-black text-white uppercase tracking-widest">{title}</h2>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-white"><X size={24}/></button>
        </div>
        {children}
      </div>
    </div>
  );
}