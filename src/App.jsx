import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInAnonymously, 
  signInWithCustomToken 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  setDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { 
  Plus, 
  LayoutDashboard, 
  Briefcase, 
  Settings, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  LogOut,
  User,
  ChevronRight
} from 'lucide-react';

// --- FIREBASE CONFIGURATION ---
const getFirebaseConfig = () => {
  try {
    return JSON.parse(__firebase_config);
  } catch (e) {
    console.error("Firebase config missing or invalid");
    return null;
  }
};

const config = getFirebaseConfig();
const appId = typeof __app_id !== 'undefined' ? __app_id : 'uystudios-nexus-v1';

// Initialize Firebase only if config is available
let app, auth, db;
if (config) {
  app = initializeApp(config);
  auth = getAuth(app);
  db = getFirestore(app);
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', status: 'Active', budget: '', progress: 0 });

  // 1. Authentication Lifecycle
  useEffect(() => {
    if (!auth) return;

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error:", err);
      }
    };

    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Real-time Data Sync
  useEffect(() => {
    if (!user || !db) return;

    // RULE 1: Use strictly formatted paths
    const projectsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'projects');

    const unsubscribe = onSnapshot(projectsRef, (snapshot) => {
      const projectsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProjects(projectsData);
    }, (err) => {
      console.error("Firestore sync error:", err);
    });

    return () => unsubscribe();
  }, [user]);

  // 3. Actions
  const handleAddProject = async (e) => {
    e.preventDefault();
    if (!user || !db || !newProject.name) return;

    try {
      const projectsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'projects');
      await addDoc(projectsRef, {
        ...newProject,
        budget: parseFloat(newProject.budget) || 0,
        createdAt: serverTimestamp()
      });
      setNewProject({ name: '', status: 'Active', budget: '', progress: 0 });
      setIsModalOpen(false);
    } catch (err) {
      console.error("Error adding project:", err);
    }
  };

  const updateProgress = async (id, val) => {
    const projectRef = doc(db, 'artifacts', appId, 'users', user.uid, 'projects', id);
    await updateDoc(projectRef, { progress: val });
  };

  // 4. Computed Stats
  const stats = useMemo(() => {
    const total = projects.length;
    const completed = projects.filter(p => p.status === 'Completed').length;
    const active = projects.filter(p => p.status === 'Active').length;
    const totalBudget = projects.reduce((acc, p) => acc + (p.budget || 0), 0);
    
    const chartData = [
      { name: 'Active', value: active },
      { name: 'Completed', value: completed },
      { name: 'Paused', value: total - active - completed },
    ];

    return { total, completed, active, totalBudget, chartData };
  }, [projects]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Setup Required</h1>
          <p className="text-slate-600">Firebase configuration is missing. Please ensure environment variables are properly set.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col">
        <div className="p-6">
          <div className="flex items-center gap-2 text-indigo-600 mb-8">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <TrendingUp className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-800">UY NEXUS</span>
          </div>
          
          <nav className="space-y-1">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'projects', label: 'Projects', icon: Briefcase },
              { id: 'settings', label: 'Settings', icon: Settings },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === item.id 
                    ? 'bg-indigo-50 text-indigo-700' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </nav>
        </div>
        
        <div className="mt-auto p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 p-2">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
              <User className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-slate-700 truncate">{user?.uid}</p>
              <p className="text-[10px] text-slate-500">Device ID Verified</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8">
          <h2 className="text-lg font-semibold capitalize">{activeTab}</h2>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-indigo-700 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </header>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-8">
          {activeTab === 'dashboard' && (
            <div className="max-w-6xl mx-auto space-y-8">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                  { label: 'Total Projects', val: stats.total, icon: Briefcase, color: 'text-blue-600' },
                  { label: 'Active Tasks', val: stats.active, icon: Clock, color: 'text-amber-600' },
                  { label: 'Completed', val: stats.completed, icon: CheckCircle2, color: 'text-emerald-600' },
                  { label: 'Portfolio Value', val: `$${stats.totalBudget.toLocaleString()}`, icon: TrendingUp, color: 'text-indigo-600' },
                ].map((s, i) => (
                  <div key={i} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`p-2 rounded-lg bg-slate-50 ${s.color}`}>
                        <s.icon className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-sm text-slate-500 mb-1">{s.label}</p>
                    <p className="text-2xl font-bold text-slate-800">{s.val}</p>
                  </div>
                ))}
              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-700 mb-6 uppercase tracking-wider">Project Status Distribution</h3>
                  {/* Fixed height container for Recharts */}
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats.chartData}
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {stats.chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Recent Activity</h3>
                  <div className="space-y-4">
                    {projects.slice(0, 5).map(p => (
                      <div key={p.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${p.status === 'Completed' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                          <span className="text-sm font-medium text-slate-700">{p.name}</span>
                        </div>
                        <span className="text-xs text-slate-400">Sync active</span>
                      </div>
                    ))}
                    {projects.length === 0 && (
                      <p className="text-center text-slate-400 py-12 italic">No projects yet. Click "New Project" to start.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'projects' && (
            <div className="max-w-6xl mx-auto">
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Project Name</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Budget</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Progress</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {projects.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-800">{p.name}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            p.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'
                          }`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">${p.budget?.toLocaleString()}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <input 
                              type="range" 
                              className="w-24 accent-indigo-600 h-1"
                              value={p.progress || 0}
                              onChange={(e) => updateProgress(p.id, parseInt(e.target.value))}
                            />
                            <span className="text-xs text-slate-500 w-8">{p.progress}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={async () => {
                              const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'projects', p.id);
                              await deleteDoc(ref);
                            }}
                            className="text-slate-400 hover:text-red-500 transition-colors"
                          >
                            Delete
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

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-50/50">
              <h3 className="text-lg font-bold text-slate-800">Add New Project</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form onSubmit={handleAddProject} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Project Name</label>
                <input 
                  autoFocus
                  required
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  value={newProject.name}
                  onChange={e => setNewProject({...newProject, name: e.target.value})}
                  placeholder="E.g. Mobile App Redesign"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Budget ($)</label>
                  <input 
                    type="number"
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newProject.budget}
                    onChange={e => setNewProject({...newProject, budget: e.target.value})}
                    placeholder="5000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Status</label>
                  <select 
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none appearance-none bg-white"
                    value={newProject.status}
                    onChange={e => setNewProject({...newProject, status: e.target.value})}
                  >
                    <option>Active</option>
                    <option>Completed</option>
                    <option>Paused</option>
                  </select>
                </div>
              </div>
              <button 
                type="submit"
                className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-[0.98]"
              >
                Create Project
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}