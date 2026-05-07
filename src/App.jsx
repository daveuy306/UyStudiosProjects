import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query 
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
  ExternalLink, CheckCircle2, Clock, AlertCircle, Trash2
} from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'lumina-studio-manager';

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

  // --- Auth Logic ---
  useEffect(() => {
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

  // --- Data Fetching Logic ---
  useEffect(() => {
    if (!user) return;

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

  // --- Computed Analytics ---
  const chartData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.map((month, index) => {
      const monthProjects = projects.filter(p => {
        const d = new Date(p.date);
        return d.getMonth() === index && d.getFullYear() === new Date().getFullYear();
      });
      const monthExpenses = expenses.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === index && d.getFullYear() === new Date().getFullYear();
      });

      const revenue = monthProjects.reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0);
      const owed = monthProjects.reduce((sum, p) => sum + ((Number(p.budget) || 0) - (Number(p.amountPaid) || 0)), 0);
      const cost = monthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

      return { name: month, revenue, owed, expenses: cost };
    });
  }, [projects, expenses]);

  // --- Action Handlers ---
  const handleAddProject = async (e) => {
    e.preventDefault();
    if (!user) return;
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
      team: JSON.parse(formData.get('team') || '[]'),
      createdAt: new Date().toISOString()
    };
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'projects'), newProject);
    setIsAddingProject(false);
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!user) return;
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
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'projects', id);
    await updateDoc(docRef, { status });
  };

  // --- UI Components ---
  const NavItem = ({ id, icon: Icon, label }) => {
    const isActive = activeTab === id;
    return (
      <button
        onClick={() => { setActiveTab(id); setIsMobileMenuOpen(false); }}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
          isActive 
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        }`}
      >
        <Icon size={20} />
        {!isSidebarCollapsed && <span className="font-medium">{label}</span>}
      </button>
    );
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar - Desktop */}
      <aside 
        className={`hidden md:flex flex-col border-r border-slate-800 transition-all duration-300 bg-slate-900/50 backdrop-blur-xl ${
          isSidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className="p-6 flex items-center justify-between">
          {!isSidebarCollapsed && <h1 className="text-xl font-bold tracking-tighter bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">LUMINA</h1>}
          <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="p-1.5 hover:bg-slate-800 rounded-md">
            {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
        
        <nav className="flex-1 px-3 space-y-2">
          <NavItem id="dashboard" icon={LayoutDashboard} label="Dashboard" />
          <NavItem id="projects" icon={Briefcase} label="Projects" />
          <NavItem id="expenses" icon={Receipt} label="Expenses" />
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold">
              {user?.uid.substring(0, 2).toUpperCase() || 'P'}
            </div>
            {!isSidebarCollapsed && (
              <div className="overflow-hidden">
                <p className="text-xs font-medium truncate">{user?.uid || 'Guest'}</p>
                <p className="text-[10px] text-slate-500">Cloud Sync Active</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Top Nav */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 z-50">
        <h1 className="text-lg font-bold tracking-tighter">LUMINA</h1>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2">
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-slate-950 z-40 pt-20 px-4">
          <nav className="space-y-4">
            <NavItem id="dashboard" icon={LayoutDashboard} label="Dashboard" />
            <NavItem id="projects" icon={Briefcase} label="Projects" />
            <NavItem id="expenses" icon={Receipt} label="Expenses" />
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pt-20 md:pt-0 p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          
          {/* Dashboard View */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <header>
                <h2 className="text-3xl font-bold">Financial Trends</h2>
                <p className="text-slate-400">Monthly overview of your studio's health</p>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
                  <p className="text-slate-400 text-sm mb-1">Total Revenue (YTD)</p>
                  <p className="text-2xl font-bold text-emerald-400">
                    ${chartData.reduce((a, b) => a + b.revenue, 0).toLocaleString()}
                  </p>
                </div>
                <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
                  <p className="text-slate-400 text-sm mb-1">Total Owed</p>
                  <p className="text-2xl font-bold text-amber-400">
                    ${chartData.reduce((a, b) => a + b.owed, 0).toLocaleString()}
                  </p>
                </div>
                <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
                  <p className="text-slate-400 text-sm mb-1">Total Expenses</p>
                  <p className="text-2xl font-bold text-rose-400">
                    ${chartData.reduce((a, b) => a + b.expenses, 0).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                      itemStyle={{ fontSize: '12px' }}
                    />
                    <Legend verticalAlign="top" height={36}/>
                    <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Revenue" />
                    <Line type="monotone" dataKey="owed" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Client Owed" />
                    <Line type="monotone" dataKey="expenses" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Expenses" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Projects View */}
          {activeTab === 'projects' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-bold">Projects</h2>
                  <p className="text-slate-400">{projects.length} shoots planned / in progress</p>
                </div>
                <button 
                  onClick={() => setIsAddingProject(true)}
                  className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-semibold transition-colors"
                >
                  <Plus size={20} /> New Project
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.sort((a,b) => new Date(b.date) - new Date(a.date)).map(project => (
                  <div key={project.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors group">
                    <div className="flex justify-between items-start mb-4">
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded ${
                        project.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-500' :
                        project.status === 'Ongoing' ? 'bg-blue-500/10 text-blue-500' :
                        project.status === 'Cancelled' ? 'bg-rose-500/10 text-rose-500' : 'bg-slate-700 text-slate-300'
                      }`}>
                        {project.status}
                      </span>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', project.id))} className="text-slate-500 hover:text-rose-500">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    
                    <h3 className="text-xl font-bold mb-1">{project.clientName}</h3>
                    <p className="text-slate-400 text-sm mb-4">{project.eventType} • {project.duration}</p>
                    
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <Calendar size={14} className="text-slate-500" />
                        {new Date(project.date).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <MapPin size={14} className="text-slate-500" />
                        <a href={project.mapsLink} target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 flex items-center gap-1">
                          {project.location} <ExternalLink size={10} />
                        </a>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <Users size={14} className="text-slate-500" />
                        {project.team?.length || 0} Team Members
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-800">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-500">Budget Progress</span>
                        <span className="font-mono">${project.amountPaid} / ${project.budget}</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-blue-500 h-full transition-all" 
                          style={{ width: `${Math.min(100, (project.amountPaid / project.budget) * 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <select 
                        value={project.status}
                        onChange={(e) => updateProjectStatus(project.id, e.target.value)}
                        className="w-full bg-slate-800 border-none text-xs rounded-lg py-2 focus:ring-1 focus:ring-blue-500"
                      >
                        {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expenses View */}
          {activeTab === 'expenses' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-bold">Expenses</h2>
                  <p className="text-slate-400">Track equipment, rentals, and overhead</p>
                </div>
                <button 
                  onClick={() => setIsAddingExpense(true)}
                  className="flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 text-white px-6 py-2.5 rounded-xl font-semibold transition-colors"
                >
                  <Plus size={20} /> Add Expense
                </button>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-800/50 text-slate-400 text-xs uppercase tracking-widest font-bold">
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Type</th>
                      <th className="px-6 py-4">Reason / Notes</th>
                      <th className="px-6 py-4 text-right">Amount</th>
                      <th className="px-6 py-4 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {expenses.sort((a,b) => new Date(b.date) - new Date(a.date)).map(expense => (
                      <tr key={expense.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4 text-sm">{new Date(expense.date).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-sm font-medium">{expense.type}</td>
                        <td className="px-6 py-4 text-sm text-slate-400">{expense.reason}</td>
                        <td className="px-6 py-4 text-sm text-right font-mono text-rose-400">-${expense.amount?.toLocaleString()}</td>
                        <td className="px-6 py-4">
                           <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'expenses', expense.id))} className="text-slate-600 hover:text-rose-500">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {expenses.length === 0 && (
                      <tr>
                        <td colSpan="5" className="px-6 py-12 text-center text-slate-500 italic">No expenses recorded yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Project Modal */}
      {isAddingProject && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleAddProject} className="p-8 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-bold">New Project</h3>
                <button type="button" onClick={() => setIsAddingProject(false)}><X /></button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400">Client Name</label>
                  <input name="clientName" required className="w-full bg-slate-800 border-slate-700 rounded-lg p-2.5 focus:ring-1 focus:ring-blue-500 outline-none" placeholder="e.g. Acme Corp" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400">Event Type</label>
                  <input name="eventType" required className="w-full bg-slate-800 border-slate-700 rounded-lg p-2.5 focus:ring-1 focus:ring-blue-500 outline-none" placeholder="e.g. Wedding, Commercial" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400">Date</label>
                  <input type="date" name="date" required className="w-full bg-slate-800 border-slate-700 rounded-lg p-2.5 focus:ring-1 focus:ring-blue-500 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400">Duration</label>
                  <input name="duration" className="w-full bg-slate-800 border-slate-700 rounded-lg p-2.5 focus:ring-1 focus:ring-blue-500 outline-none" placeholder="e.g. 8 Hours" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400">Location Name</label>
                  <input name="location" className="w-full bg-slate-800 border-slate-700 rounded-lg p-2.5 focus:ring-1 focus:ring-blue-500 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400">Google Maps Link</label>
                  <input name="mapsLink" className="w-full bg-slate-800 border-slate-700 rounded-lg p-2.5 focus:ring-1 focus:ring-blue-500 outline-none" placeholder="https://..." />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400">Budget ($)</label>
                  <input type="number" name="budget" required className="w-full bg-slate-800 border-slate-700 rounded-lg p-2.5 focus:ring-1 focus:ring-blue-500 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400">Amount Paid ($)</label>
                  <input type="number" name="amountPaid" className="w-full bg-slate-800 border-slate-700 rounded-lg p-2.5 focus:ring-1 focus:ring-blue-500 outline-none" defaultValue="0" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400">Status</label>
                  <select name="status" className="w-full bg-slate-800 border-slate-700 rounded-lg p-2.5 outline-none">
                    {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex gap-4">
                <button type="submit" className="flex-1 bg-blue-600 py-3 rounded-xl font-bold hover:bg-blue-500 transition-colors">Create Project</button>
                <button type="button" onClick={() => setIsAddingProject(false)} className="flex-1 bg-slate-800 py-3 rounded-xl font-bold">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {isAddingExpense && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md">
            <form onSubmit={handleAddExpense} className="p-8 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-bold text-rose-400">Add Expense</h3>
                <button type="button" onClick={() => setIsAddingExpense(false)}><X /></button>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400">Expense Type</label>
                  <select name="type" className="w-full bg-slate-800 border-slate-700 rounded-lg p-2.5 outline-none">
                    {EXPENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400">Amount ($)</label>
                  <input type="number" name="amount" required className="w-full bg-slate-800 border-slate-700 rounded-lg p-2.5 outline-none font-mono" placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400">Date of Purchase</label>
                  <input type="date" name="date" required className="w-full bg-slate-800 border-slate-700 rounded-lg p-2.5 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400">Reason / Notes</label>
                  <textarea name="reason" rows="3" className="w-full bg-slate-800 border-slate-700 rounded-lg p-2.5 outline-none text-sm" placeholder="Why was this bought?"></textarea>
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button type="submit" className="flex-1 bg-rose-600 py-3 rounded-xl font-bold hover:bg-rose-500 transition-colors">Record Expense</button>
                <button type="button" onClick={() => setIsAddingExpense(false)} className="flex-1 bg-slate-800 py-3 rounded-xl font-bold">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}