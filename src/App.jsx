import React, { useState, useEffect, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, Legend, ComposedChart
} from 'recharts';
import { 
  LayoutDashboard, FolderPlus, Receipt, Menu, X, LogIn, Search, MapPin, 
  Plus, Trash2, Edit3, Link as LinkIcon, FileText, Globe, Wifi, WifiOff,
  ChevronRight, MoreVertical, ExternalLink, Calendar, Users, DollarSign, Activity, Terminal, ShieldCheck, UserPlus, UserMinus
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, onSnapshot, 
  query, orderBy, updateDoc, doc, deleteDoc, getDocs 
} from 'firebase/firestore';

// --- CORE INFRASTRUCTURE ---
const firebaseConfig = {
  apiKey: "AIzaSyAiSo4QbPqEOX-bTvbE7BjHtOY78_fTHpY",
  authDomain: "uystudiosprojectdatabase.firebaseapp.com",
  projectId: "uystudiosprojectdatabase",
  storageBucket: "uystudiosprojectdatabase.firebasestorage.app",
  messagingSenderId: "167809203911",
  appId: "1:167809203911:web:9b72b71460cfd92ab8c8e2",
  measurementId: "G-8R4PKT6WM4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- PRE-LOADED BOOKINGS LOG DATA ---
const SEED_DATA = [
  { clientName: "Marilyn Bautista", eventType: "Engagement", date: "2024-06-08", location: "Spadina", budget: 200, paid: 200, status: "Completed", teamMembers: [] },
  { clientName: "Jhen Gonzaga", eventType: "Wedding", date: "2024-07-13", location: "The Cardinals", budget: 700, paid: 700, status: "Completed", teamMembers: [] }
];

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [projects, setProjects] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const seedDatabase = async () => {
    const querySnapshot = await getDocs(collection(db, "projects"));
    if (querySnapshot.empty) {
      SEED_DATA.forEach(async (project) => {
        await addDoc(collection(db, "projects"), { ...project, teamMembers: [] });
      });
    }
  };

  useEffect(() => {
    if (isAuthenticated) seedDatabase();
  }, [isAuthenticated]);

  useEffect(() => {
    window.addEventListener('online', () => setIsOnline(true));
    window.addEventListener('offline', () => setIsOnline(false));
    return () => {
      window.removeEventListener('online', () => setIsOnline(true));
      window.removeEventListener('offline', () => setIsOnline(false));
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const unsubP = onSnapshot(query(collection(db, 'projects'), orderBy('date', 'desc')), (s) => 
      setProjects(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubE = onSnapshot(query(collection(db, 'expenses'), orderBy('date', 'desc')), (s) => 
      setExpenses(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { unsubP(); unsubE(); };
  }, [isAuthenticated]);

  const filteredProjects = useMemo(() => {
    return projects.filter(p => 
      p.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.eventType?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [projects, searchTerm]);

  if (!isAuthenticated) return <Login onLogin={() => setIsAuthenticated(true)} />;

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#010102] text-slate-400 overflow-hidden font-extralight tracking-tight selection:bg-blue-500/30">
      
      {/* SIDEBAR NAVIGATION */}
      <aside className={`hidden md:flex relative flex-col bg-[#050506] border-r border-white/5 transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] ${isSidebarCollapsed ? 'w-20' : 'w-72'} shadow-[10px_0_40px_rgba(0,0,0,0.9)] z-50`}>
        <div className="p-8 flex items-center justify-between">
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-4 animate-in fade-in zoom-in duration-1000">
              <div className="w-10 h-10 bg-black border border-white/10 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.05)]">
                <span className="text-white font-thin text-[10px] tracking-[0.4em]">UY</span>
              </div>
              <h1 className="text-xs font-thin tracking-[0.6em] text-white uppercase italic">Studios</h1>
            </div>
          )}
          <button onClick={() => setSidebarCollapsed(!isSidebarCollapsed)} className="p-2 hover:text-white transition-colors active:scale-90">
            <Menu className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 px-6 py-10 space-y-6">
          <NavItem icon={Activity} label="Performance" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} color="blue" collapsed={isSidebarCollapsed} />
          <NavItem icon={Terminal} label="Portfolio" active={activeTab === 'projects'} onClick={() => setActiveTab('projects')} color="purple" collapsed={isSidebarCollapsed} />
          <NavItem icon={Receipt} label="Ledger" active={activeTab === 'expenses'} onClick={() => setActiveTab('expenses')} color="emerald" collapsed={isSidebarCollapsed} />
        </nav>
      </aside>

      {/* MOBILE NAVIGATION BAR */}
      <nav className="md:hidden fixed bottom-6 left-6 right-6 h-20 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] flex items-center justify-around px-4 z-[100] shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        <MobileNavItem icon={Activity} active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} color="blue" />
        <MobileNavItem icon={Terminal} active={activeTab === 'projects'} onClick={() => setActiveTab('projects')} color="purple" />
        <MobileNavItem icon={Receipt} active={activeTab === 'expenses'} onClick={() => setActiveTab('expenses')} color="emerald" />
      </nav>

      {/* PRIMARY APPLICATION CORE */}
      <main className="flex-1 flex flex-col min-w-0 h-full relative z-0">
        <header className="h-20 md:h-24 flex items-center justify-between px-6 md:px-10 border-b border-white/5 bg-[#010102]/90 backdrop-blur-3xl z-40">
          <div className="flex-1 flex items-center">
            <div className="relative w-full max-w-lg group">
              <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-700 group-focus-within:text-white transition-all" />
              <input 
                type="text" 
                placeholder="SEARCH PRODUCTION ARCHIVES..." 
                className="w-full bg-transparent border-none py-4 pl-10 text-[9px] md:text-[10px] tracking-[0.4em] focus:outline-none text-white placeholder:text-slate-800"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-4 md:gap-8">
            <div className="text-right group hidden sm:block">
              <p className="text-[8px] font-black tracking-[0.3em] text-slate-700 uppercase group-hover:text-slate-500 transition-colors">Connection Status</p>
              <p className={`text-[9px] tracking-[0.2em] font-bold ${isOnline ? 'text-emerald-500 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'text-red-500'}`}>
                {isOnline ? 'ENCRYPTED' : 'OFFLINE'}
              </p>
            </div>
            <div className="md:hidden w-8 h-8 bg-white/5 rounded-full border border-white/10 flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.05)]">
              <span className="text-[8px] text-white">UY</span>
            </div>
          </div>
        </header>

        {/* MAIN DATA INTERFACE */}
        <div className="flex-1 overflow-y-auto pb-32 md:pb-12 p-6 md:p-12 custom-scrollbar bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-[#0a0a0f] via-[#010102] to-[#010102]">
          <div className="max-w-[1600px] mx-auto">
            {activeTab === 'dashboard' && <DashboardView projects={projects} expenses={expenses} />}
            {activeTab === 'projects' && <ProjectsView projects={filteredProjects} />}
            {activeTab === 'expenses' && <ExpensesView expenses={expenses} />}
          </div>
        </div>
      </main>
    </div>
  );
}

// --- MODULES ---

function DashboardView({ projects, expenses }) {
  const totalRev = projects.reduce((s, p) => s + (Number(p.paid) || 0), 0);
  const totalOwing = projects.reduce((s, p) => s + ((Number(p.budget) || 0) - (Number(p.paid) || 0)), 0);
  const totalBurn = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  // Data processing for the consolidated chart
  const chartData = useMemo(() => {
    const dataMap = {};
    
    projects.forEach(p => {
      const month = p.date?.substring(0, 7) || 'Unknown';
      if (!dataMap[month]) dataMap[month] = { name: month, owing: 0, expenses: 0, revenue: 0 };
      dataMap[month].owing += ((Number(p.budget) || 0) - (Number(p.paid) || 0));
      dataMap[month].revenue += (Number(p.paid) || 0);
    });

    expenses.forEach(e => {
      const month = e.date?.substring(0, 7) || 'Unknown';
      if (!dataMap[month]) dataMap[month] = { name: month, owing: 0, expenses: 0, revenue: 0 };
      dataMap[month].expenses += (Number(e.amount) || 0);
    });

    return Object.values(dataMap)
      .filter(d => d.name !== 'Unknown')
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(-10); // Show last 10 months
  }, [projects, expenses]);

  return (
    <div className="space-y-10 md:space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-10">
        <MetricCard label="GROSS REVENUE" value={`$${totalRev.toLocaleString()}`} accent="blue" />
        <MetricCard label="OUTSTANDING (OWING)" value={`$${totalOwing.toLocaleString()}`} accent="purple" />
        <MetricCard label="OPERATING COSTS" value={`$${totalBurn.toLocaleString()}`} accent="red" />
        <MetricCard label="ACTIVE TASKS" value={projects.filter(p => p.status === 'In Progress').length} accent="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12">
        <div className="lg:col-span-2 bg-[#050506] border border-white/5 rounded-[2.5rem] md:rounded-[3.5rem] p-6 md:p-12 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.6)] relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
          <div className="flex justify-between items-end mb-8 md:mb-12">
            <h3 className="text-[10px] font-thin tracking-[0.5em] text-white/40 uppercase italic">Cash Flow Analytics: Revenue vs Owing vs Expenses</h3>
          </div>
          <div className="h-64 md:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <defs>
                  <linearGradient id="colorBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis dataKey="name" stroke="#ffffff40" fontSize={9} tickLine={false} axisLine={false} />
                <YAxis stroke="#ffffff40" fontSize={9} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                <Tooltip 
                  contentStyle={{backgroundColor: '#050506', border: '1px solid #ffffff10', borderRadius: '16px', fontSize: '10px', tracking: '0.1em'}} 
                  itemStyle={{fontFamily: 'monospace'}}
                />
                <Legend wrapperStyle={{ fontSize: '9px', tracking: '0.2em', textTransform: 'uppercase' }} />
                <Area type="monotone" name="Revenue" dataKey="revenue" stroke="#3b82f6" fill="url(#colorBlue)" strokeWidth={2} />
                <Bar name="Client Owing" dataKey="owing" fill="#a855f7" radius={[4, 4, 0, 0]} maxBarSize={30} />
                <Bar name="Expenses" dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={30} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="bg-white text-black rounded-[2.5rem] md:rounded-[3.5rem] p-10 md:p-12 flex flex-col justify-between shadow-[0_0_60px_rgba(255,255,255,0.08)] transform active:scale-95 md:hover:scale-[1.02] transition-all duration-500">
          <div>
            <h4 className="text-[9px] font-black uppercase tracking-[0.4em] opacity-30 mb-4">TOTAL NET PROFIT</h4>
            <p className="text-5xl md:text-6xl font-extralight tracking-tighter italic">${(totalRev - totalBurn).toLocaleString()}</p>
          </div>
          <div className="space-y-6 pt-12 border-t border-black/5 hidden md:block">
            <p className="text-[9px] leading-relaxed font-bold uppercase tracking-[0.2em] opacity-30 italic">UY Studios Infrastructure v3.6</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExpensesView({ expenses }) {
  const [showModal, setShowModal] = useState(false);
  const [editData, setEditData] = useState(null);

  return (
    <div className="space-y-8 md:space-y-12 animate-in fade-in slide-in-from-right-8 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-thin text-white tracking-[0.3em] uppercase italic">Fiscal Ledger</h2>
          <p className="text-[9px] tracking-[0.5em] text-slate-700 mt-2 font-bold uppercase italic">Expenditure Log</p>
        </div>
        <button onClick={() => { setEditData(null); setShowModal(true); }} className="w-full md:w-auto px-10 py-5 bg-white text-black text-[9px] font-black tracking-[0.5em] rounded-full hover:bg-emerald-500 hover:text-white transition-all shadow-xl active:scale-95 italic">LOG DEBIT +</button>
      </div>

      <div className="bg-[#050506] border border-white/5 rounded-[2rem] md:rounded-[3rem] overflow-hidden shadow-2xl overflow-x-auto">
        <table className="w-full text-left text-sm font-extralight min-w-[600px]">
          <thead>
            <tr className="border-b border-white/5 text-[9px] tracking-[0.4em] text-slate-600 uppercase bg-white/[0.01]">
              <th className="px-8 py-8">Timestamp</th>
              <th className="px-8 py-8">Description</th>
              <th className="px-8 py-8 text-right">Allocation</th>
              <th className="px-8 py-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {expenses.map(e => (
              <tr key={e.id} className="hover:bg-white/[0.02] transition-all group">
                <td className="px-8 py-6 text-slate-600 font-mono text-[10px]">{e.date}</td>
                <td className="px-8 py-6 text-white tracking-widest uppercase text-xs font-light italic">{e.description}</td>
                <td className="px-8 py-6 text-right font-mono text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.2)]">-${Number(e.amount).toLocaleString()}</td>
                <td className="px-8 py-6 text-right">
                  <div className="flex gap-4 justify-end">
                    <button onClick={() => { setEditData(e); setShowModal(true); }} className="p-3 bg-white/5 rounded-full hover:bg-white hover:text-black transition-all active:scale-75"><Edit3 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => deleteDoc(doc(db, 'expenses', e.id))} className="p-3 bg-red-500/10 rounded-full hover:bg-red-500 hover:text-white transition-all active:scale-75"><Trash2 className="w-3.5 h-3.5 text-red-500 hover:text-white" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && <ExpenseModal expense={editData} onClose={() => setShowModal(false)} />}
    </div>
  );
}

function ProjectsView({ projects }) {
  const [showModal, setShowModal] = useState(false);
  const [editData, setEditData] = useState(null);

  return (
    <div className="space-y-8 md:space-y-12 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-4xl md:text-5xl font-thin text-white tracking-tighter uppercase italic">Portfolio Matrix</h2>
          <p className="text-[9px] tracking-[0.6em] text-slate-700 mt-2 font-bold uppercase italic">Production Assets: {projects.length}</p>
        </div>
        <button onClick={() => { setEditData(null); setShowModal(true); }} className="w-full md:w-auto px-10 py-5 bg-white text-black text-[9px] font-black tracking-[0.5em] rounded-full hover:shadow-[0_0_40px_rgba(255,255,255,0.2)] transition-all active:scale-95 italic font-black uppercase">Initialize Production +</button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 md:gap-12">
        {projects.map(p => (
          <div key={p.id} className="group bg-[#050506] border border-white/5 p-8 md:p-12 rounded-[2.5rem] md:rounded-[3.5rem] hover:border-blue-500/40 transition-all duration-700 shadow-2xl hover:shadow-[0_0_60px_rgba(59,130,246,0.15)] relative overflow-hidden active:scale-[0.98] md:active:scale-100 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-10 md:mb-12">
                <div className="space-y-4">
                  <StatusBadge status={p.status} />
                  <h3 className="text-2xl md:text-3xl font-extralight text-white tracking-tighter uppercase group-hover:text-blue-400 transition-colors duration-500 italic">{p.clientName}</h3>
                  <p className="text-[8px] font-bold tracking-[0.4em] text-slate-700 uppercase italic font-black">{p.eventType}</p>
                </div>
                <div className="flex gap-3 md:gap-4 md:opacity-0 group-hover:opacity-100 transition-all duration-500">
                  <button onClick={() => { setEditData(p); setShowModal(true); }} className="p-3 md:p-4 bg-white/5 rounded-full hover:bg-white text-black transition-all active:scale-75 shadow-lg shadow-white/5"><Edit3 className="w-4 h-4" /></button>
                  <button onClick={() => deleteDoc(doc(db, 'projects', p.id))} className="p-3 md:p-4 bg-red-500/10 rounded-full hover:bg-red-500 text-white transition-all active:scale-75 shadow-lg shadow-red-500/5"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:gap-4 mb-8 font-bold uppercase italic font-black">
                 <a href={p.mapsLink} target="_blank" rel="noreferrer" className="p-4 md:p-6 bg-white/[0.01] border border-white/5 rounded-2xl text-[8px] tracking-[0.2em] text-slate-600 uppercase flex items-center gap-3 md:gap-4 hover:border-blue-500/50 hover:text-blue-400 transition-all overflow-hidden shadow-inner">
                   <MapPin className="w-3.5 h-3.5 flex-shrink-0 drop-shadow-[0_0_5px_rgba(59,130,246,0.5)]" /> <span className="truncate">{p.location || 'Pending Coordinates'}</span>
                 </a>
                 <a href={p.filesLink} target="_blank" rel="noreferrer" className="p-4 md:p-6 bg-white/[0.01] border border-white/5 rounded-2xl text-[8px] tracking-[0.2em] text-slate-600 uppercase flex items-center gap-3 md:gap-4 hover:border-emerald-500/50 hover:text-emerald-400 transition-all shadow-inner">
                   <Globe className="w-3.5 h-3.5 flex-shrink-0 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" /> Secure Assets
                 </a>
              </div>

              {/* TEAM MEMBERS DISPLAY MATRIX */}
              {p.teamMembers && p.teamMembers.length > 0 && (
                <div className="mb-8 p-6 rounded-2xl bg-white/[0.01] border border-white/5 shadow-inner">
                  <p className="text-[8px] font-black tracking-[0.4em] text-slate-700 uppercase mb-4 italic">Assigned Operatives</p>
                  <div className="space-y-3">
                    {p.teamMembers.map((member, i) => (
                      <div key={i} className="flex justify-between items-center text-[9px] uppercase tracking-widest font-bold">
                        <div className="flex items-center gap-3">
                          <Users className="w-3 h-3 text-purple-500" />
                          <span className="text-white">{member.name} <span className="text-slate-600 ml-1">[{member.role}]</span></span>
                        </div>
                        <span className="text-emerald-400 font-mono">${member.amount}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-8 md:pt-10 border-t border-white/5 italic mt-auto">
              <div className="text-right">
                <p className="text-[8px] font-black text-slate-800 tracking-[0.4em] uppercase mb-1 font-black">Liquidity Stream</p>
                <p className="text-xl md:text-2xl font-extralight text-white font-mono tracking-tighter">${p.paid} <span className="opacity-20 text-[10px] tracking-normal">/ ${p.budget}</span></p>
              </div>
              <div className="h-1 w-24 md:w-32 bg-white/[0.03] rounded-full overflow-hidden shadow-inner">
                <div className="h-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.6)] transition-all duration-1000" style={{width: `${(p.paid/p.budget)*100}%`}} />
              </div>
            </div>
          </div>
        ))}
      </div>
      {showModal && <ProjectModal project={editData} onClose={() => setShowModal(false)} />}
    </div>
  );
}

// --- SHARED UI COMPONENTS ---

const NavItem = ({ icon: Icon, label, active, onClick, collapsed, color }) => {
  const neon = {
    blue: 'hover:text-blue-400 hover:drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]',
    purple: 'hover:text-purple-400 hover:drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]',
    emerald: 'hover:text-emerald-400 hover:drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]'
  };
  
  return (
    <button 
      onClick={onClick} 
      className={`w-full flex items-center px-6 py-5 rounded-[2rem] border transition-all duration-500 active:scale-95 ${active ? 'bg-white text-black border-white shadow-[0_15px_40px_rgba(255,255,255,0.15)]' : `bg-transparent border-transparent text-slate-600 ${neon[color]}`}`}
    >
      <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'drop-shadow-[0_0_5px_rgba(0,0,0,0.5)]' : ''}`} />
      {!collapsed && <span className="ml-6 text-[10px] font-black uppercase tracking-[0.5em] pt-0.5 font-black uppercase italic">{label}</span>}
    </button>
  );
};

const MobileNavItem = ({ icon: Icon, active, onClick, color }) => {
  const colors = {
    blue: 'text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.3)]',
    purple: 'text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.3)]',
    emerald: 'text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
  };
  return (
    <button onClick={onClick} className={`p-4 rounded-full transition-all duration-500 active:scale-75 ${active ? `bg-white/10 ${colors[color]}` : 'text-slate-700'}`}>
      <Icon className={`w-6 h-6 ${active ? 'drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]' : ''}`} />
    </button>
  );
};

const MetricCard = ({ label, value, accent }) => {
  const tints = {
    blue: 'border-blue-500/10 text-blue-400 shadow-[0_0_30px_rgba(59,130,246,0.05)]',
    red: 'border-red-500/10 text-red-400 shadow-[0_0_30px_rgba(239,68,68,0.05)]',
    emerald: 'border-emerald-500/10 text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.05)]',
    purple: 'border-purple-500/10 text-purple-400 shadow-[0_0_30px_rgba(168,85,247,0.05)]'
  };
  return (
    <div className={`p-6 md:p-10 rounded-[2rem] md:rounded-[3.5rem] bg-[#050506] border ${tints[accent]} transition-all hover:scale-[1.03] active:scale-95 duration-700 shadow-xl shadow-black/40`}>
      <p className="text-[7px] md:text-[8px] font-black tracking-[0.5em] opacity-40 mb-3 md:mb-5 uppercase italic font-black truncate">{label}</p>
      <p className="text-2xl md:text-4xl font-extralight tracking-tighter italic text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] truncate">{value}</p>
    </div>
  );
};

const InputGroup = ({ label, type = "text", value, onChange, placeholder = "" }) => (
  <div className="space-y-3 md:space-y-4 w-full">
    <label className="text-[8px] font-black text-slate-800 tracking-[0.6em] uppercase px-2 italic font-black">{label}</label>
    <input 
      type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full bg-[#010102] border border-white/5 rounded-2xl py-4 md:py-5 px-6 md:px-8 text-xs text-white placeholder:text-slate-800 focus:outline-none focus:border-white/20 transition-all font-bold tracking-[0.2em] uppercase shadow-inner italic"
    />
  </div>
);

const StatusBadge = ({ status }) => {
  const styles = {
    'Completed': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 drop-shadow-[0_0_5px_rgba(16,185,129,0.3)]',
    'In Progress': 'bg-blue-500/10 text-blue-400 border-blue-500/20 drop-shadow-[0_0_5px_rgba(59,130,246,0.3)]',
    'Not Started': 'bg-white/5 text-slate-500 border-white/10',
    'Cancelled': 'bg-red-500/10 text-red-500 border-red-500/20'
  };
  return <span className={`inline-block text-[7px] md:text-[8px] font-black uppercase tracking-[0.4em] px-3 md:px-4 py-1.5 md:py-2 rounded-full border ${styles[status]} italic font-black`}>{status}</span>;
};

// --- AUTH LOGIC ---
const Login = ({ onLogin }) => {
  const [val, setVal] = useState('');
  const [error, setError] = useState(false);
  
  const check = (e) => {
    e.preventDefault();
    if(val === 'uy2026') onLogin();
    else { setError(true); setTimeout(() => setError(false), 500); }
  };

  return (
    <div className="h-screen bg-[#010102] flex items-center justify-center p-6 font-extralight">
      <form onSubmit={check} className={`w-full max-w-md p-12 md:p-20 bg-[#050506] border border-white/5 rounded-[4rem] md:rounded-[5rem] text-center transition-all duration-1000 ${error ? 'border-red-500/50 shake' : 'shadow-[0_60px_120px_-30px_rgba(0,0,0,0.9)] shadow-black/80'}`}>
        <div className="w-20 h-20 md:w-28 md:h-28 bg-white rounded-full mx-auto mb-12 md:mb-16 flex items-center justify-center shadow-[0_0_60px_rgba(255,255,255,0.15)] group">
          <ShieldCheck className="w-8 h-8 md:w-10 md:h-10 text-black group-hover:scale-110 transition-transform duration-700" />
        </div>
        <h1 className="text-2xl md:text-3xl font-thin text-white tracking-[0.5em] mb-4 uppercase italic">UY Studios</h1>
        <p className="text-[9px] font-black text-slate-800 tracking-[0.6em] mb-12 md:mb-16 uppercase italic font-black tracking-[0.7em]">Neural Terminal v3.6</p>
        <input 
          type="password" autoFocus onChange={e => setVal(e.target.value)} 
          className="w-full bg-[#010102] border border-white/5 rounded-2xl md:rounded-[2.5rem] py-6 md:py-8 px-8 text-center text-white tracking-[1.5em] md:tracking-[2em] focus:outline-none focus:border-white/20 mb-10 md:mb-12 font-mono text-xl md:text-2xl shadow-inner shadow-black/50"
        />
        <button type="submit" className="w-full bg-white text-black py-6 md:py-8 rounded-full font-black tracking-[0.6em] hover:shadow-[0_0_40px_rgba(255,255,255,0.2)] transition-all uppercase text-[10px] font-black italic">Initialize Link</button>
      </form>
    </div>
  );
};

// --- MODALS ---

function ExpenseModal({ expense, onClose }) {
  const [form, setForm] = useState(expense || { description: '', amount: 0, date: '', category: 'Equipment' });

  const save = async (e) => {
    e.preventDefault();
    expense ? await updateDoc(doc(db, 'expenses', expense.id), form) : await addDoc(collection(db, 'expenses'), form);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl flex items-center justify-center p-4 z-[200] animate-in fade-in duration-500">
      <form onSubmit={save} className="bg-[#050506] border border-white/10 p-8 md:p-16 rounded-[3rem] md:rounded-[4rem] w-full max-w-xl space-y-8 shadow-[0_0_100px_rgba(16,185,129,0.15)] shadow-emerald-500/10">
        <h3 className="text-xl font-thin tracking-[0.5em] text-white italic uppercase">{expense ? 'Update Debit' : 'Authorize Debit'}</h3>
        <InputGroup label="Descriptor" value={form.description} onChange={v => setForm({...form, description: v})} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          <InputGroup label="Quantum ($)" type="number" value={form.amount} onChange={v => setForm({...form, amount: v})} />
          <InputGroup label="Temporal Marker" type="date" value={form.date} onChange={v => setForm({...form, date: v})} />
        </div>
        <div className="flex gap-4 pt-4">
           <button type="submit" className="flex-1 py-6 md:py-7 bg-white text-black font-black tracking-[0.5em] rounded-3xl hover:bg-emerald-500 hover:text-white transition-all uppercase text-[9px] font-black italic">Commit to Ledger</button>
           <button type="button" onClick={onClose} className="p-6 md:p-7 bg-white/5 rounded-3xl text-white hover:bg-red-500/20 transition-all shadow-lg active:scale-75"><X className="w-5 h-5" /></button>
        </div>
      </form>
    </div>
  );
}

function ProjectModal({ project, onClose }) {
  const [form, setForm] = useState(project || {
    clientName: '', eventType: '', date: '', location: '', mapsLink: '', filesLink: '',
    budget: 0, paid: 0, status: 'Not Started', teamMembers: []
  });

  const save = async (e) => {
    e.preventDefault();
    project ? await updateDoc(doc(db, 'projects', project.id), form) : await addDoc(collection(db, 'projects'), form);
    onClose();
  };

  const addTeamMember = () => {
    setForm({ ...form, teamMembers: [...(form.teamMembers || []), { name: '', role: '', amount: 0 }] });
  };

  const updateTeamMember = (index, field, value) => {
    const updated = [...form.teamMembers];
    updated[index][field] = value;
    setForm({ ...form, teamMembers: updated });
  };

  const removeTeamMember = (index) => {
    const updated = [...form.teamMembers];
    updated.splice(index, 1);
    setForm({ ...form, teamMembers: updated });
  };

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl flex items-center justify-center p-4 z-[200] animate-in fade-in zoom-in duration-500">
      <div className="bg-[#050506] border border-white/10 w-full max-w-3xl rounded-[3rem] md:rounded-[4rem] p-8 md:p-16 overflow-y-auto max-h-[90vh] shadow-[0_0_120px_rgba(59,130,246,0.2)] shadow-blue-500/10 custom-scrollbar">
        <header className="flex justify-between items-center mb-10 md:mb-16 italic">
          <h3 className="text-xl md:text-2xl font-thin text-white tracking-[0.5em] italic uppercase">{project ? 'Update Entry' : 'New Assignment'}</h3>
          <button onClick={onClose} className="p-4 bg-white/5 rounded-full hover:bg-white text-black transition-all shadow-lg active:scale-75"><X className="w-5 h-5" /></button>
        </header>

        <form onSubmit={save} className="space-y-10 md:space-y-12">
          {/* CLIENT DATA */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 italic font-black uppercase">
            <InputGroup label="Client Vector" value={form.clientName} onChange={v => setForm({...form, clientName: v})} />
            <InputGroup label="Event Type" value={form.eventType} placeholder="Wedding, Headshots..." onChange={v => setForm({...form, eventType: v})} />
            <InputGroup label="Timeline Marker" type="date" value={form.date} onChange={v => setForm({...form, date: v})} />
            <div className="space-y-4">
              <label className="text-[8px] font-black text-slate-800 tracking-[0.6em] uppercase px-2 italic font-black">Assignment Phase</label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="w-full bg-[#010102] border border-white/5 rounded-2xl py-5 md:py-6 px-8 text-xs text-white focus:outline-none appearance-none font-bold tracking-widest uppercase italic font-black shadow-inner">
                <option value="Not Started">Standby</option>
                <option value="In Progress">Active</option>
                <option value="Completed">Archived</option>
                <option value="Cancelled">Aborted</option>
              </select>
            </div>
          </div>
          <InputGroup label="Venue Coordinates" value={form.location} onChange={v => setForm({...form, location: v})} />
          
          {/* TEAM MEMBERS SECTION */}
          <div className="pt-8 border-t border-white/5">
            <div className="flex justify-between items-center mb-6">
               <label className="text-[8px] font-black text-slate-800 tracking-[0.6em] uppercase px-2 italic font-black">Team Allocation Matrix</label>
               <button type="button" onClick={addTeamMember} className="flex items-center gap-2 text-[8px] uppercase tracking-widest font-black text-white bg-white/5 px-4 py-3 rounded-full hover:bg-purple-500 hover:text-white transition-all shadow-inner">
                 <UserPlus className="w-3 h-3" /> Add Operative
               </button>
            </div>
            
            <div className="space-y-4">
              {form.teamMembers && form.teamMembers.map((member, index) => (
                <div key={index} className="flex flex-col md:flex-row gap-4 items-center bg-[#010102] p-4 rounded-2xl border border-white/5 shadow-inner">
                  <InputGroup label={`Name`} value={member.name} onChange={v => updateTeamMember(index, 'name', v)} />
                  <InputGroup label={`Role`} value={member.role} placeholder="2nd Shooter" onChange={v => updateTeamMember(index, 'role', v)} />
                  <InputGroup label={`Paid ($)`} type="number" value={member.amount} onChange={v => updateTeamMember(index, 'amount', v)} />
                  <button type="button" onClick={() => removeTeamMember(index)} className="mt-6 p-4 bg-red-500/10 rounded-xl text-red-500 hover:bg-red-500 hover:text-white transition-all">
                    <UserMinus className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* FINANCIALS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-white/5 italic font-black uppercase">
            <InputGroup label="Quote Yield ($)" type="number" value={form.budget} onChange={v => setForm({...form, budget: v})} />
            <InputGroup label="Liquidity Injected ($)" type="number" value={form.paid} onChange={v => setForm({...form, paid: v})} />
          </div>
          <button type="submit" className="w-full py-7 md:py-9 bg-white text-black font-black tracking-[0.7em] rounded-3xl hover:bg-blue-600 hover:text-white transition-all uppercase text-[9px] md:text-[10px] italic font-black shadow-2xl">Confirm Production Parameters</button>
        </form>
      </div>
    </div>
  );
}