import React, { useState, useEffect, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { 
  LayoutDashboard, FolderPlus, Receipt, Menu, X, LogIn, Search, MapPin, 
  Plus, Trash2, Edit3, Link as LinkIcon, FileText, Globe, Wifi, WifiOff,
  ChevronRight, MoreVertical, ExternalLink, Calendar, Users, DollarSign
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, onSnapshot, 
  query, orderBy, updateDoc, doc, deleteDoc 
} from 'firebase/firestore';

// --- INTEGRATED FIREBASE CONFIG ---
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
    <div className="flex h-screen bg-[#020203] text-slate-300 overflow-hidden font-sans">
      <aside className={`relative flex flex-col bg-[#08080a] border-r border-white/5 transition-all duration-500 ease-in-out ${isSidebarCollapsed ? 'w-20' : 'w-72'}`}>
        <div className="p-6 flex items-center justify-between">
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-lg shadow-indigo-500/20 flex items-center justify-center">
                <span className="text-white font-black text-sm">UY</span>
              </div>
              <h1 className="text-lg font-bold tracking-tight text-white">STUDIOS</h1>
            </div>
          )}
          <button onClick={() => setSidebarCollapsed(!isSidebarCollapsed)} className="p-2 hover:bg-white/5 rounded-xl text-slate-500 transition-colors">
            <Menu className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2">
          <NavItem icon={LayoutDashboard} label="Executive" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} collapsed={isSidebarCollapsed} />
          <NavItem icon={FolderPlus} label="Portfolio" active={activeTab === 'projects'} onClick={() => setActiveTab('projects')} collapsed={isSidebarCollapsed} />
          <NavItem icon={Receipt} label="Expenses" active={activeTab === 'expenses'} onClick={() => setActiveTab('expenses')} collapsed={isSidebarCollapsed} />
        </nav>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-gradient-to-b from-[#08080a] to-[#020203]">
        <header className="h-20 flex items-center justify-between px-8 border-b border-white/5 backdrop-blur-xl bg-black/20">
          <div className="flex-1 flex items-center gap-6">
            <div className="relative w-full max-w-md group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
              <input 
                type="text" 
                placeholder="Search production database..." 
                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all placeholder:text-slate-600"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all ${isOnline ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
              {isOnline ? 'Cloud Sync Online' : 'Local Mode'}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {activeTab === 'dashboard' && <DashboardView projects={projects} expenses={expenses} />}
          {activeTab === 'projects' && <ProjectsView projects={filteredProjects} />}
          {activeTab === 'expenses' && <ExpensesView expenses={expenses} />}
        </div>
      </main>
    </div>
  );
}

// --- VIEW COMPONENTS ---

