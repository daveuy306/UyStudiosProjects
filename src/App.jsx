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
  Wifi, WifiOff, AlertCircle, RefreshCw
} from 'lucide-react';

const APP_ID = typeof __app_id !== 'undefined' ? __app_id : 'lumiere-studio-manager';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("Initializing environment...");
  const [authError, setAuthError] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [isProjectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [db, setDb] = useState(null);

  // Robust Initialization with Polling for Credentials
  useEffect(() => {
    let retryInterval;
    let authUnsubscribe;

    const startApp = async (configStr, token) => {
      try {
        setStatusMessage("Connecting to Studio Database...");
        const firebaseConfig = JSON.parse(configStr);
        const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
        const firestoreDb = getFirestore(app);
        const auth = getAuth(app);
        setDb(firestoreDb);

        // RULE 3: Auth Before Queries
        if (token) {
          await signInWithCustomToken(auth, token).catch(() => signInAnonymously(auth));
        } else {
          await signInAnonymously(auth);
        }

        authUnsubscribe = onAuthStateChanged(auth, (currentUser) => {
          if (currentUser) {
            setUser(currentUser);
            setLoading(false);
          }
        });
      } catch (err) {
        console.error("Init Error:", err);
        setAuthError("Failed to parse configuration. Please refresh.");
      }
    };

    const checkEnv = () => {
      const config = window['__firebase_config'];
      const token = window['__initial_auth_token'];

      if (config) {
        clearInterval(retryInterval);
        startApp(config, token);
      } else {
        setStatusMessage("Waiting for secure credentials...");
      }
    };

    retryInterval = setInterval(checkEnv, 1000);
    checkEnv(); // Initial check

    return () => {
      if (retryInterval) clearInterval(retryInterval);
      if (authUnsubscribe) authUnsubscribe();
    };
  }, []);

  // Data Fetching
  useEffect(() => {
    if (!user || !db) return;

    // RULE 1: Strict Paths & RULE 2: No complex queries
    const pRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'projects');
    const eRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'expenses');

    const unsubP = onSnapshot(pRef, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setProjects(data.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));
    }, (err) => console.error("Sync Error:", err));

    const unsubE = onSnapshot(eRef, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setExpenses(data.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));
    }, (err) => console.error("Sync Error:", err));

    return () => { unsubP(); unsubE(); };
  }, [user, db]);

  const stats = useMemo(() => {
    const income = projects.reduce((acc, p) => acc + (Number(p.paidAmount) || 0), 0);
    const outgo = expenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
    return { income, outgo, profit: income - outgo };
  }, [projects, expenses]);

  const handleSaveProject = async (e) => {
    e.preventDefault();
    if (!db || !user) return;
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
    if (editingProject) {
      await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'projects', editingProject.id), payload);
    } else {
      await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'projects'), { ...payload, createdAt: new Date().toISOString() });
    }
    setProjectModalOpen(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-white p-6">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6" />
        <h2 className="text-xl font-black uppercase tracking-widest mb-2">Syncing Lumiere</h2>
        <p className="text-gray-500 text-sm mb-8">{statusMessage}</p>
        <button 
          onClick={() => setLoading(false)} 
          className="text-[10px] text-gray-700 hover:text-indigo-400 uppercase tracking-[0.2em] transition-colors"
        >
          Skip to Offline Mode
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-gray-200">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 w-64 bg-[#0a0a0a] border-r border-white/5 z-50 transition-transform md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-8 h-full flex flex-col">
          <div className="text-2xl font-black italic mb-12">LUMIERE</div>
          <nav className="space-y-1 flex-1">
            {['dashboard', 'projects', 'expenses'].map(id => (
              <button 
                key={id} 
                onClick={() => { setActiveTab(id); setSidebarOpen(false); }}
                className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm capitalize transition-all ${activeTab === id ? 'bg-white text-black' : 'text-gray-500 hover:bg-white/5'}`}
              >
                {id}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main */}
      <main className="md:ml-64 p-6 md:p-12">
        <header className="flex justify-between items-center mb-12">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 bg-white/5 rounded-lg"><Menu /></button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
             <div className="text-right hidden sm:block">
               <p className="text-xs font-black text-white">STUDIO SESSION</p>
               <p className="text-[10px] text-gray-600 font-mono">ID: {user?.uid?.slice(0,6)}</p>
             </div>
             <div className="w-10 h-10 rounded-full bg-indigo-600" />
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-[#0c0c0c] p-8 rounded-3xl border border-white/5">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Revenue</p>
                <h3 className="text-3xl font-black text-white">${stats.income.toLocaleString()}</h3>
              </div>
              <div className="bg-[#0c0c0c] p-8 rounded-3xl border border-white/5">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Expenses</p>
                <h3 className="text-3xl font-black text-rose-500">${stats.outgo.toLocaleString()}</h3>
              </div>
              <div className="bg-[#0c0c0c] p-8 rounded-3xl border border-white/5">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Net</p>
                <h3 className={`text-3xl font-black ${stats.profit >= 0 ? 'text-emerald-500' : 'text-orange-500'}`}>${stats.profit.toLocaleString()}</h3>
              </div>
            </div>

            <div className="bg-[#0c0c0c] rounded-3xl border border-white/5 overflow-hidden">
               <div className="p-6 border-b border-white/5 font-black uppercase text-xs tracking-widest">Recent Deliveries</div>
               <div className="divide-y divide-white/5">
                 {projects.slice(0, 4).map(p => (
                   <div key={p.id} className="p-6 flex justify-between items-center hover:bg-white/[0.02]">
                      <div>
                        <p className="font-bold text-white">{p.clientName}</p>
                        <p className="text-[10px] text-gray-500 uppercase">{p.eventType}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black">${p.paidAmount.toLocaleString()}</p>
                        <p className="text-[10px] text-indigo-400 font-bold uppercase">{p.status}</p>
                      </div>
                   </div>
                 ))}
               </div>
            </div>
          </div>
        )}

        {activeTab === 'projects' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-black text-white">Production Log</h2>
              <button onClick={() => { setEditingProject(null); setProjectModalOpen(true); }} className="bg-white text-black px-5 py-2 rounded-xl font-bold text-sm">Add New</button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {projects.map(p => (
                <div key={p.id} className="bg-[#0c0c0c] p-6 rounded-3xl border border-white/5 group">
                  <div className="flex justify-between mb-4">
                    <h4 className="font-black text-white text-lg">{p.clientName}</h4>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingProject(p); setProjectModalOpen(true); }} className="p-2 hover:text-indigo-400"><Edit3 size={16}/></button>
                      <button onClick={() => deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'projects', p.id))} className="p-2 hover:text-rose-500"><Trash2 size={16}/></button>
                    </div>
                  </div>
                  <div className="flex justify-between items-end">
                    <p className="text-[10px] text-gray-500 font-mono">{p.date}</p>
                    <p className="font-black text-xl">${p.paidAmount.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'expenses' && (
           <div className="space-y-6">
              <div className="bg-[#0c0c0c] p-6 rounded-3xl border border-white/5">
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.target);
                  await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'expenses'), {
                    category: fd.get('cat'), amount: Number(fd.get('amt')), date: fd.get('date'), createdAt: new Date().toISOString()
                  });
                  e.target.reset();
                }} className="flex flex-wrap gap-4">
                  <input name="cat" placeholder="Vendor/Item" className="flex-1 min-w-[200px] bg-white/5 border border-white/10 p-3 rounded-xl text-white outline-none" required />
                  <input name="amt" type="number" placeholder="Amount" className="w-32 bg-white/5 border border-white/10 p-3 rounded-xl text-white outline-none" required />
                  <input name="date" type="date" className="bg-white/5 border border-white/10 p-3 rounded-xl text-white outline-none" required />
                  <button className="bg-indigo-600 px-6 py-3 rounded-xl font-black text-sm">Log</button>
                </form>
              </div>
              <div className="bg-[#0c0c0c] rounded-3xl border border-white/5 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-gray-500 uppercase text-[10px] font-black">
                      <th className="p-4">Item</th>
                      <th className="p-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map(e => (
                      <tr key={e.id} className="border-b border-white/5 last:border-0">
                        <td className="p-4 font-bold">{e.category}</td>
                        <td className="p-4 text-right font-black text-rose-500">-${e.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
           </div>
        )}
      </main>

      {/* Modal */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setProjectModalOpen(false)} />
          <div className="bg-[#111] p-8 rounded-[32px] w-full max-w-md relative border border-white/10">
            <h3 className="text-xl font-black mb-6">{editingProject ? 'Update' : 'New'} Project</h3>
            <form onSubmit={handleSaveProject} className="space-y-4">
              <input name="clientName" defaultValue={editingProject?.clientName} placeholder="Client" className="w-full bg-white/5 p-4 rounded-xl outline-none border border-white/5 focus:border-indigo-500" required />
              <input name="eventType" defaultValue={editingProject?.eventType} placeholder="Type" className="w-full bg-white/5 p-4 rounded-xl outline-none" />
              <div className="grid grid-cols-2 gap-4">
                <input name="budget" type="number" defaultValue={editingProject?.budget} placeholder="Total" className="w-full bg-white/5 p-4 rounded-xl outline-none" />
                <input name="paidAmount" type="number" defaultValue={editingProject?.paidAmount} placeholder="Paid" className="w-full bg-white/5 p-4 rounded-xl outline-none" />
              </div>
              <input name="date" type="date" defaultValue={editingProject?.date} className="w-full bg-white/5 p-4 rounded-xl outline-none" />
              <select name="status" className="w-full bg-white/5 p-4 rounded-xl outline-none">
                <option value="ongoing">In Progress</option>
                <option value="completed">Delivered</option>
              </select>
              <button className="w-full bg-white text-black font-black py-4 rounded-xl mt-4">Confirm</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}