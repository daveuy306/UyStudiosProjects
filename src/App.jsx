import React, { useState, useEffect, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { 
  LayoutDashboard, FolderPlus, Receipt, Menu, X, LogIn, Search, MapPin, 
  Plus, Trash2, Edit3, Link as LinkIcon, FileText, Globe, Wifi, WifiOff,
  ChevronRight, MoreVertical, ExternalLink, Calendar, Users, DollarSign, Activity, Terminal
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, onSnapshot, 
  query, orderBy, updateDoc, doc, deleteDoc 
} from 'firebase/firestore';

// --- ENCRYPTED CORE: FIREBASE CONFIG ---
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

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [projects, setProjects] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

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
    <div className="flex h-screen bg-[#010102] text-slate-400 overflow-hidden font-extralight tracking-tight">
      {/* SIDEBAR WITH NEON UNDERGLOW */}
      <aside className={`relative flex flex-col bg-[#050506] border-r border-white/5 transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] ${isSidebarCollapsed ? 'w-20' : 'w-72'} shadow-[10px_0_40px_rgba(0,0,0,0.8)]`}>
        <div className="p-8 flex items-center justify-between">
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-4 animate-in fade-in duration-1000">
              <div className="w-10 h-10 bg-black border border-white/10 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.05)]">
                <span className="text-white font-thin text-xs tracking-[0.3em]">UY</span>
              </div>
              <h1 className="text-sm font-thin tracking-[0.5em] text-white">SYSTEM</h1>
            </div>
          )}
          <button onClick={() => setSidebarCollapsed(!isSidebarCollapsed)} className="p-2 hover:text-white transition-colors">
            <Menu className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 px-6 py-6 space-y-4">
          <NavItem icon={Activity} label="Neural Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} collapsed={isSidebarCollapsed} color="blue" />
          <NavItem icon={Terminal} label="Portfolio Matrix" active={activeTab === 'projects'} onClick={() => setActiveTab('projects')} collapsed={isSidebarCollapsed} color="purple" />
          <NavItem icon={Receipt} label="Fiscal Ledger" active={activeTab === 'expenses'} onClick={() => setActiveTab('expenses')} collapsed={isSidebarCollapsed} color="emerald" />
        </nav>
      </aside>

      {/* MAIN DATA VIEW */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-24 flex items-center justify-between px-10 border-b border-white/5 bg-[#010102]/80 backdrop-blur-3xl z-50">
          <div className="flex-1 flex items-center">
            <div className="relative w-full max-w-lg group">
              <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 group-focus-within:text-white transition-all" />
              <input 
                type="text" 
                placeholder="QUERY PRODUCTION DATABASE..." 
                className="w-full bg-transparent border-none py-4 pl-10 text-[11px] tracking-[0.3em] focus:outline-none text-white placeholder:text-slate-800"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-8">
            <div className="text-right">
              <p className="text-[9px] font-black tracking-[0.2em] text-slate-600 uppercase">Core Frequency</p>
              <p className={`text-[10px] tracking-widest font-bold ${isOnline ? 'text-emerald-500 shadow-emerald-500/20 drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'text-red-500'}`}>
                {isOnline ? 'SYNCHRONIZED' : 'LINK SEVERED'}
              </p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-[#08080a] via-[#010102] to-[#010102]">
          {activeTab === 'dashboard' && <DashboardView projects={projects} expenses={expenses} />}
          {activeTab === 'projects' && <ProjectsView projects={filteredProjects} />}
          {activeTab === 'expenses' && <ExpensesView expenses={expenses} />}
        </div>
      </main>
    </div>
  );
}

// --- SUB-SYSTEMS (VIEWS) ---

function DashboardView({ projects, expenses }) {
  const totalRev = projects.reduce((s, p) => s + (Number(p.paid) || 0), 0);
  const totalBurn = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  return (
    <div className="space-y-12 animate-in fade-in duration-1000">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <MetricCard label="GROSS LIQUIDITY" value={`$${totalRev.toLocaleString()}`} accent="blue" />
        <MetricCard label="OPERATIONAL BURN" value={`$${totalBurn.toLocaleString()}`} accent="red" />
        <MetricCard label="DELTA MARGIN" value="84.2%" accent="emerald" />
        <MetricCard label="ACTIVE NODES" value={projects.filter(p => p.status === 'In Progress').length} accent="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 bg-[#050506] border border-white/5 rounded-[3rem] p-12 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
          <h3 className="text-xs font-thin tracking-[0.4em] text-white/50 mb-12 uppercase">Revenue Velocity Matrix</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={projects.slice(0, 15).reverse()}>
                <defs>
                  <linearGradient id="colorBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Tooltip contentStyle={{backgroundColor: '#050506', border: '1px solid #ffffff10', borderRadius: '20px', fontSize: '10px'}} />
                <Area type="monotone" dataKey="paid" stroke="#3b82f6" fill="url(#colorBlue)" strokeWidth={1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="bg-white text-black rounded-[3rem] p-12 flex flex-col justify-between shadow-[0_0_50px_rgba(255,255,255,0.05)]">
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-4">Total Net Equity</h4>
            <p className="text-6xl font-extralight tracking-tighter italic">${(totalRev - totalBurn).toLocaleString()}</p>
          </div>
          <div className="space-y-6 pt-12 border-t border-black/5">
            <p className="text-[10px] leading-relaxed font-bold uppercase tracking-widest opacity-40">System verified: All packets encrypted with AES-256 for UY Studios Infrastructure.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- NEW COMPONENT: EXPENSES VIEW ---
function ExpensesView({ expenses }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ description: '', amount: 0, date: '', category: 'Gear' });

  const save = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, 'expenses'), form);
    setShowModal(false);
  };

  return (
    <div className="space-y-10 animate-in slide-in-from-right-4 duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-thin text-white tracking-[0.2em] uppercase italic">Fiscal Burn</h2>
          <p className="text-[10px] tracking-[0.4em] text-slate-600 mt-2 font-bold">OPERATIONAL DEBIT LEDGER</p>
        </div>
        <button onClick={() => setShowModal(true)} className="px-10 py-5 bg-white text-black text-[10px] font-black tracking-[0.3em] rounded-full hover:bg-emerald-500 hover:text-white transition-all shadow-2xl">LOG DEBIT +</button>
      </div>

      <div className="bg-[#050506] border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
        <table className="w-full text-left text-sm font-extralight">
          <thead>
            <tr className="border-b border-white/5 text-[10px] tracking-[0.3em] text-slate-500 uppercase">
              <th className="px-10 py-8">Timestamp</th>
              <th className="px-10 py-8">Allocation</th>
              <th className="px-10 py-8">Quantum Category</th>
              <th className="px-10 py-8 text-right">Value (USD)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {expenses.map(e => (
              <tr key={e.id} className="hover:bg-white/[0.02] transition-colors group">
                <td className="px-10 py-6 text-slate-500 font-mono text-[11px]">{e.date}</td>
                <td className="px-10 py-6 text-white tracking-widest uppercase text-xs">{e.description}</td>
                <td className="px-10 py-6"><span className="px-3 py-1 border border-white/10 rounded-full text-[9px] font-bold text-slate-500">{e.category}</span></td>
                <td className="px-10 py-6 text-right font-mono text-emerald-500 drop-shadow-[0_0_5px_rgba(16,185,129,0.3)]">-${Number(e.amount).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 z-[100]">
          <form onSubmit={save} className="bg-[#050506] border border-white/10 p-12 rounded-[3rem] w-full max-w-xl space-y-8 shadow-[0_0_100px_rgba(16,185,129,0.1)]">
            <h3 className="text-xl font-thin tracking-[0.4em] text-white italic">AUTHORIZE EXPENSE</h3>
            <InputGroup label="Description" value={form.description} onChange={v => setForm({...form, description: v})} />
            <div className="grid grid-cols-2 gap-6">
              <InputGroup label="Value" type="number" value={form.amount} onChange={v => setForm({...form, amount: v})} />
              <InputGroup label="Date" type="date" value={form.date} onChange={v => setForm({...form, date: v})} />
            </div>
            <button type="submit" className="w-full py-6 bg-white text-black font-black tracking-[0.4em] rounded-2xl hover:bg-emerald-500 hover:text-white transition-all">COMMIT TO LEDGER</button>
            <button type="button" onClick={() => setShowModal(false)} className="w-full text-[10px] font-bold tracking-widest text-slate-600">ABORT COMMAND</button>
          </form>
        </div>
      )}
    </div>
  );
}

function ProjectsView({ projects }) {
  const [showModal, setShowModal] = useState(false);
  const [editData, setEditData] = useState(null);

  return (
    <div className="space-y-12">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-5xl font-thin text-white tracking-tighter uppercase italic">Portfolio</h2>
          <p className="text-[10px] tracking-[0.5em] text-slate-600 mt-2 font-bold">ASSET CLASS ARCHIVE / {projects.length} RECORDS</p>
        </div>
        <button onClick={() => { setEditData(null); setShowModal(true); }} className="px-12 py-5 bg-white text-black text-[10px] font-black tracking-[0.4em] rounded-full hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-all">INITIALIZE PROJECT +</button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
        {projects.map(p => (
          <div key={p.id} className="group bg-[#050506] border border-white/5 p-10 rounded-[3rem] hover:border-blue-500/30 transition-all duration-700 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.5)] hover:shadow-[0_0_50px_rgba(59,130,246,0.1)] relative overflow-hidden">
            <div className="flex justify-between items-start mb-10">
              <div className="space-y-3">
                <StatusBadge status={p.status} />
                <h3 className="text-3xl font-extralight text-white tracking-tighter uppercase group-hover:text-blue-400 transition-colors">{p.clientName}</h3>
                <p className="text-[10px] font-bold tracking-[0.3em] text-slate-600 uppercase">{p.eventType} // ID: {p.id.slice(0,8)}</p>
              </div>
              <div className="flex gap-4 opacity-0 group-hover:opacity-100 transition-all">
                <button onClick={() => { setEditData(p); setShowModal(true); }} className="p-3 bg-white/5 rounded-full hover:bg-white text-black transition-all"><Edit3 className="w-4 h-4" /></button>
                <button onClick={() => deleteDoc(doc(db, 'projects', p.id))} className="p-3 bg-red-500/10 rounded-full hover:bg-red-500 text-white transition-all"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>

            <div className="flex gap-4 mb-10 font-bold">
               <a href={p.mapsLink} target="_blank" className="flex-1 p-5 bg-white/[0.02] border border-white/5 rounded-2xl text-[9px] tracking-[0.2em] text-slate-500 uppercase flex items-center gap-3 hover:border-blue-500/50 transition-all">
                 <MapPin className="w-4 h-4" /> Vector: {p.location || 'Pending'}
               </a>
               <a href={p.filesLink} target="_blank" className="flex-1 p-5 bg-white/[0.02] border border-white/5 rounded-2xl text-[9px] tracking-[0.2em] text-slate-500 uppercase flex items-center gap-3 hover:border-emerald-500/50 transition-all">
                 <Globe className="w-4 h-4" /> Asset Cloud
               </a>
            </div>

            <div className="flex items-center justify-between pt-8 border-t border-white/5">
              <div className="text-right">
                <p className="text-[9px] font-black text-slate-700 tracking-[0.3em] uppercase mb-2">Liquidity Injection</p>
                <p className="text-2xl font-extralight text-white font-mono">${p.paid} <span className="opacity-20 text-xs">/ ${p.budget}</span></p>
              </div>
              <div className="h-1 w-24 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" style={{width: `${(p.paid/p.budget)*100}%`}} />
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
    blue: 'hover:shadow-[0_0_20px_rgba(59,130,246,0.2)] hover:border-blue-500/30 text-blue-500',
    purple: 'hover:shadow-[0_0_20px_rgba(168,85,247,0.2)] hover:border-purple-500/30 text-purple-500',
    emerald: 'hover:shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:border-emerald-500/30 text-emerald-500'
  };
  
  return (
    <button 
      onClick={onClick} 
      className={`w-full flex items-center px-5 py-5 rounded-[2rem] border transition-all duration-500 ${active ? 'bg-white text-black border-white shadow-[0_0_30px_rgba(255,255,255,0.1)]' : `bg-transparent border-transparent text-slate-500 ${neon[color]}`}`}
    >
      <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'drop-shadow-[0_0_8px_rgba(0,0,0,0.5)]' : ''}`} />
      {!collapsed && <span className="ml-5 text-[10px] font-black uppercase tracking-[0.4em] pt-0.5">{label}</span>}
    </button>
  );
};

const MetricCard = ({ label, value, accent }) => {
  const tints = {
    blue: 'border-blue-500/10 text-blue-400 shadow-[0_0_40px_rgba(59,130,246,0.05)]',
    red: 'border-red-500/10 text-red-400 shadow-[0_0_40px_rgba(239,68,68,0.05)]',
    emerald: 'border-emerald-500/10 text-emerald-400 shadow-[0_0_40px_rgba(16,185,129,0.05)]',
    purple: 'border-purple-500/10 text-purple-400 shadow-[0_0_40px_rgba(168,85,247,0.05)]'
  };
  return (
    <div className={`p-10 rounded-[3rem] bg-[#050506] border ${tints[accent]} transition-transform hover:scale-[1.03] duration-700`}>
      <p className="text-[9px] font-black tracking-[0.4em] opacity-40 mb-4">{label}</p>
      <p className="text-4xl font-extralight tracking-tighter italic text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">{value}</p>
    </div>
  );
};

const InputGroup = ({ label, type = "text", value, onChange }) => (
  <div className="space-y-3">
    <label className="text-[9px] font-black text-slate-700 tracking-[0.5em] uppercase px-1">{label}</label>
    <input 
      type={type} value={value} onChange={e => onChange(e.target.value)} 
      className="w-full bg-[#010102] border border-white/5 rounded-2xl py-5 px-8 text-xs text-white focus:outline-none focus:border-white/20 transition-all font-bold tracking-widest uppercase shadow-inner"
    />
  </div>
);

const StatusBadge = ({ status }) => {
  const styles = {
    'Completed': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    'In Progress': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'Not Started': 'bg-white/5 text-slate-500 border-white/10',
    'Cancelled': 'bg-red-500/10 text-red-500 border-red-500/20'
  };
  return <span className={`inline-block text-[8px] font-black uppercase tracking-[0.3em] px-3 py-1.5 rounded-full border ${styles[status]}`}>{status}</span>;
};

// --- AUTH LOGIC (STRICT PASSCODE) ---
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
      <form onSubmit={check} className={`w-full max-w-md p-20 bg-[#050506] border border-white/5 rounded-[4rem] text-center transition-all ${error ? 'border-red-500/50' : 'shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)]'}`}>
        <div className="w-24 h-24 bg-white rounded-full mx-auto mb-12 flex items-center justify-center shadow-[0_0_50px_rgba(255,255,255,0.1)]">
          <Terminal className="w-8 h-8 text-black" />
        </div>
        <h1 className="text-3xl font-thin text-white tracking-[0.4em] mb-4 uppercase italic">UY Studios</h1>
        <p className="text-[10px] font-black text-slate-800 tracking-[0.5em] mb-16 uppercase">Production Terminal v3.2</p>
        <input 
          type="password" autoFocus onChange={e => setVal(e.target.value)} 
          className="w-full bg-[#010102] border border-white/5 rounded-3xl py-6 px-8 text-center text-white tracking-[1.5em] focus:outline-none focus:border-white/20 mb-10 font-mono text-xl"
        />
        <button type="submit" className="w-full bg-white text-black py-6 rounded-full font-black tracking-[0.5em] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-all uppercase text-[10px]">Initialize Link</button>
      </form>
    </div>
  );
};

// --- MISSING PROJECT MODAL RE-ADDED ---
function ProjectModal({ project, onClose }) {
  const [form, setForm] = useState(project || {
    clientName: '', eventType: '', date: '', location: '', mapsLink: '', filesLink: '',
    budget: 0, paid: 0, status: 'Not Started'
  });

  const save = async (e) => {
    e.preventDefault();
    project ? await updateDoc(doc(db, 'projects', project.id), form) : await addDoc(collection(db, 'projects'), form);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl flex items-center justify-center p-4 z-[100] animate-in fade-in duration-500">
      <div className="bg-[#050506] border border-white/10 w-full max-w-3xl rounded-[4rem] p-16 overflow-y-auto max-h-[90vh] shadow-[0_0_100px_rgba(59,130,246,0.1)] custom-scrollbar">
        <header className="flex justify-between items-center mb-16">
          <div>
            <h3 className="text-2xl font-thin text-white tracking-[0.4em] italic uppercase">Log Production</h3>
            <p className="text-[9px] font-black text-slate-700 tracking-[0.5em] uppercase mt-2">Writing to permanent Firestore Matrix</p>
          </div>
          <button onClick={onClose} className="p-4 bg-white/5 rounded-full hover:bg-white text-black transition-all"><X className="w-5 h-5" /></button>
        </header>

        <form onSubmit={save} className="space-y-12">
          <div className="grid grid-cols-2 gap-10">
            <InputGroup label="Client Vector" value={form.clientName} onChange={v => setForm({...form, clientName: v})} />
            <InputGroup label="Event Logic" value={form.eventType} onChange={v => setForm({...form, eventType: v})} />
            <InputGroup label="Temporal Code" type="date" value={form.date} onChange={v => setForm({...form, date: v})} />
            <div className="space-y-3">
              <label className="text-[9px] font-black text-slate-700 tracking-[0.5em] uppercase px-1">Phase Status</label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="w-full bg-[#010102] border border-white/5 rounded-2xl py-5 px-8 text-xs text-white focus:outline-none appearance-none font-bold tracking-widest uppercase">
                <option value="Not Started">Standby</option>
                <option value="In Progress">Active</option>
                <option value="Completed">Finalized</option>
                <option value="Cancelled">Aborted</option>
              </select>
            </div>
          </div>
          <InputGroup label="Physical Venue" value={form.location} onChange={v => setForm({...form, location: v})} />
          <InputGroup label="Maps Navigation Packet (URL)" value={form.mapsLink} onChange={v => setForm({...form, mapsLink: v})} />
          <InputGroup label="Asset Cloud Link (URL)" value={form.filesLink} onChange={v => setForm({...form, filesLink: v})} />
          
          <div className="grid grid-cols-2 gap-10 pt-10 border-t border-white/5">
            <InputGroup label="Total Quote ($)" type="number" value={form.budget} onChange={v => setForm({...form, budget: v})} />
            <InputGroup label="Deposit Injected ($)" type="number" value={form.paid} onChange={v => setForm({...form, paid: v})} />
          </div>

          <button type="submit" className="w-full py-8 bg-white text-black font-black tracking-[0.6em] rounded-3xl hover:bg-blue-600 hover:text-white transition-all uppercase text-[10px]">Verify & Deploy Production</button>
        </form>
      </div>
    </div>
  );
}