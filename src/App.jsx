import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged 
} from 'firebase/auth';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { 
  LayoutDashboard, Briefcase, Receipt, Plus, Users, MapPin, 
  ChevronLeft, ChevronRight, Menu, X, DollarSign, Calendar,
  ExternalLink, Trash2, Camera, Film
} from 'lucide-react';

// --- Safety Wrapper for Firebase Config ---
const getFirebaseConfig = () => {
  try {
    return typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
  } catch (e) {
    return null;
  }
};

const firebaseConfig = getFirebaseConfig();
const appId = typeof __app_id !== 'undefined' ? __app_id : 'lumina-studio-manager';

// Initialize Firebase only if config is available
let app, auth, db;
if (firebaseConfig) {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
}

// --- Constants ---
const PROJECT_STATUSES = ['Not Started', 'Ongoing', 'Completed', 'Cancelled'];
const EXPENSE_TYPES = ['Equipment', 'Rentals', 'Travel', 'Software', 'Marketing', 'Other'];

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Data State
  const [projects, setProjects] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [isAddingExpense, setIsAddingExpense] = useState(false);

  // --- Auth & Data Logic ---
  useEffect(() => {
    if (!firebaseConfig) {
      console.warn("Cloud storage not configured. Running in local mode.");
      return;
    }

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth failed:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) return;

    const projectsRef = collection(db, 'artifacts', appId, 'public', 'data', 'projects');
    const expensesRef = collection(db, 'artifacts', appId, 'public', 'data', 'expenses');

    const unsubProjects = onSnapshot(projectsRef, (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error("Projects sync error:", err));

    const unsubExpenses = onSnapshot(expensesRef, (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error("Expenses sync error:", err));

    return () => {
      unsubProjects();
      unsubExpenses();
    };
  }, [user]);

  // --- Analytics ---
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
      const owed = monthProjects.reduce((sum, p) => sum + ((Number(p.budget) || 0) - (Number(p.amountPaid) || 0)), 0);
      const cost = monthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

      return { name: month, revenue, owed, expenses: cost };
    });
  }, [projects, expenses]);

  // --- Handlers ---
  const handleAddProject = async (e) => {
    e.preventDefault();
    if (!db) return;
    const formData = new FormData(e.target);
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
      team: [], // Simplified for this view
      createdAt: new Date().toISOString()
    };
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'projects'), newProject);
    setIsAddingProject(false);
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!db) return;
    const formData = new FormData(e.target);
    const newExpense = {
      type: formData.get('type'),
      amount: Number(formData.get('amount')),
      date: formData.get('date'),
      reason: formData.get('reason'),
      createdAt: new Date().toISOString()
    };
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'expenses'), newExpense);
    setIsAddingExpense(false);
  };

  const updateProjectStatus = async (id, status) => {
    if (!db) return;
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'projects', id);
    await updateDoc(docRef, { status });
  };

  const deleteItem = async (col, id) => {
    if (!db) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', col, id));
  };

  const NavItem = ({ id, icon: Icon, label }) => {
    const isActive = activeTab === id;
    return (
      <button
        onClick={() => { setActiveTab(id); setIsMobileMenuOpen(false); }}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
          isActive 
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        }`}
      >
        <Icon size={20} />
        {!isSidebarCollapsed && <span className="font-semibold text-sm tracking-wide">{label}</span>}
      </button>
    );
  };

  return (
    <div className="flex h-screen bg-[#050505] text-slate-100 overflow-hidden selection:bg-indigo-500/30">
      {/* Sidebar */}
      <aside 
        className={`hidden md:flex flex-col border-r border-slate-900 bg-black/40 backdrop-blur-2xl transition-all duration-500 ease-in-out ${
          isSidebarCollapsed ? 'w-20' : 'w-72'
        }`}
      >
        <div className="p-8 flex items-center justify-between">
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-2">
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-lg">
                <Camera size={20} className="text-white" />
              </div>
              <h1 className="text-xl font-black tracking-tighter">LUMINA</h1>
            </div>
          )}
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-500"
          >
            {isSidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
          <NavItem id="dashboard" icon={LayoutDashboard} label="Studio Overview" />
          <NavItem id="projects" icon={Briefcase} label="Project Manager" />
          <NavItem id="expenses" icon={Receipt} label="Expense Tracker" />
        </nav>

        <div className="p-6 border-t border-slate-900">
          <div className="flex items-center gap-4 bg-slate-900/50 p-3 rounded-2xl border border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-700 to-slate-600 flex items-center justify-center text-sm font-bold">
              {user?.uid?.substring(0, 1).toUpperCase() || 'L'}
            </div>
            {!isSidebarCollapsed && (
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-slate-200 truncate">{user?.uid || 'Ready to Sync'}</p>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${user ? 'bg-green-500' : 'bg-slate-500'}`} />
                  <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">{user ? 'Online' : 'Local Mode'}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Nav */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-20 bg-black/80 backdrop-blur-md border-b border-slate-900 flex items-center justify-between px-6 z-50">
        <div className="flex items-center gap-2">
          <Camera size={20} className="text-indigo-500" />
          <h1 className="text-lg font-black tracking-tighter">LUMINA</h1>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 bg-slate-900 rounded-lg">
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-black z-40 pt-24 px-6 animate-in fade-in zoom-in-95">
          <nav className="space-y-4">
            <NavItem id="dashboard" icon={LayoutDashboard} label="Studio Overview" />
            <NavItem id="projects" icon={Briefcase} label="Project Manager" />
            <NavItem id="expenses" icon={Receipt} label="Expense Tracker" />
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pt-24 md:pt-0">
        <div className="max-w-7xl mx-auto p-6 md:p-12 space-y-10">
          
          {/* Dashboard View */}
          {activeTab === 'dashboard' && (
            <div className="space-y-10 animate-in fade-in slide-in-from-top-4 duration-700">
              <header className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-indigo-500 text-xs font-bold uppercase tracking-widest">
                  <Film size={14} /> Analytics Engine
                </div>
                <h2 className="text-4xl font-black tracking-tight">Studio Performance</h2>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { label: 'Revenue YTD', val: chartData.reduce((a, b) => a + b.revenue, 0), color: 'text-emerald-400', bg: 'bg-emerald-500/5' },
                  { label: 'Pending Payments', val: chartData.reduce((a, b) => a + b.owed, 0), color: 'text-amber-400', bg: 'bg-amber-500/5' },
                  { label: 'Total Expenses', val: chartData.reduce((a, b) => a + b.expenses, 0), color: 'text-rose-400', bg: 'bg-rose-500/5' }
                ].map((stat, i) => (
                  <div key={i} className={`p-8 rounded-[2rem] bg-slate-900/40 border border-slate-800/50 backdrop-blur-sm relative overflow-hidden group`}>
                    <div className={`absolute top-0 right-0 w-32 h-32 ${stat.bg} rounded-full -mr-16 -mt-16 blur-2xl transition-opacity group-hover:opacity-100 opacity-50`} />
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-2 relative z-10">{stat.label}</p>
                    <p className={`text-4xl font-black ${stat.color} relative z-10 font-mono`}>
                      ${stat.val.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>

              <div className="bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-800/50 h-[450px]">
                <h3 className="text-sm font-bold text-slate-400 mb-8 px-2 uppercase tracking-widest">Monthly Cash Flow Trends</h3>
                <ResponsiveContainer width="100%" height="90%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="name" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                    <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#000', border: '1px solid #1e293b', borderRadius: '16px', fontSize: '12px' }}
                      cursor={{ stroke: '#4f46e5', strokeWidth: 1 }}
                    />
                    <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '30px', fontSize: '10px', textTransform: 'uppercase', fontWeight: '700' }}/>
                    <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={4} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} name="Revenue" />
                    <Line type="monotone" dataKey="owed" stroke="#f59e0b" strokeWidth={4} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} name="Client Owed" />
                    <Line type="monotone" dataKey="expenses" stroke="#f43f5e" strokeWidth={4} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} name="Expenses" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Projects View */}
          {activeTab === 'projects' && (
            <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-700">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                  <h2 className="text-4xl font-black tracking-tight">Active Projects</h2>
                  <p className="text-slate-500 font-medium">{projects.length} assignments tracked</p>
                </div>
                <button 
                  onClick={() => setIsAddingProject(true)}
                  className="flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-2xl font-bold transition-all hover:scale-105 active:scale-95 shadow-xl shadow-indigo-600/20"
                >
                  <Plus size={20} /> Create Shoot
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {projects.sort((a,b) => new Date(b.date) - new Date(a.date)).map(project => (
                  <div key={project.id} className="bg-slate-900/30 border border-slate-800/80 rounded-[2rem] p-8 hover:bg-slate-900/50 transition-all group border-l-4 border-l-indigo-600">
                    <div className="flex justify-between items-start mb-6">
                      <div className="space-y-1">
                        <span className={`text-[10px] uppercase tracking-[0.2em] font-black px-3 py-1.5 rounded-full ${
                          project.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-500' :
                          project.status === 'Ongoing' ? 'bg-blue-500/10 text-blue-500' :
                          project.status === 'Cancelled' ? 'bg-rose-500/10 text-rose-500' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {project.status}
                        </span>
                        <h3 className="text-2xl font-black pt-2">{project.clientName}</h3>
                      </div>
                      <button onClick={() => deleteItem('projects', project.id)} className="p-2 text-slate-700 hover:text-rose-500 transition-colors">
                        <Trash2 size={18} />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-y-4 mb-8">
                      <div className="flex items-center gap-3 text-sm text-slate-400">
                        <Calendar size={16} className="text-indigo-500" />
                        {new Date(project.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-slate-400">
                        <Film size={16} className="text-indigo-500" />
                        {project.eventType}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-slate-400 overflow-hidden">
                        <MapPin size={16} className="text-indigo-500 flex-shrink-0" />
                        <span className="truncate">{project.location}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-slate-400">
                        <Clock size={16} className="text-indigo-500" />
                        {project.duration}
                      </div>
                    </div>

                    <div className="p-6 bg-black/40 rounded-2xl border border-slate-800/50">
                      <div className="flex justify-between items-end mb-3">
                        <div className="space-y-1">
                          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Financial Progress</p>
                          <p className="text-lg font-mono font-bold text-slate-200">
                            ${project.amountPaid?.toLocaleString()} <span className="text-slate-600 text-sm">/ ${project.budget?.toLocaleString()}</span>
                          </p>
                        </div>
                        <p className="text-indigo-400 font-bold text-sm">
                          {Math.round((project.amountPaid / project.budget) * 100)}%
                        </p>
                      </div>
                      <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-indigo-600 to-indigo-400 h-full transition-all duration-1000" 
                          style={{ width: `${Math.min(100, (project.amountPaid / project.budget) * 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-6 flex items-center gap-4">
                      <select 
                        value={project.status}
                        onChange={(e) => updateProjectStatus(project.id, e.target.value)}
                        className="flex-1 bg-slate-800/50 border border-slate-700 text-xs font-bold uppercase tracking-widest rounded-xl py-3 px-4 focus:ring-1 focus:ring-indigo-500 outline-none appearance-none cursor-pointer"
                      >
                        {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      {project.mapsLink && (
                        <a href={project.mapsLink} target="_blank" rel="noopener noreferrer" className="p-3 bg-indigo-600/10 text-indigo-400 rounded-xl hover:bg-indigo-600/20 transition-colors">
                          <MapPin size={20} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expenses View */}
          {activeTab === 'expenses' && (
            <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-700">
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                  <h2 className="text-4xl font-black tracking-tight">Studio Expenses</h2>
                  <p className="text-slate-500 font-medium">Tracking overhead and capital expenditure</p>
                </div>
                <button 
                  onClick={() => setIsAddingExpense(true)}
                  className="flex items-center justify-center gap-3 bg-rose-600 hover:bg-rose-500 text-white px-8 py-4 rounded-2xl font-bold transition-all shadow-xl shadow-rose-600/20"
                >
                  <Plus size={20} /> Add Expense
                </button>
              </div>

              <div className="bg-slate-900/30 border border-slate-800/80 rounded-[2.5rem] overflow-hidden backdrop-blur-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-800/30 text-slate-500 text-[10px] uppercase tracking-[0.2em] font-black">
                        <th className="px-10 py-6">Date</th>
                        <th className="px-10 py-6">Category</th>
                        <th className="px-10 py-6">Description</th>
                        <th className="px-10 py-6 text-right">Amount</th>
                        <th className="px-10 py-6 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {expenses.sort((a,b) => new Date(b.date) - new Date(a.date)).map(expense => (
                        <tr key={expense.id} className="hover:bg-slate-800/20 transition-colors group">
                          <td className="px-10 py-6 text-sm text-slate-400">{new Date(expense.date).toLocaleDateString()}</td>
                          <td className="px-10 py-6">
                            <span className="text-xs font-bold uppercase tracking-widest text-indigo-400 bg-indigo-500/5 px-3 py-1.5 rounded-lg border border-indigo-500/10">
                              {expense.type}
                            </span>
                          </td>
                          <td className="px-10 py-6 text-sm font-medium text-slate-200">{expense.reason}</td>
                          <td className="px-10 py-6 text-right font-mono font-bold text-rose-400">-${expense.amount?.toLocaleString()}</td>
                          <td className="px-10 py-6">
                             <button onClick={() => deleteItem('expenses', expense.id)} className="p-2 text-slate-800 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {expenses.length === 0 && (
                  <div className="py-24 text-center">
                    <Receipt size={48} className="mx-auto text-slate-800 mb-4" />
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No records found</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Project Modal */}
      {isAddingProject && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-300">
            <form onSubmit={handleAddProject} className="p-10 space-y-8">
              <div className="flex justify-between items-center border-b border-slate-800 pb-6">
                <h3 className="text-3xl font-black">New Assignment</h3>
                <button type="button" onClick={() => setIsAddingProject(false)} className="p-2 hover:bg-slate-800 rounded-full"><X /></button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { label: 'Client Name', name: 'clientName', placeholder: 'e.g. Vogue Magazine', type: 'text', required: true },
                  { label: 'Shoot Type', name: 'eventType', placeholder: 'e.g. Editorial, Commercial', type: 'text', required: true },
                  { label: 'Event Date', name: 'date', type: 'date', required: true },
                  { label: 'Project Duration', name: 'duration', placeholder: 'e.g. 2 Days', type: 'text' },
                  { label: 'Location', name: 'location', placeholder: 'e.g. Studio A', type: 'text' },
                  { label: 'Maps Link', name: 'mapsLink', placeholder: 'https://...', type: 'url' },
                  { label: 'Total Budget ($)', name: 'budget', type: 'number', required: true },
                  { label: 'Amount Paid ($)', name: 'amountPaid', type: 'number' }
                ].map((field, idx) => (
                  <div key={idx} className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{field.label}</label>
                    <input 
                      {...field}
                      className="w-full bg-black/40 border border-slate-800 rounded-xl p-4 focus:border-indigo-500 outline-none transition-all font-medium placeholder:text-slate-700" 
                    />
                  </div>
                ))}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Initial Status</label>
                  <select name="status" className="w-full bg-black/40 border border-slate-800 rounded-xl p-4 outline-none font-bold uppercase tracking-widest text-xs">
                    {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-800 flex gap-4">
                <button type="submit" className="flex-1 bg-indigo-600 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20">Initialize Project</button>
                <button type="button" onClick={() => setIsAddingProject(false)} className="px-8 bg-slate-800 py-4 rounded-2xl font-black uppercase tracking-widest text-xs">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {isAddingExpense && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-300">
            <form onSubmit={handleAddExpense} className="p-10 space-y-8">
              <div className="flex justify-between items-center border-b border-slate-800 pb-6">
                <h3 className="text-3xl font-black text-rose-500">Record Cost</h3>
                <button type="button" onClick={() => setIsAddingExpense(false)} className="p-2 hover:bg-slate-800 rounded-full"><X /></button>
              </div>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Category</label>
                  <select name="type" className="w-full bg-black/40 border border-slate-800 rounded-xl p-4 outline-none font-bold uppercase tracking-widest text-xs">
                    {EXPENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Amount ($)</label>
                  <input type="number" name="amount" required className="w-full bg-black/40 border border-slate-800 rounded-xl p-4 outline-none font-mono text-xl font-bold text-rose-400" placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Date</label>
                  <input type="date" name="date" required className="w-full bg-black/40 border border-slate-800 rounded-xl p-4 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Description</label>
                  <textarea name="reason" rows="3" className="w-full bg-black/40 border border-slate-800 rounded-xl p-4 outline-none text-sm placeholder:text-slate-700" placeholder="Equipment maintenance, rental fee, etc."></textarea>
                </div>
              </div>

              <div className="pt-6 flex gap-4">
                <button type="submit" className="flex-1 bg-rose-600 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-rose-500 transition-all shadow-lg shadow-rose-600/20">Commit Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}