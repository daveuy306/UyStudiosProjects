import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
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
  MapPin, Calendar, Users, DollarSign, Clock, ChevronRight, Edit3, Save
} from 'lucide-react';

// --- Firebase Configuration & Initialization ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'photo-film-manager';

// --- Custom Components ---

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1e1e1e] border border-white/10 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center p-6 border-b border-white/10">
          <h3 className="text-xl font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [isProjectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);

  // --- Auth Setup ---
  useEffect(() => {
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
  }, []);

  // --- Real-time Data Sync ---
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

  // --- Financial Logic ---
  const chartData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months.map((month, index) => {
      const monthProjects = projects.filter(p => new Date(p.date).getMonth() === index);
      const monthExpenses = expenses.filter(e => new Date(e.date).getMonth() === index);
      
      const revenue = monthProjects.reduce((sum, p) => sum + (Number(p.paidAmount) || 0), 0);
      const owed = monthProjects.reduce((sum, p) => sum + ((Number(p.budget) || 0) - (Number(p.paidAmount) || 0)), 0);
      const cost = monthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

      return { name: month, revenue, owed, expenses: cost };
    });
  }, [projects, expenses]);

  // --- Form Handlers ---
  const handleSaveProject = async (e) => {
    e.preventDefault();
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
      team: editingProject?.team || [], // Simplified for demo; usually involves sub-form
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
      setEditingProject(null);
    } catch (err) {
      console.error("Save error:", err);
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const expenseData = {
      type: formData.get('type'),
      amount: Number(formData.get('amount')),
      date: formData.get('date'),
      notes: formData.get('notes'),
      createdAt: new Date().toISOString()
    };
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'expenses'), expenseData);
      e.target.reset();
    } catch (err) {
      console.error("Expense error:", err);
    }
  };

  const deleteItem = async (col, id) => {
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', col, id));
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-gray-100 flex font-sans">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#1a1a1a] border-r border-white/5 transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static`}>
        <div className="flex flex-col h-full">
          <div className="p-6">
            <h1 className="text-2xl font-black tracking-tighter text-white flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">L</div>
              LUMIERE
            </h1>
          </div>
          
          <nav className="flex-1 px-4 space-y-2 mt-4">
            {[
              { id: 'dashboard', icon: LayoutDashboard, label: 'Analytics' },
              { id: 'projects', icon: FolderPlus, label: 'Projects' },
              { id: 'expenses', icon: Receipt, label: 'Expenses' }
            ].map(item => (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === item.id ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-600/20' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
              >
                <item.icon size={20} />
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="p-6 border-t border-white/5">
            <div className="text-xs text-gray-500 uppercase font-bold tracking-widest mb-4">Sync Status</div>
            <div className="flex items-center gap-2 text-sm text-green-500">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Connected to Cloud
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-auto">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-[#0f0f0f]/80 backdrop-blur-md border-b border-white/5 p-4 md:px-8 flex items-center justify-between">
          <button className="md:hidden p-2 hover:bg-white/5 rounded-lg" onClick={() => setSidebarOpen(true)}>
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-4">
            <div className="text-sm font-medium text-gray-400 hidden sm:block">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500" />
          </div>
        </header>

        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
          {activeTab === 'dashboard' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-white/5">
                  <div className="text-gray-400 text-sm font-medium">Total Revenue (Year)</div>
                  <div className="text-3xl font-bold text-white mt-1">
                    ${chartData.reduce((a, b) => a + b.revenue, 0).toLocaleString()}
                  </div>
                </div>
                <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-white/5">
                  <div className="text-gray-400 text-sm font-medium">Outstanding Owed</div>
                  <div className="text-3xl font-bold text-orange-400 mt-1">
                    ${chartData.reduce((a, b) => a + b.owed, 0).toLocaleString()}
                  </div>
                </div>
                <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-white/5">
                  <div className="text-gray-400 text-sm font-medium">Net Profit</div>
                  <div className="text-3xl font-bold text-green-400 mt-1">
                    ${(chartData.reduce((a, b) => a + b.revenue, 0) - chartData.reduce((a, b) => a + b.expenses, 0)).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-white/5">
                <h2 className="text-lg font-bold mb-6">Financial Trends</h2>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                      <XAxis dataKey="name" stroke="#666" />
                      <YAxis stroke="#666" tickFormatter={(v) => `$${v}`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333', borderRadius: '12px' }}
                        itemStyle={{ fontWeight: 'bold' }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} name="Revenue" />
                      <Line type="monotone" dataKey="owed" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" name="Owed" />
                      <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={3} name="Expenses" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          {activeTab === 'projects' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Active Projects</h2>
                <button 
                  onClick={() => { setEditingProject(null); setProjectModalOpen(true); }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-colors"
                >
                  <Plus size={18} /> New Project
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.sort((a, b) => new Date(b.date) - new Date(a.date)).map(project => (
                  <div key={project.id} className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-6 hover:border-indigo-500/30 transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="text-xs font-bold text-indigo-400 uppercase tracking-widest">{project.eventType}</div>
                        <h3 className="text-lg font-bold text-white mt-1">{project.clientName}</h3>
                      </div>
                      <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase ${
                        project.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                        project.status === 'ongoing' ? 'bg-blue-500/10 text-blue-500' :
                        project.status === 'not started' ? 'bg-gray-500/10 text-gray-500' : 'bg-red-500/10 text-red-500'
                      }`}>
                        {project.status}
                      </span>
                    </div>

                    <div className="space-y-3 text-sm text-gray-400 mb-6">
                      <div className="flex items-center gap-2"><Calendar size={14} /> {project.date}</div>
                      <div className="flex items-center gap-2"><MapPin size={14} /> {project.location}</div>
                      <div className="flex items-center gap-2"><DollarSign size={14} /> ${project.paidAmount} / ${project.budget} paid</div>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => { setEditingProject(project); setProjectModalOpen(true); }}
                        className="flex-1 bg-white/5 hover:bg-white/10 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                      >
                        <Edit3 size={14} /> Edit
                      </button>
                      <button 
                        onClick={() => deleteItem('projects', project.id)}
                        className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'expenses' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1">
                <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-white/5 sticky top-24">
                  <h2 className="text-xl font-bold mb-6">Log Expense</h2>
                  <form onSubmit={handleAddExpense} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Category</label>
                      <select name="type" className="w-full bg-[#2a2a2a] border border-white/10 rounded-xl px-4 py-3 text-white">
                        <option>Equipment</option>
                        <option>Rentals</option>
                        <option>Marketing</option>
                        <option>Travel</option>
                        <option>Software</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Amount</label>
                        <input type="number" name="amount" required step="0.01" className="w-full bg-[#2a2a2a] border border-white/10 rounded-xl px-4 py-3 text-white" placeholder="0.00" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Date</label>
                        <input type="date" name="date" required className="w-full bg-[#2a2a2a] border border-white/10 rounded-xl px-4 py-3 text-white" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Reason / Notes</label>
                      <textarea name="notes" className="w-full bg-[#2a2a2a] border border-white/10 rounded-xl px-4 py-3 text-white" rows="3" placeholder="Bought new filter..."></textarea>
                    </div>
                    <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-600/20">
                      Save Expense
                    </button>
                  </form>
                </div>
              </div>

              <div className="lg:col-span-2">
                <div className="bg-[#1a1a1a] rounded-2xl border border-white/5 overflow-hidden">
                  <div className="p-6 border-b border-white/5">
                    <h2 className="text-xl font-bold">Expense History</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-white/5 text-xs font-bold text-gray-400 uppercase">
                        <tr>
                          <th className="px-6 py-4">Date</th>
                          <th className="px-6 py-4">Category</th>
                          <th className="px-6 py-4">Notes</th>
                          <th className="px-6 py-4 text-right">Amount</th>
                          <th className="px-6 py-4"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {expenses.sort((a, b) => new Date(b.date) - new Date(a.date)).map(expense => (
                          <tr key={expense.id} className="hover:bg-white/5">
                            <td className="px-6 py-4 text-sm text-gray-300">{expense.date}</td>
                            <td className="px-6 py-4"><span className="text-xs px-2 py-1 bg-white/10 rounded-full">{expense.type}</span></td>
                            <td className="px-6 py-4 text-sm text-gray-400 max-w-[200px] truncate">{expense.notes}</td>
                            <td className="px-6 py-4 text-right font-bold text-white">${expense.amount.toLocaleString()}</td>
                            <td className="px-6 py-4 text-right">
                              <button onClick={() => deleteItem('expenses', expense.id)} className="text-gray-500 hover:text-red-500 transition-colors">
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
        onClose={() => { setProjectModalOpen(false); setEditingProject(null); }}
        title={editingProject ? 'Edit Project' : 'Create New Project'}
      >
        <form onSubmit={handleSaveProject} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Client Name</label>
              <input type="text" name="clientName" defaultValue={editingProject?.clientName} required className="w-full bg-[#2a2a2a] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Event Type</label>
              <input type="text" name="eventType" defaultValue={editingProject?.eventType} required className="w-full bg-[#2a2a2a] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600" placeholder="e.g. Wedding, Commercial" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Date</label>
              <input type="date" name="date" defaultValue={editingProject?.date} required className="w-full bg-[#2a2a2a] border border-white/10 rounded-xl px-4 py-3 text-white" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Duration</label>
              <input type="text" name="duration" defaultValue={editingProject?.duration} className="w-full bg-[#2a2a2a] border border-white/10 rounded-xl px-4 py-3 text-white" placeholder="8 Hours" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Progress Status</label>
              <select name="status" defaultValue={editingProject?.status || 'not started'} className="w-full bg-[#2a2a2a] border border-white/10 rounded-xl px-4 py-3 text-white">
                <option value="not started">Not Started</option>
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Location</label>
              <input type="text" name="location" defaultValue={editingProject?.location} className="w-full bg-[#2a2a2a] border border-white/10 rounded-xl px-4 py-3 text-white" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Google Maps Link</label>
              <input type="url" name="mapsLink" defaultValue={editingProject?.mapsLink} className="w-full bg-[#2a2a2a] border border-white/10 rounded-xl px-4 py-3 text-white" placeholder="https://maps.google.com/..." />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Total Budget ($)</label>
              <input type="number" name="budget" defaultValue={editingProject?.budget} required className="w-full bg-[#2a2a2a] border border-white/10 rounded-xl px-4 py-3 text-white" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Amount Paid ($)</label>
              <input type="number" name="paidAmount" defaultValue={editingProject?.paidAmount || 0} className="w-full bg-[#2a2a2a] border border-white/10 rounded-xl px-4 py-3 text-white" />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
              <Save size={18} /> Save Project Details
            </button>
            <button 
              type="button" 
              onClick={() => { setProjectModalOpen(false); setEditingProject(null); }}
              className="px-6 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-xl transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}