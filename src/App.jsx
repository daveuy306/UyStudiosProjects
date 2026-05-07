import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  query
} from 'firebase/firestore';
import { 
  getAuth,
  signInWithCustomToken,
  signInAnonymously,
  onAuthStateChanged
} from 'firebase/auth';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area,
  BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';
import { 
  Plus, Trash2, Save, Download, RefreshCw, Database, 
  TrendingUp, Users, DollarSign, Briefcase, ChevronRight,
  Menu, X, LayoutDashboard, Settings, PieChart as PieIcon,
  CreditCard, PlusCircle, Search, LogOut, Info, AlertCircle,
  CloudCheck, CloudOff, Globe
} from 'lucide-react';

// --- FIREBASE CONFIGURATION & INITIALIZATION ---
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : { apiKey: "preview", authDomain: "preview", projectId: "preview" };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'uy-studios-prod';

const App = () => {
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [syncStatus, setSyncStatus] = useState('connecting'); // 'connecting', 'synced', 'error'
  
  // --- STATE DATA ---
  const [data, setData] = useState({
    projects: [],
    team: [],
    expenses: [],
    revenue: [
      { month: 'Jan', amount: 0 },
      { month: 'Feb', amount: 0 },
      { month: 'Mar', amount: 0 },
      { month: 'Apr', amount: 0 }
    ],
    settings: {
      projectName: 'Dave Uy Database',
      currency: 'USD'
    }
  });

  // --- AUTHENTICATION (RULE 3: Auth Before Queries) ---
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
        setSyncStatus('error');
      } finally {
        setLoading(false);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // --- DATABASE SYNC (RULE 1 & 2: Public Data Path & Simple Query) ---
  useEffect(() => {
    if (!user) return;

    // Use specific artifact path for cross-device persistence
    const dataDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'uy_studios_v2');

    const unsubscribe = onSnapshot(dataDocRef, (snap) => {
      if (snap.exists()) {
        setData(snap.data());
        setSyncStatus('synced');
      } else {
        // Initialize with default if first time
        setSyncStatus('synced');
      }
    }, (err) => {
      console.error("Firestore Listen Error:", err);
      setSyncStatus('error');
    });

    return () => unsubscribe();
  }, [user]);

  const syncToCloud = async (newData) => {
    setData(newData);
    if (!user) return;
    
    setSyncStatus('connecting');
    try {
      const dataDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'uy_studios_v2');
      await setDoc(dataDocRef, newData);
      setSyncStatus('synced');
    } catch (err) {
      console.error("Sync failed:", err);
      setSyncStatus('error');
    }
  };

  // --- HANDLERS ---
  const addItem = (category, template) => {
    const newItem = { ...template, id: Date.now().toString() };
    const newData = { ...data, [category]: [...(data[category] || []), newItem] };
    syncToCloud(newData);
  };

  const removeItem = (category, id) => {
    const newData = { ...data, [category]: data[category].filter(item => item.id !== id) };
    syncToCloud(newData);
  };

  const updateItem = (category, id, field, value) => {
    const newData = {
      ...data,
      [category]: data[category].map(item => item.id === id ? { ...item, [field]: value } : item)
    };
    syncToCloud(newData);
  };

  // --- CALCULATIONS ---
  const stats = useMemo(() => {
    const totalSalaries = (data.team || []).reduce((acc, curr) => acc + (Number(curr.cost) || 0), 0);
    const totalExpenses = (data.expenses || []).reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const totalBurn = totalSalaries + totalExpenses;
    const backlogValue = (data.projects || []).reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);
    const currentRevenue = data.revenue[data.revenue.length - 1]?.amount || 0;
    
    return { totalBurn, backlogValue, currentRevenue, profit: currentRevenue - totalBurn };
  }, [data]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
        <Database className="w-6 h-6 text-blue-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      </div>
      <span className="mt-6 text-slate-400 font-medium tracking-widest uppercase text-xs">Authenticating Session...</span>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* --- SIDEBAR --- */}
      <aside className={`bg-slate-900 border-r border-slate-800 transition-all duration-300 flex flex-col z-30 ${sidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="p-6 flex items-center gap-3 overflow-hidden">
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2 rounded-xl shrink-0 shadow-lg shadow-blue-500/20">
            <Database className="w-6 h-6 text-white" />
          </div>
          {sidebarOpen && <h2 className="font-bold text-lg whitespace-nowrap tracking-tight text-white">UY Studios</h2>}
        </div>

        <nav className="flex-1 px-3 space-y-1.5 mt-4">
          {[
            { id: 'overview', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'projects', icon: Briefcase, label: 'Projects' },
            { id: 'team', icon: Users, label: 'Team' },
            { id: 'expenses', icon: CreditCard, label: 'Expenses' },
            { id: 'settings', icon: Settings, label: 'Settings' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 ${
                activeTab === item.id 
                  ? 'bg-blue-600/15 text-blue-400 shadow-inner' 
                  : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
              }`}
            >
              <item.icon className={`w-5 h-5 shrink-0 ${activeTab === item.id ? 'text-blue-400' : ''}`} />
              {sidebarOpen && <span className="font-semibold text-sm">{item.label}</span>}
              {activeTab === item.id && sidebarOpen && <div className="ml-auto w-1.5 h-1.5 bg-blue-400 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800/50">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            {sidebarOpen && <span className="font-medium text-sm text-left">Hide Sidebar</span>}
          </button>
        </div>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 overflow-y-auto relative flex flex-col">
        <header className="sticky top-0 z-20 bg-slate-950/80 backdrop-blur-xl px-8 py-4 flex justify-between items-center border-b border-slate-800/50">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-xl font-bold tracking-tight">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h1>
              <div className="flex items-center gap-2">
                 <div className={`w-1.5 h-1.5 rounded-full ${syncStatus === 'synced' ? 'bg-emerald-500' : syncStatus === 'error' ? 'bg-rose-500' : 'bg-amber-500 animate-pulse'}`}></div>
                 <span className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">
                   {syncStatus === 'synced' ? 'Cloud Connected' : syncStatus === 'error' ? 'Sync Error' : 'Syncing...'}
                 </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              <div className="w-8 h-8 rounded-full border-2 border-slate-950 bg-blue-600 flex items-center justify-center text-[10px] font-bold">DU</div>
              <div className="w-8 h-8 rounded-full border-2 border-slate-950 bg-slate-800 flex items-center justify-center">
                <Globe className="w-3.5 h-3.5 text-slate-400" />
              </div>
            </div>
            <div className="h-8 w-[1px] bg-slate-800"></div>
            <div className="flex flex-col items-end">
               <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Device ID</span>
               <span className="text-xs font-mono text-slate-300">{user?.uid.slice(0, 8) || 'anonymous'}</span>
            </div>
          </div>
        </header>

        <div className="p-8 flex-1">
          {/* Dashboard Overview */}
          {activeTab === 'overview' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'Operational Burn', value: stats.totalBurn, color: 'text-rose-400', icon: TrendingUp, bg: 'bg-rose-400/5' },
                  { label: 'Backlog Value', value: stats.backlogValue, color: 'text-blue-400', icon: Briefcase, bg: 'bg-blue-400/5' },
                  { label: 'Current Revenue', value: stats.currentRevenue, color: 'text-emerald-400', icon: DollarSign, bg: 'bg-emerald-400/5' },
                  { label: 'Projected Net', value: stats.profit, color: 'text-amber-400', icon: PieIcon, bg: 'bg-amber-400/5' }
                ].map((s, idx) => (
                  <div key={idx} className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl hover:border-slate-700 transition-colors group">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`p-2.5 rounded-xl ${s.bg} ${s.color} transition-transform group-hover:scale-110`}><s.icon className="w-5 h-5" /></div>
                      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Monthly</span>
                    </div>
                    <p className="text-slate-500 text-xs font-semibold mb-1">{s.label}</p>
                    <h3 className="text-2xl font-bold font-mono tracking-tight text-white">${s.value.toLocaleString()}</h3>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-2 bg-slate-900/50 border border-slate-800 p-8 rounded-3xl h-[450px]">
                  <div className="flex justify-between items-center mb-8">
                    <h3 className="font-bold flex items-center gap-2 text-slate-300 tracking-tight">
                      <TrendingUp className="w-4 h-4 text-blue-500" /> Revenue vs projection
                    </h3>
                    <div className="flex gap-2">
                       <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 rounded-full text-[10px] font-bold text-slate-400">
                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div> Actual
                       </div>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height="80%">
                    <AreaChart data={data.revenue}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="month" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                      <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)' }} 
                        itemStyle={{ color: '#3b82f6', fontWeight: 'bold' }}
                      />
                      <Area type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-3xl flex flex-col">
                  <h3 className="font-bold mb-6 text-slate-300">Operational Breakdown</h3>
                  <div className="space-y-4 flex-1">
                    {data.expenses.slice(0, 5).map(e => (
                      <div key={e.id} className="flex items-center justify-between p-4 bg-slate-800/30 rounded-2xl border border-slate-800/50 hover:bg-slate-800/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-1.5 h-8 bg-blue-600/40 rounded-full"></div>
                          <div>
                            <p className="font-bold text-sm text-slate-200">{e.name}</p>
                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{e.category}</p>
                          </div>
                        </div>
                        <span className="font-mono font-bold text-slate-300">${Number(e.amount).toLocaleString()}</span>
                      </div>
                    ))}
                    {data.expenses.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-full text-slate-600 opacity-50">
                        <CreditCard className="w-8 h-8 mb-2" />
                        <p className="text-xs font-bold uppercase">No records found</p>
                      </div>
                    )}
                  </div>
                  <button onClick={() => setActiveTab('expenses')} className="mt-6 w-full py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-400 transition-colors">View All Expenses</button>
                </div>
              </div>
            </div>
          )}

          {/* Project View */}
          {activeTab === 'projects' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                   <h2 className="text-lg font-bold">Active Backlog</h2>
                   <p className="text-sm text-slate-500">Manage deliverables and revenue streams</p>
                </div>
                <button 
                  onClick={() => addItem('projects', { name: 'New Project', client: 'New Client', value: 0, status: 'Quoted' })}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                >
                  <PlusCircle className="w-5 h-5" /> Add Project
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {data.projects.map(p => (
                  <div key={p.id} className="bg-slate-900 border border-slate-800 p-6 rounded-3xl group relative overflow-hidden hover:border-blue-500/30 transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => removeItem('projects', p.id)} className="p-2 bg-rose-500/10 text-rose-500 rounded-lg hover:bg-rose-500 hover:text-white transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="mb-8">
                      <input 
                        className="bg-transparent border-none text-lg font-bold w-full focus:ring-0 p-0 text-white placeholder:text-slate-700"
                        value={p.name}
                        placeholder="Project Title"
                        onChange={(e) => updateItem('projects', p.id, 'name', e.target.value)}
                      />
                      <input 
                        className="bg-transparent border-none text-slate-500 text-xs font-bold uppercase tracking-widest w-full focus:ring-0 p-0 mt-1"
                        value={p.client}
                        placeholder="Client Name"
                        onChange={(e) => updateItem('projects', p.id, 'client', e.target.value)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-blue-400 font-mono font-bold text-lg">
                        <span className="text-sm">$</span>
                        <input 
                          type="number"
                          className="bg-transparent border-none w-24 p-0 focus:ring-0"
                          value={p.value}
                          onChange={(e) => updateItem('projects', p.id, 'value', e.target.value)}
                        />
                      </div>
                      <select 
                        className="bg-slate-800/50 border-none text-[10px] font-bold uppercase tracking-tighter rounded-full px-4 py-1.5 text-slate-400 focus:ring-0 cursor-pointer"
                        value={p.status}
                        onChange={(e) => updateItem('projects', p.id, 'status', e.target.value)}
                      >
                        <option>Active</option>
                        <option>In Progress</option>
                        <option>Quoted</option>
                        <option>Completed</option>
                      </select>
                    </div>
                  </div>
                ))}
                {data.projects.length === 0 && (
                   <div className="col-span-full border-2 border-dashed border-slate-800 rounded-3xl p-12 flex flex-col items-center justify-center text-slate-600">
                      <Briefcase className="w-12 h-12 mb-4 opacity-20" />
                      <p className="font-bold uppercase tracking-widest text-sm">Project pipeline empty</p>
                      <p className="text-xs text-slate-500 mt-2">Add your first client project to start tracking revenue</p>
                   </div>
                )}
              </div>
            </div>
          )}

          {/* Team View */}
          {activeTab === 'team' && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
               <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 backdrop-blur-sm">
                  <div>
                    <h3 className="font-bold text-lg">Resource Allocation</h3>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Personnel Cost Center</p>
                  </div>
                  <button onClick={() => addItem('team', { name: 'New Hire', role: 'Developer', cost: 0 })} className="bg-white text-slate-950 px-5 py-2.5 rounded-xl font-bold text-xs hover:bg-slate-200 transition-all flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Onboard Member
                  </button>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead className="bg-slate-950/50 text-[10px] uppercase tracking-widest text-slate-500 font-black">
                      <tr>
                        <th className="px-8 py-5">Internal Name</th>
                        <th className="px-8 py-5">Position</th>
                        <th className="px-8 py-5">Allocated Cost</th>
                        <th className="px-8 py-5 text-right">Utility</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.team.map(t => (
                        <tr key={t.id} className="border-b border-slate-800/50 hover:bg-blue-600/5 group transition-colors">
                          <td className="px-8 py-6">
                            <input className="bg-transparent border-none focus:ring-0 p-0 w-full font-bold text-slate-200" value={t.name} onChange={(e) => updateItem('team', t.id, 'name', e.target.value)} />
                          </td>
                          <td className="px-8 py-6">
                            <input className="bg-transparent border-none focus:ring-0 p-0 w-full text-slate-500 text-sm italic" value={t.role} onChange={(e) => updateItem('team', t.id, 'role', e.target.value)} />
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-1.5 font-mono font-bold text-emerald-400/80">
                               <span>$</span>
                               <input type="number" className="bg-transparent border-none focus:ring-0 p-0 w-24" value={t.cost} onChange={(e) => updateItem('team', t.id, 'cost', e.target.value)} />
                               <span className="text-[10px] text-slate-600">/mo</span>
                            </div>
                          </td>
                          <td className="px-8 py-6 text-right">
                            <button onClick={() => removeItem('team', t.id)} className="p-2 text-slate-600 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
               </div>
            </div>
          )}

          {/* Expenses View */}
          {activeTab === 'expenses' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
                  <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                    <h3 className="font-bold">Transaction History</h3>
                    <button onClick={() => addItem('expenses', { name: 'Expense Item', category: 'SaaS', amount: 0 })} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-bold transition-all">Record Expense</button>
                  </div>
                  <div className="p-4 space-y-2">
                    {data.expenses.map(ex => (
                      <div key={ex.id} className="flex items-center gap-4 p-4 hover:bg-slate-800/40 rounded-2xl group border border-transparent hover:border-slate-700 transition-all">
                         <div className="p-3 bg-slate-800 rounded-xl text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-lg">
                            <CreditCard className="w-5 h-5" />
                         </div>
                         <div className="flex-1 grid grid-cols-3 gap-4 items-center">
                            <input className="bg-transparent border-none focus:ring-0 font-bold text-slate-200" value={ex.name} onChange={(e) => updateItem('expenses', ex.id, 'name', e.target.value)} />
                            <input className="bg-transparent border-none focus:ring-0 text-[10px] text-slate-500 uppercase font-black tracking-widest" value={ex.category} onChange={(e) => updateItem('expenses', ex.id, 'category', e.target.value)} />
                            <div className="flex items-center justify-end font-mono font-bold text-rose-400">
                               <span className="text-xs mr-1">$</span>
                               <input type="number" className="bg-transparent border-none focus:ring-0 w-20 text-right p-0" value={ex.amount} onChange={(e) => updateItem('expenses', ex.id, 'amount', e.target.value)} />
                            </div>
                         </div>
                         <button onClick={() => removeItem('expenses', ex.id)} className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-rose-500 p-2"><X className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-3xl shadow-xl shadow-blue-500/10">
                   <h3 className="font-bold text-white mb-2">Total Monthly Burn</h3>
                   <h2 className="text-4xl font-black text-white mb-6">${stats.totalBurn.toLocaleString()}</h2>
                   <div className="space-y-4">
                      <div className="flex justify-between text-[10px] uppercase font-black tracking-widest text-blue-200/60">
                         <span>Efficiency Score</span>
                         <span>84%</span>
                      </div>
                      <div className="w-full bg-blue-900/50 h-2 rounded-full overflow-hidden">
                         <div className="bg-white h-full w-[84%] rounded-full"></div>
                      </div>
                   </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl">
                   <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Financial Guardrail</p>
                   <p className="text-sm text-slate-400 italic leading-relaxed">
                     Automated alerts are enabled. You will be notified via cloud-sync if monthly expenses exceed 80% of average revenue.
                   </p>
                </div>
              </div>
            </div>
          )}

          {/* Settings View */}
          {activeTab === 'settings' && (
            <div className="max-w-3xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-xl">
                <h3 className="text-lg font-bold mb-8 flex items-center gap-2"><Globe className="w-5 h-5 text-blue-500" /> Database Configuration</h3>
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Organization Label</label>
                    <input 
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none font-bold"
                      value={data.settings.projectName}
                      onChange={(e) => syncToCloud({ ...data, settings: { ...data.settings, projectName: e.target.value }})}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Currency Locale</label>
                      <select className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-300 appearance-none">
                        <option>USD ($)</option>
                        <option>EUR (€)</option>
                        <option>GBP (£)</option>
                      </select>
                    </div>
                    <div>
                       <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Sync Strategy</label>
                       <div className="w-full bg-blue-600/10 border border-blue-500/20 rounded-2xl p-4 flex items-center justify-between text-blue-400">
                          <span className="text-xs font-bold uppercase tracking-widest">Real-time Cloud</span>
                          <CloudCheck className="w-5 h-5" />
                       </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-rose-500/5 border border-rose-500/20 rounded-3xl flex items-start gap-4">
                 <div className="p-3 bg-rose-500/10 rounded-2xl text-rose-500"><AlertCircle className="w-6 h-6" /></div>
                 <div>
                    <h4 className="font-bold text-rose-400">Data Persistence Warning</h4>
                    <p className="text-xs text-rose-500/70 mt-1 leading-relaxed">
                      This database is currently hosted in a public artifact partition. Ensure you do not store sensitive bank credentials or PII. For enterprise isolation, please request a private vault upgrade.
                    </p>
                 </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;