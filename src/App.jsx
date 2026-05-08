import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged 
} from 'firebase/auth';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area 
} from 'recharts';
import { 
  LayoutDashboard, Briefcase, Receipt, Plus, Users, MapPin, 
  ChevronLeft, ChevronRight, Menu, X, DollarSign, Calendar,
  ExternalLink, Trash2, Camera, Film, Clock, UserPlus, Info
} from 'lucide-react';

// --- Firebase Configuration & Initialization ---
const getFirebaseConfig = () => {
  try {
    return typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
  } catch (e) {
    return null;
  }
};

const firebaseConfig = getFirebaseConfig();
const appId = typeof __app_id !== 'undefined' ? __app_id : 'lumina-studio-v1';

let app, auth, db;
if (firebaseConfig) {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
}

// --- Constants ---
const PROJECT_STATUSES = ['Not Started', 'Ongoing', 'Completed', 'Cancelled'];
const EXPENSE_TYPES = ['Equipment', 'Rentals', 'Travel', 'Software', 'Marketing', 'Office', 'Other'];

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Data State
  const [projects, setProjects] = useState([]);
  const [expenses, setExpenses] = useState([]);
  
  // UI Modal State
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [isAddingExpense, setIsAddingExpense] = useState(false);

  // --- Authentication (RULE 3) ---
  useEffect(() => {
    if (!firebaseConfig) return;

    const initAuth = async (retries = 0) => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        if (retries < 5) {
          const delay = Math.pow(2, retries) * 1000;
          setTimeout(() => initAuth(retries + 1), delay);
        }
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  // --- Data Sync (RULE 1 & 2) ---
  useEffect(() => {
    if (!user || !db) return;

    const projectsPath = collection(db, 'artifacts', appId, 'public', 'data', 'projects');
    const expensesPath = collection(db, 'artifacts', appId, 'public', 'data', 'expenses');

    const unsubProjects = onSnapshot(projectsPath, (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error("Sync error:", err));

    const unsubExpenses = onSnapshot(expensesPath, (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error("Sync error:", err));

    return () => {
      unsubProjects();
      unsubExpenses();
    };
  }, [user]);

  // --- Analytics Logic ---
  const chartData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();
    
    return months.map((month, index) => {
      const monthProjects = projects.filter(p => {
        const d = new Date(p.date);
        return d.getMonth() === index && d.getFullYear() === currentYear;
      });
      const monthExpenses = expenses.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === index && d.getFullYear() === currentYear;
      });

      const revenue = monthProjects.reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0);
      const totalBudget = monthProjects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
      const owed = totalBudget - revenue;
      const cost = monthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

      return { name: month, revenue, owed: Math.max(0, owed), expenses: cost };
    });
  }, [projects, expenses]);

  // --- Handlers ---
  const handleAddProject = async (e) => {
    e.preventDefault();
    if (!db || !user) return;
    
    const formData = new FormData(e.target);
    const teamData = [];
    if (formData.get('teamMember')) {
      teamData.push({
        name: formData.get('teamMember'),
        role: formData.get('teamRole'),
        cost: Number(formData.get('teamCost')) || 0
      });
    }

    const newProject = {
      clientName: formData.get('clientName'),
      eventType: formData.get('eventType'),
      duration: formData.get('duration'),
      location: formData.get('location'),
      mapsLink: formData.get('mapsLink'),
      budget: Number(formData.get('budget')),
      amountPaid: Number(formData.get('amountPaid')),
      date: formData.get('date'),
      status: formData.get('status'),
      team: teamData,
      createdAt: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'projects'), newProject);
      setIsAddingProject(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!db || !user) return;
    
    const formData = new FormData(e.target);
    const newExpense = {
      type: formData.get('type'),
      amount: Number(formData.get('amount')),
      date: formData.get('date'),
      reason: formData.get('reason'),
      createdAt: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'expenses'), newExpense);
      setIsAddingExpense(false);
    } catch (err) {
      console.error(err);
    }
  };

  const updateStatus = async (id, newStatus) => {
    if (!db) return;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', id), { status: newStatus });
  };

  const NavItem = ({ id, icon: Icon, label }) => {
    const isActive = activeTab === id;
    return (
      <button
        onClick={() => { setActiveTab(id); setIsMobileMenuOpen(false); }}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
          isActive 
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
          : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
        }`}
      >
        <Icon size={20} />
        {!isSidebarCollapsed && <span className="font-semibold text-sm">{label}</span>}
      </button>
    );
  };

  return (
    <div className="flex h-screen bg-[#0a0a0c] text-slate-100 font-sans selection:bg-indigo-500/30">
      {/* Sidebar */}
      <aside className={`hidden md:flex flex-col border-r border-slate-800/50 bg-[#0d0d0f] transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
        <div className="p-6 flex items-center justify-between">
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-2">
              <Camera size={18} className="text-indigo-500" />
              <h1 className="text-lg font-black tracking-tight">LUMINA</h1>
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

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6 md:p-10 pt-24 md:pt-10">
        <div className="max-w-6xl mx-auto space-y-10">
          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div>
                <h2 className="text-3xl font-bold tracking-tight">Studio Overview</h2>
                <p className="text-slate-500">Metrics for {new Date().getFullYear()}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {[
                  { label: 'Revenue', val: chartData.reduce((a, b) => a + b.revenue, 0), color: 'text-emerald-400', icon: DollarSign },
                  { label: 'Owed', val: chartData.reduce((a, b) => a + b.owed, 0), color: 'text-amber-400', icon: Clock },
                  { label: 'Expenses', val: chartData.reduce((a, b) => a + b.expenses, 0), color: 'text-rose-400', icon: Receipt }
                ].map((stat, i) => (
                  <div key={i} className="bg-slate-900/40 border border-slate-800/60 p-6 rounded-2xl relative overflow-hidden">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">{stat.label}</p>
                    <p className={`text-3xl font-black ${stat.color}`}>${stat.val.toLocaleString()}</p>
                  </div>
                ))}
              </div>

              <div className="bg-slate-900/40 border border-slate-800/60 p-6 rounded-3xl h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="name" stroke="#475569" fontSize={12} />
                    <YAxis stroke="#475569" fontSize={12} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }} />
                    <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="#10b981" fillOpacity={0.1} />
                    <Area type="monotone" dataKey="expenses" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.1} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {activeTab === 'projects' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold">Projects</h2>
                <button onClick={() => setIsAddingProject(true)} className="bg-indigo-600 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2">
                  <Plus size={18} /> New Project
                </button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {projects.map(project => (
                  <div key={project.id} className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
                    <div className="flex justify-between mb-4">
                      <h3 className="text-xl font-bold">{project.clientName}</h3>
                      <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', project.id))} className="text-slate-600 hover:text-rose-500">
                        <Trash2 size={18} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-xs text-slate-400 mb-4">
                      <div className="flex items-center gap-2"><Calendar size={14}/> {project.date}</div>
                      <div className="flex items-center gap-2"><MapPin size={14}/> {project.location}</div>
                    </div>
                    <select 
                      value={project.status} 
                      onChange={(e) => updateStatus(project.id, e.target.value)}
                      className="w-full bg-slate-800 rounded-lg p-2 text-xs font-bold"
                    >
                      {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'expenses' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold">Expenses</h2>
                <button onClick={() => setIsAddingExpense(true)} className="bg-rose-600 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2">
                  <Plus size={18} /> Add Expense
                </button>
              </div>
              <div className="bg-slate-900/40 border border-slate-800 rounded-3xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-800/30 text-[10px] font-black text-slate-500 uppercase">
                    <tr>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Category</th>
                      <th className="px-6 py-4 text-right">Amount</th>
                      <th className="px-6 py-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/30">
                    {expenses.map(exp => (
                      <tr key={exp.id} className="text-sm">
                        <td className="px-6 py-4">{exp.date}</td>
                        <td className="px-6 py-4">{exp.type}</td>
                        <td className="px-6 py-4 text-right text-rose-400">-${exp.amount}</td>
                        <td className="px-6 py-4">
                          <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'expenses', exp.id))} className="text-slate-600">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      {isAddingProject && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[100]">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-8">
            <form onSubmit={handleAddProject} className="space-y-4">
              <h3 className="text-2xl font-bold mb-4">New Project</h3>
              <input name="clientName" placeholder="Client Name" required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3" />
              <input name="eventType" placeholder="Event Type" required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3" />
              <input name="date" type="date" required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3" />
              <div className="grid grid-cols-2 gap-4">
                <input name="budget" type="number" placeholder="Budget $" required className="bg-slate-950 border border-slate-800 rounded-xl p-3" />
                <input name="amountPaid" type="number" placeholder="Paid $" className="bg-slate-950 border border-slate-800 rounded-xl p-3" />
              </div>
              <select name="status" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3">
                {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <div className="flex gap-4 mt-6">
                <button type="submit" className="flex-1 bg-indigo-600 py-3 rounded-xl font-bold">Save</button>
                <button type="button" onClick={() => setIsAddingProject(false)} className="px-6 bg-slate-800 py-3 rounded-xl font-bold">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAddingExpense && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[100]">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-8">
            <form onSubmit={handleAddExpense} className="space-y-4">
              <h3 className="text-2xl font-bold mb-4">Add Expense</h3>
              <select name="type" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3">
                {EXPENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input name="amount" type="number" step="0.01" required placeholder="Amount $" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3" />
              <input name="date" type="date" required className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3" />
              <textarea name="reason" placeholder="Notes" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3" rows="3" />
              <div className="flex gap-4 mt-6">
                <button type="submit" className="flex-1 bg-rose-600 py-3 rounded-xl font-bold">Save</button>
                <button type="button" onClick={() => setIsAddingExpense(false)} className="px-6 bg-slate-800 py-3 rounded-xl font-bold">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}