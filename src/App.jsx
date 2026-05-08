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
  Loader2, 
  Trash2, 
  FileText,
  AlertCircle,
  TrendingUp,
  Calendar,
  RefreshCcw
} from 'lucide-react';

// --- Configuration Helper ---
const getFirebaseConfig = () => {
  try {
    if (typeof __firebase_config !== 'undefined' && __firebase_config) {
      return JSON.parse(__firebase_config);
    }
  } catch (e) {
    console.error("Config parse error", e);
  }
  return null;
};

const getAppId = () => (typeof __app_id !== 'undefined' ? __app_id : 'default-app');

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

  // Initialization Logic
  useEffect(() => {
    let timeout;
    
    const initFirebase = async () => {
      const config = getFirebaseConfig();
      
      if (!config) {
        // If config isn't there, wait and try again up to 5 times
        if (retryCount < 5) {
          timeout = setTimeout(() => setRetryCount(prev => prev + 1), 1000);
        } else {
          setStatus('error');
        }
        return;
      }

      try {
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
          if (u) setStatus('ready');
        });

        return unsubscribe;
      } catch (err) {
        console.error("Firebase Init Error:", err);
        setStatus('error');
      }
    };

    initFirebase();
    return () => clearTimeout(timeout);
  }, [retryCount]);

  // Firestore Sync
  useEffect(() => {
    if (!user || !dbRef.current || status !== 'ready') return;

    const appId = getAppId();
    const q = collection(dbRef.current, 'artifacts', appId, 'public', 'data', 'expenses');
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setExpenses(docs.sort((a, b) => new Date(b.date) - new Date(a.date)));
    }, (err) => {
      console.error("Firestore Listen Error:", err);
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
      console.error("Save Error:", err);
    }
  };

  const deleteItem = async (id) => {
    try {
      const appId = getAppId();
      await deleteDoc(doc(dbRef.current, 'artifacts', appId, 'public', 'data', 'expenses', id));
    } catch (err) {
      console.error("Delete Error:", err);
    }
  };

  // Loading Screen
  if (status === 'connecting') {
    return (
      <div className="min-h-screen bg-[#0f111a] flex items-center justify-center p-6">
        <div className="text-center animate-pulse">
          <div className="w-16 h-16 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin mx-auto mb-6"></div>
          <h2 className="text-xl font-bold text-white mb-2">Connecting to Services...</h2>
          <p className="text-zinc-500 text-sm">Synchronizing your financial data...</p>
        </div>
      </div>
    );
  }

  // Error Screen
  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#0f111a] flex items-center justify-center p-6">
        <div className="bg-[#1a1d29] p-10 rounded-[2.5rem] border border-white/5 shadow-2xl flex flex-col items-center max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mb-6">
            <AlertCircle className="text-rose-500 w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Connection Failed</h2>
          <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
            We couldn't verify your Firebase environment variables. Please check your settings or try again.
          </p>
          <button 
            onClick={() => { setStatus('connecting'); setRetryCount(0); }}
            className="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-8 py-3 rounded-2xl font-bold transition-all active:scale-95"
          >
            <RefreshCcw size={18} /> Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const total = expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);

  return (
    <div className="min-h-screen bg-[#0f111a] text-zinc-300 font-sans selection:bg-rose-500/30">
      <header className="border-b border-white/5 px-8 py-6 flex items-center justify-between sticky top-0 bg-[#0f111a]/80 backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-rose-500 rounded-xl flex items-center justify-center shadow-lg shadow-rose-500/20">
            <TrendingUp className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-black text-white tracking-tight uppercase">Expense Hub</h1>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-rose-500 hover:bg-rose-600 text-white px-6 py-2.5 rounded-full font-bold text-sm transition-all flex items-center gap-2 active:scale-95"
        >
          <Plus size={18} /> Add Entry
        </button>
      </header>

      <main className="max-w-5xl mx-auto p-8">
        <div className="bg-gradient-to-br from-[#1a1d29] to-[#141621] p-10 rounded-[2.5rem] border border-white/5 mb-10 shadow-2xl relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mb-2">Total Balance Out</p>
            <h2 className="text-6xl font-black text-white tracking-tighter group-hover:text-rose-500 transition-colors">
              ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </h2>
          </div>
          <div className="absolute top-0 right-0 p-10 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
            <DollarSign size={180} className="text-white" />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
            <FileText size={14} /> Transaction History
          </h3>
          
          {expenses.map(exp => (
            <div key={exp.id} className="bg-[#1a1d29] p-6 rounded-3xl border border-white/5 flex items-center justify-between hover:border-white/10 transition-all group">
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 bg-[#0f111a] rounded-2xl flex items-center justify-center text-rose-500 font-bold border border-white/5 group-hover:border-rose-500/30 transition-colors">
                  {exp.category[0]}
                </div>
                <div>
                  <h4 className="font-bold text-white uppercase text-sm tracking-wide">{exp.reason || 'No Description'}</h4>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase mt-0.5">{exp.category} • {exp.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <span className="text-xl font-black text-white tracking-tight">
                  ${(Number(exp.amount) || 0).toLocaleString()}
                </span>
                <button 
                  onClick={() => deleteItem(exp.id)}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-700 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}

          {expenses.length === 0 && (
            <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[2.5rem]">
              <p className="text-zinc-500 font-medium text-sm">Your ledger is currently empty.</p>
            </div>
          )}
        </div>
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-[#090b14]/90 backdrop-blur-md animate-in fade-in" onClick={() => setIsModalOpen(false)}></div>
          <div className="bg-[#111421] w-full max-w-md rounded-[2.5rem] border border-white/10 shadow-2xl relative z-10 overflow-hidden flex flex-col p-10 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-black text-rose-500 tracking-tighter">Add Expense</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Category</label>
                <select 
                  value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value})}
                  className="w-full bg-[#0a0c16] border border-white/5 rounded-2xl px-6 py-4 text-zinc-300 font-medium focus:outline-none focus:border-rose-500/50 appearance-none cursor-pointer"
                >
                  <option>Equipment</option>
                  <option>Labor</option>
                  <option>Office</option>
                  <option>Travel</option>
                  <option>Marketing</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Amount ($)</label>
                <input 
                  type="number" required step="0.01" placeholder="0.00"
                  value={formData.amount}
                  onChange={e => setFormData({...formData, amount: e.target.value})}
                  className="w-full bg-[#0a0c16] border border-white/5 rounded-2xl px-6 py-4 text-rose-500 font-black text-2xl focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Date</label>
                <div className="relative">
                  <input 
                    type="date" required
                    value={formData.date}
                    onChange={e => setFormData({...formData, date: e.target.value})}
                    className="w-full bg-[#0a0c16] border border-white/5 rounded-2xl px-6 py-4 text-zinc-300 focus:outline-none focus:border-rose-500/50"
                  />
                  <Calendar size={18} className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-700 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Reason</label>
                <textarea 
                  required placeholder="What was this purchase for?"
                  value={formData.reason}
                  onChange={e => setFormData({...formData, reason: e.target.value})}
                  className="w-full bg-[#0a0c16] border border-white/5 rounded-2xl px-6 py-4 text-zinc-300 min-h-[100px] resize-none focus:outline-none focus:border-rose-500/50"
                />
              </div>

              <button 
                type="submit" 
                className="w-full bg-rose-500 hover:bg-rose-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-rose-500/20 uppercase tracking-widest transition-all active:scale-[0.98] mt-4"
              >
                Save Transaction
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}