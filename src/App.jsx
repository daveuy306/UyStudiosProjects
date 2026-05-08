import React, { useState, useEffect, useMemo } from 'react';
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
  MapPin, Calendar, Users, DollarSign, Clock, ChevronRight, Edit3, Save, Link, UserPlus
} from 'lucide-react';

// --- Initialization Guard ---
// We wrap the initialization in a check to prevent top-level ReferenceErrors
let db, auth, appId;

const initializeFirebase = () => {
  try {
    if (typeof __firebase_config === 'undefined') return null;
    
    const firebaseConfig = JSON.parse(__firebase_config);
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
    db = getFirestore(app);
    appId = typeof __app_id !== 'undefined' ? __app_id : 'photo-film-manager';
    return true;
  } catch (e) {
    console.error("Firebase init failed", e);
    return false;
  }
};

// --- Custom Components ---

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center p-6 border-b border-white/5">
          <h3 className="text-xl font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-2 hover:bg-white/5 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

export default function App() {
  const [isConfigured, setIsConfigured] = useState(false);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [isProjectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  
  // Local state for team members during project creation
  const [currentTeam, setCurrentTeam] = useState([]);

  // 1. Initialize Firebase
  useEffect(() => {
    const success = initializeFirebase();
    if (success) {
      setIsConfigured(true);
      
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
    }
  }, []);

  // 2. Data Listeners
  useEffect(() => {
    if (!user || !isConfigured) return;

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

  // 3. Analytics Logic
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

  // --- Actions ---

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

  const addTeamMember = () => {
    setCurrentTeam([...currentTeam, { role: '', name: '', cost: 0 }]);
  };

  const updateTeamMember = (index, field, value) => {
    const updated = [...currentTeam];
    updated[index][field] = field === 'cost' ? Number(value) : value;
    setCurrentTeam(updated);
  };

  const removeTeamMember = (index) => {
    setCurrentTeam(currentTeam.filter((_, i) => i !== index));
  };

  const handleSaveProject = async (e) => {
    e.preventDefault();
    if (!user) return;

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
      const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'projects');
      if (editingProject?.id) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', editingProject.id), projectData);
      } else {
        await addDoc(colRef, { ...projectData, createdAt: new Date().toISOString() });
      }
      setProjectModalOpen(false);
    } catch (err) {
      console.error("Save error:", err);
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!user) return;
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

  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6"></div>
        <h2 className="text-2xl font-bold text-white mb-2">Connecting to Studio Cloud...</h2>
        <p className="text-gray-400 max-w-xs">Initializing secure environment and syncing your workspace variables.</p>
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

          <div className="p-6 mt-auto">
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Live Sync Active</span>
              </div>
              <div className="text-[11px] text-gray-500 leading-relaxed">
                Mobile & Desktop sessions are automatically merged.
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-auto relative">
        <header className="sticky top-0 z-30 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5 p-4 md:px-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 hover:bg-white/5 rounded-xl" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} />
            </button>
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest hidden sm:block">
              {activeTab} Management
            </h2>
          </div>
          <div className="flex items-center gap-4 bg-white/5 px-4 py-2 rounded-full border border-white/5">
             <div className="w-2 h-2 rounded-full bg-indigo-500" />
             <span className="text-xs font-mono text-indigo-300">{user?.uid?.substring(0, 8)}</span>
          </div>
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
                  <div className="flex gap-4 text-[10px] font-bold uppercase tracking-widest">
                    <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-indigo-500"/> Revenue</span>
                    <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500"/> Expenses</span>
                  </div>
                </div>
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                      <XAxis dataKey="name" stroke="#444" fontSize={12} tickMargin={10} />
                      <YAxis stroke="#444" fontSize={12} tickFormatter={(v) => `$${v}`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#141414', border: '1px solid #333', borderRadius: '16px', padding: '12px' }}
                      />
                      <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={4} dot={{ r: 0 }} activeDot={{ r: 6 }} />
                      <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={4} dot={{ r: 0 }} activeDot={{ r: 6 }} />
                      <Line type="monotone" dataKey="owed" stroke="#f59e0b" strokeWidth={2} strokeDasharray="8 8" dot={{ r: 0 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          {activeTab === 'projects' && (
            <div className="space-y-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-3xl font-black">Production Queue</h2>
                <button 
                  onClick={() => handleOpenProjectModal()}
                  className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl flex items-center justify-center gap-3 font-bold transition-all transform active:scale-95"
                >
                  <Plus size={20} /> Create Project
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {projects.map(project => (
                  <div key={project.id} className="group bg-[#141414] border border-white/5 rounded-3xl overflow-hidden hover:border-indigo-500/40 transition-all duration-300">
                    <div className="p-8">
                      <div className="flex justify-between items-start mb-6">
                        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                          project.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                          project.status === 'ongoing' ? 'bg-indigo-500/10 text-indigo-500' :
                          project.status === 'cancelled' ? 'bg-red-500/10 text-red-500' : 'bg-gray-500/10 text-gray-500'
                        }`}>
                          {project.status}
                        </div>
                        <div className="flex gap-1">
                           <button onClick={() => handleOpenProjectModal(project)} className="p-2 text-gray-500 hover:text-white transition-colors"><Edit3 size={16}/></button>
                           <button onClick={() => deleteItem('projects', project.id)} className="p-2 text-gray-500 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
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
                        <div className="flex items-center gap-3 text-sm text-gray-400">
                          <Users size={16} className="text-indigo-500" /> {project.team?.length || 0} Team Members
                        </div>
                      </div>

                      <div className="bg-white/5 rounded-2xl p-4">
                        <div className="flex justify-between text-xs font-bold mb-2">
                          <span className="text-gray-500 uppercase tracking-widest">Payment Progress</span>
                          <span className="text-white">${project.paidAmount} / ${project.budget}</span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-indigo-500 transition-all duration-1000" 
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
                    <h2 className="text-xl font-bold mb-8 flex items-center gap-3">
                      <div className="w-8 h-8 bg-red-500/10 text-red-500 rounded-lg flex items-center justify-center"><Receipt size={18}/></div>
                      Log Expense
                    </h2>
                    <form onSubmit={handleAddExpense} className="space-y-5">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Category</label>
                        <select name="type" className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-indigo-500 outline-none transition-all">
                          <option>Equipment</option>
                          <option>Rentals</option>
                          <option>Marketing</option>
                          <option>Travel</option>
                          <option>Software</option>
                          <option>Post-Production</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Amount</label>
                          <input type="number" name="amount" required step="0.01" className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-gray-700" placeholder="0.00" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Date</label>
                          <input type="date" name="date" required className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Reason / Memo</label>
                        <textarea name="notes" className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white resize-none" rows="4" placeholder="Brief description..."></textarea>
                      </div>
                      <button type="submit" className="w-full bg-white text-black font-black py-4 rounded-2xl hover:bg-gray-200 transition-all shadow-xl shadow-white/5">
                        Record Transaction
                      </button>
                    </form>
                  </div>
                </div>

                <div className="xl:col-span-8">
                  <div className="bg-[#141414] rounded-3xl border border-white/5 overflow-hidden">
                    <div className="p-8 border-b border-white/5 flex justify-between items-center">
                      <h2 className="text-xl font-bold">Transaction History</h2>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-white/[0.02] text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                          <tr>
                            <th className="px-8 py-5">Purchase Date</th>
                            <th className="px-8 py-5">Category</th>
                            <th className="px-8 py-5">Memo</th>
                            <th className="px-8 py-5 text-right">Cost</th>
                            <th className="px-8 py-5"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {expenses.sort((a, b) => new Date(b.date) - new Date(a.date)).map(expense => (
                            <tr key={expense.id} className="group hover:bg-white/5 transition-colors">
                              <td className="px-8 py-6 text-sm font-mono text-gray-400">{expense.date}</td>
                              <td className="px-8 py-6">
                                <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-bold text-gray-300">
                                  {expense.type}
                                </span>
                              </td>
                              <td className="px-8 py-6 text-sm text-gray-400 max-w-[200px] truncate">{expense.notes}</td>
                              <td className="px-8 py-6 text-right font-black text-white">${expense.amount.toLocaleString()}</td>
                              <td className="px-8 py-6 text-right">
                                <button onClick={() => deleteItem('expenses', expense.id)} className="opacity-0 group-hover:opacity-100 p-2 text-gray-600 hover:text-red-500 transition-all">
                                  <Trash2 size={16} />
                                </button>
                              </td>
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

      {/* Project Creation/Edit Modal */}
      <Modal 
        isOpen={isProjectModalOpen} 
        onClose={() => setProjectModalOpen(false)}
        title={editingProject ? 'Modify Production' : 'New Project Initiation'}
      >
        <form onSubmit={handleSaveProject} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Client Identity</label>
              <input type="text" name="clientName" defaultValue={editingProject?.clientName} required className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-indigo-500 outline-none" placeholder="Brand or Individual Name" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Production Type</label>
              <input type="text" name="eventType" defaultValue={editingProject?.eventType} required className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:border-indigo-500 outline-none" placeholder="e.g. Cinematic Commercial" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Production Date</label>
              <input type="date" name="date" defaultValue={editingProject?.date} required className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Duration</label>
              <input type="text" name="duration" defaultValue={editingProject?.duration} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white" placeholder="e.g. 12 Hours" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Project Phase</label>
              <select name="status" defaultValue={editingProject?.status || 'not started'} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none">
                <option value="not started">Not Started</option>
                <option value="ongoing">In Production</option>
                <option value="completed">Delivered</option>
                <option value="cancelled">On Hold/Cancelled</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Location</label>
              <input type="text" name="location" defaultValue={editingProject?.location} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Maps Integration</label>
              <input type="url" name="mapsLink" defaultValue={editingProject?.mapsLink} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white" placeholder="Google Maps URL" />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
               <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Crew Allocation & Costs</label>
               <button type="button" onClick={addTeamMember} className="text-xs text-indigo-400 flex items-center gap-1 hover:text-indigo-300 font-bold transition-colors">
                 <UserPlus size={14}/> Add Member
               </button>
            </div>
            <div className="space-y-3">
              {currentTeam.map((member, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-3 items-center">
                  <div className="col-span-4">
                    <input 
                      placeholder="Name" 
                      value={member.name} 
                      onChange={(e) => updateTeamMember(idx, 'name', e.target.value)}
                      className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-2 text-xs" 
                    />
                  </div>
                  <div className="col-span-4">
                    <input 
                      placeholder="Role (e.g. DOP)" 
                      value={member.role} 
                      onChange={(e) => updateTeamMember(idx, 'role', e.target.value)}
                      className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-2 text-xs" 
                    />
                  </div>
                  <div className="col-span-3">
                    <input 
                      type="number" 
                      placeholder="Cost" 
                      value={member.cost} 
                      onChange={(e) => updateTeamMember(idx, 'cost', e.target.value)}
                      className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-2 text-xs" 
                    />
                  </div>
                  <div className="col-span-1 text-right">
                    <button type="button" onClick={() => removeTeamMember(idx)} className="text-gray-600 hover:text-red-500 transition-colors"><X size={14}/></button>
                  </div>
                </div>
              ))}
              {currentTeam.length === 0 && <p className="text-[10px] text-gray-600 italic">No crew assigned to this project yet.</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/[0.02] p-6 rounded-3xl border border-white/5">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-white">Full Project Budget ($)</label>
              <input type="number" name="budget" defaultValue={editingProject?.budget} required className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white font-bold" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Amount Received ($)</label>
              <input type="number" name="paidAmount" defaultValue={editingProject?.paidAmount || 0} className="w-full bg-indigo-500/10 border border-indigo-500/20 rounded-2xl px-5 py-4 text-indigo-100 font-bold" />
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row gap-4">
            <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-600/20 transition-all flex items-center justify-center gap-3">
              <Save size={20} /> Finalize Records
            </button>
            <button 
              type="button" 
              onClick={() => setProjectModalOpen(false)}
              className="px-10 bg-white/5 hover:bg-white/10 text-white font-bold py-4 rounded-2xl transition-all"
            >
              Discard
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}