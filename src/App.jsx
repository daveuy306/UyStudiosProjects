import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  onSnapshot, 
  setDoc,
  collection
} from 'firebase/firestore';
import { 
  getAuth,
  signInWithCustomToken,
  signInAnonymously,
  onAuthStateChanged
} from 'firebase/auth';
import { 
  Users, Plus, Trash2, Briefcase, 
  MapPin, DollarSign, ExternalLink,
  ShieldCheck, ShoppingCart, Tag, 
  BarChart3, Activity, X, Link as LinkIcon,
  FileText, ChevronLeft, ChevronRight,
  LayoutDashboard, FolderKanban, Settings,
  Clock, TrendingUp, AlertCircle
} from 'lucide-react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

// --- Initialization Logic ---
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const appId = typeof __app_id !== 'undefined' ? __app_id : 'uy-studios-pm';

// Initialize Firebase services outside component to prevent re-init
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const App = () => {
  const [user, setUser] = useState(null);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [syncStatus, setSyncStatus] = useState('connecting');
  const [projects, setProjects] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [newProject, setNewProject] = useState({
    name: '',
    location: '',
    budget: '',
    amountPaid: '',
    mapLink: '',
    filesLink: '',
    notes: '',
    teamMember: '',
    teamRole: ''
  });

  // Authentication Sequence (Rule 3)
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth Error:", err);
        setSyncStatus('offline');
      }
    };

    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // Data Fetching (Rule 1 & 2)
  useEffect(() => {
    if (!user) return;
    
    // Path follows Rule 1: /artifacts/{appId}/public/data/{collectionName}
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'pm_projects_v2');
    
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        setProjects(snap.data().projects || []);
      }
      setSyncStatus('synced');
    }, (err) => {
      console.error("Firestore Error:", err);
      setSyncStatus('error');
    });

    return () => unsubscribe();
  }, [user]);

  const saveToCloud = async (updated) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pm_projects_v2'), { 
        projects: updated,
        lastUpdated: Date.now()
      });
    } catch (err) {
      console.error("Save Error:", err);
    }
  };

  const handleCreate = () => {
    const payload = {
      ...newProject,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      team: [{ id: '1', name: newProject.teamMember, role: newProject.teamRole }]
    };
    const updated = [...projects, payload];
    setProjects(updated);
    saveToCloud(updated);
    setIsModalOpen(false);
    setNewProject({ name: '', location: '', budget: '', amountPaid: '', mapLink: '', filesLink: '', notes: '', teamMember: '', teamRole: '' });
  };

  const handleDelete = (id) => {
    const updated = projects.filter(p => p.id !== id);
    setProjects(updated);
    saveToCloud(updated);
  };

  const stats = useMemo(() => {
    const totalBudget = projects.reduce((acc, p) => acc + (parseFloat(p.budget) || 0), 0);
    const totalPaid = projects.reduce((acc, p) => acc + (parseFloat(p.amountPaid) || 0), 0);
    return {
      active: projects.length,
      owing: totalBudget - totalPaid,
      revenue: totalPaid,
    };
  }, [projects]);

  const trendData = [
    { name: 'Mon', val: 2400 },
    { name: 'Tue', val: 1398 },
    { name: 'Wed', val: 9800 },
    { name: 'Thu', val: 3908 },
    { name: 'Fri', val: 4800 },
    { name: 'Sat', val: 3800 },
    { name: 'Sun', val: 4300 },
  ];

  return (
    <div className="flex h-screen bg-[#050505] text-[#e0e0e0] font-sans overflow-hidden">
      
      {/* Premium Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-[#0a0a0a] border-r border-[#1a1a1a] transition-all duration-300 flex flex-col shrink-0`}>
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center shrink-0">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          {isSidebarOpen && <span className="font-black italic text-lg tracking-tighter uppercase">UY Studios</span>}
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-4">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'projects', icon: FolderKanban, label: 'Projects' },
            { id: 'timeline', icon: Clock, label: 'Schedule' },
            { id: 'settings', icon: Settings, label: 'System' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all ${
                activeTab === item.id ? 'bg-blue-600/10 text-blue-500' : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900/50'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {isSidebarOpen && <span className="text-[10px] font-bold uppercase tracking-widest">{item.label}</span>}
            </button>
          ))}
        </nav>

        <button 
          onClick={() => setSidebarOpen(!isSidebarOpen)}
          className="p-6 text-zinc-600 hover:text-white flex items-center justify-center border-t border-[#1a1a1a]"
        >
          {isSidebarOpen ? <ChevronLeft /> : <ChevronRight />}
        </button>
      </aside>

      {/* Main Panel */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Header */}
        <header className="h-20 border-b border-[#1a1a1a] flex items-center justify-between px-8 bg-[#050505]/50 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-3">
            <div className={`px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${
              syncStatus === 'synced' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-500' : 'bg-amber-500/5 border-amber-500/20 text-amber-500'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${syncStatus === 'synced' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
              {syncStatus === 'synced' ? 'System Synced' : 'Connecting...'}
            </div>
          </div>

          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-white text-black px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all flex items-center gap-2"
          >
            <Plus className="w-3 h-3" /> Create Project
          </button>
        </header>

        {/* Viewport */}
        <main className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
          
          {/* Top Row Graphics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-[#0a0a0a] border border-[#1a1a1a] rounded-[2rem] p-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Revenue Velocity</h3>
                  <p className="text-2xl font-black text-white italic mt-1 uppercase">Financial Trending</p>
                </div>
                <div className="flex items-center gap-2 text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                  <TrendingUp className="w-3 h-3" />
                  <span className="text-[10px] font-black">+14.2%</span>
                </div>
              </div>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="colorBlue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1a1a1a" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#444', fontSize: 10}} />
                    <YAxis hide />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '12px' }}
                    />
                    <Area type="monotone" dataKey="val" stroke="#3b82f6" strokeWidth={3} fill="url(#colorBlue)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {[
                { label: 'Active Assets', val: stats.active, icon: Activity, color: 'text-blue-500' },
                { label: 'Cleared Funds', val: `$${stats.revenue.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-500' },
                { label: 'Outstanding', val: `$${stats.owing.toLocaleString()}`, icon: AlertCircle, color: 'text-rose-500' }
              ].map((m, i) => (
                <div key={i} className="flex-1 bg-[#0a0a0a] border border-[#1a1a1a] rounded-[1.5rem] p-6 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">{m.label}</p>
                    <m.icon className={`w-4 h-4 ${m.color}`} />
                  </div>
                  <p className="text-2xl font-black text-white">{m.val}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Project List */}
          <div className="space-y-6">
            <h2 className="text-xs font-black text-zinc-500 uppercase tracking-[0.4em]">Asset Deployment Ledger</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
              {projects.length === 0 ? (
                <div className="col-span-full py-20 border-2 border-dashed border-[#1a1a1a] rounded-[2rem] flex flex-col items-center justify-center text-zinc-600">
                  <FolderKanban className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-xs font-bold uppercase tracking-widest">No active projects detected</p>
                </div>
              ) : (
                projects.map((p) => (
                  <div key={p.id} className="group bg-[#0a0a0a] border border-[#1a1a1a] hover:border-blue-500/50 rounded-[2rem] p-8 transition-all duration-300">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="text-xl font-black text-white italic uppercase tracking-tight">{p.name}</h3>
                        <div className="flex items-center gap-2 mt-1 text-zinc-500">
                          <MapPin className="w-3 h-3" />
                          <span className="text-[10px] font-bold uppercase">{p.location || 'Unknown'}</span>
                        </div>
                      </div>
                      <button onClick={() => handleDelete(p.id)} className="p-2 text-zinc-700 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-8">
                      <div className="bg-[#050505] p-5 rounded-2xl border border-[#1a1a1a]">
                        <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">Contract</p>
                        <p className="text-md font-black text-white">${p.budget || '0'}</p>
                      </div>
                      <div className="bg-[#050505] p-5 rounded-2xl border border-[#1a1a1a]">
                        <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">Settled</p>
                        <p className="text-md font-black text-emerald-500">${p.amountPaid || '0'}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {p.teamMember && (
                        <div className="flex items-center gap-4 bg-zinc-900/40 p-4 rounded-2xl border border-[#1a1a1a]">
                          <div className="w-10 h-10 rounded-full bg-blue-600/20 text-blue-500 flex items-center justify-center">
                            <Users className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-[11px] font-black text-white uppercase">{p.teamMember}</p>
                            <p className="text-[9px] font-bold text-zinc-500 uppercase">{p.teamRole || 'Lead'}</p>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex gap-2">
                        {p.mapLink && (
                          <a href={p.mapLink} target="_blank" className="flex-1 flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 p-3 rounded-xl text-[10px] font-black uppercase text-white transition-all">
                            <MapPin className="w-3 h-3" /> Map
                          </a>
                        )}
                        {p.filesLink && (
                          <a href={p.filesLink} target="_blank" className="flex-1 flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 p-3 rounded-xl text-[10px] font-black uppercase text-white transition-all">
                            <FileText className="w-3 h-3" /> Vault
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>
        </main>
      </div>

      {/* Deployment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-2xl bg-[#0a0a0a] border border-[#1a1a1a] rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-8 border-b border-[#1a1a1a] flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">Initiate Asset</h2>
                <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.3em] mt-1">System Deployment Sequence</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-600 hover:text-white"><X className="w-7 h-7" /></button>
            </div>
            
            <div className="p-8 grid grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="col-span-2 space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Project Name</label>
                <input className="w-full bg-[#050505] border border-[#1a1a1a] rounded-xl p-4 text-white font-black uppercase outline-none focus:border-blue-500 transition-all" placeholder="Enter Asset Name" value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Region</label>
                <input className="w-full bg-[#050505] border border-[#1a1a1a] rounded-xl p-4 text-sm outline-none focus:border-blue-500 transition-all" placeholder="City" value={newProject.location} onChange={e => setNewProject({...newProject, location: e.target.value})} />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Map URL</label>
                <input className="w-full bg-[#050505] border border-[#1a1a1a] rounded-xl p-4 text-sm outline-none focus:border-blue-500 transition-all" placeholder="Google Maps Link" value={newProject.mapLink} onChange={e => setNewProject({...newProject, mapLink: e.target.value})} />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Contract ($)</label>
                <input className="w-full bg-[#050505] border border-[#1a1a1a] rounded-xl p-4 text-white font-black outline-none focus:border-blue-500 transition-all" placeholder="Total" value={newProject.budget} onChange={e => setNewProject({...newProject, budget: e.target.value})} />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Paid ($)</label>
                <input className="w-full bg-[#050505] border border-[#1a1a1a] rounded-xl p-4 text-emerald-500 font-black outline-none focus:border-blue-500 transition-all" placeholder="Current" value={newProject.amountPaid} onChange={e => setNewProject({...newProject, amountPaid: e.target.value})} />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Assignee</label>
                <input className="w-full bg-[#050505] border border-[#1a1a1a] rounded-xl p-4 text-sm outline-none focus:border-blue-500 transition-all" placeholder="Team Member" value={newProject.teamMember} onChange={e => setNewProject({...newProject, teamMember: e.target.value})} />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Position</label>
                <input className="w-full bg-[#050505] border border-[#1a1a1a] rounded-xl p-4 text-sm outline-none focus:border-blue-500 transition-all" placeholder="Role" value={newProject.teamRole} onChange={e => setNewProject({...newProject, teamRole: e.target.value})} />
              </div>

              <div className="col-span-2 space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Vault Link (Drive/Dropbox)</label>
                <input className="w-full bg-[#050505] border border-[#1a1a1a] rounded-xl p-4 text-blue-400 text-sm outline-none focus:border-blue-500 transition-all" placeholder="Project Assets URL" value={newProject.filesLink} onChange={e => setNewProject({...newProject, filesLink: e.target.value})} />
              </div>

              <div className="col-span-2 pt-6">
                <button 
                  onClick={handleCreate}
                  disabled={!newProject.name}
                  className="w-full bg-white text-black py-5 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl hover:bg-zinc-200 active:scale-[0.98] disabled:opacity-20"
                >
                  Deploy Assets
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1a1a1a; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #333; }
      `}} />

    </div>
  );
};

export default App;