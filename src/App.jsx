import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  doc, 
  deleteDoc,
  enableIndexedDbPersistence
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
  CreditCard,
  Briefcase
} from 'lucide-react';

// --- Environment Variable Shield ---
// Safely extract global variables provided by the container
const getSafeEnv = () => {
  let config = null;
  let id = 'expense-tracker-default';
  let token = null;

  try {
    if (typeof __firebase_config !== 'undefined') {
      config = JSON.parse(__firebase_config);
    }
    if (typeof __app_id !== 'undefined') {
      id = __app_id;
    }
    if (typeof __initial_auth_token !== 'undefined') {
      token = __initial_auth_token;
    }
  } catch (e) {
    console.warn("Environment config not ready yet.");
  }
  return { config, id, token };
};

const { config: firebaseConfig, id: appId, token: initialToken } = getSafeEnv();

// Singleton instances
let db = null;
let auth = null;

if (firebaseConfig) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
  } catch (e) {
    console.error("Firebase Initialization Error:", e);
  }
}

export default function App() {
  const [user, setUser] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  
  const [formData, setFormData] = useState({
    category: 'Equipment',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    reason: '',
    teamMember: '',
    role: '',
    pay: ''
  });

  // 1. Authentication Lifecycle
  useEffect(() => {
    if (!auth) {
      // If config wasn't available at startup, wait and check again or show error
      const timer = setTimeout(() => {
        if (!auth) setIsLoading(false);
      }, 2000);
      return () => clearTimeout(timer);
    }

    const performAuth = async () => {
      try {
        if (initialToken) {
          await signInWithCustomToken(auth, initialToken);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth Exception:", err);
        setAuthError("Session synchronization error. Please try refreshing.");
      }
    };

    performAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Real-time Data Sync
  useEffect(() => {
    if (!user || !db) return;

    // RULE 1: Strict pathing for public data
    const expensesCol = collection(db, 'artifacts', appId, 'public', 'data', 'expenses');
    
    // RULE 2: No complex queries, fetch and sort in memory
    const unsubscribe = onSnapshot(expensesCol, 
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        }));
        setExpenses(data.sort((a, b) => new Date(b.date) - new Date(a.date)));
      }, 
      (err) => {
        console.error("Firestore Listener Error:", err);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user || !db) return;

    try {
      const expensesCol = collection(db, 'artifacts', appId, 'public', 'data', 'expenses');
      await addDoc(expensesCol, {
        ...formData,
        amount: parseFloat(formData.amount) || 0,
        pay: parseFloat(formData.pay) || 0,
        createdBy: user.uid,
        createdAt: new Date().toISOString()
      });
      
      setIsModalOpen(false);
      setFormData({
        category: 'Equipment', amount: '', date: new Date().toISOString().split('T')[0],
        reason: '', teamMember: '', role: '', pay: ''
      });
    } catch (err) {
      console.error("Save Error:", err);
    }
  };

  const deleteExpense = async (id) => {
    if (!db || !user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'expenses', id));
    } catch (err) {
      console.error("Delete Error:", err);
    }
  };

  // Error States
  if (!firebaseConfig) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-6 text-center">
        <div className="max-w-md bg-[#18181b] p-8 rounded-3xl border border-white/5 shadow-2xl">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Connecting to Services...</h1>
          <p className="text-zinc-400 text-sm mb-6">
            Establishing a secure connection to the database. This usually takes a few seconds.
          </p>
          <Loader2 className="w-6 h-6 animate-spin text-zinc-600 mx-auto" />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-pink-500/20 border-t-pink-500 rounded-full animate-spin"></div>
            <DollarSign className="absolute inset-0 m-auto w-5 h-5 text-pink-500" />
          </div>
          <span className="text-zinc-500 font-medium text-sm animate-pulse">Loading Workspace</span>
        </div>
      </div>
    );
  }

  const totals = expenses.reduce((acc, curr) => ({
    total: acc.total + (Number(curr.amount) || 0) + (Number(curr.pay) || 0),
    labor: acc.labor + (Number(curr.pay) || 0),
    items: acc.items + (Number(curr.amount) || 0)
  }), { total: 0, labor: 0, items: 0 });

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-300 selection:bg-pink-500/30 selection:text-pink-200">
      {/* Header */}
      <nav className="sticky top-0 z-40 bg-[#09090b]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-pink-600 to-rose-400 rounded-xl flex items-center justify-center shadow-lg shadow-pink-500/20">
              <TrendingUp className="text-white w-6 h-6" />
            </div>
            <div>
              <span className="font-black text-xl text-white block leading-none tracking-tight">EX-TRACK</span>
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Enterprise Console</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end mr-2">
              <span className="text-[10px] text-zinc-500 font-bold uppercase">Network Status</span>
              <span className="text-xs text-green-500 font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                ACTIVE NODE
              </span>
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-white text-black hover:bg-zinc-200 px-5 py-2.5 rounded-full font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-white/5 active:scale-95"
            >
              <Plus size={18} /> New Entry
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {[
            { label: 'Total Gross Spend', value: totals.total, icon: CreditCard, color: 'text-white' },
            { label: 'Labor Allocation', value: totals.labor, icon: Briefcase, color: 'text-pink-500' },
            { label: 'Material Costs', value: totals.items, icon: DollarSign, color: 'text-zinc-400' }
          ].map((stat, i) => (
            <div key={i} className="bg-[#18181b] p-8 rounded-[2rem] border border-white/5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <stat.icon size={80} />
              </div>
              <p className="text-zinc-500 text-[11px] font-black uppercase tracking-[0.2em] mb-3">{stat.label}</p>
              <h2 className={`text-4xl font-black ${stat.color} tracking-tighter`}>
                ${stat.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </h2>
            </div>
          ))}
        </div>

        {/* Table Section */}
        <div className="bg-[#18181b] rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl">
          <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-zinc-900/20">
            <h3 className="font-bold text-white text-sm tracking-wide flex items-center gap-2">
              <FileText size={16} className="text-pink-500" /> TRANSACTION LEDGER
            </h3>
            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-3 py-1 rounded-full font-black">
              {expenses.length} TOTAL RECORDS
            </span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-zinc-500 text-[10px] uppercase tracking-[0.2em] border-b border-white/5">
                  <th className="px-8 py-6 font-black">Timeline</th>
                  <th className="px-8 py-6 font-black">Entity / Role</th>
                  <th className="px-8 py-6 font-black">Description</th>
                  <th className="px-8 py-6 font-black text-right text-white">Gross Value</th>
                  <th className="px-8 py-6 font-black text-center">Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-8 py-24 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center text-zinc-700 mb-2">
                          <FileText size={24} />
                        </div>
                        <p className="text-zinc-500 font-medium italic">No transactions synchronized</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  expenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-white/[0.01] transition-colors group">
                      <td className="px-8 py-7 text-xs font-mono text-zinc-500">{exp.date}</td>
                      <td className="px-8 py-7">
                        <div className="font-bold text-white text-sm uppercase tracking-wide">{exp.teamMember || 'System Origin'}</div>
                        <div className="text-[10px] text-zinc-500 font-bold uppercase mt-1">{exp.role || 'Uncategorized'}</div>
                      </td>
                      <td className="px-8 py-7">
                        <div className="text-xs text-zinc-400 max-w-sm leading-relaxed">{exp.reason}</div>
                      </td>
                      <td className="px-8 py-7 text-right">
                        <div className="font-black text-white text-lg tracking-tight">
                          ${((Number(exp.amount) || 0) + (Number(exp.pay) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                      </td>
                      <td className="px-8 py-7 text-center">
                        <button 
                          onClick={() => deleteExpense(exp.id)} 
                          className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-700 hover:text-rose-500 hover:bg-rose-500/10 transition-all active:scale-90"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setIsModalOpen(false)}></div>
          <div className="bg-[#18181b] w-full max-w-xl rounded-[3rem] border border-white/10 shadow-2xl relative z-10 overflow-hidden animate-in zoom-in duration-200">
            <div className="p-10">
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">Add Entry</h2>
                <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-full bg-zinc-900 text-zinc-500 flex items-center justify-center hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Type</label>
                    <select 
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      className="w-full bg-zinc-900 border border-white/5 rounded-2xl px-5 py-4 text-white font-bold focus:outline-none focus:border-pink-500/50 appearance-none"
                    >
                      <option>Equipment</option>
                      <option>Labor</option>
                      <option>Infrastructure</option>
                      <option>Miscellaneous</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Timeline</label>
                    <input 
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      className="w-full bg-zinc-900 border border-white/5 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-pink-500/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-pink-500 uppercase tracking-widest ml-1">Asset Value ($)</label>
                    <input 
                      type="number" step="0.01" required placeholder="0.00"
                      value={formData.amount}
                      onChange={(e) => setFormData({...formData, amount: e.target.value})}
                      className="w-full bg-zinc-900 border border-white/5 rounded-2xl px-5 py-4 text-white font-black text-xl focus:outline-none focus:border-pink-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Labor Payout ($)</label>
                    <input 
                      type="number" step="0.01" placeholder="0.00"
                      value={formData.pay}
                      onChange={(e) => setFormData({...formData, pay: e.target.value})}
                      className="w-full bg-zinc-900 border border-white/5 rounded-2xl px-5 py-4 text-white font-black text-xl focus:outline-none focus:border-white/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Entity Name</label>
                    <input 
                      type="text" placeholder="Member/Vendor"
                      value={formData.teamMember}
                      onChange={(e) => setFormData({...formData, teamMember: e.target.value})}
                      className="w-full bg-zinc-900 border border-white/5 rounded-2xl px-5 py-4 text-white font-bold focus:outline-none focus:border-white/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Functional Role</label>
                    <input 
                      type="text" placeholder="Dev / Design"
                      value={formData.role}
                      onChange={(e) => setFormData({...formData, role: e.target.value})}
                      className="w-full bg-zinc-900 border border-white/5 rounded-2xl px-5 py-4 text-white font-bold focus:outline-none focus:border-white/20"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Ledger Note</label>
                  <textarea 
                    placeholder="Specific transaction details..."
                    value={formData.reason}
                    onChange={(e) => setFormData({...formData, reason: e.target.value})}
                    className="w-full bg-zinc-900 border border-white/5 rounded-2xl px-5 py-4 text-white min-h-[100px] resize-none focus:outline-none focus:border-white/20"
                  />
                </div>

                <button 
                  type="submit" 
                  className="w-full bg-white text-black font-black py-5 rounded-2xl shadow-xl hover:bg-zinc-200 uppercase tracking-[0.2em] italic transition-all active:scale-[0.98] mt-4"
                >
                  Authorize Entry
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {authError && (
        <div className="fixed bottom-6 right-6 z-[60] bg-rose-500 text-white px-6 py-4 rounded-2xl font-bold shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-4">
          <AlertCircle size={20} />
          <span>{authError}</span>
          <button onClick={() => setAuthError(null)} className="ml-2 hover:opacity-70"><X size={16} /></button>
        </div>
      )}
    </div>
  );
}