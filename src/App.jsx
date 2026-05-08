import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, 
  onSnapshot, query, setDoc, getDoc 
} from 'firebase/firestore';
import { 
  getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  LayoutDashboard, FolderPlus, Receipt, Menu, Plus, Trash2, 
  Edit3, CheckCircle2, Clock, X, Wallet, TrendingUp, BarChart3,
  Wifi, WifiOff, AlertCircle
} from 'lucide-react';

// Configuration & Globals
const APP_ID = typeof __app_id !== 'undefined' ? __app_id : 'lumiere-studio-manager';
let db = null;
let auth = null;

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [isProjectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [syncStatus, setSyncStatus] = useState('connecting');

  // 1. Robust Firebase Initialization
  useEffect(() => {
    const init = async () => {
      try {
        // Wait for config to be available
        if (!window['__firebase_config']) {
          console.log("Waiting for Firebase config...");
          return;
        }

        const firebaseConfig = JSON.parse(window['__firebase_config']);
        const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
        db = getFirestore(app);
        auth = getAuth(app);

        // Set a timeout for loading state to prevent "forever stuck"
        const timeout = setTimeout(() => {
          if (loading) setLoading(false);
        }, 5000);

        // Authentication Flow
        const token = window['__initial_auth_token'];
        if (token && token !== "") {
          await signInWithCustomToken(auth, token).catch(async () => {
            await signInAnonymously(auth);
          });
        } else {
          await signInAnonymously(auth);
        }

        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
          setUser(currentUser);
          setLoading(false);
          setSyncStatus(currentUser ? 'online' : 'offline');
          clearTimeout(timeout);
        });

        return () => {
          unsubscribe();
          clearTimeout(timeout);
        };
      } catch (err) {
        console.error("Critical Auth Error:", err);
        setAuthError(err.message);
        setLoading(false);
      }
    };

    init();
  }, []);

  // 2. Real-Time Data Sync (Only when user is authenticated)
  useEffect(() => {
    if (!user || !db) return;

    // RULE 1: Strict Paths
    const projectsRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'projects');
    const expensesRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'expenses');

    // RULE 2: Simple queries only
    const unsubProjects = onSnapshot(projectsRef, 
      (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Sort in memory to follow RULE 2
        setProjects(data.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));
        setSyncStatus('online');
      },
      (err) => {
        console.error("Projects Sync Error:", err);
        setSyncStatus('error');
      }
    );

    const unsubExpenses = onSnapshot(expensesRef, 
      (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setExpenses(data.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));
      },
      (err) => console.error("Expenses Sync Error:", err)
    );

    return () => {
      unsubProjects();
      unsubExpenses();
    };
  }, [user]);

  // Actions
  const handleSaveProject = async (e) => {
    e.preventDefault();
    if (!db || !user) return;
    
    const formData = new FormData(e.target);
    const data = {
      clientName: formData.get('clientName'),
      eventType: formData.get('eventType'),
      budget: parseFloat(formData.get('budget')) || 0,
      paidAmount: parseFloat(formData.get('paidAmount')) || 0,
      date: formData.get('date'),
      status: formData.get('status'),
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingProject) {
        await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'projects', editingProject.id), data);
      } else {
        await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'projects'), {
          ...data,
          createdAt: new Date().toISOString()
        });
      }
      setProjectModalOpen(false);
      setEditingProject(null);
    } catch (err) {
      console.error("Save Error:", err);
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!db || !user) return;
    const formData = new FormData(e.target);
    try {
      await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'expenses'), {
        category: formData.get('category'),
        amount: parseFloat(formData.get('amount')) || 0,
        date: formData.get('date'),
        createdAt: new Date().toISOString()
      });
      e.target.reset();
    } catch (err) {
      console.error("Expense Error:", err);
    }
  };

  const stats = useMemo(() => {
    const income = projects.reduce((acc, p) => acc + (p.paidAmount || 0), 0);
    const outgo = expenses.reduce((acc, e) => acc + (e.amount || 0), 0);
    return { income, outgo, profit: income - outgo };
  }, [projects, expenses]);

  // Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-white p-6 text-center">
        <div className="relative w-16 h-16 mb-8">
           <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full"></div>
           <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <h2 className="text-xl font-black tracking-widest uppercase mb-2">Syncing Lumiere</h2>
        <p className="text-gray-500 font-mono text-[10px]">Attempting secure handshake...</p>
      </div>
    );
  }

  // Error Screen
  if (authError) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-white p-10 text-center">
        <AlertCircle size={48} className="text-rose-500 mb-6" />
        <h2 className="text-2xl font-black mb-2">Connection Failed</h2>
        <p className="text-gray-400 max-w-xs mx-auto mb-8">{authError}</p>
        <button onClick={() => window.location.reload()} className="bg-white text-black px-8 py-3 rounded-2xl font-bold">Retry Connection</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-gray-200 font-sans selection:bg-indigo-500/30">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 w-72 bg-[#080808] border-r border-white/5 z-[70] transition-all duration-500 ease-in-out md:translate-x-0 ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
        <div className="h-full flex flex-col p-8">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
              <span className="font-black text-xl italic text-white">L</span>
            </div>
            <h1 className="font-black text-2xl tracking-tighter text-white">LUMIERE</h1>
          </div>

          <nav className="space-y-2 flex-1">
            {[
              { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
              { id: 'projects', label: 'Projects', icon: FolderPlus },
              { id: 'expenses', label: 'Financials', icon: Receipt },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 font-bold text-sm ${activeTab === tab.id ? 'bg-white text-black translate-x-1' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
              >
                <tab.icon size={20} strokeWidth={2.5} />
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="pt-8 mt-8 border-t border-white/5">
            <div className="bg-white/[0.03] p-4 rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Database</p>
                <p className="text-xs font-bold text-gray-400 capitalize">{syncStatus}</p>
              </div>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${syncStatus === 'online' ? 'bg-green-500/10 text-green-500' : 'bg-rose-500/10 text-rose-500'}`}>
                {syncStatus === 'online' ? <Wifi size={16}/> : <WifiOff size={16}/>}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Content Area */}
      <main className="md:ml-72 min-h-screen">
        <header className="sticky top-0 z-50 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5 p-6 flex justify-between items-center">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden p-3 bg-white/5 rounded-xl"><Menu size={20}/></button>
          <div className="flex-1" />
          <div className="flex items-center gap-4">
             <div className="hidden sm:flex flex-col items-end">
                <span className="text-xs font-bold text-white uppercase tracking-tighter">Studio Manager</span>
                <span className="text-[10px] text-gray-500 font-mono">{user?.uid?.slice(0, 8)}</span>
             </div>
             <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 ring-4 ring-black" />
          </div>
        </header>

        <div className="p-6 md:p-12 max-w-7xl mx-auto">
          {activeTab === 'dashboard' && (
            <div className="space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { label: 'Revenue', value: stats.income, icon: TrendingUp, color: 'text-indigo-400' },
                  { label: 'Expenses', value: stats.outgo, icon: Wallet, color: 'text-rose-400' },
                  { label: 'Net Profit', value: stats.profit, icon: BarChart3, color: stats.profit >= 0 ? 'text-emerald-400' : 'text-orange-400' }
                ].map((stat, i) => (
                  <div key={i} className="bg-[#0c0c0c] p-8 rounded-[32px] border border-white/5 hover:border-white/10 transition-all">
                    <div className="flex justify-between items-start mb-6">
                       <div className={`p-3 rounded-2xl bg-white/5 ${stat.color}`}><stat.icon size={24} /></div>
                    </div>
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-1">{stat.label}</p>
                    <p className="text-4xl font-black text-white tracking-tighter">${stat.value.toLocaleString()}</p>
                  </div>
                ))}
              </div>

              <div className="bg-[#0c0c0c] border border-white/5 rounded-[32px] overflow-hidden">
                 <div className="p-8 border-b border-white/5 flex justify-between items-center">
                    <h3 className="font-black text-xl text-white">Latest Deliveries</h3>
                    <button onClick={() => setActiveTab('projects')} className="text-xs font-bold text-indigo-400 uppercase tracking-widest">View All</button>
                 </div>
                 <div className="p-4 space-y-2">
                    {projects.slice(0, 5).map(p => (
                      <div key={p.id} className="flex items-center justify-between p-4 rounded-2xl hover:bg-white/[0.02] transition-all">
                         <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-xs font-black text-indigo-400 uppercase">
                               {p.eventType?.slice(0, 2)}
                            </div>
                            <div>
                               <p className="font-bold text-white">{p.clientName}</p>
                               <p className="text-xs text-gray-500 font-mono">{p.date}</p>
                            </div>
                         </div>
                         <div className="text-right">
                            <p className="font-black text-white">${p.paidAmount?.toLocaleString()}</p>
                            <span className="text-[10px] font-bold uppercase text-indigo-500 tracking-widest">{p.status}</span>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>
            </div>
          )}

          {activeTab === 'projects' && (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-black text-white">Active Production</h2>
                <button 
                  onClick={() => { setEditingProject(null); setProjectModalOpen(true); }}
                  className="bg-white text-black px-6 py-3 rounded-xl font-black flex items-center gap-2 hover:scale-105 active:scale-95 transition-all"
                >
                  <Plus size={20} strokeWidth={3} /> Add New
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {projects.map(p => (
                  <div key={p.id} className="bg-[#0c0c0c] p-8 rounded-[32px] border border-white/5 relative group">
                    <div className="flex justify-between items-start mb-8">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-500/10 px-3 py-1 rounded-full">{p.eventType}</span>
                        <h3 className="text-2xl font-black text-white mt-4">{p.clientName}</h3>
                        <p className="text-gray-500 text-sm mt-1 flex items-center gap-2"><Clock size={14}/> {p.date}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setEditingProject(p); setProjectModalOpen(true); }} className="p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"><Edit3 size={18}/></button>
                        <button onClick={() => deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'projects', p.id))} className="p-2 bg-white/5 rounded-xl hover:bg-rose-500/20 text-rose-500 transition-colors"><Trash2 size={18}/></button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-8">
                       <div className="bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                          <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Fee</p>
                          <p className="text-xl font-black text-white">${p.budget?.toLocaleString()}</p>
                       </div>
                       <div className="bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                          <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Paid</p>
                          <p className="text-xl font-black text-emerald-400">${p.paidAmount?.toLocaleString()}</p>
                       </div>
                    </div>

                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${Math.min(100, (p.paidAmount / p.budget) * 100)}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'expenses' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
              <div className="xl:col-span-4">
                <div className="bg-[#0c0c0c] p-8 rounded-[32px] border border-white/5 sticky top-32">
                  <h3 className="text-xl font-black text-white mb-6">Log Expense</h3>
                  <form onSubmit={handleAddExpense} className="space-y-4">
                    <input name="category" placeholder="Description" className="w-full bg-white/5 border border-white/5 p-4 rounded-xl text-white outline-none focus:border-indigo-500" required />
                    <input name="amount" type="number" step="0.01" placeholder="Amount" className="w-full bg-white/5 border border-white/5 p-4 rounded-xl text-white outline-none focus:border-indigo-500" required />
                    <input name="date" type="date" className="w-full bg-white/5 border border-white/5 p-4 rounded-xl text-white outline-none focus:border-indigo-500" required />
                    <button className="w-full bg-indigo-600 text-white font-black py-4 rounded-xl hover:bg-indigo-700 transition-all">Record Entry</button>
                  </form>
                </div>
              </div>
              <div className="xl:col-span-8">
                <div className="bg-[#0c0c0c] rounded-[32px] border border-white/5 overflow-hidden">
                   <table className="w-full text-left">
                      <thead>
                        <tr className="text-[10px] font-bold uppercase tracking-widest text-gray-600 border-b border-white/5">
                          <th className="p-6">Date</th>
                          <th className="p-6">Vendor/Item</th>
                          <th className="p-6 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {expenses.map(e => (
                          <tr key={e.id} className="hover:bg-white/[0.01]">
                            <td className="p-6 text-sm text-gray-500 font-mono">{e.date}</td>
                            <td className="p-6 font-bold text-white">{e.category}</td>
                            <td className="p-6 text-right font-black text-rose-400">-${e.amount.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                   </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setProjectModalOpen(false)} />
          <div className="bg-[#111] border border-white/10 p-10 rounded-[40px] w-full max-w-lg shadow-2xl relative animate-in zoom-in slide-in-from-bottom-10">
            <button onClick={() => setProjectModalOpen(false)} className="absolute top-8 right-8 text-gray-500"><X size={20}/></button>
            <h3 className="text-2xl font-black text-white mb-8">{editingProject ? 'Edit' : 'New'} Production</h3>
            <form onSubmit={handleSaveProject} className="space-y-4">
              <input name="clientName" defaultValue={editingProject?.clientName} placeholder="Client Name" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-white outline-none focus:border-indigo-500" required />
              <input name="eventType" defaultValue={editingProject?.eventType} placeholder="Type (e.g. Fashion, Event)" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-white outline-none focus:border-indigo-500" required />
              <div className="grid grid-cols-2 gap-4">
                <input name="budget" type="number" defaultValue={editingProject?.budget} placeholder="Total Budget" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-white outline-none" required />
                <input name="paidAmount" type="number" defaultValue={editingProject?.paidAmount} placeholder="Amount Paid" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-white outline-none" required />
              </div>
              <input name="date" type="date" defaultValue={editingProject?.date} className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-white outline-none" required />
              <select name="status" defaultValue={editingProject?.status || 'ongoing'} className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-white outline-none">
                <option value="ongoing">In Production</option>
                <option value="completed">Delivered</option>
              </select>
              <button type="submit" className="w-full bg-white text-black font-black py-4 rounded-xl hover:bg-gray-100 transition-all mt-4">Save Entry</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}