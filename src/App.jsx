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
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { 
  LayoutDashboard, Briefcase, Receipt, Plus, Users, MapPin, 
  ChevronLeft, ChevronRight, Menu, X, DollarSign, Calendar,
  ExternalLink, Trash2, Camera, Clock, UserPlus, TrendingUp, 
  AlertCircle, Link2, HardDrive, Info, CheckCircle2
} from 'lucide-react';

// --- Firebase Configuration & Initialization ---
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : null;

const appId = typeof __app_id !== 'undefined' ? __app_id : 'lumina-production-v3';

let db, auth;
const isConfigValid = firebaseConfig && firebaseConfig.apiKey;

if (isConfigValid) {
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
}

// --- Constants ---
const PROJECT_STATUSES = ['Not Started', 'Ongoing', 'Completed', 'Cancelled'];
const EXPENSE_TYPES = ['Equipment', 'Rentals', 'Travel', 'Software', 'Marketing', 'Office', 'Other'];

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(isConfigValid ? true : false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Data State
  const [projects, setProjects] = useState([]);
  const [expenses, setExpenses] = useState([]);
  
  // Modal State
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [isAddingExpense, setIsAddingExpense] = useState(false);

  // --- Auth Flow (RULE 3) ---
  useEffect(() => {
    if (!isConfigValid || !auth) return;

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

  // --- Real-time Sync or Demo Mode ---
  useEffect(() => {
    if (!isConfigValid || !user || !db) {
      // Mock data for demo mode if no config
      if (!isConfigValid) {
        setProjects([
          { id: '1', clientName: 'Vogue Magazine', eventType: 'Fashion Shoot', budget: 5000, amountPaid: 2500, date: '2026-05-07', status: 'Ongoing', location: 'New York Studio', duration: '8 Hours' },
          { id: '2', clientName: 'TechCorp', eventType: 'Corporate Video', budget: 12000, amountPaid: 12000, date: '2026-04-12', status: 'Completed', location: 'Silicon Valley', duration: '3 Days' }
        ]);
        setExpenses([
          { id: 'e1', type: 'Equipment', amount: 1200, date: '2026-05-01', reason: 'Lens Rental - 85mm f1.2' }
        ]);
      }
      return;
    }

    const pRef = collection(db, 'artifacts', appId, 'public', 'data', 'projects');
    const eRef = collection(db, 'artifacts', appId, 'public', 'data', 'expenses');

    const unsubP = onSnapshot(pRef, (s) => {
      setProjects(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (e) => console.error("Project Sync Error:", e));

    const unsubE = onSnapshot(eRef, (s) => {
      setExpenses(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (e) => console.error("Expense Sync Error:", e));

    return () => { unsubP(); unsubE(); };
  }, [user]);

  // --- Financial Logic ---
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
      const cost = mExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

      return { 
        name: month, 
        revenue, 
        owed: Math.max(0, budget - revenue), 
        expenses: cost 
      };
    });
  }, [projects, expenses]);

  // --- Handlers ---
  const handleAddProject = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
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
      updatedAt: serverTimestamp()
    };

    if (isConfigValid && db) {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'projects'), payload);
    } else {
      setProjects([...projects, { id: Date.now().toString(), ...payload }]);
    }
    setIsAddingProject(false);
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      type: fd.get('type'),
      amount: Number(fd.get('amount')),
      date: fd.get('date'),
      reason: fd.get('reason'),
      createdAt: serverTimestamp()
    };

    if (isConfigValid && db) {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'expenses'), payload);
    } else {
      setExpenses([...expenses, { id: Date.now().toString(), ...payload }]);
    }
    setIsAddingExpense(false);
  };

  const handleDeleteProject = async (id) => {
    if (isConfigValid && db) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', id));
    } else {
      setProjects(projects.filter(p => p.id !== id));
    }
  };

  if (authLoading) {
    return (
      <div className="h-screen w-screen bg-[#0a0a0c] flex flex-col items-center justify-center">
        <Camera size={40} className="text-indigo-500 animate-pulse mb-4" />
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">Syncing Studio Data</p>
      </div>
    );
  }

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
    <div className="flex h-screen bg-[#0a0a0c] text-slate-100 overflow-hidden font-sans">
      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex flex-col border-r border-white/5 bg-[#0d0d0f] transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
        <div className="p-6 flex items-center justify-between mb-4">
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <Camera size={18} className="text-white" />
              </div>
              <h1 className="text-lg font-black tracking-tighter uppercase italic">Lumina</h1>
            </div>
          )}
          <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="p-2 hover:bg-white/5 rounded-lg text-slate-500">
            {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          <NavItem id="dashboard" icon={LayoutDashboard} label="Pulse Dashboard" />
          <NavItem id="projects" icon={Briefcase} label="Productions" />
          <NavItem id="expenses" icon={Receipt} label="Ledger" />
        </nav>
        
        <div className="p-4">
           <div className={`p-3 rounded-xl border border-white/5 bg-white/5 ${isSidebarCollapsed ? 'flex justify-center' : ''}`}>
              {isConfigValid ? (
                <div className="flex items-center gap-2 text-emerald-500">
                   <CheckCircle2 size={16} />
                   {!isSidebarCollapsed && <span className="text-[10px] font-black uppercase tracking-wider">Cloud Sync On</span>}
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

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-6 h-16 bg-[#0d0d0f] border-b border-white/5">
          <div className="flex items-center gap-2">
            <Camera size={20} className="text-indigo-500" />
            <h1 className="font-black text-sm tracking-tighter uppercase italic">LUMINA</h1>
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
          {!isConfigValid && activeTab === 'dashboard' && (
            <div className="mb-6 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center gap-3 text-indigo-400 text-sm">
              <Info size={18} />
              <span>Running in <b>Demo Mode</b>. Authenticate to enable cross-platform syncing.</span>
            </div>
          )}

          <div className="max-w-6xl mx-auto space-y-8">
            {activeTab === 'dashboard' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex justify-between items-end mb-8">
                  <div>
                    <h2 className="text-4xl font-black tracking-tight">Studio Performance</h2>
                    <p className="text-slate-500 mt-1">Real-time metrics for {new Date().getFullYear()}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
                  {[
                    { label: 'Revenue (Paid)', val: chartData.reduce((a, b) => a + b.revenue, 0), color: 'text-emerald-400' },
                    { label: 'Accounts Receivable', val: chartData.reduce((a, b) => a + b.owed, 0), color: 'text-amber-400' },
                    { label: 'Total Overhead', val: chartData.reduce((a, b) => a + b.expenses, 0), color: 'text-rose-400' }
                  ].map((stat, i) => (
                    <div key={i} className="bg-[#111114] border border-white/5 p-8 rounded-3xl group hover:border-indigo-500/30 transition-all">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{stat.label}</p>
                      <p className={`text-3xl font-black ${stat.color}`}>${stat.val.toLocaleString()}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-[#111114] border border-white/5 p-8 rounded-[2rem] shadow-xl">
                  <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="name" stroke="#475569" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#475569" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0d0d0f', border: '1px solid #1e293b', borderRadius: '16px', padding: '12px' }}
                          itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={4} dot={{ r: 4 }} name="Revenue" />
                        <Line type="monotone" dataKey="owed" stroke="#f59e0b" strokeWidth={4} dot={{ r: 4 }} name="Owed" />
                        <Line type="monotone" dataKey="expenses" stroke="#f43f5e" strokeWidth={4} dot={{ r: 4 }} name="Expenses" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'projects' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-3xl font-black italic uppercase tracking-tighter">Productions</h2>
                  <button onClick={() => setIsAddingProject(true)} className="bg-indigo-600 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20">
                    <Plus size={18}/> New Project
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {projects.map(p => (
                    <div key={p.id} className="bg-[#111114] border border-white/5 p-8 rounded-[2rem] hover:border-white/10 transition-all relative overflow-hidden group">
                      <div className={`absolute top-0 right-0 w-1.5 h-full ${
                        p.status === 'Completed' ? 'bg-emerald-500' : p.status === 'Ongoing' ? 'bg-indigo-500' : 'bg-slate-700'
                      }`} />
                      
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">{p.eventType}</span>
                          <h4 className="text-2xl font-black">{p.clientName}</h4>
                        </div>
                        <button onClick={() => handleDeleteProject(p.id)} className="text-slate-800 hover:text-rose-500 transition-colors p-2">
                          <Trash2 size={20} />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-6 mb-8 text-sm">
                        <div className="space-y-4">
                          <div className="flex items-center gap-3 text-slate-400 font-bold italic">
                            <Calendar size={16} className="text-indigo-500" />
                            <span>{p.date}</span>
                          </div>
                          <div className="flex items-center gap-3 text-slate-400">
                            <MapPin size={16} className="text-indigo-500" />
                            <span className="truncate">{p.location}</span>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div className="flex items-center gap-3 text-slate-400 font-black">
                            <DollarSign size={16} className="text-emerald-500" />
                            <span>${p.budget?.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-6 border-t border-white/5 flex justify-between items-center">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                           Paid: <span className="text-emerald-400">${p.amountPaid?.toLocaleString()}</span>
                        </div>
                        <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                          p.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {p.status}
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
                  <h2 className="text-3xl font-black italic uppercase tracking-tighter">Financial Ledger</h2>
                  <button onClick={() => setIsAddingExpense(true)} className="bg-rose-600 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-rose-500 transition-all shadow-lg shadow-rose-500/20">
                    <Plus size={18}/> Add Expense
                  </button>
                </div>

                <div className="bg-[#111114] border border-white/5 rounded-[2rem] overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-white/5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-white/5">
                        <th className="p-6">Date</th>
                        <th className="p-6">Category</th>
                        <th className="p-6">Details</th>
                        <th className="p-6 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {expenses.map(e => (
                        <tr key={e.id} className="hover:bg-white/5 transition-colors">
                          <td className="p-6 text-slate-500 text-sm font-bold">{e.date}</td>
                          <td className="p-6"><span className="bg-indigo-500/10 text-indigo-400 text-[10px] font-black uppercase px-3 py-1 rounded-lg">{e.type}</span></td>
                          <td className="p-6 text-slate-300 text-sm italic">{e.reason}</td>
                          <td className="p-6 text-right text-rose-400 font-black text-lg">${Number(e.amount).toLocaleString()}</td>
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

      {/* Expense Modal (Matches screenshot design) */}
      {isAddingExpense && (
        <div className="fixed inset-0 bg-[#0a0a0c]/90 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
           <div className="bg-[#11141d] border border-white/5 p-8 md:p-10 rounded-[2.5rem] w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
              <form onSubmit={handleAddExpense} className="space-y-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-3xl font-black text-rose-500 tracking-tight">Add Expense</h3>
                  <button type="button" onClick={() => setIsAddingExpense(false)} className="text-slate-500 hover:text-white transition-colors">
                    <X size={28}/>
                  </button>
                </div>
                
                <div className="space-y-5">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1 mb-2 block">Category</label>
                    <select name="type" className="w-full bg-[#0a0c14] border border-white/5 p-4 rounded-xl outline-none font-bold text-slate-300 focus:border-indigo-500/50 appearance-none">
                      {EXPENSE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1 mb-2 block">Amount ($)</label>
                    <input name="amount" type="number" placeholder="0" className="w-full bg-[#0a0c14] border border-white/5 p-4 rounded-xl outline-none font-black text-rose-400 text-lg" required />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1 mb-2 block">Date</label>
                    <input name="date" type="date" className="w-full bg-[#0a0c14] border border-white/5 p-4 rounded-xl outline-none text-slate-300" defaultValue={new Date().toISOString().split('T')[0]} required />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1 mb-2 block">Reason / Notes</label>
                    <textarea name="reason" placeholder="Details..." className="w-full bg-[#0a0c14] border border-white/5 p-4 rounded-xl outline-none text-slate-300 text-sm min-h-[100px] resize-none" required></textarea>
                  </div>
                </div>

                <div className="pt-4">
                  <button type="submit" className="w-full bg-rose-500 py-5 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-rose-500/20 hover:bg-rose-600 active:scale-95 transition-all">
                    Record Transaction
                  </button>
                </div>
              </form>
           </div>
        </div>
      )}

      {/* Project Modal */}
      {isAddingProject && (
        <div className="fixed inset-0 bg-[#0a0a0c]/90 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
           <div className="bg-[#11141d] border border-white/5 p-8 md:p-12 rounded-[3rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
              <form onSubmit={handleAddProject} className="space-y-8">
                <div className="flex justify-between items-center">
                  <h3 className="text-3xl font-black text-indigo-500 tracking-tight">New Production</h3>
                  <button type="button" onClick={() => setIsAddingProject(false)} className="text-slate-500 hover:text-white"><X size={32}/></button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <input name="clientName" placeholder="Client Name" className="bg-[#0a0c14] border border-white/5 p-4 rounded-xl outline-none" required />
                  <input name="eventType" placeholder="Event Type" className="bg-[#0a0c14] border border-white/5 p-4 rounded-xl outline-none" required />
                  <input name="date" type="date" className="bg-[#0a0c14] border border-white/5 p-4 rounded-xl outline-none" required />
                  <input name="duration" placeholder="Duration" className="bg-[#0a0c14] border border-white/5 p-4 rounded-xl outline-none" />
                  <input name="budget" type="number" placeholder="Budget" className="bg-[#0a0c14] border border-white/5 p-4 rounded-xl outline-none" required />
                  <input name="amountPaid" type="number" placeholder="Paid" className="bg-[#0a0c14] border border-white/5 p-4 rounded-xl outline-none" required />
                  <input name="location" placeholder="Location" className="col-span-full bg-[#0a0c14] border border-white/5 p-4 rounded-xl outline-none" />
                  <select name="status" className="col-span-full bg-[#0a0c14] border border-white/5 p-4 rounded-xl outline-none font-bold text-slate-400">
                    {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <button type="submit" className="w-full bg-indigo-600 py-5 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-indigo-700 transition-all">
                  Create Production
                </button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}