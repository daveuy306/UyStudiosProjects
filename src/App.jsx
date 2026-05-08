import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, 
  onSnapshot, query, setDoc, getDoc 
} from 'firebase/firestore';
import { 
  getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  LayoutDashboard, FolderPlus, Receipt, Menu, X, Plus, Trash2, 
  MapPin, Calendar, Edit3, RefreshCw, AlertCircle
} from 'lucide-react';

// Use a simple let for instances to avoid re-init cycles
let dbInstance = null;
let authInstance = null;
let appIdValue = 'lumiere-studio-default';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [isProjectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);

  // 1. SAFE INITIALIZATION (Wait for environment)
  useEffect(() => {
    const initInterval = setInterval(() => {
      // Use window brackets to prevent ReferenceError
      const config = window['__firebase_config'];
      const token = window['__initial_auth_token'];
      const envAppId = window['__app_id'];

      if (config) {
        try {
          const firebaseConfig = JSON.parse(config);
          const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
          
          authInstance = getAuth(app);
          dbInstance = getFirestore(app);
          appIdValue = envAppId || 'lumiere-studio-default';

          // Handle Auth
          const runAuth = async () => {
            if (token) {
              await signInWithCustomToken(authInstance, token);
            } else {
              await signInAnonymously(authInstance);
            }
          };

          runAuth();
          
          const unsubAuth = onAuthStateChanged(authInstance, (u) => {
            setUser(u);
            if (u) setIsReady(true);
          });

          clearInterval(initInterval);
          return () => unsubAuth();
        } catch (err) {
          console.error("Delayed init failed:", err);
        }
      }
    }, 500); // Check every 500ms

    return () => clearInterval(initInterval);
  }, []);

  // 2. DATA SYNC
  useEffect(() => {
    if (!isReady || !user || !dbInstance) return;

    const projRef = collection(dbInstance, 'artifacts', appIdValue, 'public', 'data', 'projects');
    const expRef = collection(dbInstance, 'artifacts', appIdValue, 'public', 'data', 'expenses');

    const unsubP = onSnapshot(projRef, 
      (s) => setProjects(s.docs.map(d => ({ id: d.id, ...d.data() }))),
      (e) => console.error("Sync Projects Error", e)
    );

    const unsubE = onSnapshot(expRef, 
      (s) => setExpenses(s.docs.map(d => ({ id: d.id, ...d.data() }))),
      (e) => console.error("Sync Expenses Error", e)
    );

    return () => {
      unsubP();
      unsubE();
    };
  }, [isReady, user]);

  // Actions
  const handleSaveProject = async (e) => {
    e.preventDefault();
    if (!user || !dbInstance) return;
    const formData = new FormData(e.target);
    const data = {
      clientName: formData.get('clientName'),
      eventType: formData.get('eventType'),
      budget: Number(formData.get('budget')),
      paidAmount: Number(formData.get('paidAmount')),
      date: formData.get('date'),
      status: formData.get('status'),
      updatedAt: new Date().toISOString()
    };

    if (editingProject) {
      await updateDoc(doc(dbInstance, 'artifacts', appIdValue, 'public', 'data', 'projects', editingProject.id), data);
    } else {
      await addDoc(collection(dbInstance, 'artifacts', appIdValue, 'public', 'data', 'projects'), { ...data, createdAt: new Date().toISOString() });
    }
    setProjectModalOpen(false);
  };

  const deleteProject = async (id) => {
    await deleteDoc(doc(dbInstance, 'artifacts', appIdValue, 'public', 'data', 'projects', id));
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    await addDoc(collection(dbInstance, 'artifacts', appIdValue, 'public', 'data', 'expenses'), {
      type: formData.get('type'),
      amount: Number(formData.get('amount')),
      date: formData.get('date'),
      createdAt: new Date().toISOString()
    });
    e.target.reset();
  };

  const chartData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months.map((m, i) => {
      const rev = projects.filter(p => new Date(p.date).getMonth() === i).reduce((s, p) => s + (Number(p.paidAmount) || 0), 0);
      const exp = expenses.filter(e => new Date(e.date).getMonth() === i).reduce((s, e) => s + (Number(e.amount) || 0), 0);
      return { name: m, revenue: rev, expenses: exp };
    });
  }, [projects, expenses]);

  // Loading View
  if (!isReady) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-8 text-center">
        <div className="relative w-20 h-20 mb-8">
          <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">System Handshake...</h2>
        <p className="text-gray-500 text-sm max-w-xs leading-relaxed">Waiting for studio environment variables to propagate across the workspace.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 flex font-sans">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#111] border-r border-white/5 transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static`}>
        <div className="p-8 h-full flex flex-col">
          <h1 className="text-xl font-black tracking-tighter text-white flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">L</div>
            LUMIERE
          </h1>
          <nav className="flex-1 space-y-2">
            {[
              { id: 'dashboard', icon: LayoutDashboard, label: 'Insights' },
              { id: 'projects', icon: FolderPlus, label: 'Projects' },
              { id: 'expenses', icon: Receipt, label: 'Finances' }
            ].map(item => (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all ${activeTab === item.id ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-white/5 hover:text-gray-200'}`}
              >
                <item.icon size={18} />
                <span className="font-bold text-sm tracking-wide">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-auto">
        <header className="sticky top-0 z-30 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/5 p-6 flex justify-between items-center">
          <button className="md:hidden" onClick={() => setSidebarOpen(true)}><Menu/></button>
          <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">{activeTab} Mode</div>
          <div className="text-xs font-mono text-gray-600">ID: {user?.uid.slice(0, 8)}</div>
        </header>

        <div className="p-6 md:p-12 max-w-6xl mx-auto space-y-10">
          {activeTab === 'dashboard' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#141414] p-8 rounded-3xl border border-white/5">
                  <div className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2">Total Revenue</div>
                  <div className="text-4xl font-black">${projects.reduce((a, b) => a + (b.paidAmount || 0), 0).toLocaleString()}</div>
                </div>
                <div className="bg-[#141414] p-8 rounded-3xl border border-white/5">
                  <div className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2">Expenses</div>
                  <div className="text-4xl font-black text-red-500">${expenses.reduce((a, b) => a + (b.amount || 0), 0).toLocaleString()}</div>
                </div>
                <div className="bg-[#141414] p-8 rounded-3xl border border-white/5">
                  <div className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2">Active Shoots</div>
                  <div className="text-4xl font-black text-indigo-500">{projects.filter(p => p.status === 'ongoing').length}</div>
                </div>
              </div>

              <div className="bg-[#141414] p-8 rounded-3xl border border-white/5 h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <XAxis dataKey="name" stroke="#333" fontSize={12} />
                    <Tooltip contentStyle={{background: '#111', border: 'none', borderRadius: '12px'}} />
                    <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={3} dot={false} />
                    <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {activeTab === 'projects' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black">Production Queue</h2>
                <button 
                  onClick={() => { setEditingProject(null); setProjectModalOpen(true); }}
                  className="bg-indigo-600 px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700"
                >
                  <Plus size={18}/> New Shoot
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {projects.map(p => (
                  <div key={p.id} className="bg-[#141414] p-6 rounded-3xl border border-white/5 hover:border-indigo-500/30 transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-lg">{p.clientName}</h3>
                        <p className="text-sm text-gray-500">{p.eventType}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setEditingProject(p); setProjectModalOpen(true); }} className="p-2 hover:bg-white/5 rounded-lg"><Edit3 size={16}/></button>
                        <button onClick={() => deleteProject(p.id)} className="p-2 hover:bg-white/5 rounded-lg text-red-500"><Trash2 size={16}/></button>
                      </div>
                    </div>
                    <div className="flex gap-4 text-xs text-gray-400 mb-6">
                      <span className="flex items-center gap-1"><Calendar size={12}/> {p.date}</span>
                      <span className={`uppercase font-black ${p.status === 'completed' ? 'text-green-500' : 'text-indigo-500'}`}>{p.status}</span>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 flex justify-between items-center">
                      <span className="text-[10px] font-bold text-gray-500 uppercase">Paid</span>
                      <span className="font-bold">${p.paidAmount} / ${p.budget}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'expenses' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1">
                <form onSubmit={handleAddExpense} className="bg-[#141414] p-8 rounded-3xl border border-white/5 space-y-4">
                  <h3 className="font-bold mb-4">Log Outgoing</h3>
                  <input name="type" placeholder="Category (e.g. Gear)" required className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm" />
                  <input name="amount" type="number" placeholder="Amount" required className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm" />
                  <input name="date" type="date" required className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm" />
                  <button className="w-full bg-white text-black font-black py-4 rounded-xl hover:bg-gray-200">Post Transaction</button>
                </form>
              </div>
              <div className="lg:col-span-2 bg-[#141414] rounded-3xl border border-white/5 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-white/5 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                    <tr>
                      <th className="p-6">Date</th>
                      <th className="p-6">Category</th>
                      <th className="p-6 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {expenses.map(e => (
                      <tr key={e.id} className="text-sm">
                        <td className="p-6 text-gray-400">{e.date}</td>
                        <td className="p-6 font-bold">{e.type}</td>
                        <td className="p-6 text-right font-black">${e.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {isProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#161616] border border-white/10 p-8 rounded-3xl w-full max-w-md space-y-6">
            <h3 className="text-xl font-bold">{editingProject ? 'Edit' : 'New'} Project</h3>
            <form onSubmit={handleSaveProject} className="space-y-4">
              <input name="clientName" defaultValue={editingProject?.clientName} placeholder="Client Name" className="w-full bg-white/5 border border-white/10 rounded-xl p-4" required />
              <input name="eventType" defaultValue={editingProject?.eventType} placeholder="Event Type (Wedding, Ad, etc)" className="w-full bg-white/5 border border-white/10 rounded-xl p-4" required />
              <div className="grid grid-cols-2 gap-4">
                <input name="budget" type="number" defaultValue={editingProject?.budget} placeholder="Total Budget" className="w-full bg-white/5 border border-white/10 rounded-xl p-4" required />
                <input name="paidAmount" type="number" defaultValue={editingProject?.paidAmount} placeholder="Amount Paid" className="w-full bg-white/5 border border-white/10 rounded-xl p-4" required />
              </div>
              <input name="date" type="date" defaultValue={editingProject?.date} className="w-full bg-white/5 border border-white/10 rounded-xl p-4" required />
              <select name="status" defaultValue={editingProject?.status || 'ongoing'} className="w-full bg-white/5 border border-white/10 rounded-xl p-4">
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
              </select>
              <div className="flex gap-4 pt-4">
                <button type="submit" className="flex-1 bg-white text-black font-bold py-4 rounded-xl">Save</button>
                <button type="button" onClick={() => setProjectModalOpen(false)} className="px-6 py-4 text-gray-500 font-bold">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}