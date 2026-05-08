import React, { useState, useEffect, useMemo, Component } from 'react';
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

// --- Error Boundary for Production Stability ---
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-slate-950 text-white flex flex-col items-center justify-center p-10 text-center">
          <AlertCircle size={48} className="text-rose-500 mb-4" />
          <h1 className="text-xl font-bold">Something went wrong</h1>
          <p className="text-slate-400 mt-2 max-w-md">{this.state.error?.message || "An unexpected error occurred."}</p>
          <button onClick={() => window.location.reload()} className="mt-6 bg-indigo-600 px-6 py-2 rounded-full font-bold">Reload Application</button>
        </div>
      );
    }
    return this.props.children;
  }
}

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

function MainApp() {
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
        // We set loading false regardless so the UI can attempt to render
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
      const monthProjects = (projects || []).filter(p => {
        const d = p?.date ? new Date(p.date) : null;
        return d && d.getMonth() === index && d.getFullYear() === currentYear;
      });
      const monthExpenses = (expenses || []).filter(e => {
        const d = e?.date ? new Date(e.date) : null;
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
      budget: Number(formData.get('budget')),
      amountPaid: Number(formData.get('amountPaid')) || 0,
      date: formData.get('date'),
      status: formData.get('status'),
      location: formData.get('location') || 'Studio',
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
      <div className="h-screen w-screen bg-[#0a0a0c] flex flex-col items-center justify-center">
        <Camera size={48} className="text-indigo-500 animate-pulse mb-4" />
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Authenticating...</p>
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
              <h1 className="text-lg font-black tracking-tighter uppercase italic">Lumina</h1>
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

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-6 h-16 bg-[#0d0d0f] border-b border-slate-800/50 z-50">
          <div className="flex items-center gap-2">
            <Camera size={20} className="text-indigo-500" />
            <h1 className="font-black text-sm tracking-tighter uppercase">LUMINA</h1>
          </div>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-400">
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </header>

        {/* Mobile Nav Overlay */}
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 bg-[#0a0a0c] z-[60] p-6 pt-20 space-y-4">
            <NavItem id="dashboard" icon={LayoutDashboard} label="Dashboard" />
            <NavItem id="projects" icon={Briefcase} label="Projects" />
            <NavItem id="expenses" icon={Receipt} label="Expenses" />
          </div>
        )}

        {/* Tab Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-10">
          <div className="max-w-6xl mx-auto space-y-8">
            {activeTab === 'dashboard' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                <header className="mb-8">
                  <h2 className="text-3xl font-black">Studio Pulse</h2>
                  <p className="text-slate-500">Live studio financials and performance.</p>
                </header>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                  <div className="bg-slate-900/40 border border-slate-800/60 p-6 rounded-2xl">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Revenue</p>
                    <p className="text-2xl font-black text-emerald-400">${chartData.reduce((a, b) => a + b.revenue, 0).toLocaleString()}</p>
                  </div>
                  <div className="bg-slate-900/40 border border-slate-800/60 p-6 rounded-2xl">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Unpaid</p>
                    <p className="text-2xl font-black text-amber-400">${chartData.reduce((a, b) => a + b.owed, 0).toLocaleString()}</p>
                  </div>
                  <div className="bg-slate-900/40 border border-slate-800/60 p-6 rounded-2xl">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Expenses</p>
                    <p className="text-2xl font-black text-rose-400">${chartData.reduce((a, b) => a + b.expenses, 0).toLocaleString()}</p>
                  </div>
                </div>

                <div className="bg-slate-900/40 border border-slate-800/60 p-6 rounded-3xl min-h-[350px]">
                   {/* Explicitly check if we have data to prevent Recharts measure errors */}
                   {chartData && (
                     <div style={{ width: '100%', height: '300px' }}>
                       <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                          <XAxis dataKey="name" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                          <YAxis stroke="#475569" fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                          <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }} />
                          <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="#10b981" fillOpacity={0.1} strokeWidth={2} />
                          <Area type="monotone" dataKey="expenses" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.1} strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                     </div>
                   )}
                </div>
              </div>
            )}

            {activeTab === 'projects' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-3xl font-black">Active Projects</h2>
                  <button onClick={() => setIsAddingProject(true)} className="bg-indigo-600 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-500 transition-colors">
                    <Plus size={18}/> New Project
                  </button>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {projects.map(p => (
                    <div key={p.id} className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl group hover:border-slate-700 transition-all">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-lg">{p.clientName}</h4>
                          <p className="text-slate-500 text-sm font-medium">{p.eventType}</p>
                        </div>
                        <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', p.id))} className="text-slate-700 hover:text-rose-500 transition-colors">
                          <Trash2 size={18}/>
                        </button>
                      </div>
                      <div className="mt-6 flex flex-wrap gap-4 text-xs font-bold text-slate-500 uppercase tracking-tight">
                        <div className="flex items-center gap-1.5"><Calendar size={14} className="text-indigo-400"/> {p.date}</div>
                        <div className="flex items-center gap-1.5"><MapPin size={14} className="text-indigo-400"/> {p.location}</div>
                      </div>
                      <div className="mt-6 pt-6 border-t border-slate-800/50 flex justify-between items-center">
                        <div>
                           <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Payment Status</p>
                           <p className="text-sm font-bold">${p.amountPaid} <span className="text-slate-600">/ ${p.budget}</span></p>
                        </div>
                        <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${p.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                          {p.status}
                        </span>
                      </div>
                    </div>
                  ))}
                  {projects.length === 0 && (
                    <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-800 rounded-3xl">
                      <Briefcase className="mx-auto text-slate-800 mb-4" size={48} />
                      <p className="text-slate-600 font-bold uppercase tracking-widest text-xs">No projects logged yet</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'expenses' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-3xl font-black">Expenses</h2>
                  <button onClick={() => setIsAddingExpense(true)} className="bg-rose-600 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-rose-500 transition-colors">
                    <Plus size={18}/> Log Expense
                  </button>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-800/30 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-slate-800">
                        <th className="p-4 pl-6">Date</th>
                        <th className="p-4">Category</th>
                        <th className="p-4">Description</th>
                        <th className="p-4 pr-6 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/30">
                      {expenses.map(e => (
                        <tr key={e.id} className="hover:bg-slate-800/20 transition-colors">
                          <td className="p-4 pl-6 text-slate-500 text-sm font-medium">{e.date}</td>
                          <td className="p-4"><span className="bg-indigo-500/10 text-indigo-400 text-[10px] font-black uppercase px-2 py-0.5 rounded">{e.type}</span></td>
                          <td className="p-4 text-slate-300 text-sm">{e.reason}</td>
                          <td className="p-4 pr-6 text-right text-rose-400 font-black">${Number(e.amount).toLocaleString()}</td>
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

      {/* Modals */}
      {isAddingProject && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
           <div className="bg-[#111114] border border-slate-800 p-8 rounded-[2.5rem] w-full max-w-lg shadow-2xl">
              <form onSubmit={handleAddProject} className="space-y-5">
                <h3 className="text-2xl font-black mb-6">New Studio Project</h3>
                <div className="space-y-4">
                  <input name="clientName" placeholder="Client Name" className="w-full bg-slate-900/50 border border-slate-800 p-4 rounded-2xl focus:outline-none focus:border-indigo-500 transition-colors" required />
                  <input name="eventType" placeholder="Service (e.g. Portrait Session)" className="w-full bg-slate-900/50 border border-slate-800 p-4 rounded-2xl focus:outline-none focus:border-indigo-500 transition-colors" required />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase ml-2">Date</label>
                      <input name="date" type="date" className="w-full bg-slate-900/50 border border-slate-800 p-4 rounded-2xl focus:outline-none focus:border-indigo-500 transition-colors text-slate-300" required />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase ml-2">Total Budget</label>
                      <input name="budget" type="number" placeholder="2500" className="w-full bg-slate-900/50 border border-slate-800 p-4 rounded-2xl focus:outline-none focus:border-indigo-500 transition-colors" required />
                    </div>
                  </div>
                  <input name="location" placeholder="Shoot Location" className="w-full bg-slate-900/50 border border-slate-800 p-4 rounded-2xl" />
                  <select name="status" className="w-full bg-slate-900/50 border border-slate-800 p-4 rounded-2xl appearance-none font-bold text-slate-400">
                    {PROJECT_STATUSES.map(s => <option key={s} value={s} className="bg-slate-900">{s}</option>)}
                  </select>
                </div>
                <div className="flex gap-3 pt-6">
                  <button type="submit" className="flex-1 bg-indigo-600 p-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-500 transition-all">Create Project</button>
                  <button type="button" onClick={() => setIsAddingProject(false)} className="px-6 bg-slate-800 p-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-700 transition-all text-slate-400">Cancel</button>
                </div>
              </form>
           </div>
        </div>
      )}

      {isAddingExpense && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
           <div className="bg-[#111114] border border-slate-800 p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl">
              <form onSubmit={handleAddExpense} className="space-y-5">
                <h3 className="text-2xl font-black mb-6">Log Expense</h3>
                <div className="space-y-4">
                  <select name="type" className="w-full bg-slate-900/50 border border-slate-800 p-4 rounded-2xl font-bold text-slate-400 appearance-none">
                    {EXPENSE_TYPES.map(s => <option key={s} value={s} className="bg-slate-900">{s}</option>)}
                  </select>
                  <input name="amount" type="number" placeholder="Amount ($)" className="w-full bg-slate-900/50 border border-slate-800 p-4 rounded-2xl font-black text-rose-400" required />
                  <input name="date" type="date" className="w-full bg-slate-900/50 border border-slate-800 p-4 rounded-2xl text-slate-300" required />
                  <textarea name="reason" placeholder="What was this for?" className="w-full bg-slate-900/50 border border-slate-800 p-4 rounded-2xl text-sm" rows="3"></textarea>
                </div>
                <div className="flex gap-3 pt-6">
                  <button type="submit" className="flex-1 bg-rose-600 p-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-rose-500 transition-all">Save Expense</button>
                  <button type="button" onClick={() => setIsAddingExpense(false)} className="px-6 bg-slate-800 p-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-700 transition-all text-slate-400">Cancel</button>
                </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}

// Wrap with Error Boundary for safety
export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}