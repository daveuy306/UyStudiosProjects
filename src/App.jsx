import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  doc, 
  setDoc,
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
  User, 
  Briefcase, 
  Calendar, 
  FileText, 
  AlertCircle,
  Loader2,
  ChevronDown,
  Trash2,
  Users
} from 'lucide-react';

// --- Firebase Configuration ---
// These global variables are provided by the environment at runtime
const firebaseConfig = JSON.parse(__firebase_config);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'expense-tracker-v1';

// Initialize Firebase services immediately
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export default function App() {
  const [user, setUser] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    category: 'Equipment',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    reason: '',
    teamMember: '',
    role: '',
    pay: ''
  });

  // 1. Mandatory Authentication Flow
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Authentication failed:", err);
      }
    };

    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsInitialLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Real-time Data Syncing (Across Devices)
  useEffect(() => {
    if (!user) return;

    // RULE 1: Use the strict public data path for global syncing
    const expensesCol = collection(db, 'artifacts', appId, 'public', 'data', 'expenses');
    
    // RULE 2: Simple query to avoid index requirements
    const unsubscribe = onSnapshot(expensesCol, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      
      // Sort by date (descending) in memory
      const sortedData = data.sort((a, b) => new Date(b.date) - new Date(a.date));
      setExpenses(sortedData);
    }, (error) => {
      console.error("Firestore sync error:", error);
    });

    return () => unsubscribe();
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;

    try {
      const expensesCol = collection(db, 'artifacts', appId, 'public', 'data', 'expenses');
      
      const payload = {
        category: formData.category,
        amount: parseFloat(formData.amount) || 0,
        pay: parseFloat(formData.pay) || 0,
        date: formData.date,
        reason: formData.reason,
        teamMember: formData.teamMember,
        role: formData.role,
        createdBy: user.uid,
        userName: user.isAnonymous ? 'Guest User' : user.displayName || user.email || 'Team Member',
        createdAt: new Date().toISOString()
      };

      await addDoc(expensesCol, payload);
      
      setIsModalOpen(false);
      setFormData({
        category: 'Equipment',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        reason: '',
        teamMember: '',
        role: '',
        pay: ''
      });
    } catch (err) {
      console.error("Failed to save expense:", err);
    }
  };

  const deleteExpense = async (id) => {
    if (!confirm('Are you sure you want to delete this record?')) return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'expenses', id);
      await deleteDoc(docRef);
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-[#0f111a] flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-10 h-10 animate-spin text-pink-500 mb-4" />
        <p>Connecting to secure database...</p>
      </div>
    );
  }

  const totalSpend = expenses.reduce((acc, curr) => acc + (curr.amount || 0) + (curr.pay || 0), 0);
  const totalLabor = expenses.reduce((acc, curr) => acc + (curr.pay || 0), 0);

  return (
    <div className="min-h-screen bg-[#0f111a] text-slate-200 font-sans selection:bg-pink-500/30">
      {/* Top Navigation */}
      <nav className="border-b border-slate-800 bg-[#0f111a]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-pink-600 rounded-lg flex items-center justify-center">
              <DollarSign className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-lg tracking-tight text-white">ProjectTracker</span>
          </div>
          <div className="flex items-center gap-4">
             <div className="hidden md:block text-xs font-medium px-3 py-1 bg-green-500/10 text-green-400 rounded-full border border-green-500/20">
               Live Sync Active
             </div>
             <span className="text-xs text-slate-500 font-mono">User: {user?.uid?.slice(0, 8)}...</span>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-4 md:p-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <h1 className="text-4xl font-extrabold text-white mb-2">Financial Dashboard</h1>
            <p className="text-slate-500">Real-time expenditure tracking for your project team.</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-pink-600 hover:bg-pink-700 text-white px-8 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all transform hover:scale-[1.02] active:scale-95 shadow-xl shadow-pink-900/20"
          >
            <Plus size={22} strokeWidth={3} /> Record Expense
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-[#161b2c] p-8 rounded-[2rem] border border-slate-800 shadow-sm">
            <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
              <DollarSign className="text-slate-400" />
            </div>
            <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-1">Total Expenditure</p>
            <h2 className="text-4xl font-black text-white">${totalSpend.toLocaleString()}</h2>
          </div>

          <div className="bg-[#161b2c] p-8 rounded-[2rem] border border-slate-800 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Users size={80} />
            </div>
            <div className="w-12 h-12 bg-pink-500/10 rounded-2xl flex items-center justify-center mb-4">
              <Users className="text-pink-500" />
            </div>
            <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-1">Total Labor Cost</p>
            <h2 className="text-4xl font-black text-pink-500">${totalLabor.toLocaleString()}</h2>
          </div>

          <div className="bg-[#161b2c] p-8 rounded-[2rem] border border-slate-800 shadow-sm">
            <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
              <FileText className="text-slate-400" />
            </div>
            <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-1">Total Items</p>
            <h2 className="text-4xl font-black text-white">{expenses.length}</h2>
          </div>
        </div>

        {/* Expenses List */}
        <div className="bg-[#161b2c] rounded-[2rem] border border-slate-800 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-800 flex justify-between items-center">
            <h3 className="font-bold text-white text-lg">Transaction History</h3>
            <div className="text-xs text-slate-500 uppercase tracking-widest font-bold">Updated Just Now</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/50 text-slate-500 text-[10px] uppercase tracking-[0.2em]">
                  <th className="px-8 py-5 font-bold">Date</th>
                  <th className="px-8 py-5 font-bold">Category</th>
                  <th className="px-8 py-5 font-bold">Team Member</th>
                  <th className="px-8 py-5 font-bold">Details</th>
                  <th className="px-8 py-5 font-bold text-right">Cost</th>
                  <th className="px-8 py-5 font-bold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <FileText className="w-12 h-12 text-slate-700" />
                        <p className="text-slate-500 font-medium">No records found. Click 'Record Expense' to start syncing.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  expenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-8 py-6">
                        <div className="text-sm font-medium text-slate-400">{exp.date}</div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="px-3 py-1 bg-slate-800 text-slate-300 rounded-full text-[10px] font-bold border border-slate-700">
                          {exp.category}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="font-bold text-white leading-tight">{exp.teamMember || 'General'}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{exp.role || 'Unassigned'}</div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-sm text-slate-300 max-w-xs truncate">{exp.reason}</div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="font-black text-white text-lg tracking-tight">
                          ${((exp.amount || 0) + (exp.pay || 0)).toLocaleString()}
                        </div>
                        {exp.pay > 0 && (
                          <div className="text-[10px] font-bold text-pink-500 mt-1 uppercase tracking-tighter">
                            Incl. ${exp.pay} Pay
                          </div>
                        )}
                      </td>
                      <td className="px-8 py-6 text-center">
                        <button 
                          onClick={() => deleteExpense(exp.id)}
                          className="p-2 text-slate-600 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={18} />
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

      {/* Modern Add Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="bg-[#161b2c] w-full max-w-xl rounded-[2.5rem] border border-slate-800 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-10">
              <div className="flex justify-between items-center mb-10">
                <div>
                  <h2 className="text-4xl font-black text-pink-500 italic">Record Expense</h2>
                  <p className="text-slate-500 text-sm mt-1">This data will sync instantly to all devices.</p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Item Category</label>
                    <div className="relative">
                      <select 
                        value={formData.category}
                        onChange={(e) => setFormData({...formData, category: e.target.value})}
                        className="w-full bg-[#0f111a] border border-slate-800 rounded-2xl px-5 py-4 text-white appearance-none focus:outline-none focus:ring-2 focus:ring-pink-600 transition-all font-semibold"
                      >
                        <option>Equipment</option>
                        <option>Labor / Payroll</option>
                        <option>Marketing</option>
                        <option>Software</option>
                        <option>Travel</option>
                        <option>Production</option>
                      </select>
                      <ChevronDown className="absolute right-5 top-5 text-slate-500 pointer-events-none" size={18} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Date of Expense</label>
                    <input 
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      className="w-full bg-[#0f111a] border border-slate-800 rounded-2xl px-5 py-4 text-white focus:outline-none focus:ring-2 focus:ring-pink-600 transition-all font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-black text-pink-500 uppercase tracking-[0.2em] mb-3 italic">Item/Service Cost ($)</label>
                    <input 
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({...formData, amount: e.target.value})}
                      className="w-full bg-[#0f111a] border border-slate-800 rounded-2xl px-5 py-4 text-pink-400 text-xl font-black focus:outline-none focus:ring-2 focus:ring-pink-600 transition-all"
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Team Member Pay ($)</label>
                    <input 
                      type="number"
                      step="0.01"
                      value={formData.pay}
                      onChange={(e) => setFormData({...formData, pay: e.target.value})}
                      className="w-full bg-[#0f111a] border border-slate-800 rounded-2xl px-5 py-4 text-white text-xl font-black focus:outline-none focus:ring-2 focus:ring-pink-600 transition-all"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Team Member Name</label>
                    <input 
                      type="text"
                      value={formData.teamMember}
                      onChange={(e) => setFormData({...formData, teamMember: e.target.value})}
                      className="w-full bg-[#0f111a] border border-slate-800 rounded-2xl px-5 py-4 text-white font-bold focus:outline-none focus:ring-2 focus:ring-pink-600 transition-all"
                      placeholder="Member name"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Role / Responsibility</label>
                    <input 
                      type="text"
                      value={formData.role}
                      onChange={(e) => setFormData({...formData, role: e.target.value})}
                      className="w-full bg-[#0f111a] border border-slate-800 rounded-2xl px-5 py-4 text-white font-bold focus:outline-none focus:ring-2 focus:ring-pink-600 transition-all"
                      placeholder="e.g. Lead Dev"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Reason / Description</label>
                  <textarea 
                    value={formData.reason}
                    onChange={(e) => setFormData({...formData, reason: e.target.value})}
                    className="w-full bg-[#0f111a] border border-slate-800 rounded-2xl px-5 py-4 text-white min-h-[100px] focus:outline-none focus:ring-2 focus:ring-pink-600 transition-all font-medium"
                    placeholder="Briefly describe what this expense was for..."
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full bg-pink-600 hover:bg-pink-700 text-white font-black text-lg py-5 rounded-[1.5rem] shadow-2xl shadow-pink-900/40 transition-all active:scale-95 mt-4 uppercase tracking-widest italic"
                >
                  Confirm & Sync Record
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}