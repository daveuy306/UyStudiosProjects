import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, 
  onSnapshot, query, serverTimestamp 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged 
} from 'firebase/auth';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  LayoutDashboard, Briefcase, Receipt, Plus, Users, MapPin, 
  ChevronLeft, ChevronRight, Menu, X, DollarSign, Calendar,
  ExternalLink, Trash2, Camera, Clock, UserPlus, TrendingUp, AlertCircle
} from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : { apiKey: "", authDomain: "", projectId: "", storageBucket: "", messagingSenderId: "", appId: "" };

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'lumina-studio-v2';

// --- Constants ---
const PROJECT_STATUSES = ['Not Started', 'Ongoing', 'Completed', 'Cancelled'];
const EXPENSE_TYPES = ['Equipment', 'Rentals', 'Travel', 'Software', 'Marketing', 'Office', 'Other'];

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Data State
  const [projects, setProjects] = useState([]);
  const [expenses, setExpenses] = useState([]);
  
  // UI Modal State
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [isAddingExpense, setIsAddingExpense] = useState(false);

  // --- Auth Logic (RULE 3) ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error:", err);
      } finally {
        setAuthLoading(false);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
        setUser(u);
        setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- Firestore Sync (RULE 1 & 2) ---
  useEffect(() => {
    if (!user) return;

    const projectsRef = collection(db, 'artifacts', appId, 'public', 'data', 'projects');
    const expensesRef = collection(db, 'artifacts', appId, 'public', 'data', 'expenses');

    const unsubProjects = onSnapshot(projectsRef, (snap) => {
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Firestore Projects Sync Error:", err));

    const unsubExpenses = onSnapshot(expensesRef, (snap) => {
      setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Firestore Expenses Sync Error:", err));

    return () => {
      unsubProjects();
      unsubExpenses();
    };
  }, [user]);

  // --- Financial Analytics ---
  const chartData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();
    
    return months.map((month, index) => {
      const monthProjects = projects.filter(p => {
        const d = p.date ? new Date(p.date) : null;
        return d && d.getMonth() === index && d.getFullYear() === currentYear;
      });
      const monthExpenses = expenses.filter(e => {
        const d = e.date ? new Date(e.date) : null;
        return d && d.getMonth() === index && d.getFullYear() === currentYear;
      });

      const revenue = monthProjects.reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0);
      const totalBudget = monthProjects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
      const cost = monthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

      return { 
        name: month, 
        revenue, 
        owed: Math.max(0, totalBudget - revenue), 
        expenses: cost 
      };
    });
  }, [projects, expenses]);

  const handleAddProject = async (e) => {
    e.preventDefault();
    if (!user) return;
    const form = e.target;
    const formData = new FormData(form);

    const payload = {
      clientName: formData.get('clientName'),
      eventType: formData.get('eventType'),
      duration: formData.get('duration'),
      location: formData.get('location'),
      mapsLink: formData.get('mapsLink'),
      budget: Number(formData.get('budget')),
      amountPaid: Number(formData.get('amountPaid')),
      date: formData.get('date'),
      status: formData.get('status'),
      createdAt: serverTimestamp()
    };

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'projects'), payload);
      setIsAddingProject(false);
      form.reset();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!user) return;
    const form = e.target;
    const formData = new FormData(form);

    const payload = {
      type: formData.get('type'),
      amount: Number(formData.get('amount')),
      date: formData.get('date'),
      reason: formData.get('reason'),
      createdAt: serverTimestamp()
    };

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'expenses'), payload);
      setIsAddingExpense(false);
      form.reset();
    } catch (err) {
      console.error(err);
    }
  };

  const NavItem = ({ id, icon: Icon, label }) => (
    <button
      onClick={() => { setActiveTab(id); setIsMobileMenuOpen(false); }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
        activeTab === id 
        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
        : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
      }`}
    >
      <Icon size={20} />
      {(!isSidebarCollapsed || isMobileMenuOpen) && <span className="font-semibold text-sm">{label}</span>}
    </button>
  );

  if (authLoading) {
    return (
      <div className="h-screen w-screen bg-[#0a0a0c] flex flex-col items-center justify-center space-y-4">
        <Camera size={48} className="text-indigo-500 animate-pulse" />
        <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 animate-[loading_1.5s_ease-in-out_infinite]" />
        </div>
        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Initializing Lumina...</p>
        <style>{`
          @keyframes loading {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0a0a0c] text-slate-100 font-sans selection:bg-indigo-500/30 overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside className={`hidden md:flex flex-col border-r border-slate-800/50 bg-[#0d0d0f] transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
        <div className="p-6 flex items-center justify-between">
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-2">
              <Camera size={22} className="text-indigo-500" />
              <h1 className="text-lg font-black tracking-tighter">LUMINA</h1>
            </div>
          )}
          <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-500">
            {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          <NavItem id="dashboard" icon={LayoutDashboard} label="Dashboard" />
          <NavItem id="projects" icon={Briefcase} label="Projects" />
          <NavItem id="expenses" icon={Receipt} label="Expenses" />
        </nav>
      </aside>

      {/* Main View */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="md:hidden flex items-center justify-between px-6 h-16 bg-[#0d0d0f] border-b border-slate-800/50 z-50">
          <div className="flex items-center gap-2">
            <Camera size={20} className="text-indigo-500" />
            <h1 className="font-black text-sm tracking-tighter">LUMINA</h1>
          </div>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-400">
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </header>

        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 bg-[#0a0a0c] z-[60] p-6 pt-20 space-y-4">
            <NavItem id="dashboard" icon={LayoutDashboard} label="Dashboard" />
            <NavItem id="projects" icon={Briefcase} label="Projects" />
            <NavItem id="expenses" icon={Receipt} label="Expenses" />
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-10">
          <div className="max-w-6xl mx-auto">
            {activeTab === 'dashboard' && (
              <div className="space-y-8">
                <header>
                  <h2 className="text-3xl font-bold tracking-tight">Studio Overview</h2>
                  <p className="text-slate-500">Annual financial performance</p>
                </header>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { label: 'Revenue', val: chartData.reduce((a, b) => a + b.revenue, 0), color: 'text-emerald-400' },
                    { label: 'Unpaid', val: chartData.reduce((a, b) => a + b.owed, 0), color: 'text-amber-400' },
                    { label: 'Expenses', val: chartData.reduce((a, b) => a + b.expenses, 0), color: 'text-rose-400' }
                  ].map((stat, i) => (
                    <div key={i} className="bg-slate-900/40 border border-slate-800/60 p-6 rounded-2xl">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{stat.label}</p>
                      <p className={`text-2xl font-black ${stat.color}`}>${stat.val.toLocaleString()}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-slate-900/40 border border-slate-800/60 p-6 rounded-3xl h-[350px]">
                   <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="name" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis stroke="#475569" fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }} />
                      <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="#10b981" fillOpacity={0.1} strokeWidth={2} />
                      <Area type="monotone" dataKey="expenses" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.1} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {activeTab === 'projects' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-3xl font-bold">Projects</h2>
                  <button onClick={() => setIsAddingProject(true)} className="bg-indigo-600 px-4 py-2 rounded-lg font-bold flex items-center gap-2">
                    <Plus size={18}/> New Project
                  </button>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {projects.map(p => (
                    <div key={p.id} className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl relative">
                      <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', p.id))} className="absolute top-4 right-4 text-slate-600 hover:text-rose-500">
                        <Trash2 size={16}/>
                      </button>
                      <h4 className="font-bold text-lg">{p.clientName}</h4>
                      <p className="text-slate-500 text-sm">{p.eventType}</p>
                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-400">
                        <div className="flex items-center gap-1"><Calendar size={12}/> {p.date}</div>
                        <div className="flex items-center gap-1"><MapPin size={12}/> {p.location}</div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-end">
                        <div className="text-xs uppercase font-bold text-slate-500">
                           Paid: <span className="text-indigo-400">${p.amountPaid}</span> / ${p.budget}
                        </div>
                        <span className="text-[10px] font-black uppercase bg-slate-800 px-2 py-1 rounded">{p.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'expenses' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-3xl font-bold">Expenses</h2>
                  <button onClick={() => setIsAddingExpense(true)} className="bg-rose-600 px-4 py-2 rounded-lg font-bold flex items-center gap-2">
                    <Plus size={18}/> Log Expense
                  </button>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-800/50 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">
                      <tr>
                        <th className="p-4">Date</th>
                        <th className="p-4">Category</th>
                        <th className="p-4">Notes</th>
                        <th className="p-4 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/30">
                      {expenses.map(e => (
                        <tr key={e.id}>
                          <td className="p-4 text-slate-500">{e.date}</td>
                          <td className="p-4"><span className="text-indigo-400 text-xs font-bold">{e.type}</span></td>
                          <td className="p-4 text-slate-300">{e.reason}</td>
                          <td className="p-4 text-right text-rose-400 font-bold">${e.amount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Simplified Modals */}
      {isAddingProject && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur flex items-center justify-center p-4 z-[100]">
           <div className="bg-[#111114] border border-slate-800 p-8 rounded-3xl w-full max-w-lg">
              <form onSubmit={handleAddProject} className="space-y-4">
                <h3 className="text-xl font-bold">Add Project</h3>
                <input name="clientName" placeholder="Client Name" className="w-full bg-slate-900 border border-slate-800 p-3 rounded-xl" required />
                <input name="eventType" placeholder="Event Type (e.g. Wedding)" className="w-full bg-slate-900 border border-slate-800 p-3 rounded-xl" required />
                <div className="grid grid-cols-2 gap-4">
                  <input name="date" type="date" className="bg-slate-900 border border-slate-800 p-3 rounded-xl" required />
                  <input name="budget" type="number" placeholder="Budget" className="bg-slate-900 border border-slate-800 p-3 rounded-xl" required />
                </div>
                <input name="location" placeholder="Location" className="w-full bg-slate-900 border border-slate-800 p-3 rounded-xl" />
                <select name="status" className="w-full bg-slate-900 border border-slate-800 p-3 rounded-xl">
                  {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <div className="flex gap-2 pt-4">
                  <button type="submit" className="flex-1 bg-indigo-600 p-3 rounded-xl font-bold">Save</button>
                  <button type="button" onClick={() => setIsAddingProject(false)} className="flex-1 bg-slate-800 p-3 rounded-xl font-bold">Cancel</button>
                </div>
              </form>
           </div>
        </div>
      )}

      {isAddingExpense && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur flex items-center justify-center p-4 z-[100]">
           <div className="bg-[#111114] border border-slate-800 p-8 rounded-3xl w-full max-w-md">
              <form onSubmit={handleAddExpense} className="space-y-4">
                <h3 className="text-xl font-bold">Add Expense</h3>
                <select name="type" className="w-full bg-slate-900 border border-slate-800 p-3 rounded-xl">
                  {EXPENSE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <input name="amount" type="number" placeholder="Amount" className="w-full bg-slate-900 border border-slate-800 p-3 rounded-xl" required />
                <input name="date" type="date" className="w-full bg-slate-900 border border-slate-800 p-3 rounded-xl" required />
                <textarea name="reason" placeholder="Reason" className="w-full bg-slate-900 border border-slate-800 p-3 rounded-xl" rows="3"></textarea>
                <div className="flex gap-2 pt-4">
                  <button type="submit" className="flex-1 bg-rose-600 p-3 rounded-xl font-bold">Save</button>
                  <button type="button" onClick={() => setIsAddingExpense(false)} className="flex-1 bg-slate-800 p-3 rounded-xl font-bold">Cancel</button>
                </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}