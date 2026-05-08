import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, 
  onSnapshot, query, setDoc, getDoc 
} from 'firebase/firestore';
import { 
  getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { 
  LayoutDashboard, FolderPlus, Receipt, Menu, X, Plus, Trash2, 
  MapPin, Calendar, Users, DollarSign, Clock, ChevronRight, Edit3, Save, Link, UserPlus, RefreshCw, AlertCircle
} from 'lucide-react';

// Variables to hold singleton instances
let db, auth, appId;

export default function App() {
  const [isConfigured, setIsConfigured] = useState(false);
  const [configError, setConfigError] = useState(false);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [isProjectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [currentTeam, setCurrentTeam] = useState([]);

  // --- Robust Initialization Logic ---

  const tryInitialize = useCallback(() => {
    try {
      // Check if global config exists yet
      if (typeof __firebase_config === 'undefined' || !__firebase_config) {
        return false;
      }
      
      const firebaseConfig = JSON.parse(__firebase_config);
      const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
      auth = getAuth(app);
      db = getFirestore(app);
      appId = typeof __app_id !== 'undefined' ? __app_id : 'photo-film-manager';
      
      setIsConfigured(true);
      setConfigError(false);
      return true;
    } catch (e) {
      console.error("Initialization failed:", e);
      setConfigError(true);
      return false;
    }
  }, []);

  // Poll for configuration on mount
  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 10;
    
    const interval = setInterval(() => {
      const success = tryInitialize();
      attempts++;
      
      if (success || attempts >= maxAttempts) {
        clearInterval(interval);
        if (!success && attempts >= maxAttempts) {
          setConfigError(true);
        }
      }
    }, 1000); // Check every second

    return () => clearInterval(interval);
  }, [tryInitialize]);

  // Auth setup after configuration is successful
  useEffect(() => {
    if (!isConfigured || !auth) return;

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth error:", error);
      }
    };

    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, [isConfigured]);

  // Data listeners after Auth is successful
  useEffect(() => {
    if (!user || !db || !isConfigured) return;

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
  }, [user, isConfigured]);

  // --- Actions & Helpers ---

  const deleteItem = async (colName, id) => {
    if (!user || !db) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', colName, id));
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const handleOpenProjectModal = (project = null) => {
    if (project) {
      setEditingProject(project);
      setCurrentTeam(project.team || []);
    } else {
      setEditingProject(null);
      setCurrentTeam([]);
    }
    setProjectModalOpen(true);
  };

  const handleSaveProject = async (e) => {
    e.preventDefault();
    if (!user || !db) return;

    const formData = new FormData(e.target);
    const projectData = {
      clientName: formData.get('clientName'),
      eventType: formData.get('eventType'),
      duration: formData.get('duration'),
      location: formData.get('location'),
      mapsLink: formData.get('mapsLink'),
      budget: Number(formData.get('budget')),
      paidAmount: Number(formData.get('paidAmount')),
      date: formData.get('date'),
      status: formData.get('status'),
      team: currentTeam,
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingProject?.id) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', editingProject.id), projectData);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'projects'), { 
          ...projectData, 
          createdAt: new Date().toISOString() 
        });
      }
      setProjectModalOpen(false);
    } catch (err) {
      console.error("Save error:", err);
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!user || !db) return;
    const formData = new FormData(e.target);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'expenses'), {
        type: formData.get('type'),
        amount: Number(formData.get('amount')),
        date: formData.get('date'),
        notes: formData.get('notes'),
        createdAt: new Date().toISOString()
      });
      e.target.reset();
    } catch (err) {
      console.error("Expense error:", err);
    }
  };

  const chartData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
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
      
      const revenue = monthProjects.reduce((sum, p) => sum + (Number(p.paidAmount) || 0), 0);
      const budgetTotal = monthProjects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
      const owed = budgetTotal - revenue;
      const cost = monthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

      return { name: month, revenue, owed: Math.max(0, owed), expenses: cost };
    });
  }, [projects, expenses]);

  // --- Render Logic ---

  if (configError) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 text-red-500">
          <AlertCircle size={40} />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Connection Issue</h2>
        <p className="text-gray-400 max-w-sm mb-8">
          The studio environment variables haven't loaded correctly. This usually fixes itself within a few seconds.
        </p>
        <button 
          onClick={() => { setConfigError(false); tryInitialize(); }}
          className="flex items-center gap-2 bg-white text-black px-8 py-3 rounded-2xl font-bold hover:bg-gray-200 transition-all active:scale-95"
        >
          <RefreshCw size={18} /> Retry Connection
        </button>
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6"></div>
        <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Syncing Studio Workspace...</h2>
        <p className="text-gray-500 text-sm max-w-xs leading-relaxed">
          Establishing a secure link with your production database and workspace variables.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 flex font-sans selection:bg-indigo-500/30">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#141414] border-r border-white/5 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static`}>
        <div className="flex flex-col h-full">
          <div className="p-8 flex items-center justify-between">
            <h1 className="text-xl font-black tracking-tighter text-white flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">L</div>
              LUMIERE
            </h1>
            <button className="md:hidden text-gray-500" onClick={() => setSidebarOpen(false)}><X size={20} /></button>
          </div>
          
          <nav className="flex-1 px-4 space-y-1.5">
            {[
              { id: 'dashboard', icon: LayoutDashboard, label: 'Analytics' },
              { id: 'projects', icon: FolderPlus, label: 'Production' },
              { id: 'expenses', icon: Receipt, label: 'Expenses' }
            ].map(item => (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 ${activeTab === item.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-gray-500 hover:bg-white/5 hover:text-gray-200'}`}
              >
                <item.icon size={18} />
                <span className="font-semibold text-sm tracking-wide">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-auto">
        <header className="sticky top-0 z-30 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5 p-4 md:px-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 hover:bg-white/5 rounded-xl" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} />
            </button>
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest hidden sm:block">
              {activeTab} Management
            </h2>
          </div>
          {user && (
            <div className="flex items-center gap-4 bg-white/5 px-4 py-2 rounded-full border border-white/5">
               <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
               <span className="text-xs font-mono text-gray-400">{user.uid.substring(0, 12)}</span>
            </div>
          )}
        </header>

        <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-10">
          {activeTab === 'dashboard' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { label: 'Yearly Revenue', val: chartData.reduce((a, b) => a + b.revenue, 0), color: 'text-white' },
                  { label: 'Pending Collections', val: chartData.reduce((a, b) => a + b.owed, 0), color: 'text-orange-400' },
                  { label: 'Net Profit', val: chartData.reduce((a, b) => a + b.revenue, 0) - chartData.reduce((a, b) => a + b.expenses, 0), color: 'text-green-400' }
                ].map((stat, i) => (
                  <div key={i} className="bg-[#141414] p-8 rounded-3xl border border-white/5 shadow-sm">
                    <div className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-2">{stat.label}</div>
                    <div className={`text-4xl font-black ${stat.color}`}>
                      ${stat.val.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-[#141414] p-8 rounded-3xl border border-white/5">
                <div className="flex items-center justify-between mb-10">
                  <h3 className="text-lg font-bold">Performance Matrix</h3>
                </div>
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                      <XAxis dataKey="name" stroke="#444" fontSize={12} tickMargin={10} />
                      <YAxis stroke="#444" fontSize={12} tickFormatter={(v) => `$${v}`} />
                      <Tooltip contentStyle={{ backgroundColor: '#141414', border: '1px solid #333', borderRadius: '16px' }} />
                      <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={4} dot={{ r: 0 }} />
                      <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={4} dot={{ r: 0 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          {activeTab === 'projects' && (
            <div className="space-y-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-3xl font-black text-white">Production Queue</h2>
                <button 
                  onClick={() => handleOpenProjectModal()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3.5 rounded-2xl flex items-center justify-center gap-3 font-bold transition-all transform active:scale-95 shadow-xl shadow-indigo-600/20"
                >
                  <Plus size={20} /> Create Project
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {projects.map(project => (
                  <div key={project.id} className="bg-[#141414] border border-white/5 rounded-3xl overflow-hidden hover:border-indigo-500/40 transition-all duration-300">
                    <div className="p-8">
                      <div className="flex justify-between items-start mb-6">
                        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                          project.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                          project.status === 'ongoing' ? 'bg-indigo-500/10 text-indigo-500' : 'bg-gray-500/10 text-gray-500'
                        }`}>
                          {project.status}
                        </div>
                        <div className="flex gap-1">
                           <button onClick={() => handleOpenProjectModal(project)} className="p-2 text-gray-500 hover:text-white"><Edit3 size={16}/></button>
                           <button onClick={() => deleteItem('projects', project.id)} className="p-2 text-gray-500 hover:text-red-500"><Trash2 size={16}/></button>
                        </div>
                      </div>

                      <h3 className="text-xl font-bold mb-1">{project.clientName}</h3>
                      <p className="text-gray-500 text-sm font-medium mb-6">{project.eventType}</p>

                      <div className="space-y-4 mb-8">
                        <div className="flex items-center gap-3 text-sm text-gray-400">
                          <Calendar size={16} className="text-indigo-500" /> {project.date}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-400">
                          <MapPin size={16} className="text-indigo-500" /> {project.location}
                        </div>
                      </div>

                      <div className="bg-white/5 rounded-2xl p-4">
                        <div className="flex justify-between text-xs font-bold mb-2">
                          <span className="text-gray-500 uppercase">Payment Progress</span>
                          <span className="text-white">${project.paidAmount} / ${project.budget}</span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-indigo-500 transition-all duration-700" 
                            style={{ width: `${Math.min(100, (project.paidAmount / project.budget) * 100)}%` }} 
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'expenses' && (
             <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
                <div className="xl:col-span-4">
                  <div className="bg-[#141414] p-8 rounded-3xl border border-white/5 sticky top-28">
                    <h2 className="text-xl font-bold mb-8">Record Expense</h2>
                    <form onSubmit={handleAddExpense} className="space-y-5">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Category</label>
                        <select name="type" className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none">
                          <option>Equipment</option>
                          <option>Marketing</option>
                          <option>Travel</option>
                          <option>Software</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Amount</label>
                          <input type="number" name="amount" required step="0.01" className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white" placeholder="0.00" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Date</label>
                          <input type="date" name="date" required className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Memo</label>
                        <textarea name="notes" className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white resize-none" rows="3"></textarea>
                      </div>
                      <button type="submit" className="w-full bg-white text-black font-black py-4 rounded-2xl hover:bg-gray-200 transition-all">
                        Log Transaction
                      </button>
                    </form>
                  </div>
                </div>

                <div className="xl:col-span-8">
                  <div className="bg-[#141414] rounded-3xl border border-white/5 overflow-hidden">
                    <div className="p-8 border-b border-white/5">
                      <h2 className="text-xl font-bold">Expense History</h2>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-white/[0.02] text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                          <tr>
                            <th className="px-8 py-5">Date</th>
                            <th className="px-8 py-5">Category</th>
                            <th className="px-8 py-5">Memo</th>
                            <th className="px-8 py-5 text-right">Cost</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {expenses.sort((a, b) => new Date(b.date) - new Date(a.date)).map(expense => (
                            <tr key={expense.id} className="hover:bg-white/5 transition-colors">
                              <td className="px-8 py-6 text-sm font-mono text-gray-400">{expense.date}</td>
                              <td className="px-8 py-6 text-sm text-indigo-400 font-bold">{expense.type}</td>
                              <td className="px-8 py-6 text-sm text-gray-400">{expense.notes}</td>
                              <td className="px-8 py-6 text-right font-black text-white">${expense.amount.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
             </div>
          )}
        </div>
      </main>

      {/* Basic Modal Implementation */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-bold text-white">Project Details</h3>
              <button onClick={() => setProjectModalOpen(false)} className="text-gray-400 hover:text-white"><X/></button>
            </div>
            <form onSubmit={handleSaveProject} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Client</label>
                  <input name="clientName" defaultValue={editingProject?.clientName} required className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Event Type</label>
                  <input name="eventType" defaultValue={editingProject?.eventType} required className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Budget ($)</label>
                  <input type="number" name="budget" defaultValue={editingProject?.budget} required className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Paid ($)</label>
                  <input type="number" name="paidAmount" defaultValue={editingProject?.paidAmount} required className="w-full bg-indigo-500/10 border border-indigo-500/20 rounded-2xl px-5 py-4 text-indigo-100 font-bold" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Date</label>
                  <input type="date" name="date" defaultValue={editingProject?.date} required className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Status</label>
                  <select name="status" defaultValue={editingProject?.status} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none">
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Location</label>
                <input name="location" defaultValue={editingProject?.location} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white" />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="submit" className="flex-1 bg-white text-black font-black py-4 rounded-2xl hover:bg-gray-200 transition-all">Save Project</button>
                <button type="button" onClick={() => setProjectModalOpen(false)} className="px-8 bg-white/5 text-white font-bold py-4 rounded-2xl">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}