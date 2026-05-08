import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, 
  onSnapshot, query, setDoc, getDoc, serverTimestamp 
} from 'firebase/firestore';
import { 
  getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  LayoutDashboard, Camera, Film, Users, Receipt, 
  Plus, Trash2, Edit3, ChevronLeft, ChevronRight, 
  MapPin, Calendar, DollarSign, Clock, CheckCircle2, 
  AlertCircle, TrendingUp, MoreVertical, X, Menu, Search
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

/**
 * UY STUDIOS NEXUS - PROFESSIONAL CRM & TRACKER
 * * CORE ARCHITECTURE:
 * - SAFE-BOOT: Handles missing __firebase_config gracefully.
 * - RULE 1: Uses /artifacts/{id}/public/data/ for cross-device sync.
 * - RULE 3: Strict Auth -> Firestore sequence.
 * - RESPONSIVE: Tailwind-first layout for mobile/desktop.
 */

const APP_ID = typeof __app_id !== 'undefined' ? __app_id : 'uy-studios-nexus-001';

export default function App() {
  // --- Auth & Connection ---
  const [user, setUser] = useState(null);
  const [db, setDb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

  // --- Data States ---
  const [projects, setProjects] = useState([]);
  const [expenses, setExpenses] = useState([]);
  
  // --- UI States ---
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // 1. SAFE BOOT & AUTH (Rule 3)
  useEffect(() => {
    const initApp = async () => {
      try {
        const configStr = window['__firebase_config'];
        if (!configStr) {
          console.error("Environment variables not ready.");
          setLoading(false);
          return;
        }

        const firebaseConfig = JSON.parse(configStr);
        const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
        const auth = getAuth(app);
        const firestoreDb = getFirestore(app);
        setDb(firestoreDb);

        const token = window['__initial_auth_token'];
        if (token) {
          await signInWithCustomToken(auth, token).catch(() => signInAnonymously(auth));
        } else {
          await signInAnonymously(auth);
        }

        onAuthStateChanged(auth, (u) => {
          setUser(u);
          setLoading(false);
        });
      } catch (err) {
        console.error("Initialization Failed:", err);
        setLoading(false);
      }
    };
    initApp();
  }, []);

  // 2. DATA SYNC (Rule 1 & 2)
  useEffect(() => {
    if (!user || !db) return;

    const pRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'projects');
    const eRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'expenses');

    const unsubP = onSnapshot(pRef, (snap) => {
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Project Sync Error:", err));

    const unsubE = onSnapshot(eRef, (snap) => {
      setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Expense Sync Error:", err));

    return () => { unsubP(); unsubE(); };
  }, [user, db]);

  // --- Calculations ---
  const stats = useMemo(() => {
    const totalRevenue = projects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
    const totalPaid = projects.reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const totalOwed = totalRevenue - totalPaid;
    
    // Generate Monthly Data (Last 12 Months)
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const chartData = months.map(m => {
      const monthProjects = projects.filter(p => p.eventDate && p.eventDate.includes(`-${months.indexOf(m) + 1 < 10 ? '0' : ''}${months.indexOf(m) + 1}-`));
      const monthExpenses = expenses.filter(e => e.date && e.date.includes(`-${months.indexOf(m) + 1 < 10 ? '0' : ''}${months.indexOf(m) + 1}-`));
      
      const rev = monthProjects.reduce((s, p) => s + (Number(p.budget) || 0), 0);
      const paid = monthProjects.reduce((s, p) => s + (Number(p.amountPaid) || 0), 0);
      const exp = monthExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
      
      return { name: m, revenue: rev, owed: rev - paid, expenses: exp };
    });

    return { totalRevenue, totalPaid, totalExpenses, totalOwed, chartData };
  }, [projects, expenses]);

  // --- Handlers ---
  const saveProject = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      clientName: fd.get('clientName'),
      eventType: fd.get('eventType'),
      duration: fd.get('duration'),
      location: fd.get('location'),
      mapsLink: fd.get('mapsLink'),
      budget: Number(fd.get('budget')),
      amountPaid: Number(fd.get('amountPaid')),
      eventDate: fd.get('eventDate'),
      status: fd.get('status'),
      team: JSON.parse(fd.get('team') || '[]'),
      updatedAt: serverTimestamp()
    };

    if (editingItem) {
      await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'projects', editingItem.id), data);
    } else {
      await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'projects'), { ...data, createdAt: serverTimestamp() });
    }
    setIsProjectModalOpen(false);
    setEditingItem(null);
  };

  const saveExpense = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      type: fd.get('type'),
      amount: Number(fd.get('amount')),
      date: fd.get('date'),
      notes: fd.get('notes'),
      createdAt: serverTimestamp()
    };
    await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'expenses'), data);
    setIsExpenseModalOpen(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-[10px] font-black uppercase tracking-[0.4em] animate-pulse">Syncing Nexus...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-gray-400 font-sans selection:bg-indigo-500/30">
      
      {/* Mobile Nav Toggle */}
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="fixed bottom-6 right-6 z-50 p-4 bg-white text-black rounded-full shadow-2xl md:hidden"
      >
        <Menu size={24} />
      </button>

      {/* SIDEBAR */}
      <aside className={`fixed top-0 left-0 h-full bg-[#0a0a0a] border-r border-white/5 transition-all duration-300 z-40 ${isSidebarOpen ? 'w-64' : 'w-0 -translate-x-full md:translate-x-0 md:w-20'}`}>
        <div className="p-6 h-full flex flex-col overflow-hidden">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shrink-0">
              <Camera className="text-black" size={18} />
            </div>
            {isSidebarOpen && <span className="text-white font-black italic tracking-tighter text-xl">UY STUDIOS</span>}
          </div>

          <nav className="flex-1 space-y-2">
            <NavBtn active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={20}/>} label="Dashboard" showLabel={isSidebarOpen} />
            <NavBtn active={activeTab === 'projects'} onClick={() => setActiveTab('projects')} icon={<Film size={20}/>} label="Projects" showLabel={isSidebarOpen} />
            <NavBtn active={activeTab === 'expenses'} onClick={() => setActiveTab('expenses')} icon={<Receipt size={20}/>} label="Expenses" showLabel={isSidebarOpen} />
          </nav>

          <div className="pt-6 border-t border-white/5">
             <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 shrink-0" />
               {isSidebarOpen && (
                 <div className="truncate">
                   <p className="text-xs font-bold text-white truncate">{user?.uid?.slice(0,8)}</p>
                   <p className="text-[8px] font-black uppercase text-gray-600">Pro Member</p>
                 </div>
               )}
             </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className={`transition-all duration-300 ${isSidebarOpen ? 'md:ml-64' : 'md:ml-20'} p-4 md:p-8`}>
        
        {activeTab === 'dashboard' && (
          <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-black text-white tracking-tight">Overview.</h1>
                <p className="text-xs text-gray-500 font-medium mt-1">Financial performance for current fiscal year</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setIsProjectModalOpen(true)} className="px-4 py-2 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center gap-2">
                  <Plus size={14} /> New Project
                </button>
              </div>
            </header>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard label="Total Revenue" value={stats.totalRevenue} color="text-white" />
              <StatCard label="Amount Paid" value={stats.totalPaid} color="text-emerald-500" />
              <StatCard label="Outstanding" value={stats.totalOwed} color="text-amber-500" />
              <StatCard label="Expenses" value={stats.totalExpenses} color="text-rose-500" />
            </div>

            {/* Trend Chart */}
            <div className="bg-[#0a0a0a] border border-white/5 p-6 rounded-[32px]">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">Monthly Trends</h3>
                <div className="flex gap-4 text-[8px] font-black uppercase tracking-widest">
                  <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-500" /> Revenue</div>
                  <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500" /> Expenses</div>
                </div>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.chartData}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#444', fontSize: 10}} />
                    <YAxis hide />
                    <Tooltip contentStyle={{backgroundColor: '#111', border: 'none', borderRadius: '12px', fontSize: '10px'}} itemStyle={{fontWeight: '900'}} />
                    <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                    <Area type="monotone" dataKey="expenses" stroke="#f43f5e" strokeWidth={3} fillOpacity={0} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               {/* Recent Projects */}
               <section className="bg-[#0a0a0a] border border-white/5 rounded-[32px] overflow-hidden">
                  <div className="p-6 border-b border-white/5 flex justify-between items-center">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">Recent Productions</h3>
                  </div>
                  <div className="divide-y divide-white/5">
                    {projects.slice(0, 5).map(p => (
                      <div key={p.id} className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={`w-2 h-2 rounded-full ${p.status === 'completed' ? 'bg-emerald-500' : 'bg-indigo-500 animate-pulse'}`} />
                          <div>
                            <p className="text-sm font-bold text-white">{p.clientName}</p>
                            <p className="text-[10px] font-medium text-gray-600 uppercase tracking-tighter">{p.eventType}</p>
                          </div>
                        </div>
                        <p className="text-sm font-black text-white">${Number(p.budget).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
               </section>

               {/* Recent Expenses */}
               <section className="bg-[#0a0a0a] border border-white/5 rounded-[32px] overflow-hidden">
                  <div className="p-6 border-b border-white/5 flex justify-between items-center">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">Recent Expenses</h3>
                  </div>
                  <div className="divide-y divide-white/5">
                    {expenses.slice(0, 5).map(e => (
                      <div key={e.id} className="p-4 flex items-center justify-between hover:bg-white/[0.02]">
                        <div>
                          <p className="text-sm font-bold text-white">{e.type}</p>
                          <p className="text-[10px] font-medium text-gray-600">{e.date}</p>
                        </div>
                        <p className="text-sm font-black text-rose-500">-${Number(e.amount).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
               </section>
            </div>
          </div>
        )}

        {activeTab === 'projects' && (
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-end">
              <h1 className="text-3xl font-black text-white tracking-tight">Productions.</h1>
              <button onClick={() => { setEditingItem(null); setIsProjectModalOpen(true); }} className="px-6 py-3 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl">
                Create Project
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map(p => (
                <div key={p.id} className="bg-[#0a0a0a] border border-white/5 p-6 rounded-[32px] hover:border-white/20 transition-all group relative">
                   <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button onClick={() => { setEditingItem(p); setIsProjectModalOpen(true); }} className="p-2 bg-white/5 rounded-lg hover:bg-white/10 text-white"><Edit3 size={14}/></button>
                     <button onClick={async () => await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'projects', p.id))} className="p-2 bg-rose-500/10 rounded-lg hover:bg-rose-500 text-rose-500 hover:text-white"><Trash2 size={14}/></button>
                   </div>
                   
                   <div className="flex items-center gap-4 mb-6">
                     <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center">
                       {p.eventType?.toLowerCase().includes('film') ? <Film className="text-indigo-500" /> : <Camera className="text-indigo-500" />}
                     </div>
                     <div>
                       <h4 className="font-bold text-white">{p.clientName}</h4>
                       <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">{p.eventType}</span>
                     </div>
                   </div>

                   <div className="space-y-4 mb-6">
                     <div className="flex items-center gap-2 text-xs">
                       <Calendar size={14} className="text-gray-600" />
                       <span>{p.eventDate}</span>
                     </div>
                     <div className="flex items-center gap-2 text-xs">
                       <MapPin size={14} className="text-gray-600" />
                       <a href={p.mapsLink} target="_blank" className="hover:text-white underline truncate">{p.location}</a>
                     </div>
                     <div className="flex items-center gap-2 text-xs">
                       <Users size={14} className="text-gray-600" />
                       <span>{p.team?.length || 0} Team Members</span>
                     </div>
                   </div>

                   <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase text-gray-600">Budget</p>
                        <p className="text-lg font-black text-white">${Number(p.budget).toLocaleString()}</p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        p.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : 
                        p.status === 'ongoing' ? 'bg-indigo-500/10 text-indigo-500' : 'bg-white/5 text-gray-500'
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
           <div className="max-w-4xl mx-auto space-y-6">
             <div className="flex justify-between items-end">
                <h1 className="text-3xl font-black text-white tracking-tight">Expenses.</h1>
                <button onClick={() => setIsExpenseModalOpen(true)} className="px-6 py-3 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-2xl">
                  Add Expense
                </button>
             </div>

             <div className="bg-[#0a0a0a] rounded-[32px] border border-white/5 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-600">
                      <th className="p-6">Date</th>
                      <th className="p-6">Type</th>
                      <th className="p-6">Notes</th>
                      <th className="p-6 text-right">Amount</th>
                      <th className="p-6"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {expenses.map(e => (
                      <tr key={e.id} className="group hover:bg-white/[0.02]">
                        <td className="p-6 text-sm font-medium">{e.date}</td>
                        <td className="p-6">
                          <span className="px-3 py-1 bg-white/5 rounded-lg text-[10px] font-black uppercase tracking-widest text-white">{e.type}</span>
                        </td>
                        <td className="p-6 text-sm text-gray-500 max-w-xs truncate">{e.notes}</td>
                        <td className="p-6 text-right font-black text-rose-500">-${Number(e.amount).toLocaleString()}</td>
                        <td className="p-6 text-right">
                           <button onClick={async () => await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'expenses', e.id))} className="p-2 opacity-0 group-hover:opacity-100 hover:text-rose-500 transition-all"><Trash2 size={16}/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
           </div>
        )}

      </main>

      {/* PROJECT MODAL */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={() => setIsProjectModalOpen(false)} />
          <div className="relative bg-[#111] w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[40px] border border-white/10 p-8 md:p-12 scrollbar-hide">
            <h2 className="text-3xl font-black text-white tracking-tighter mb-8">{editingItem ? 'Edit Production' : 'New Production'}</h2>
            <form onSubmit={saveProject} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input label="Client Name" name="clientName" defaultValue={editingItem?.clientName} required />
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-600 px-1">Event Type</label>
                <select name="eventType" defaultValue={editingItem?.eventType} className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white outline-none focus:border-indigo-500">
                  <option value="Wedding Film">Wedding Film</option>
                  <option value="Commercial Shoot">Commercial Shoot</option>
                  <option value="Music Video">Music Video</option>
                  <option value="Event Photography">Event Photography</option>
                  <option value="Portrait Session">Portrait Session</option>
                </select>
              </div>
              <Input label="Duration" name="duration" placeholder="e.g. 8 Hours" defaultValue={editingItem?.duration} />
              <Input label="Event Date" name="eventDate" type="date" defaultValue={editingItem?.eventDate} required />
              <Input label="Location" name="location" defaultValue={editingItem?.location} />
              <Input label="Maps Link" name="mapsLink" placeholder="URL" defaultValue={editingItem?.mapsLink} />
              <Input label="Budget ($)" name="budget" type="number" defaultValue={editingItem?.budget} required />
              <Input label="Paid to Date ($)" name="amountPaid" type="number" defaultValue={editingItem?.amountPaid} required />
              <div className="md:col-span-2 space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-600 px-1">Project Status</label>
                <select name="status" defaultValue={editingItem?.status || 'not started'} className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white outline-none focus:border-indigo-500">
                  <option value="not started">Not Started</option>
                  <option value="ongoing">Ongoing</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="md:col-span-2 pt-6">
                <button className="w-full bg-white text-black font-black py-5 rounded-2xl text-xs uppercase tracking-[0.3em] hover:scale-[1.01] active:scale-95 transition-all">
                  Synchronize to Nexus
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXPENSE MODAL */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={() => setIsExpenseModalOpen(false)} />
          <div className="relative bg-[#111] w-full max-w-md p-10 rounded-[40px] border border-white/10">
            <h2 className="text-2xl font-black text-white tracking-tighter mb-8">Add Expense</h2>
            <form onSubmit={saveExpense} className="space-y-6">
              <Input label="Expense Type" name="type" placeholder="e.g. Gear Rental" required />
              <Input label="Amount ($)" name="amount" type="number" required />
              <Input label="Date" name="date" type="date" required />
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-600 px-1">Notes</label>
                <textarea name="notes" className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white outline-none focus:border-indigo-500 h-24 resize-none" />
              </div>
              <button className="w-full bg-white text-black font-black py-5 rounded-2xl text-xs uppercase tracking-[0.3em] hover:scale-[1.01] active:scale-95 transition-all">
                Add Transaction
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

// --- Subcomponents ---

function NavBtn({ active, icon, label, onClick, showLabel }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${active ? 'bg-white text-black' : 'text-gray-500 hover:bg-white/5 hover:text-white'}`}
    >
      <div className="shrink-0">{icon}</div>
      {showLabel && <span className="text-xs font-black uppercase tracking-widest">{label}</span>}
    </button>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="bg-[#0a0a0a] border border-white/5 p-6 rounded-[32px]">
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-600 mb-1">{label}</p>
      <h3 className={`text-2xl font-black tracking-tighter ${color}`}>${Number(value).toLocaleString()}</h3>
    </div>
  );
}

function Input({ label, ...props }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-black uppercase tracking-widest text-gray-600 px-1">{label}</label>
      <input 
        className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white outline-none focus:border-indigo-500 placeholder:text-gray-700 transition-colors" 
        {...props} 
      />
    </div>
  );
}