import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, 
  onSnapshot, query, setDoc, getDoc, enableNetwork 
} from 'firebase/firestore';
import { 
  getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  LayoutDashboard, FolderPlus, Receipt, Menu, Plus, Trash2, 
  Calendar, Edit3, CheckCircle2, Clock
} from 'lucide-react';

// GLOBAL INSTANCES TO PERSIST ACROSS RE-RENDERS
let db = null;
let auth = null;
let appId = 'lumiere-studio-manager';

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isProjectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);

  // 1. ROBUST INITIALIZATION
  useEffect(() => {
    const init = async () => {
      try {
        const configStr = window['__firebase_config'];
        const token = window['__initial_auth_token'];
        const envAppId = window['__app_id'];

        if (!configStr) {
          console.log("Waiting for config...");
          return;
        }

        const firebaseConfig = JSON.parse(configStr);
        const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
        
        db = getFirestore(app);
        auth = getAuth(app);
        appId = envAppId || 'lumiere-studio-manager';

        // Essential: Sign in first before doing ANY firestore work
        if (token) {
          await signInWithCustomToken(auth, token);
        } else {
          await signInAnonymously(auth);
        }

        onAuthStateChanged(auth, (u) => {
          setUser(u);
          if (u) setLoading(false);
        });

      } catch (err) {
        console.error("Initialization error:", err);
      }
    };

    // Check frequently until window variables are ready
    const timer = setInterval(() => {
      if (window['__firebase_config']) {
        init();
        clearInterval(timer);
      }
    }, 500);

    return () => clearInterval(timer);
  }, []);

  // 2. REAL-TIME SYNC ENGINE (The "Sync across devices" part)
  useEffect(() => {
    if (!user || !db) return;

    // MANDATORY PATH STRUCTURE for cross-device sync in this environment
    const projectsCol = collection(db, 'artifacts', appId, 'public', 'data', 'projects');
    const expensesCol = collection(db, 'artifacts', appId, 'public', 'data', 'expenses');

    // Projects Listener
    const unsubProjects = onSnapshot(projectsCol, (snapshot) => {
      const pData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort by date in memory (Rule 2: No complex Firestore queries)
      setProjects(pData.sort((a, b) => new Date(b.date) - new Date(a.date)));
    }, (err) => console.error("Projects sync failed:", err));

    // Expenses Listener
    const unsubExpenses = onSnapshot(expensesCol, (snapshot) => {
      const eData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setExpenses(eData.sort((a, b) => new Date(b.date) - new Date(a.date)));
    }, (err) => console.error("Expenses sync failed:", err));

    return () => {
      unsubProjects();
      unsubExpenses();
    };
  }, [user]);

  // ACTIONS
  const saveProject = async (e) => {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.target);
    const payload = {
      clientName: fd.get('clientName'),
      eventType: fd.get('eventType'),
      budget: Number(fd.get('budget')),
      paidAmount: Number(fd.get('paidAmount')),
      date: fd.get('date'),
      status: fd.get('status'),
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingProject) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', editingProject.id), payload);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'projects'), {
          ...payload,
          createdAt: new Date().toISOString()
        });
      }
      setProjectModalOpen(false);
      setEditingProject(null);
    } catch (err) {
      console.error("Save failed:", err);
    }
  };

  const deleteProject = async (id) => {
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', id));
    } catch (err) { console.error(err); }
  };

  const addExpense = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'expenses'), {
        category: fd.get('category'),
        amount: Number(fd.get('amount')),
        date: fd.get('date'),
        createdAt: new Date().toISOString()
      });
      e.target.reset();
    } catch (err) { console.error(err); }
  };

  // ANALYTICS
  const stats = useMemo(() => {
    const totalRev = projects.reduce((sum, p) => sum + (p.paidAmount || 0), 0);
    const totalExp = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    return { totalRev, totalExp, profit: totalRev - totalExp };
  }, [projects, expenses]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-10 text-center">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6"></div>
        <h2 className="text-xl font-bold tracking-tight">Synchronizing Studio...</h2>
        <p className="text-gray-500 mt-2 text-sm max-w-xs">Establishing a secure connection to the cloud database for real-time collaboration.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex">
      {/* Navigation */}
      <nav className={`fixed inset-y-0 left-0 w-64 bg-[#0a0a0a] border-r border-white/5 p-6 z-50 transform transition-transform duration-300 md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-3 mb-12">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-black">L</div>
          <span className="font-black tracking-tighter text-xl">LUMIERE</span>
        </div>
        
        <div className="space-y-2">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Analytics' },
            { id: 'projects', icon: FolderPlus, label: 'Production' },
            { id: 'expenses', icon: Receipt, label: 'Ledger' }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === item.id ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
            >
              <item.icon size={18} /> {item.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 min-h-screen">
        <header className="p-6 border-b border-white/5 flex justify-between items-center sticky top-0 bg-[#050505]/80 backdrop-blur-xl z-40">
          <button className="md:hidden" onClick={() => setSidebarOpen(true)}><Menu /></button>
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Live Sync</span>
             </div>
             <span className="text-xs font-mono text-gray-600 hidden sm:inline">{user?.uid}</span>
          </div>
        </header>

        <div className="p-6 md:p-10 max-w-6xl mx-auto">
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#0f0f0f] p-8 rounded-3xl border border-white/5">
                  <p className="text-gray-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-2">Revenue</p>
                  <p className="text-4xl font-black">${stats.totalRev.toLocaleString()}</p>
                </div>
                <div className="bg-[#0f0f0f] p-8 rounded-3xl border border-white/5">
                  <p className="text-gray-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-2">Expenses</p>
                  <p className="text-4xl font-black text-red-500">${stats.totalExp.toLocaleString()}</p>
                </div>
                <div className="bg-[#0f0f0f] p-8 rounded-3xl border border-white/5">
                  <p className="text-gray-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-2">Profit</p>
                  <p className={`text-4xl font-black ${stats.profit >= 0 ? 'text-green-500' : 'text-orange-500'}`}>
                    ${stats.profit.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="bg-[#0f0f0f] p-8 rounded-3xl border border-white/5">
                <h3 className="font-bold mb-8 flex items-center gap-2">
                   <Clock size={18} className="text-indigo-500" /> Recent Activity
                </h3>
                <div className="space-y-4">
                   {projects.slice(0, 5).map(p => (
                     <div key={p.id} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                        <div className="flex items-center gap-4">
                           <div className={`w-2 h-2 rounded-full ${p.status === 'completed' ? 'bg-green-500' : 'bg-indigo-500'}`}></div>
                           <div>
                              <p className="font-bold text-sm">{p.clientName}</p>
                              <p className="text-xs text-gray-500">{p.eventType}</p>
                           </div>
                        </div>
                        <p className="font-mono text-sm">${p.paidAmount}</p>
                     </div>
                   ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'projects' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black">Shoots & Productions</h2>
                <button 
                  onClick={() => { setEditingProject(null); setProjectModalOpen(true); }}
                  className="bg-indigo-600 hover:bg-indigo-700 px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
                >
                  <Plus size={18} /> New Project
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {projects.map(p => (
                  <div key={p.id} className="bg-[#0f0f0f] p-6 rounded-3xl border border-white/5 group hover:border-indigo-500/50 transition-all">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="text-lg font-black">{p.clientName}</h3>
                        <p className="text-sm text-gray-500 uppercase tracking-widest font-bold text-[10px] mt-1">{p.eventType}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setEditingProject(p); setProjectModalOpen(true); }} className="p-2 bg-white/5 rounded-lg hover:bg-indigo-500/20 transition-colors"><Edit3 size={16}/></button>
                        <button onClick={() => deleteProject(p.id)} className="p-2 bg-white/5 rounded-lg hover:bg-red-500/20 text-red-500 transition-colors"><Trash2 size={16}/></button>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6 mb-6">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 font-bold uppercase mb-1">Date</span>
                        <span className="text-sm font-mono">{p.date}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 font-bold uppercase mb-1">Status</span>
                        <span className={`text-sm font-bold uppercase ${p.status === 'completed' ? 'text-green-500' : 'text-indigo-500'}`}>{p.status}</span>
                      </div>
                    </div>

                    <div className="bg-white/5 rounded-2xl p-4 flex justify-between items-center">
                       <div className="w-2/3 h-2 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${Math.min(100, (p.paidAmount / p.budget) * 100)}%` }}></div>
                       </div>
                       <div className="text-right">
                          <p className="text-[10px] text-gray-500 font-bold uppercase">Balance</p>
                          <p className="font-black text-sm">${p.paidAmount} / ${p.budget}</p>
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'expenses' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1">
                <div className="bg-[#0f0f0f] p-8 rounded-3xl border border-white/5 sticky top-28">
                  <h3 className="font-bold mb-6">Log Expense</h3>
                  <form onSubmit={addExpense} className="space-y-4">
                    <input name="category" placeholder="Vendor/Category" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-sm" required />
                    <input name="amount" type="number" placeholder="Amount ($)" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-sm" required />
                    <input name="date" type="date" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-sm" required />
                    <button className="w-full bg-white text-black font-black py-4 rounded-xl hover:bg-gray-200 transition-all">Record Transaction</button>
                  </form>
                </div>
              </div>
              <div className="lg:col-span-2">
                <div className="bg-[#0f0f0f] rounded-3xl border border-white/5 overflow-hidden">
                   <table className="w-full text-left">
                      <thead className="bg-white/5">
                        <tr className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                          <th className="p-6">Date</th>
                          <th className="p-6">Category</th>
                          <th className="p-6 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {expenses.map(e => (
                          <tr key={e.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="p-6 text-sm text-gray-400 font-mono">{e.date}</td>
                            <td className="p-6 font-bold">{e.category}</td>
                            <td className="p-6 text-right font-black text-red-500">${e.amount.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                   </table>
                   {expenses.length === 0 && (
                     <div className="p-20 text-center text-gray-600 font-bold uppercase tracking-widest text-xs">No records found</div>
                   )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Project Modal */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
          <div className="bg-[#111] border border-white/10 p-8 rounded-[40px] w-full max-w-md shadow-2xl">
            <h3 className="text-2xl font-black mb-8">{editingProject ? 'Modify' : 'Launch'} Project</h3>
            <form onSubmit={saveProject} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-500 ml-2">Client Details</label>
                <input name="clientName" defaultValue={editingProject?.clientName} placeholder="Full Name" className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl" required />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-500 ml-2">Shoot Type</label>
                <input name="eventType" defaultValue={editingProject?.eventType} placeholder="e.g. Wedding, Commercial" className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-500 ml-2">Budget</label>
                  <input name="budget" type="number" defaultValue={editingProject?.budget} placeholder="Total" className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl" required />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-500 ml-2">Paid</label>
                  <input name="paidAmount" type="number" defaultValue={editingProject?.paidAmount} placeholder="To Date" className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-500 ml-2">Event Date</label>
                  <input name="date" type="date" defaultValue={editingProject?.date} className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl" required />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-500 ml-2">Stage</label>
                  <select name="status" defaultValue={editingProject?.status || 'ongoing'} className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl">
                    <option value="ongoing">Production</option>
                    <option value="completed">Delivered</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-4 pt-8">
                <button type="submit" className="flex-1 bg-indigo-600 text-white font-black py-4 rounded-2xl hover:bg-indigo-700 transition-all">Confirm</button>
                <button type="button" onClick={() => setProjectModalOpen(false)} className="px-6 py-4 text-gray-500 font-bold">Close</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}