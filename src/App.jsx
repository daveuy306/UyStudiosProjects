import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  doc, 
  deleteDoc
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
  ChevronDown, 
  Trash2, 
  Users,
  FileText,
  AlertCircle
} from 'lucide-react';

// --- Safe Configuration Setup ---
const getAppConfig = () => {
  try {
    const config = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
    const id = typeof __app_id !== 'undefined' ? __app_id : 'expense-tracker-v1';
    const token = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
    return { config, id, token };
  } catch (e) {
    console.error("Config parse error", e);
    return { config: null, id: 'expense-tracker-v1', token: null };
  }
};

const { config: firebaseConfig, id: appId, token: initialToken } = getAppConfig();

// Initialize Firebase only if config exists
let db, auth;
if (firebaseConfig) {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
}

export default function App() {
  const [user, setUser] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [formData, setFormData] = useState({
    category: 'Equipment',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    reason: '',
    teamMember: '',
    role: '',
    pay: ''
  });

  // 1. Authentication Flow
  useEffect(() => {
    if (!auth) {
      setIsLoading(false);
      return;
    }

    const initAuth = async () => {
      try {
        if (initialToken) {
          await signInWithCustomToken(auth, initialToken);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error:", err);
        setError("Database connection failed. Please refresh.");
      }
    };

    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Real-time Data Syncing
  useEffect(() => {
    if (!user || !db) return;

    const expensesCol = collection(db, 'artifacts', appId, 'public', 'data', 'expenses');
    
    const unsubscribe = onSnapshot(expensesCol, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      // Sort by date descending
      setExpenses(data.sort((a, b) => new Date(b.date) - new Date(a.date)));
    }, (err) => {
      console.error("Sync error:", err);
    });

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
      console.error("Save error:", err);
    }
  };

  const deleteExpense = async (id) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'expenses', id));
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  if (!firebaseConfig) {
    return (
      <div className="min-h-screen bg-[#0f111a] flex items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-4">
          <AlertCircle className="w-12 h-12 text-pink-500 mx-auto" />
          <h1 className="text-xl font-bold text-white">Missing Configuration</h1>
          <p className="text-slate-400 text-sm">
            The environment variables are not yet available. Please wait a moment or ensure you are in a live project session.
          </p>
          <div className="pt-4">
             <Loader2 className="w-6 h-6 animate-spin text-slate-700 mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f111a] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-pink-500" />
      </div>
    );
  }

  const totals = expenses.reduce((acc, curr) => ({
    total: acc.total + (curr.amount || 0) + (curr.pay || 0),
    labor: acc.labor + (curr.pay || 0)
  }), { total: 0, labor: 0 });

  return (
    <div className="min-h-screen bg-[#0f111a] text-slate-200 font-sans">
      <nav className="border-b border-slate-800 bg-[#0f111a]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-pink-600 rounded-lg flex items-center justify-center shadow-lg shadow-pink-900/20">
              <DollarSign className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-lg text-white tracking-tight">SyncTracker</span>
          </div>
          <div className="flex items-center gap-3">
             <div className="px-3 py-1 bg-green-500/10 text-green-400 text-[10px] font-bold rounded-full border border-green-500/20 uppercase">Live Sync</div>
             <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-4 md:p-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <h1 className="text-4xl font-black text-white mb-2 italic">Dashboard</h1>
            <p className="text-slate-500 font-medium">Real-time expenditure & labor tracking.</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-pink-600 hover:bg-pink-700 text-white px-8 py-4 rounded-2xl font-black flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl shadow-pink-900/30 uppercase tracking-wider text-sm"
          >
            <Plus size={20} strokeWidth={3} /> Add New Entry
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 text-left">
          <div className="bg-[#161b2c] p-8 rounded-[2rem] border border-slate-800 shadow-sm">
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Total Spend</p>
            <h2 className="text-4xl font-black text-white tracking-tighter">${totals.total.toLocaleString()}</h2>
          </div>
          <div className="bg-[#161b2c] p-8 rounded-[2rem] border border-slate-800 shadow-sm border-l-pink-600/50">
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Total Labor</p>
            <h2 className="text-4xl font-black text-pink-500 tracking-tighter">${totals.labor.toLocaleString()}</h2>
          </div>
          <div className="bg-[#161b2c] p-8 rounded-[2rem] border border-slate-800 shadow-sm">
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Total Items</p>
            <h2 className="text-4xl font-black text-white tracking-tighter">{expenses.length}</h2>
          </div>
        </div>

        <div className="bg-[#161b2c] rounded-[2rem] border border-slate-800 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/30">
            <h3 className="font-bold text-white uppercase text-xs tracking-widest flex items-center gap-2">
              <FileText size={14} className="text-pink-500" /> Transaction History
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-slate-500 text-[10px] uppercase tracking-[0.2em]">
                  <th className="px-8 py-5 font-black">Date</th>
                  <th className="px-8 py-5 font-black">Team Member</th>
                  <th className="px-8 py-5 font-black">Details</th>
                  <th className="px-8 py-5 font-black text-right">Total Cost</th>
                  <th className="px-8 py-5 font-black text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-left">
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-8 py-20 text-center text-slate-600 italic font-medium">No records found.</td>
                  </tr>
                ) : (
                  expenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-8 py-6 text-sm text-slate-400 font-mono">{exp.date}</td>
                      <td className="px-8 py-6">
                        <div className="font-black text-white leading-tight uppercase text-xs tracking-wide">{exp.teamMember || 'General'}</div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-wider">{exp.role || 'Unassigned'}</div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-xs text-slate-400 max-w-xs">{exp.reason}</div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="font-black text-white text-lg tracking-tighter">
                          ${((exp.amount || 0) + (exp.pay || 0)).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-center">
                        <button onClick={() => deleteExpense(exp.id)} className="p-2 text-slate-700 hover:text-red-500 transition-colors">
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

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-[#161b2c] w-full max-w-xl rounded-[2.5rem] border border-slate-800 shadow-2xl relative overflow-hidden">
            <div className="p-10">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-black text-pink-500 italic tracking-tighter uppercase">New Record</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5 text-left">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Category</label>
                    <select 
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      className="w-full bg-[#0f111a] border border-slate-800 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:ring-1 focus:ring-pink-600"
                    >
                      <option>Equipment</option>
                      <option>Labor</option>
                      <option>Software</option>
                      <option>Travel</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Date</label>
                    <input 
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      className="w-full bg-[#0f111a] border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-pink-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-pink-500 uppercase tracking-widest">Item Cost ($)</label>
                    <input 
                      type="number" step="0.01" required placeholder="0.00"
                      value={formData.amount}
                      onChange={(e) => setFormData({...formData, amount: e.target.value})}
                      className="w-full bg-[#0f111a] border border-slate-800 rounded-xl px-4 py-3 text-white font-black text-lg focus:outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Member Pay ($)</label>
                    <input 
                      type="number" step="0.01" placeholder="0.00"
                      value={formData.pay}
                      onChange={(e) => setFormData({...formData, pay: e.target.value})}
                      className="w-full bg-[#0f111a] border border-slate-800 rounded-xl px-4 py-3 text-white font-black text-lg focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Member Name</label>
                    <input 
                      type="text" placeholder="John Doe"
                      value={formData.teamMember}
                      onChange={(e) => setFormData({...formData, teamMember: e.target.value})}
                      className="w-full bg-[#0f111a] border border-slate-800 rounded-xl px-4 py-3 text-white font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Member Role</label>
                    <input 
                      type="text" placeholder="Manager"
                      value={formData.role}
                      onChange={(e) => setFormData({...formData, role: e.target.value})}
                      className="w-full bg-[#0f111a] border border-slate-800 rounded-xl px-4 py-3 text-white font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Description</label>
                  <textarea 
                    placeholder="Brief details..."
                    value={formData.reason}
                    onChange={(e) => setFormData({...formData, reason: e.target.value})}
                    className="w-full bg-[#0f111a] border border-slate-800 rounded-xl px-4 py-3 text-white min-h-[80px]"
                  />
                </div>

                <button type="submit" className="w-full bg-pink-600 hover:bg-pink-700 text-white font-black py-4 rounded-xl shadow-xl shadow-pink-900/20 uppercase tracking-widest italic transition-all active:scale-95">
                  Confirm & Sync
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}