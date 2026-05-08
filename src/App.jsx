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
  AlertCircle, Link2, HardDrive
} from 'lucide-react';

// --- Firebase Configuration & Initialization ---
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : null;

const appId = typeof __app_id !== 'undefined' ? __app_id : 'lumina-production-v3';

let db, auth;

if (firebaseConfig && firebaseConfig.apiKey) {
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
}

// --- Constants ---
const PROJECT_STATUSES = ['Not Started', 'Ongoing', 'Completed', 'Cancelled'];
const EXPENSE_TYPES = ['Equipment', 'Rentals', 'Travel', 'Software', 'Marketing', 'Office', 'Other'];

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
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
    if (!auth) {
      setAuthLoading(false);
      return;
    }

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

  // --- Real-time Sync (RULE 1 & 2) ---
  useEffect(() => {
    if (!user || !db) return;

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
    const form = e.target;
    const fd = new FormData(form);

    // Simple role parser for demonstration - "Name:Role:Cost, Name:Role:Cost"
    const teamInput = fd.get('teamMembers') || "";
    const team = teamInput.split(',').filter(x => x).map(entry => {
      const [name, role, cost] = entry.split(':');
      return { name: name?.trim(), role: role?.trim(), cost: Number(cost) || 0 };
    });

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

    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'projects'), payload);
    setIsAddingProject(false);
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'expenses'), {
      type: fd.get('type'),
      amount: Number(fd.get('amount')),
      date: fd.get('date'),
      reason: fd.get('reason'),
      createdAt: serverTimestamp()
    });
    setIsAddingExpense(false);
  };

  // --- Guard UI ---
  if (!firebaseConfig || !firebaseConfig.apiKey) {
    return (
      <div className="h-screen w-screen bg-[#0a0a0c] flex items-center justify-center p-10 text-center">
        <div className="max-w-md space-y-4">
          <AlertCircle size={48} className="text-rose-500 mx-auto" />
          <h1 className="text-xl font-bold text-white">Missing Configuration</h1>
          <p className="text-slate-500 text-sm">Please ensure your Firebase API key and App ID are correctly configured in the environment settings.</p>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="h-screen w-screen bg-[#0a0a0c] flex flex-col items-center justify-center">
        <Camera size={40} className="text-indigo-500 animate-pulse mb-4" />
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">Authenticating</p>
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
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Nav */}
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
          <div className="max-w-6xl mx-auto space-y-8">
            {activeTab === 'dashboard' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex justify-between items-end mb-8">
                  <div>
                    <h2 className="text-4xl font-black tracking-tight">Studio Performance</h2>
                    <p className="text-slate-500 mt-1">Real-time financial analytics for {new Date().getFullYear()}</p>
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
                  <div className="flex items-center gap-2 mb-8">
                    <TrendingUp size={20} className="text-indigo-500" />
                    <h3 className="font-bold text-lg">Yearly Financial Trend</h3>
                  </div>
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
                        <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={4} dot={{ r: 4 }} activeDot={{ r: 8 }} name="Revenue" />
                        <Line type="monotone" dataKey="owed" stroke="#f59e0b" strokeWidth={4} dot={{ r: 4 }} activeDot={{ r: 8 }} name="Owed" />
                        <Line type="monotone" dataKey="expenses" stroke="#f43f5e" strokeWidth={4} dot={{ r: 4 }} activeDot={{ r: 8 }} name="Expenses" />
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
                    <Plus size={18}/> Add Production
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
                        <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', p.id))} className="text-slate-800 hover:text-rose-500 transition-colors">
                          <Trash2 size={20} />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-6 mb-8 text-sm">
                        <div className="space-y-4">
                          <div className="flex items-center gap-3 text-slate-400">
                            <Calendar size={16} className="text-indigo-500" />
                            <span className="font-medium">{p.date}</span>
                          </div>
                          <div className="flex items-center gap-3 text-slate-400">
                            <MapPin size={16} className="text-indigo-500" />
                            <span className="font-medium truncate max-w-[150px]">{p.location}</span>
                          </div>
                          {p.mapsLink && (
                            <a href={p.mapsLink} target="_blank" rel="noreferrer" className="flex items-center gap-3 text-indigo-400 hover:underline">
                              <Link2 size={16} />
                              <span className="font-medium">Map Link</span>
                            </a>
                          )}
                        </div>
                        <div className="space-y-4">
                          <div className="flex items-center gap-3 text-slate-400">
                            <Clock size={16} className="text-indigo-500" />
                            <span className="font-medium">{p.duration}</span>
                          </div>
                          <div className="flex items-center gap-3 text-slate-400">
                            <Users size={16} className="text-indigo-500" />
                            <span className="font-medium">{p.team?.length || 0} Members</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-6 border-t border-white/5 flex justify-between items-center">
                        <div className="flex items-end gap-3">
                           <div>
                             <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Financial</p>
                             <p className="text-lg font-black">${p.amountPaid?.toLocaleString()} <span className="text-slate-600 text-sm font-medium">/ ${p.budget?.toLocaleString()}</span></p>
                           </div>
                        </div>
                        <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                          p.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {p.status}
                        </div>
                      </div>
                    </div>
                  ))}
                  {projects.length === 0 && (
                    <div className="col-span-full py-32 text-center bg-[#111114] border-2 border-dashed border-white/5 rounded-[3rem]">
                      <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                        <HardDrive className="text-slate-700" size={32} />
                      </div>
                      <p className="text-slate-600 font-bold uppercase tracking-widest text-xs">No productions logged</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'expenses' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-3xl font-black italic uppercase tracking-tighter">Financial Ledger</h2>
                  <button onClick={() => setIsAddingExpense(true)} className="bg-rose-600 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-rose-500 transition-all shadow-lg shadow-rose-500/20">
                    <Plus size={18}/> Log Expense
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
                          <td className="p-6 text-slate-300 text-sm">{e.reason}</td>
                          <td className="p-6 text-right text-rose-400 font-black text-lg">${Number(e.amount).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {expenses.length === 0 && (
                    <div className="p-20 text-center text-slate-600 font-bold uppercase tracking-widest text-xs">
                      No expense data recorded
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Project Modal */}
      {isAddingProject && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 z-[100]">
           <div className="bg-[#0d0d0f] border border-white/10 p-8 md:p-12 rounded-[3rem] w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200">
              <form onSubmit={handleAddProject} className="space-y-8">
                <div className="flex justify-between items-center">
                  <h3 className="text-3xl font-black italic tracking-tighter uppercase">Initiate Production</h3>
                  <button type="button" onClick={() => setIsAddingProject(false)} className="text-slate-500 hover:text-white"><X size={32}/></button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Client Details</label>
                      <div className="space-y-3">
                        <input name="clientName" placeholder="Client Name" className="w-full bg-[#111114] border border-white/5 p-4 rounded-2xl focus:border-indigo-500 outline-none" required />
                        <input name="eventType" placeholder="Event Type (e.g. Documentary Short)" className="w-full bg-[#111114] border border-white/5 p-4 rounded-2xl outline-none" required />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Event Date</label>
                        <input name="date" type="date" className="w-full bg-[#111114] border border-white/5 p-4 rounded-2xl outline-none text-slate-400" required />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Duration</label>
                        <input name="duration" placeholder="e.g. 8 Hours" className="w-full bg-[#111114] border border-white/5 p-4 rounded-2xl outline-none" required />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Location Info</label>
                      <div className="space-y-3">
                        <input name="location" placeholder="Shooting Location" className="w-full bg-[#111114] border border-white/5 p-4 rounded-2xl outline-none" />
                        <input name="mapsLink" placeholder="Google Maps Link" className="w-full bg-[#111114] border border-white/5 p-4 rounded-2xl outline-none" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Financials & Status</label>
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <input name="budget" type="number" placeholder="Total Budget ($)" className="w-full bg-[#111114] border border-white/5 p-4 rounded-2xl outline-none font-bold" required />
                        <input name="amountPaid" type="number" placeholder="Paid to Date ($)" className="w-full bg-[#111114] border border-white/5 p-4 rounded-2xl outline-none font-bold text-emerald-400" required />
                      </div>
                      <select name="status" className="w-full bg-[#111114] border border-white/5 p-4 rounded-2xl outline-none font-black text-xs uppercase tracking-widest appearance-none">
                        {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Team Deployment</label>
                      <textarea 
                        name="teamMembers" 
                        placeholder="Format: Name:Role:Cost, Name2:Role2:Cost2" 
                        className="w-full bg-[#111114] border border-white/5 p-4 rounded-2xl outline-none text-sm min-h-[120px]"
                      ></textarea>
                      <p className="text-[9px] text-slate-600 mt-2 leading-relaxed uppercase font-bold tracking-tighter">
                        Separate members with commas. Example: John Doe:Cinematographer:500, Jane Smith:Editor:300
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-8 border-t border-white/5 flex gap-4">
                  <button type="submit" className="flex-1 bg-indigo-600 py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-indigo-600/20 hover:bg-indigo-500 transition-all">Launch Production</button>
                </div>
              </form>
           </div>
        </div>
      )}

      {/* Expense Modal */}
      {isAddingExpense && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 z-[100]">
           <div className="bg-[#0d0d0f] border border-white/10 p-10 rounded-[3rem] w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
              <form onSubmit={handleAddExpense} className="space-y-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-2xl font-black italic tracking-tighter uppercase">Record Expense</h3>
                  <button type="button" onClick={() => setIsAddingExpense(false)} className="text-slate-500 hover:text-white"><X size={24}/></button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Category</label>
                    <select name="type" className="w-full bg-[#111114] border border-white/5 p-4 rounded-2xl outline-none font-bold text-slate-400">
                      {EXPENSE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Amount</label>
                    <input name="amount" type="number" placeholder="0.00" className="w-full bg-[#111114] border border-white/5 p-4 rounded-2xl outline-none font-black text-xl text-rose-400" required />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Date of Purchase</label>
                    <input name="date" type="date" className="w-full bg-[#111114] border border-white/5 p-4 rounded-2xl outline-none text-slate-400" required />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Notes / Reason</label>
                    <textarea name="reason" placeholder="Equipment rental for Project X..." className="w-full bg-[#111114] border border-white/5 p-4 rounded-2xl outline-none text-sm" rows="3"></textarea>
                  </div>
                </div>

                <div className="pt-6">
                  <button type="submit" className="w-full bg-rose-600 py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-rose-600/20 hover:bg-rose-500 transition-all">Submit Entry</button>
                </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}