function DashboardView({ projects, expenses }) {
  const totalRev = projects.reduce((s, p) => s + (Number(p.paid) || 0), 0);
  const totalDebt = projects.reduce((s, p) => s + (Number(p.budget) - Number(p.paid)), 0);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-center">
        <MetricCard label="Lifetime Revenue" value={`$${totalRev.toLocaleString()}`} accent="indigo" />
        <MetricCard label="Receivables" value={`$${totalDebt.toLocaleString()}`} accent="amber" />
        <MetricCard label="Project Yield" value="72.4%" accent="emerald" />
        <MetricCard label="Active Shoots" value={projects.filter(p => p.status === 'In Progress').length} accent="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-10">
          <div className="flex justify-between items-center mb-10">
            <h3 className="text-xl font-bold text-white tracking-tight">Revenue Trends</h3>
            <div className="flex gap-2">
              <span className="w-3 h-3 bg-indigo-500 rounded-full" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Live Firestore Stream</span>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={projects.slice(0, 12).reverse()}>
                <defs>
                  <linearGradient id="colorPaid" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" hide />
                <YAxis hide />
                <Tooltip contentStyle={{backgroundColor: '#08080a', border: '1px solid #ffffff10', borderRadius: '16px'}} />
                <Area type="monotone" dataKey="paid" stroke="#6366f1" fillOpacity={1} fill="url(#colorPaid)" strokeWidth={4} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-900 rounded-[2.5rem] p-10 flex flex-col justify-between text-white shadow-2xl shadow-indigo-500/20">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-[0.2em] opacity-70 mb-2">Net Cash Liquidity</h4>
            <p className="text-6xl font-black italic tracking-tighter">${(totalRev - 1200).toLocaleString()}</p>
          </div>
          <div className="space-y-6">
            <div className="flex justify-between text-sm font-bold border-b border-white/10 pb-3">
              <span className="opacity-60 uppercase">OpEx Estimate</span>
              <span className="text-indigo-200">-$1,200.00</span>
            </div>
            <p className="text-[10px] leading-relaxed opacity-50 font-medium">Enterprise data sync active. Assets are linked via provided Google Drive and Maps integrations.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectsView({ projects }) {
  const [showModal, setShowModal] = useState(false);
  const [editData, setEditData] = useState(null);

  return (
    <div className="space-y-10">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-4xl font-black text-white tracking-tighter uppercase italic">Portfolio</h2>
          <p className="text-slate-500 text-sm font-medium mt-1 uppercase tracking-widest opacity-60">System Catalog / {projects.length} Entries</p>
        </div>
        <button 
          onClick={() => { setEditData(null); setShowModal(true); }}
          className="bg-white text-black px-10 py-5 rounded-2xl font-black text-xs tracking-widest hover:bg-indigo-500 hover:text-white transition-all transform hover:-translate-y-1 shadow-2xl shadow-white/5 active:scale-95"
        >
          NEW PRODUCTION +
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {projects.map(p => (
          <div key={p.id} className="group bg-[#0a0a0c] border border-white/5 p-8 rounded-[2.5rem] hover:bg-[#0e0e12] transition-all duration-500 hover:border-white/20 relative">
            <div className="flex justify-between items-start mb-8">
              <div className="space-y-2">
                <StatusBadge status={p.status} />
                <h3 className="text-2xl font-bold text-white group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{p.clientName}</h3>
                <div className="flex items-center gap-3 text-xs font-bold text-slate-500 uppercase tracking-widest">
                  <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {p.date}</span>
                  <span className="w-1 h-1 bg-slate-800 rounded-full" />
                  <span>{p.eventType}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditData(p); setShowModal(true); }} className="p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"><Edit3 className="w-4 h-4 text-white" /></button>
                <button onClick={() => deleteDoc(doc(db, 'projects', p.id))} className="p-3 bg-red-500/10 rounded-xl hover:bg-red-500/20 transition-colors"><Trash2 className="w-4 h-4 text-red-500" /></button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <a href={p.mapsLink} target="_blank" rel="noreferrer" className="flex items-center gap-4 p-5 bg-white/[0.02] rounded-3xl border border-white/5 hover:border-indigo-500/40 transition-all group/link">
                <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-400 group-hover/link:bg-indigo-500 group-hover/link:text-white transition-all"><MapPin className="w-5 h-5" /></div>
                <div className="truncate">
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-1">Live Location</p>
                  <p className="text-xs text-slate-300 truncate font-medium">{p.location || 'Launch Maps'}</p>
                </div>
              </a>
              <a href={p.filesLink} target="_blank" rel="noreferrer" className="flex items-center gap-4 p-5 bg-white/[0.02] rounded-3xl border border-white/5 hover:border-emerald-500/40 transition-all group/link">
                <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-400 group-hover/link:bg-emerald-500 group-hover/link:text-white transition-all"><FileText className="w-5 h-5" /></div>
                <div className="truncate">
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-1">Production Assets</p>
                  <p className="text-xs text-slate-300 truncate font-medium">Link Established</p>
                </div>
              </a>
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-white/5">
              <div className="flex -space-x-3">
                {p.teamMembers?.map((t, i) => (
                  <div key={i} className="w-11 h-11 rounded-full bg-indigo-600 border-[5px] border-[#0a0a0c] flex items-center justify-center text-[10px] font-black text-white shadow-xl" title={t.name}>{t.name.charAt(0)}</div>
                ))}
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Fund Allocation</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-mono font-bold text-white tracking-tighter">${p.paid}</span>
                  <span className="text-xs font-bold text-slate-600">/ ${p.budget}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && <ProjectModal project={editData} onClose={() => setShowModal(false)} />}
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

  const addMember = () => setForm({...form, teamMembers: [...form.teamMembers, { name: '', role: '', cost: 0 }]});

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
      <div className="bg-[#08080a] border border-white/10 w-full max-w-3xl rounded-[3.5rem] p-12 overflow-y-auto max-h-[90vh] shadow-2xl custom-scrollbar">
        <header className="flex justify-between items-center mb-12">
          <div>
            <h3 className="text-3xl font-black text-white tracking-tighter italic">LOG PRODUCTION</h3>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Establishing Secure Firestore Entry</p>
          </div>
          <button onClick={onClose} className="p-4 bg-white/5 rounded-full hover:bg-white/10 transition-colors"><X className="w-6 h-6" /></button>
        </header>

        <form onSubmit={save} className="space-y-10">
          <div className="grid grid-cols-2 gap-8">
            <InputGroup label="Client Identity" value={form.clientName} onChange={v => setForm({...form, clientName: v})} placeholder="Legal Name" />
            <InputGroup label="Event Logic" value={form.eventType} onChange={v => setForm({...form, eventType: v})} placeholder="Wedding / Commercial" />
            <InputGroup label="Timestamp" type="date" value={form.date} onChange={v => setForm({...form, date: v})} />
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Phase Status</label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 px-6 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none">
                <option value="Not Started">Not Started</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="space-y-6 pt-6 border-t border-white/5">
            <h4 className="text-xs font-black text-indigo-400 uppercase tracking-[0.2em] flex items-center gap-3">
              <MapPin className="w-4 h-4" /> Logistics Intelligence
            </h4>
            <div className="space-y-4">
              <InputGroup label="Studio / Venue Location" value={form.location} onChange={v => setForm({...form, location: v})} />
              <InputGroup label="Google Maps Navigation Link" value={form.mapsLink} onChange={v => setForm({...form, mapsLink: v})} placeholder="https://goo.gl/maps/..." />
              <InputGroup label="Cloud Deliverables / Raw Files" value={form.filesLink} onChange={v => setForm({...form, filesLink: v})} placeholder="Drive / Frame.io Link" />
            </div>
          </div>

          <div className="space-y-6 pt-6 border-t border-white/5">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-black text-purple-400 uppercase tracking-[0.2em] flex items-center gap-3">
                <Users className="w-4 h-4" /> Production Crew
              </h4>
              <button type="button" onClick={addMember} className="text-[10px] font-black text-white bg-white/5 px-4 py-2 rounded-lg hover:bg-white/10">+ Add Member</button>
            </div>
            {form.teamMembers.map((m, i) => (
              <div key={i} className="flex gap-4 bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                <input placeholder="Name" value={m.name} onChange={e => {
                  const updated = [...form.teamMembers]; updated[i].name = e.target.value; setForm({...form, teamMembers: updated});
                }} className="bg-transparent border-none text-sm w-full focus:ring-0" />
                <input placeholder="Role" value={m.role} onChange={e => {
                  const updated = [...form.teamMembers]; updated[i].role = e.target.value; setForm({...form, teamMembers: updated});
                }} className="bg-transparent border-none text-sm w-full focus:ring-0 opacity-60" />
                <div className="flex items-center bg-black/40 px-3 rounded-xl border border-white/5">
                  <span className="text-[10px] text-slate-600 mr-2 font-bold">$</span>
                  <input type="number" placeholder="Cost" value={m.cost} onChange={e => {
                    const updated = [...form.teamMembers]; updated[i].cost = e.target.value; setForm({...form, teamMembers: updated});
                  }} className="bg-transparent border-none text-sm w-20 focus:ring-0 font-mono" />
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-8 pt-8 border-t border-white/5">
            <InputGroup label="Contract Quote ($)" type="number" value={form.budget} onChange={v => setForm({...form, budget: v})} />
            <InputGroup label="Initial Deposit ($)" type="number" value={form.paid} onChange={v => setForm({...form, paid: v})} />
          </div>

          <div className="flex gap-4 pt-4">
            <button type="submit" className="flex-1 bg-white text-black py-6 rounded-[2rem] font-black tracking-[0.3em] hover:bg-indigo-500 hover:text-white transition-all shadow-2xl shadow-indigo-500/10 uppercase">Verify & Deploy</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- SHARED UI ---

const NavItem = ({ icon: Icon, label, active, onClick, collapsed }) => (
  <button 
    onClick={onClick} 
    className={`w-full flex items-center px-5 py-5 rounded-2xl transition-all duration-300 ${active ? 'bg-indigo-600 text-white shadow-2xl shadow-indigo-600/30' : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-300'}`}
  >
    <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'animate-pulse' : ''}`} />
    {!collapsed && <span className="ml-4 font-bold text-xs uppercase tracking-widest leading-none pt-0.5">{label}</span>}
  </button>
);

const MetricCard = ({ label, value, accent }) => {
  const themes = {
    indigo: 'text-indigo-400 border-indigo-400/10 bg-indigo-400/5 shadow-[inset_0_0_20px_rgba(99,102,241,0.05)]',
    amber: 'text-amber-400 border-amber-400/10 bg-amber-400/5',
    emerald: 'text-emerald-400 border-emerald-400/10 bg-emerald-400/5',
    purple: 'text-purple-400 border-purple-400/10 bg-purple-400/5'
  };
  return (
    <div className={`p-8 rounded-[2.5rem] border ${themes[accent]} flex flex-col justify-between h-44 transition-transform hover:scale-[1.02]`}>
      <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-50">{label}</span>
      <span className="text-5xl font-black italic tracking-tighter">{value}</span>
    </div>
  );
};

const InputGroup = ({ label, type = "text", value, onChange, placeholder }) => (
  <div className="space-y-3">
    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">{label}</label>
    <input 
      type={type} 
      value={value} 
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)} 
      className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-5 px-8 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-700 font-medium shadow-inner"
    />
  </div>
);

const StatusBadge = ({ status }) => {
  const styles = {
    'Completed': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    'In Progress': 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    'Not Started': 'bg-white/5 text-slate-500 border-white/10',
    'Cancelled': 'bg-red-500/10 text-red-500 border-red-500/20'
  };
  return <span className={`inline-block text-[9px] font-black uppercase tracking-[0.15em] px-3 py-1.5 rounded-lg border ${styles[status]}`}>{status}</span>;
};

// --- FIXED LOGIN COMPONENT ---
const Login = ({ onLogin }) => {
  const [val, setVal] = useState('');
  const [error, setError] = useState(false);
  
  const check = (e) => {
    // This prevents the page from refreshing when you hit Enter
    if (e) e.preventDefault(); 
    
    if(val === 'uy2026') {
      onLogin();
    } else { 
      setError(true); 
      setTimeout(() => setError(false), 500); 
    }
  };

  return (
    <div className="h-screen bg-[#020203] flex items-center justify-center p-6">
      {/* Changing the div to a form automatically enables the Enter key */}
      <form 
        onSubmit={check} 
        className={`w-full max-w-md p-16 bg-[#08080a] border border-white/5 rounded-[4rem] shadow-[0_50px_100px_rgba(0,0,0,0.5)] text-center transition-all ${error ? 'border-red-500/50' : ''}`}
      >
        <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-3xl mx-auto mb-10 flex items-center justify-center shadow-2xl shadow-indigo-500/20">
          <Globe className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl font-black text-white tracking-tighter mb-2 uppercase italic">UY Studios</h1>
        <p className="text-slate-600 text-xs font-black uppercase tracking-[0.3em] mb-12">Authorized Access Only</p>
        
        <input 
          type="password" 
          placeholder="SECURE CODE"
          autoFocus
          onChange={e => setVal(e.target.value)}
          className="w-full bg-white/[0.03] border border-white/10 rounded-3xl py-6 px-8 text-center text-white tracking-[1em] focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-8 font-mono text-xl"
        />
        
        <button 
          type="submit" 
          className="w-full bg-white text-black py-6 rounded-3xl font-black tracking-[0.3em] hover:bg-indigo-600 hover:text-white transition-all uppercase text-sm"
        >
          Initialize System
        </button>
      </form>
    </div>
  );
};