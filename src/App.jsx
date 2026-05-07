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

// Configuration logic
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const appId = typeof __app_id !== 'undefined' ? __app_id : 'uy-studios-pm';

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

  // Auth & Initialization
  useEffect(() => {
    if (!firebaseConfig.apiKey) {
      setSyncStatus('offline');
      return;
    }
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const auth = getAuth(app);

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        setSyncStatus('offline');
      }
    };

    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  // Data Sync
  useEffect(() => {
    if (!user) return;
    const db = getFirestore();
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'projects_v5');
    
    return onSnapshot(docRef, (snap) => {
      if (snap.exists()) setProjects(snap.data().projects || []);
      setSyncStatus('synced');
    }, (err) => {
      setSyncStatus('error');
    });
  }, [user]);

  const saveToCloud = async (updated) => {
    if (!user) return;
    const db = getFirestore();
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects_v5'), { projects: updated });
    } catch (err) {
      console.error(err);
    }
  };

  const stats = useMemo(() => {
    const totalBudget = projects.reduce((acc, p) => acc + (parseFloat(p.budget) || 0), 0);
    const totalPaid = projects.reduce((acc, p) => acc + (parseFloat(p.amountPaid) || 0), 0);
    return {
      active: projects.length,
      owing: totalBudget - totalPaid,
      revenue: totalPaid,
      growth: '+12.5%'
    };
  }, [projects]);

  // Mock data for the trending graph
  const trendData = [
    { name: 'Week 1', val: 4000 },
    { name: 'Week 2', val: 3000 },
    { name: 'Week 3', val: 5000 },
    { name: 'Week 4', val: 2780 },
    { name: 'Week 5', val: 1890 },
    { name: 'Week 6', val: 2390 },
    { name: 'Week 7', val: 3490 },
  ];

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

  return (
    <div className="flex min-h-screen bg-[#050505] text-[#e0e0e0] font-sans overflow-hidden">
      
      {/* Collapsible Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-[#0a0a0a] border-r border-[#1a1a1a] transition-all duration-300 flex flex-col z-40`}>
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          {isSidebarOpen && <span className="font-black italic text-lg tracking-tighter uppercase">UY Studios</span>}
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'projects', icon: FolderKanban, label: 'Asset Library' },
            { id: 'timeline', icon: Clock, label: 'Timeline' },
            { id: 'settings', icon: Settings, label: 'Systems' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all ${
                activeTab === item.id ? 'bg-blue-600/10 text-blue-500' : 'text-zinc-500 hover:text-zinc-200'
              }`}
            >
              <item.icon className="w-5 h-5 min-w-[20px]" />
              {isSidebarOpen && <span className="text-xs font-bold uppercase tracking-widest">{item.label}</span>}
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

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* Header */}
        <header className="h-20 border-b border-[#1a1a1a] flex items-center justify-between px-8 bg-[#050505]/80 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${
              syncStatus === 'synced' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-500' : 'bg-amber-500/5 border-amber-500/20 text-amber-500'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${syncStatus === 'synced' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
              <span className="text-[10px] font-black uppercase tracking-widest">
                {syncStatus === 'synced' ? 'Live Sync' : 'Offline Mode'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-white text-black px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all flex items-center gap-2"
            >
              <Plus className="w-3 h-3" /> Initiate Asset
            </button>
          </div>
        </header>

        {/* Dashboard Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          
          {/* Top Row: Trending Graph & Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Trending Graph */}
            <div className="lg:col-span-2 bg-[#0a0a0a] border border-[#1a1a1a] rounded-[2rem] p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em]">Performance Index</h3>
                  <p className="text-2xl font-black text-white italic mt-1">Growth Forecast</p>
                </div>
                <div className="flex items-center gap-2 text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full">
                  <TrendingUp className="w-3 h-3" />
                  <span className="text-[10px] font-black">12.5%</span>
                </div>
              </div>
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1a1a1a" />
                    <XAxis dataKey="name" hide />
                    <YAxis hide />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '12px', fontSize: '10px', color: '#fff' }}
                      itemStyle={{ color: '#3b82f6' }}
                    />
                    <Area type="monotone" dataKey="val" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorVal)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="space-y-4">
              {[
                { label: 'Active Pipeline', value: stats.active, icon: Activity, color: 'text-blue-500' },
                { label: 'Projected Revenue', value: `$${stats.revenue.toLocaleString()}`, icon: BarChart3, color: 'text-emerald-500' },
                { label: 'Total Liability', value: `$${stats.owing.toLocaleString()}`, icon: AlertCircle, color: 'text-rose-500' }
              ].map((m, i) => (
                <div key={i} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-5 flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">{m.label}</p>
                    <p className="text-xl font-black text-white">{m.value}</p>
                  </div>
                  <m.icon className={`w-5 h-5 ${m.color} opacity-40`} />
                </div>
              ))}
            </div>
          </div>

          {/* Project List */}
          <div className="space-y-6">
            <h2 className="text-xs font-black text-zinc-500 uppercase tracking-[0.3em]">Active Asset Ledger</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {projects.map((p) => (
                <div key={p.id} className="group bg-[#0a0a0a] border border-[#1a1a1a] hover:border-blue-500/40 rounded-[2rem] p-6 transition-all duration-300">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">{p.name}</h3>
                      <div className="flex items-center gap-2 mt-1 text-zinc-500">
                        <MapPin className="w-3 h-3" />
                        <span className="text-[9px] font-bold uppercase">{p.location}</span>
                      </div>
                    </div>
                    <button onClick={() => {
                      const updated = projects.filter(item => item.id !== p.id);
                      setProjects(updated);
                      saveToCloud(updated);
                    }} className="opacity-0 group-hover:opacity-100 p-2 text-zinc-600 hover:text-rose-500 transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-[#050505] p-4 rounded-2xl border border-[#1a1a1a]">
                      <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mb-1">Contract</p>
                      <p className="text-sm font-black text-white">${p.budget}</p>
                    </div>
                    <div className="bg-[#050505] p-4 rounded-2xl border border-[#1a1a1a]">
                      <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mb-1">Settled</p>
                      <p className="text-sm font-black text-emerald-500">${p.amountPaid}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {p.team && p.team[0]?.name && (
                      <div className="flex items-center gap-3 bg-blue-500/5 p-3 rounded-xl border border-blue-500/10">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-500">
                          <Users className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-white uppercase">{p.team[0].name}</p>
                          <p className="text-[8px] font-bold text-zinc-500 uppercase">{p.team[0].role}</p>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      {p.mapLink && (
                        <a href={p.mapLink} target="_blank" className="flex-1 bg-zinc-900 hover:bg-zinc-800 p-2 rounded-lg text-[9px] font-black uppercase text-center tracking-widest">Map</a>
                      )}
                      {p.filesLink && (
                        <a href={p.filesLink} target="_blank" className="flex-1 bg-zinc-900 hover:bg-zinc-800 p-2 rounded-lg text-[9px] font-black uppercase text-center tracking-widest">Files</a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Initiation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-2xl bg-[#0a0a0a] border border-[#1a1a1a] rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-8 border-b border-[#1a1a1a] flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-white italic tracking-tight uppercase">Initiate Asset</h2>
                <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.2em] mt-1">System deployment sequence</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-600 hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="p-8 grid grid-cols-2 gap-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
              <div className="col-span-2 space-y-1.5">
                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Project Descriptor</label>
                <input className="w-full bg-[#050505] border border-[#1a1a1a] rounded-xl p-4 text-white font-bold focus:border-blue-500 transition-all outline-none" placeholder="e.g. STUDIO REVAMP" value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Geography</label>
                <input className="w-full bg-[#050505] border border-[#1a1a1a] rounded-xl p-4 text-sm outline-none" placeholder="City / Region" value={newProject.location} onChange={e => setNewProject({...newProject, location: e.target.value})} />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Location Link</label>
                <input className="w-full bg-[#050505] border border-[#1a1a1a] rounded-xl p-4 text-sm outline-none" placeholder="Google Maps URL" value={newProject.mapLink} onChange={e => setNewProject({...newProject, mapLink: e.target.value})} />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Contract Value ($)</label>
                <input className="w-full bg-[#050505] border border-[#1a1a1a] rounded-xl p-4 text-white font-black outline-none" placeholder="0.00" value={newProject.budget} onChange={e => setNewProject({...newProject, budget: e.target.value})} />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Initial Deposit ($)</label>
                <input className="w-full bg-[#050505] border border-[#1a1a1a] rounded-xl p-4 text-emerald-500 font-black outline-none" placeholder="0.00" value={newProject.amountPaid} onChange={e => setNewProject({...newProject, amountPaid: e.target.value})} />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Lead Member</label>
                <input className="w-full bg-[#050505] border border-[#1a1a1a] rounded-xl p-4 text-white text-sm outline-none" placeholder="Assignee Name" value={newProject.teamMember} onChange={e => setNewProject({...newProject, teamMember: e.target.value})} />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Designated Role</label>
                <input className="w-full bg-[#050505] border border-[#1a1a1a] rounded-xl p-4 text-zinc-400 text-sm outline-none" placeholder="e.g. Lead Designer" value={newProject.teamRole} onChange={e => setNewProject({...newProject, teamRole: e.target.value})} />
              </div>

              <div className="col-span-2 space-y-1.5">
                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Project Repository (Links / Files)</label>
                <input className="w-full bg-[#050505] border border-[#1a1a1a] rounded-xl p-4 text-blue-400 text-sm outline-none" placeholder="Cloud Storage / Documentation Link" value={newProject.filesLink} onChange={e => setNewProject({...newProject, filesLink: e.target.value})} />
              </div>

              <div className="col-span-2 pt-4">
                <button 
                  onClick={handleCreate}
                  disabled={!newProject.name}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-20 text-white p-5 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-600/20 active:scale-[0.98]"
                >
                  Confirm Deployment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global CSS for scrollbars */}
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1a1a1a; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #2a2a2a; }
      `}} />

    </div>
  );
};

export default App;