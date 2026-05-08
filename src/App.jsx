import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, 
  onSnapshot, query, setDoc, getDoc 
} from 'firebase/firestore';
import { 
  getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  LayoutDashboard, Menu, Plus, Trash2, Edit3, Wifi, WifiOff, AlertCircle, RefreshCw, X, CheckCircle2, ShieldAlert
} from 'lucide-react';

/**
 * ARCHITECTURAL NOTE:
 * This app uses a "Resilient Initialization" pattern. 
 * 1. Dependency Check: Verifies React & Firebase objects exist.
 * 2. Auth-First: Follows Rule 3 (Wait for Auth before Firestore).
 * 3. Path Strictness: Follows Rule 1 (/artifacts/{appId}/public/data/...).
 * 4. Local Fallback: Ensures usability if the sandbox blocks the config.
 */

const APP_ID = typeof __app_id !== 'undefined' ? __app_id : 'lumiere-studio-manager-v2';

export default function App() {
  // --- Dependency & Health State ---
  const [healthStatus, setHealthStatus] = useState('checking');
  const [healthErrors, setHealthErrors] = useState([]);
  
  // --- App State ---
  const [user, setUser] = useState(null);
  const [db, setDb] = useState(null);
  const [connectionMode, setConnectionMode] = useState('searching'); // searching, cloud, local
  const [projects, setProjects] = useState([]);
  const [expenses, setExpenses] = useState([]);
  
  // --- UI State ---
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [localStore, setLocalStore] = useState({ projects: [], expenses: [] });

  // 1. PERFORM PRE-FLIGHT DEPENDENCY CHECK
  useEffect(() => {
    const checkDependencies = () => {
      const errors = [];
      if (typeof React === 'undefined') errors.push("React Core missing");
      if (typeof initializeApp === 'undefined') errors.push("Firebase App SDK missing");
      if (typeof getFirestore === 'undefined') errors.push("Firestore SDK missing");
      
      if (errors.length > 0) {
        setHealthErrors(errors);
        setHealthStatus('failed');
      } else {
        setHealthStatus('healthy');
        initFirebase();
      }
    };

    const initFirebase = async () => {
      const configStr = window['__firebase_config'];
      const token = window['__initial_auth_token'];

      if (!configStr) {
        console.warn("Firebase Config missing. Reverting to Local persistence.");
        setConnectionMode('local');
        return;
      }

      try {
        const config = JSON.parse(configStr);
        const app = getApps().length === 0 ? initializeApp(config) : getApps()[0];
        const firestoreDb = getFirestore(app);
        const auth = getAuth(app);
        
        setDb(firestoreDb);

        // RULE 3: Auth before Queries
        if (token) {
          await signInWithCustomToken(auth, token).catch(() => signInAnonymously(auth));
        } else {
          await signInAnonymously(auth);
        }

        onAuthStateChanged(auth, (u) => {
          if (u) {
            setUser(u);
            setConnectionMode('cloud');
          }
        });
      } catch (e) {
        console.error("Firebase Initialization Error:", e);
        setConnectionMode('local');
      }
    };

    checkDependencies();
  }, []);

  // 2. DATA SYNC (RULE 1 & 2)
  useEffect(() => {
    if (connectionMode !== 'cloud' || !user || !db) return;

    // Use Rule 1 Paths
    const pRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'projects');
    const eRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'expenses');

    const unsubP = onSnapshot(pRef, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setProjects(data);
    }, (err) => console.error("Firestore Project Sync Failed", err));

    const unsubE = onSnapshot(eRef, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setExpenses(data);
    }, (err) => console.error("Firestore Expense Sync Failed", err));

    return () => { unsubP(); unsubE(); };
  }, [connectionMode, user, db]);

  // Derived Data
  const currentProjects = connectionMode === 'cloud' ? projects : localStore.projects;
  const currentExpenses = connectionMode === 'cloud' ? expenses : localStore.expenses;

  const handleAddProject = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      name: fd.get('name'),
      amount: Number(fd.get('amount')),
      date: fd.get('date'),
      status: 'active',
      createdAt: new Date().toISOString()
    };

    if (connectionMode === 'cloud' && db) {
      await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'projects'), data);
    } else {
      setLocalStore(prev => ({
        ...prev,
        projects: [{ ...data, id: Math.random().toString() }, ...prev.projects]
      }));
    }
    setIsModalOpen(false);
  };

  // --- HEALTH OVERLAY ---
  if (healthStatus === 'failed') {
    return (
      <div className="min-h-screen bg-rose-950 flex items-center justify-center p-6 text-white font-sans">
        <div className="max-w-md w-full bg-black/40 backdrop-blur-xl p-8 rounded-3xl border border-rose-500/30">
          <ShieldAlert className="text-rose-500 mb-4" size={48} />
          <h2 className="text-2xl font-black mb-2">Dependency Error</h2>
          <p className="text-rose-200/60 text-sm mb-6 font-medium">The following core components failed to load from the CDN:</p>
          <ul className="space-y-2 mb-8">
            {healthErrors.map((err, i) => (
              <li key={i} className="flex items-center gap-2 text-xs font-mono bg-rose-500/10 p-2 rounded border border-rose-500/20">
                <span className="w-1.5 h-1.5 bg-rose-500 rounded-full" /> {err}
              </li>
            ))}
          </ul>
          <button onClick={() => window.location.reload()} className="w-full bg-white text-black py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2">
            <RefreshCw size={14}/> Re-Initialize System
          </button>
        </div>
      </div>
    );
  }

  if (healthStatus === 'checking') {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-white font-sans">
        <div className="relative">
          <div className="w-16 h-16 border-t-2 border-white rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 bg-white/10 rounded-full animate-pulse" />
          </div>
        </div>
        <p className="mt-8 text-[10px] font-black uppercase tracking-[0.4em] text-white/40">Securing Modules</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-gray-300 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation */}
      <nav className="fixed top-0 left-0 right-0 h-20 bg-black/50 backdrop-blur-md border-b border-white/5 z-40 px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-xl font-black italic tracking-tighter text-white">LUMIERE</div>
          <div className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-tighter ${connectionMode === 'cloud' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-orange-500/10 text-orange-500 border border-orange-500/20'}`}>
            {connectionMode === 'cloud' ? 'Synced' : 'Local'}
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="hidden md:flex gap-4">
            <button onClick={() => setActiveTab('dashboard')} className={`text-[10px] font-black uppercase tracking-widest ${activeTab === 'dashboard' ? 'text-white' : 'text-gray-600'}`}>Stats</button>
            <button onClick={() => setActiveTab('projects')} className={`text-[10px] font-black uppercase tracking-widest ${activeTab === 'projects' ? 'text-white' : 'text-gray-600'}`}>Log</button>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="p-3 bg-white text-black rounded-full hover:rotate-90 transition-transform">
            <Plus size={18} strokeWidth={3} />
          </button>
        </div>
      </nav>

      <main className="pt-32 px-6 pb-20 max-w-5xl mx-auto">
        {activeTab === 'dashboard' ? (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <header>
              <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter mb-4">Workspace.</h1>
              <p className="text-gray-500 font-medium max-w-md">Studio financial management and project tracking for professional creators.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#0c0c0c] border border-white/5 p-8 rounded-[32px] group hover:border-white/20 transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-2xl"><LayoutDashboard size={20}/></div>
                  <CheckCircle2 className="text-emerald-500" size={16}/>
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-600 mb-1">Total Revenue</p>
                <h2 className="text-4xl font-black text-white tracking-tight">
                  ${currentProjects.reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
                </h2>
              </div>

              <div className="bg-[#0c0c0c] border border-white/5 p-8 rounded-[32px] group hover:border-white/20 transition-all">
                 <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-rose-500/10 text-rose-500 rounded-2xl"><AlertCircle size={20}/></div>
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-600 mb-1">Operational Costs</p>
                <h2 className="text-4xl font-black text-white tracking-tight">
                  ${currentExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0).toLocaleString()}
                </h2>
              </div>
            </div>

            <section>
               <div className="flex justify-between items-end mb-6">
                 <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">Active Production</h3>
                 <span className="text-[10px] font-bold text-gray-600">{currentProjects.length} Projects</span>
               </div>
               <div className="space-y-2">
                 {currentProjects.slice(0, 4).map(p => (
                   <div key={p.id} className="bg-[#0c0c0c] p-5 rounded-2xl flex justify-between items-center hover:bg-[#111] transition-colors border border-transparent hover:border-white/5">
                      <div>
                        <p className="font-bold text-white">{p.name}</p>
                        <p className="text-[10px] font-black text-gray-600 uppercase tracking-tighter">{p.date}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-white">${p.amount.toLocaleString()}</p>
                        <p className="text-[9px] font-black text-indigo-500 uppercase">Production</p>
                      </div>
                   </div>
                 ))}
               </div>
            </section>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-500">
             <div className="flex justify-between items-end">
               <h2 className="text-3xl font-black text-white tracking-tighter">Full Log.</h2>
             </div>
             <div className="grid grid-cols-1 gap-3">
                {currentProjects.map(p => (
                  <div key={p.id} className="bg-[#0c0c0c] p-6 rounded-3xl border border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-white font-black">{p.name?.[0]}</div>
                      <div>
                        <p className="font-bold text-white text-lg">{p.name}</p>
                        <p className="text-xs font-medium text-gray-600 uppercase tracking-widest">{p.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-8">
                       <div className="text-right">
                         <p className="text-xl font-black text-white">${p.amount.toLocaleString()}</p>
                         <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">{p.status}</p>
                       </div>
                       <button 
                        onClick={async () => {
                          if (connectionMode === 'cloud') await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'projects', p.id));
                          else setLocalStore(prev => ({ ...prev, projects: prev.projects.filter(x => x.id !== p.id)}));
                        }}
                        className="p-3 bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all"
                       >
                         <Trash2 size={16} />
                       </button>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        )}
      </main>

      {/* ADD MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-[#0c0c0c] w-full max-w-md p-10 rounded-[40px] border border-white/10 shadow-2xl">
            <h3 className="text-2xl font-black text-white mb-8 tracking-tighter">Entry.</h3>
            <form onSubmit={handleAddProject} className="space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-600 px-1">Project Name</label>
                <input name="name" required className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white outline-none focus:border-white transition-colors" placeholder="e.g. Nike Winter Campaign" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-600 px-1">Budget</label>
                  <input name="amount" type="number" required className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white outline-none focus:border-white" placeholder="0" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-600 px-1">Date</label>
                  <input name="date" type="date" required className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white outline-none focus:border-white" />
                </div>
              </div>
              <button className="w-full bg-white text-black font-black py-5 rounded-2xl text-xs uppercase tracking-[0.2em] mt-4 hover:scale-[1.02] active:scale-95 transition-all">Submit Entry</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}