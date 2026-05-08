import React, { useState, useEffect, useRef } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  doc, 
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  Plus, 
  X, 
  DollarSign, 
  Trash2, 
  FileText,
  AlertCircle,
  TrendingUp,
  Calendar,
  RefreshCcw,
  Wallet
} from 'lucide-react';

// --- Safe Configuration Retrieval ---
const getFirebaseConfig = () => {
  try {
    // Check if the global variable provided by the environment exists
    if (typeof __firebase_config !== 'undefined' && __firebase_config) {
      return JSON.parse(__firebase_config);
    }
  } catch (e) {
    console.error("Config parse error:", e);
  }
  return null;
};

const getAppId = () => (typeof __app_id !== 'undefined' ? __app_id : 'expense-app-default');

export default function App() {
  const [user, setUser] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [status, setStatus] = useState('connecting'); // connecting, ready, error
  const [retryCount, setRetryCount] = useState(0);
  
  const dbRef = useRef(null);
  const authRef = useRef(null);

  const [formData, setFormData] = useState({
    category: 'Equipment',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    reason: ''
  });

  // Initialization Logic with Auto-Retry for Environment Variables
  useEffect(() => {
    let timeoutId;
    
    const initFirebase = async () => {
      const config = getFirebaseConfig();
      
      // If config isn't available yet, wait 1.5s and try again (up to 8 times)
      if (!config) {
        if (retryCount < 8) {
          console.log(`Config not found, retry ${retryCount + 1}/8...`);
          timeoutId = setTimeout(() => setRetryCount(prev => prev + 1), 1500);
        } else {
          setStatus('error');
        }
        return;
      }

      try {
        // Initialize App
        const app = getApps().length > 0 ? getApp() : initializeApp(config);
        dbRef.current = getFirestore(app);
        authRef.current = getAuth(app);

        // Authenticate
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(authRef.current, __initial_auth_token);
        } else {
          await signInAnonymously(authRef.current);
        }

        const unsubscribe = onAuthStateChanged(authRef.current, (u) => {
          setUser(u);
          if (u) {
            setStatus('ready');
            console.log("Firebase connected successfully");
          }
        });

        return unsubscribe;
      } catch (err) {
        console.error("Firebase Initialization Failed:", err);
        setStatus('error');
      }
    };

    initFirebase();
    return () => clearTimeout(timeoutId);
  }, [retryCount]);

  // Real-time Data Sync
  useEffect(() => {
    if (!user || !dbRef.current || status !== 'ready') return;

    const appId = getAppId();
    const q = collection(dbRef.current, 'artifacts', appId, 'public', 'data', 'expenses');
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort in memory by date descending
      setExpenses(docs.sort((a, b) => new Date(b.date) - new Date(a.date)));
    }, (err) => {
      console.error("Firestore Error:", err);
    });

    return () => unsubscribe();
  }, [user, status]);

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!dbRef.current || !user) return;

    try {
      const appId = getAppId();
      await addDoc(collection(dbRef.current, 'artifacts', appId, 'public', 'data', 'expenses'), {
        ...formData,
        amount: parseFloat(formData.amount) || 0,
        createdAt: serverTimestamp(),
        userId: user.uid
      });
      setIsModalOpen(false);
      setFormData({ category: 'Equipment', amount: '', date: new Date().toISOString().split('T')[0], reason: '' });
    } catch (err) {
      console.error("Failed to add expense:", err);
    }
  };

  const deleteItem = async (id) => {
    try {
      const appId = getAppId();
      await deleteDoc(doc(dbRef.current, 'artifacts', appId, 'public', 'data', 'expenses', id));
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const total = expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);

  // --- UI STATES ---

  if (status === 'connecting') {
    return (
      <div className="min-h-screen bg-[#0b0d14] flex flex-col items-center justify-center p-6 text-center">
        <div className="relative mb-8">
          <div className="w-20 h-20 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin"></div>
          <Wallet className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-500 w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Syncing with Cloud</h2>
        <p className="text-zinc-500 max-w-xs leading-relaxed">
          Establishing a secure connection to your database. This usually takes a few seconds.
        </p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#0b0d14] flex items-center justify-center p-6">
        <div className="bg-[#161a27] p-10 rounded-[2.5rem] border border-white/5 shadow-2xl flex flex-col items-center max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mb-6">
            <AlertCircle className="text-rose-500 w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Connection Failed</h2>
          <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
            The app couldn't detect the Firebase environment configuration. This can happen if the editor is still loading.
          </p>
          <button 
            onClick={() => { setStatus('connecting'); setRetryCount(0); }}
            className="flex items-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3.5 rounded-2xl font-bold transition-all active:scale-95 shadow-lg shadow-indigo-500/20"
          >
            <RefreshCcw size={18} /> Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0d14] text-zinc-300 font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <header className="border-b border-white/5 px-8 py-6 flex items-center justify-between sticky top-0 bg-[#0b0d14]/80 backdrop-blur-xl z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <TrendingUp className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-black text-white tracking-tight uppercase">Expense Hub</h1>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-full font-bold text-sm transition-all flex items-center gap-2 active:scale-95 shadow-lg shadow-indigo-600/20"
        >
          <Plus size={18} /> New Expense
        </button>
      </header>

      <main className="max-w-5xl mx-auto p-8">
        {/* Balance Card */}
        <div className="bg-gradient-to-br from-[#1c2235] to-[#141829] p-12 rounded-[3rem] border border-white/5 mb-12 shadow-2xl relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-zinc-500 text-xs font-black uppercase tracking-[0.4em] mb-3 opacity-60">Total Expenditure</p>
            <h2 className="text-7xl font-black text-white tracking-tighter transition-all group-hover:scale-[1.02] duration-500">
              ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
          </div>
          <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-700">
            <DollarSign size={220} className="text-white" />
          </div>
        </div>

        {/* List Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] flex items-center gap-2">
              <FileText size={14} className="text-indigo-500" /> Recent Transactions
            </h3>
            <span className="text-[10px] font-black text-zinc-600 uppercase bg-white/5 px-3 py-1 rounded-full">
              {expenses.length} Records
            </span>
          </div>
          
          <div className="grid gap-4">
            {expenses.map(exp => (
              <div key={exp.id} className="bg-[#161a27] p-6 rounded-[2rem] border border-white/5 flex items-center justify-between hover:border-indigo-500/30 transition-all group hover:translate-x-1 duration-300">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 bg-[#0b0d14] rounded-2xl flex items-center justify-center text-indigo-400 font-black text-xl border border-white/5 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-300">
                    {exp.category[0]}
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-lg tracking-tight mb-0.5">{exp.reason || 'Untitled Expense'}</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded font-black uppercase tracking-widest">{exp.category}</span>
                      <span className="text-[10px] text-zinc-600 font-bold uppercase">{exp.date}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <span className="text-2xl font-black text-white tracking-tighter">
                    ${(Number(exp.amount) || 0).toLocaleString()}
                  </span>
                  <button 
                    onClick={() => deleteItem(exp.id)}
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-zinc-700 hover:text-rose-500 hover:bg-rose-500/10 transition-all border border-transparent hover:border-rose-500/20"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {expenses.length === 0 && (
            <div className="py-32 text-center border-2 border-dashed border-white/5 rounded-[3rem] bg-white/[0.01]">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="text-zinc-700" size={32} />
              </div>
              <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">No records found</p>
            </div>
          )}
        </div>
      </main>

      {/* Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-[#06080e]/95 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsModalOpen(false)}></div>
          <div className="bg-[#161a27] w-full max-w-lg rounded-[3rem] border border-white/10 shadow-2xl relative z-10 overflow-hidden flex flex-col p-12 animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-4xl font-black text-white tracking-tighter">New Entry</h2>
              <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-zinc-500 hover:text-white transition-all">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Category</label>
                  <select 
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                    className="w-full bg-[#0b0d14] border border-white/5 rounded-2xl px-6 py-4 text-zinc-300 font-bold focus:outline-none focus:border-indigo-500/50 appearance-none cursor-pointer"
                  >
                    <option>Equipment</option>
                    <option>Labor</option>
                    <option>Office</option>
                    <option>Travel</option>
                    <option>Marketing</option>
                    <option>Software</option>
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Date</label>
                  <input 
                    type="date" required
                    value={formData.date}
                    onChange={e => setFormData({...formData, date: e.target.value})}
                    className="w-full bg-[#0b0d14] border border-white/5 rounded-2xl px-6 py-4 text-zinc-300 font-bold focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Transaction Amount ($)</label>
                <input 
                  type="number" required step="0.01" placeholder="0.00"
                  value={formData.amount}
                  onChange={e => setFormData({...formData, amount: e.target.value})}
                  className="w-full bg-[#0b0d14] border border-white/5 rounded-[2rem] px-8 py-6 text-white font-black text-4xl focus:outline-none focus:border-indigo-500 shadow-inner"
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Memo / Reason</label>
                <textarea 
                  required placeholder="What was this for?"
                  value={formData.reason}
                  onChange={e => setFormData({...formData, reason: e.target.value})}
                  className="w-full bg-[#0b0d14] border border-white/5 rounded-2xl px-6 py-5 text-zinc-300 font-medium min-h-[120px] resize-none focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <button 
                type="submit" 
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-6 rounded-[2rem] shadow-2xl shadow-indigo-600/30 uppercase tracking-widest transition-all active:scale-[0.98] mt-4"
              >
                Log Transaction
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}