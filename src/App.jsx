import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, doc, onSnapshot, setDoc, collection, updateDoc 
} from 'firebase/firestore';
import { 
  getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  LayoutDashboard, Briefcase, Receipt, Users, 
  MapPin, Plus, Trash2, ChevronLeft, ChevronRight, 
  Menu, X, ExternalLink, Calendar, DollarSign, 
  CheckCircle2, Clock, XCircle, AlertCircle, 
  Camera, Film, Settings, Archive, Database
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend, AreaChart, Area
} from 'recharts';

// --- Firebase Configuration ---
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : { apiKey: "" };

const appId = typeof __app_id !== 'undefined' ? __app_id : 'uy-studios-pm-v1';

const App = () => {
  const [user, setUser] = useState(null);
  const [db, setDb] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Data States
  const [projects, setProjects] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [syncing, setSyncing] = useState(true);

  // Modal States
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  // Form States
  const [newProject, setNewProject] = useState({
    clientName: '', eventType: '', duration: '', location: '', 
    mapLink: '', budget: 0, amountPaid: 0, eventDate: '',
    status: 'Not Started', team: []
  });
  const [tempMember, setTempMember] = useState({ name: '', role: '', cost: 0 });

  // --- Initialization & Auth ---
  useEffect(() => {
    const init = async () => {
      const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
      const auth = getAuth(app);
      const firestore = getFirestore(app);
      setDb(firestore);

      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
      onAuthStateChanged(auth, (u) => setUser(u));
    };
    init();
  }, []);

  // --- Real-time Sync ---
  useEffect(() => {
    if (!user || !db) return;

    const projRef = doc(db, 'artifacts', appId, 'public', 'data', 'projects');
    const expRef = doc(db, 'artifacts', appId, 'public', 'data', 'expenses');

    const unsubProj = onSnapshot(projRef, (doc) => {
      if (doc.exists()) setProjects(doc.data().items || []);
      setSyncing(false);
    }, (err) => console.error(err));

    const unsubExp = onSnapshot(expRef, (doc) => {
      if (doc.exists()) setExpenses(doc.data().items || []);
    }, (err) => console.error(err));

    return () => { unsubProj(); unsubExp(); };
  }, [user, db]);

  const persist = async (collectionName, data) => {
    if (!db || !user) return;
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', collectionName), { 
        items: data, 
        updatedAt: Date.now() 
      });
    } catch (e) {
      console.error("Sync Error:", e);
    }
  };

  // --- Analytics Engine ---
  const stats = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();

    const chartData = months.map((m, i) => {
      const mProjects = projects.filter(p => {
        const d = new Date(p.eventDate);
        return d.getMonth() === i && d.getFullYear() === currentYear;
      });
      const mExpenses = expenses.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === i && d.getFullYear() === currentYear;
      });

      const revenue = mProjects.reduce((s, p) => s + Number(p.amountPaid || 0), 0);
      const totalBudget = mProjects.reduce((s, p) => s + Number(p.budget || 0), 0);
      const cost = mExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);

      return {
        name: m,
        revenue: revenue,
        owing: totalBudget - revenue,
        expenses: cost
      };
    });

    const totalRev = projects.reduce((s, p) => s + Number(p.amountPaid || 0), 0);
    const totalOwed = projects.reduce((s, p) => s + (Number(p.budget || 0) - Number(p.amountPaid || 0)), 0);
    const totalExp = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

    return { chartData, totalRev, totalOwed, totalExp };
  }, [projects, expenses]);

  // --- Handlers ---
  const handleAddProject = () => {
    const updated = [...projects, { ...newProject, id: Date.now().toString() }];
    setProjects(updated);
    persist('projects', updated);
    setShowProjectModal(false);
    setNewProject({ clientName: '', eventType: '', duration: '', location: '', mapLink: '', budget: 0, amountPaid: 0, eventDate: '', status: 'Not Started', team: [] });
  };

  const handleAddMember = () => {
    if (!tempMember.name || !tempMember.role) return;
    setNewProject({ ...newProject, team: [...newProject.team, tempMember] });
    setTempMember({ name: '', role: '', cost: 0 });
  };

  const deleteProject = (id) => {
    const updated = projects.filter(p => p.id !== id);
    setProjects(updated);
    persist('projects', updated);
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'projects', label: 'Projects', icon: Briefcase },
    { id: 'expenses', label: 'Expenses', icon: Receipt },
    { id: 'clients', label: 'Client Database', icon: Database, overlooked: true },
    { id: 'inventory', label: 'Equipment Gear', icon: Camera, overlooked: true },
    { id: 'archive', label: 'Archives', icon: Archive, overlooked: true },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const getStatusColor = (status) => {
    switch(status) {
      case 'Ongoing': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'Completed': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'Cancelled': return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      default: return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
  };

  return (
    <div className="flex h-screen bg-[#0a0a0c] text-zinc-100 font-sans selection:bg-blue-500/30">
      
      {/* Sidebar - Desktop */}
      <aside className={`hidden md:flex flex-col border-r border-zinc-800 bg-[#0d0d10] transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
        <div className="p-6 flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-600/20">
            <Film className="w-6 h-6 text-white" />
          </div>
          {!isSidebarCollapsed && <h1 className="text-xl font-bold tracking-tight">UY<span className="text-blue-500">STUDIOS</span></h1>}
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group ${
                activeTab === item.id 
                ? 'bg-blue-600/10 text-blue-400 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]' 
                : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-blue-500' : 'group-hover:scale-110 transition-transform'}`} />
              {!isSidebarCollapsed && (
                <span className={`text-sm font-medium ${item.overlooked ? 'italic opacity-60' : ''}`}>
                  {item.label}
                </span>
              )}
              {item.overlooked && !isSidebarCollapsed && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500/40" />
              )}
            </button>
          ))}
        </nav>

        <button 
          onClick={() => setSidebarCollapsed(!isSidebarCollapsed)}
          className="p-6 border-t border-zinc-800 text-zinc-600 hover:text-zinc-300 transition-colors"
        >
          {isSidebarCollapsed ? <ChevronRight /> : <div className="flex items-center gap-2"><ChevronLeft /><span className="text-sm font-medium">Collapse</span></div>}
        </button>
      </aside>

      {/* Mobile Nav Toggle */}
      <div className="md:hidden fixed top-4 right-4 z-50">
        <button 
          onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
          className="p-3 bg-zinc-900 border border-zinc-800 rounded-full text-zinc-300 shadow-xl"
        >
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-zinc-900 via-[#0a0a0c] to-[#0a0a0c]">
        
        {/* Header Section */}
        <header className="px-6 py-4 flex items-center justify-between border-b border-zinc-800/50 backdrop-blur-xl bg-black/20 sticky top-0 z-40">
          <div>
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-widest">{activeTab}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <div className={`w-2 h-2 rounded-full ${syncing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">
                {syncing ? 'Syncing...' : 'Cloud Connected'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="hidden sm:flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl transition-all">
              <Calendar className="w-4 h-4 text-blue-500" />
              <span className="text-xs font-bold">May 2024</span>
            </button>
          </div>
        </header>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 pb-20 scroll-smooth">
          
          {activeTab === 'dashboard' && (
            <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
              {/* Financial Snapshot */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { label: 'Settled Revenue', value: stats.totalRev, icon: DollarSign, color: 'text-emerald-500', trend: '+12%' },
                  { label: 'Client Receivables', value: stats.totalOwed, icon: AlertCircle, color: 'text-blue-500', trend: '-5%' },
                  { label: 'Overhead Expenses', value: stats.totalExp, icon: Receipt, color: 'text-rose-500', trend: '+2%' },
                ].map((stat, i) => (
                  <div key={i} className="group p-6 bg-[#0d0d10] border border-zinc-800 rounded-[2rem] hover:border-zinc-700 transition-all relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-125 transition-transform">
                      <stat.icon className="w-16 h-16" />
                    </div>
                    <div className="flex justify-between items-start mb-4">
                      <div className={`p-2 rounded-xl bg-zinc-900 border border-zinc-800 ${stat.color}`}>
                        <stat.icon className="w-5 h-5" />
                      </div>
                      <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${stat.trend.startsWith('+') ? 'text-emerald-500 bg-emerald-500/10' : 'text-rose-500 bg-rose-500/10'}`}>
                        {stat.trend}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest">{stat.label}</h3>
                    <p className="text-3xl font-black mt-2 tracking-tight">${stat.value.toLocaleString()}</p>
                  </div>
                ))}
              </div>

              {/* Annual Growth Chart */}
              <div className="p-8 bg-[#0d0d10] border border-zinc-800 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                  <div>
                    <h3 className="text-xl font-bold tracking-tight">Studio Performance</h3>
                    <p className="text-sm text-zinc-500">Consolidated 12-month financial trajectory</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span className="text-[10px] font-bold text-zinc-400 uppercase">Revenue</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-amber-500" />
                      <span className="text-[10px] font-bold text-zinc-400 uppercase">Owed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-rose-500" />
                      <span className="text-[10px] font-bold text-zinc-400 uppercase">Expenses</span>
                    </div>
                  </div>
                </div>
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.chartData}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis dataKey="name" stroke="#52525b" fontSize={10} axisLine={false} tickLine={false} tickMargin={10} />
                      <YAxis stroke="#52525b" fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0d0d10', border: '1px solid #27272a', borderRadius: '16px', color: '#fff' }}
                        itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                      <Line type="monotone" dataKey="owing" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4, fill: '#f59e0b' }} strokeDasharray="5 5" />
                      <Line type="monotone" dataKey="expenses" stroke="#f43f5e" strokeWidth={2} dot={{ r: 4, fill: '#f43f5e' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'projects' && (
            <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Active Production Queue</h2>
                  <p className="text-sm text-zinc-500">Manage your bookings, team logistics, and payments</p>
                </div>
                <button 
                  onClick={() => setShowProjectModal(true)}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold shadow-lg shadow-blue-600/20 transition-all active:scale-95"
                >
                  <Plus className="w-5 h-5" />
                  <span>Start New Production</span>
                </button>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {projects.length === 0 ? (
                  <div className="col-span-full py-20 text-center border-2 border-dashed border-zinc-800 rounded-[3rem]">
                    <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-800">
                      <Briefcase className="w-8 h-8 text-zinc-700" />
                    </div>
                    <p className="text-zinc-500 font-medium">No projects listed yet. Start a new production to see it here.</p>
                  </div>
                ) : projects.map((proj) => (
                  <div key={proj.id} className="bg-[#0d0d10] border border-zinc-800 rounded-[2.5rem] overflow-hidden hover:border-zinc-700 transition-all group flex flex-col">
                    <div className="p-8">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider mb-3 ${getStatusColor(proj.status)}`}>
                            {proj.status}
                          </span>
                          <h3 className="text-2xl font-bold tracking-tight text-white group-hover:text-blue-400 transition-colors">{proj.clientName}</h3>
                          <p className="text-zinc-500 text-sm mt-1">{proj.eventType} • {proj.duration}</p>
                        </div>
                        <button onClick={() => deleteProject(proj.id)} className="p-3 bg-zinc-900 rounded-xl text-zinc-600 hover:text-rose-500 border border-zinc-800 transition-colors">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-8 mb-8">
                        <div className="space-y-4">
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-zinc-900 rounded-lg"><MapPin className="w-4 h-4 text-blue-500" /></div>
                            <div>
                              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Location</p>
                              <p className="text-xs font-medium text-zinc-300 mt-0.5">{proj.location || 'Not Specified'}</p>
                              {proj.mapLink && (
                                <a href={proj.mapLink} target="_blank" className="inline-flex items-center gap-1 text-[10px] text-blue-400 hover:underline mt-1 font-bold">
                                  <ExternalLink className="w-3 h-3" /> MAPS
                                </a>
                              )}
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-zinc-900 rounded-lg"><Calendar className="w-4 h-4 text-blue-500" /></div>
                            <div>
                              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Shoot Date</p>
                              <p className="text-xs font-medium text-zinc-300 mt-0.5">{proj.eventDate || 'TBD'}</p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <div className="flex justify-between items-center mb-1.5">
                              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Financial Health</p>
                              <span className="text-[10px] font-bold text-emerald-500">${proj.amountPaid} / ${proj.budget}</span>
                            </div>
                            <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800/50">
                              <div 
                                className="h-full bg-emerald-500 transition-all duration-1000 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                                style={{ width: `${Math.min(100, (Number(proj.amountPaid) / Number(proj.budget)) * 100)}%` }}
                              />
                            </div>
                          </div>
                          <div className="flex items-start gap-3 pt-1">
                            <div className="p-2 bg-zinc-900 rounded-lg"><Users className="w-4 h-4 text-blue-500" /></div>
                            <div>
                              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Assigned Crew</p>
                              <div className="flex -space-x-2 mt-1.5">
                                {proj.team?.map((m, idx) => (
                                  <div key={idx} className="w-8 h-8 rounded-full bg-zinc-800 border-2 border-[#0d0d10] flex items-center justify-center text-[10px] font-bold text-zinc-300" title={`${m.name} - ${m.role}`}>
                                    {m.name.charAt(0)}
                                  </div>
                                ))}
                                {(!proj.team || proj.team.length === 0) && <span className="text-[10px] text-zinc-600 font-bold uppercase">Solo Production</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'expenses' && (
            <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
               <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-rose-500">Expense Ledger</h2>
                  <p className="text-sm text-zinc-500 tracking-tight">Audit your studio costs and overheads</p>
                </div>
                <button 
                  onClick={() => setShowExpenseModal(true)}
                  className="px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-bold shadow-lg shadow-rose-600/20 transition-all"
                >
                  <Plus className="w-5 h-5 inline-block mr-2" /> Log Cost
                </button>
              </div>

              <div className="bg-[#0d0d10] border border-zinc-800 rounded-[2rem] overflow-hidden shadow-2xl">
                <table className="w-full text-left">
                  <thead className="bg-zinc-900/50 border-b border-zinc-800">
                    <tr>
                      <th className="px-6 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Type</th>
                      <th className="px-6 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Detail</th>
                      <th className="px-6 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Date</th>
                      <th className="px-6 py-5 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {expenses.map(e => (
                      <tr key={e.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="px-6 py-5">
                          <span className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-[10px] font-black text-zinc-400 uppercase tracking-tight">
                            {e.type}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <p className="text-sm font-medium text-zinc-200">{e.reason}</p>
                        </td>
                        <td className="px-6 py-5 text-xs text-zinc-500">{e.date}</td>
                        <td className="px-6 py-5 text-right font-black text-rose-400">
                          -${Number(e.amount).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {['clients', 'inventory', 'archive', 'settings'].includes(activeTab) && (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-600 space-y-4">
              <div className="p-6 bg-zinc-900 rounded-[2.5rem] border border-zinc-800">
                <Database className="w-12 h-12 opacity-20" />
              </div>
              <p className="font-bold text-lg">Expanded Module Under Maintenance</p>
              <p className="text-sm text-zinc-700 max-w-xs text-center italic">This "overlooked" section is prepared for your scaling database. Cloud sync is ready for implementation.</p>
              <button onClick={() => setActiveTab('dashboard')} className="text-blue-500 text-xs font-black uppercase tracking-widest hover:underline">Back to Core Suite</button>
            </div>
          )}

        </div>

        {/* Mobile Bottom Nav */}
        <nav className="md:hidden h-16 bg-[#0d0d10] border-t border-zinc-800 flex items-center justify-around px-2 fixed bottom-0 left-0 right-0 z-40 backdrop-blur-lg bg-black/60">
          {[
            { id: 'dashboard', icon: LayoutDashboard },
            { id: 'projects', icon: Briefcase },
            { id: 'expenses', icon: Receipt },
            { id: 'settings', icon: Settings },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`p-3 rounded-xl transition-all ${activeTab === item.id ? 'text-blue-500 bg-blue-500/10' : 'text-zinc-600'}`}
            >
              <item.icon className="w-6 h-6" />
            </button>
          ))}
        </nav>
      </main>

      {/* Project Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowProjectModal(false)} />
          <div className="relative w-full max-w-4xl bg-[#0d0d10] border border-zinc-800 rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
              <h2 className="text-xl font-bold tracking-tight">Configure New Production</h2>
              <button onClick={() => setShowProjectModal(false)} className="p-2 hover:bg-zinc-800 rounded-full transition-colors"><X /></button>
            </div>
            
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Client Identity</label>
                  <input 
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all" 
                    placeholder="Company or Individual Name"
                    value={newProject.clientName}
                    onChange={e => setNewProject({...newProject, clientName: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Production Type</label>
                    <select 
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-sm"
                      value={newProject.eventType}
                      onChange={e => setNewProject({...newProject, eventType: e.target.value})}
                    >
                      <option value="">Select Category</option>
                      <option value="Commercial">Commercial Film</option>
                      <option value="Wedding">Cinematic Wedding</option>
                      <option value="Event">Event Coverage</option>
                      <option value="Portrait">Studio Portrait</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Shoot Date</label>
                    <input type="date" className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-sm" value={newProject.eventDate} onChange={e => setNewProject({...newProject, eventDate: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Location Details</label>
                  <input className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-2" placeholder="Venue Name / Address" value={newProject.location} onChange={e => setNewProject({...newProject, location: e.target.value})} />
                  <input className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4" placeholder="Google Maps Link" value={newProject.mapLink} onChange={e => setNewProject({...newProject, mapLink: e.target.value})} />
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 text-blue-400">Total Budget ($)</label>
                    <input type="number" className="w-full bg-zinc-900 border border-blue-500/30 rounded-2xl p-4 font-bold" value={newProject.budget} onChange={e => setNewProject({...newProject, budget: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 text-emerald-400">Paid Amount ($)</label>
                    <input type="number" className="w-full bg-zinc-900 border border-emerald-500/30 rounded-2xl p-4 font-bold" value={newProject.amountPaid} onChange={e => setNewProject({...newProject, amountPaid: Number(e.target.value)})} />
                  </div>
                </div>

                <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-[2rem]">
                  <h4 className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
                    <Users className="w-4 h-4" /> Team Assignments
                  </h4>
                  <div className="flex gap-2 mb-4">
                    <input className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl p-2 text-xs" placeholder="Name" value={tempMember.name} onChange={e => setTempMember({...tempMember, name: e.target.value})} />
                    <input className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl p-2 text-xs" placeholder="Role" value={tempMember.role} onChange={e => setTempMember({...tempMember, role: e.target.value})} />
                    <input className="w-20 bg-zinc-900 border border-zinc-800 rounded-xl p-2 text-xs" placeholder="Cost" type="number" value={tempMember.cost} onChange={e => setTempMember({...tempMember, cost: Number(e.target.value)})} />
                    <button onClick={handleAddMember} className="p-2 bg-blue-600 rounded-xl text-white"><Plus /></button>
                  </div>
                  <div className="space-y-2">
                    {newProject.team.map((m, i) => (
                      <div key={i} className="flex justify-between items-center text-[10px] font-bold p-2 bg-zinc-900 border border-zinc-800 rounded-lg">
                        <span>{m.name} <span className="text-zinc-500 font-medium">— {m.role}</span></span>
                        <span className="text-rose-400">-${m.cost}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 pt-6">
                <button 
                  onClick={handleAddProject}
                  className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-[1.5rem] font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-600/20 active:scale-[0.99] transition-all"
                >
                  Authorize & Finalize Production
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowExpenseModal(false)} />
          <div className="relative w-full max-w-md bg-[#0d0d10] border border-zinc-800 rounded-[3rem] shadow-2xl p-8 animate-in zoom-in duration-300">
             <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-bold tracking-tight">Log Studio Expense</h2>
              <button onClick={() => setShowExpenseModal(false)} className="p-2 hover:bg-zinc-800 rounded-full"><X /></button>
            </div>
            <form className="space-y-6" onSubmit={(e) => {
              e.preventDefault();
              const form = e.target;
              const updated = [...expenses, {
                id: Date.now().toString(),
                type: form.type.value,
                amount: form.amount.value,
                date: form.date.value,
                reason: form.reason.value
              }];
              setExpenses(updated);
              persist('expenses', updated);
              setShowExpenseModal(false);
            }}>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Type</label>
                <select name="type" className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-sm outline-none focus:border-rose-500/50">
                  <option>Equipment</option>
                  <option>Rentals</option>
                  <option>Software</option>
                  <option>Marketing</option>
                  <option>Team Payout</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Amount ($)</label>
                <input name="amount" type="number" className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Date of Transaction</label>
                <input name="date" type="date" className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-sm" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Notes / Reason</label>
                <textarea name="reason" className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-sm h-24 outline-none" />
              </div>
              <button className="w-full py-5 bg-rose-600 hover:bg-rose-500 text-white rounded-[1.5rem] font-black uppercase tracking-widest shadow-xl shadow-rose-600/20 transition-all">
                Add To Ledger
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Global CSS Overrides */}
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3f3f46; }
        
        input[type="date"]::-webkit-calendar-picker-indicator {
          filter: invert(1);
          opacity: 0.5;
        }

        @keyframes pulse-soft {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
      `}} />
    </div>
  );
};

export default App;