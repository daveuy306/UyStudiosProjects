import React, { useState, useEffect, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { 
  LayoutDashboard, FolderPlus, Receipt, Menu, X, LogIn, Search,
  MapPin, Plus, Trash2, Edit3, DollarSign, Users, Briefcase, ExternalLink
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, onSnapshot, 
  query, orderBy, updateDoc, doc, deleteDoc 
} from 'firebase/firestore';

// --- FIREBASE CONFIG ---
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
  const [projects, setProjects] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

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
    <div className="flex h-screen bg-[#050505] text-slate-300 font-sans">
      {/* Sidebar */}
      <aside className={`${isSidebarCollapsed ? 'w-20' : 'w-72'} hidden md:flex flex-col bg-[#0a0a0a] border-r border-white/5 p-6 transition-all`}>
        <div className="flex items-center gap-3 mb-12">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-white">UY</div>
          {!isSidebarCollapsed && <h1 className="text-xl font-bold tracking-tighter text-white">UY STUDIOS</h1>}
        </div>
        <nav className="space-y-2">
          <NavItem icon={LayoutDashboard} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} collapsed={isSidebarCollapsed} />
          <NavItem icon={FolderPlus} label="Projects" active={activeTab === 'projects'} onClick={() => setActiveTab('projects')} collapsed={isSidebarCollapsed} />
          <NavItem icon={Receipt} label="Expenses" active={activeTab === 'expenses'} onClick={() => setActiveTab('expenses')} collapsed={isSidebarCollapsed} />
        </nav>
      </aside>

      {/* Main Container */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-[#050505]/80 backdrop-blur-md">
          <div className="relative w-96">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search clients or events..." 
              className="w-full bg-white/5 border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button onClick={() => setSidebarCollapsed(!isSidebarCollapsed)} className="p-2 hover:bg-white/5 rounded-lg">
            <Menu className="w-5 h-5" />
          </button>
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

// --- VIEWS ---

function DashboardView({ projects, expenses }) {
  const totalRev = projects.reduce((s, p) => s + (Number(p.paid) || 0), 0);
  const totalCost = projects.reduce((s, p) => {
    const teamCost = p.teamMembers?.reduce((ts, t) => ts + (Number(t.cost) || 0), 0) || 0;
    return s + teamCost;
  }, 0) + expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard label="Revenue" value={`$${totalRev.toLocaleString()}`} trend="+12%" color="text-emerald-400" />
        <MetricCard label="Operating Costs" value={`$${totalCost.toLocaleString()}`} trend="+5%" color="text-red-400" />
        <MetricCard label="Net Profit" value={`$${(totalRev - totalCost).toLocaleString()}`} trend="+18%" color="text-indigo-400" />
        <MetricCard label="Client Debt" value={`$${projects.reduce((s, p) => s + (Number(p.budget) - Number(p.paid)), 0).toLocaleString()}`} color="text-amber-400" />
      </div>

      <div className="bg-[#0a0a0a] p-8 rounded-3xl border border-white/5">
        <h3 className="text-lg font-bold mb-8 flex items-center gap-2">
          <div className="w-1 h-6 bg-indigo-500 rounded-full"></div> Financial Performance
        </h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={[] /* Mock aggregate logic here */}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
              <XAxis dataKey="name" stroke="#475569" fontSize={12} tickLine={false} />
              <YAxis stroke="#475569" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{backgroundColor: '#0a0a0a', borderColor: '#ffffff10', borderRadius: '12px'}} />
              <Area type="monotone" dataKey="revenue" stroke="#6366f1" fillOpacity={1} fill="url(#colorRev)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function ProjectsView({ projects }) {
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white tracking-tight">Project Portfolio</h2>
        <button onClick={() => { setEditingProject(null); setShowModal(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-full font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all">
          <Plus className="w-4 h-4" /> New Commission
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {projects.map(p => (
          <div key={p.id} className="group bg-[#0a0a0a] border border-white/5 p-6 rounded-3xl hover:border-indigo-500/30 transition-all relative overflow-hidden">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors">{p.clientName}</h3>
                <p className="text-sm text-slate-500">{p.eventType} • {p.date}</p>
              </div>
              <StatusBadge status={p.status} />
            </div>
            
            <div className="flex items-center gap-4 mb-6 text-sm text-slate-400">
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {p.location}</span>
              <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {p.teamMembers?.length || 0} Members</span>
            </div>

            <div className="flex items-end justify-between pt-4 border-t border-white/5">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Payment Status</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-mono text-white">${p.paid}</span>
                  <span className="text-xs text-slate-500">/ ${p.budget}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditingProject(p); setShowModal(true); }} className="p-2 hover:bg-white/5 rounded-xl"><Edit3 className="w-4 h-4" /></button>
                <button onClick={() => deleteDoc(doc(db, 'projects', p.id))} className="p-2 hover:bg-red-500/10 text-red-500 rounded-xl"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && <ProjectModal project={editingProject} onClose={() => setShowModal(false)} />}
    </div>
  );
}

function ProjectModal({ project, onClose }) {
  const [form, setForm] = useState(project || {
    clientName: '', eventType: '', date: '', location: '', budget: 0, paid: 0, status: 'Not Started',
    teamMembers: []
  });

  const addTeamMember = () => {
    setForm({...form, teamMembers: [...form.teamMembers, { name: '', role: '', cost: 0 }]});
  };

  const updateTeamMember = (index, field, value) => {
    const updated = [...form.teamMembers];
    updated[index][field] = value;
    setForm({...form, teamMembers: updated});
  };

  const save = async (e) => {
    e.preventDefault();
    project ? await updateDoc(doc(db, 'projects', project.id), form) : await addDoc(collection(db, 'projects'), form);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-[#0f0f0f] border border-white/10 w-full max-w-2xl rounded-3xl p-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <h3 className="text-xl font-bold text-white mb-8">Project Details</h3>
        <form onSubmit={save} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Client Name</label>
              <input value={form.clientName} onChange={e => setForm({...form, clientName: e.target.value})} className="modal-input" required />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Event Type</label>
              <input value={form.eventType} onChange={e => setForm({...form, eventType: e.target.value})} className="modal-input" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="modal-input" />
            <input placeholder="Budget" type="number" value={form.budget} onChange={e => setForm({...form, budget: e.target.value})} className="modal-input" />
            <input placeholder="Paid" type="number" value={form.paid} onChange={e => setForm({...form, paid: e.target.value})} className="modal-input" />
          </div>

          <div className="pt-6 border-t border-white/5">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-sm font-bold text-white flex items-center gap-2"><Users className="w-4 h-4 text-indigo-400" /> Team Production</h4>
              <button type="button" onClick={addTeamMember} className="text-xs text-indigo-400 hover:text-indigo-300 font-bold">+ Add Member</button>
            </div>
            <div className="space-y-3">
              {form.teamMembers.map((m, i) => (
                <div key={i} className="flex gap-2 bg-white/5 p-3 rounded-2xl items-center">
                  <input placeholder="Name" value={m.name} onChange={e => updateTeamMember(i, 'name', e.target.value)} className="bg-transparent border-none text-sm w-full focus:ring-0" />
                  <input placeholder="Role" value={m.role} onChange={e => updateTeamMember(i, 'role', e.target.value)} className="bg-transparent border-none text-sm w-full focus:ring-0" />
                  <div className="flex items-center bg-black/40 rounded-lg px-2">
                    <span className="text-slate-500 text-xs">$</span>
                    <input type="number" placeholder="Cost" value={m.cost} onChange={e => updateTeamMember(i, 'cost', e.target.value)} className="bg-transparent border-none text-sm w-20 focus:ring-0" />
                  </div>
                  <button onClick={() => {
                    const filtered = form.teamMembers.filter((_, idx) => idx !== i);
                    setForm({...form, teamMembers: filtered});
                  }} className="text-red-500 p-1"><X className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-6">
            <button type="submit" className="flex-1 bg-indigo-600 py-3 rounded-2xl font-bold text-white shadow-lg shadow-indigo-500/20">Establish Project</button>
            <button type="button" onClick={onClose} className="px-8 py-3 bg-white/5 rounded-2xl font-bold">Discard</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- SHARED UI ---
const NavItem = ({ icon: Icon, label, active, onClick, collapsed }) => (
  <button onClick={onClick} className={`w-full flex items-center p-4 rounded-2xl transition-all ${active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/20' : 'text-slate-500 hover:bg-white/5 hover:text-slate-200'}`}>
    <Icon className="w-5 h-5 flex-shrink-0" />
    {!collapsed && <span className="ml-4 font-bold text-sm tracking-tight">{label}</span>}
  </button>
);

const MetricCard = ({ label, value, trend, color }) => (
  <div className="bg-[#0a0a0a] p-6 rounded-3xl border border-white/5">
    <p className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-500 mb-2">{label}</p>
    <div className="flex items-baseline gap-3">
      <h4 className={`text-2xl font-mono font-bold ${color}`}>{value}</h4>
      {trend && <span className="text-[10px] text-emerald-500 font-bold">{trend}</span>}
    </div>
  </div>
);

const StatusBadge = ({ status }) => {
  const colors = {
    'Completed': 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    'In Progress': 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20',
    'Not Started': 'text-slate-400 bg-slate-400/10 border-slate-400/20'
  };
  return <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border ${colors[status] || colors['Not Started']}`}>{status}</span>;
}

const Login = ({ onLogin }) => {
  const [val, setVal] = useState('');
  return (
    <div className="h-screen bg-black flex items-center justify-center">
      <div className="w-full max-w-sm p-12 bg-[#0a0a0a] rounded-[40px] border border-white/5 text-center">
        <h1 className="text-3xl font-black text-white mb-2 tracking-tighter">UY STUDIOS</h1>
        <p className="text-slate-500 text-sm mb-10 italic">Access the Vault</p>
        <input 
          type="password" 
          onChange={e => setVal(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 mb-4 text-center tracking-[1em] focus:outline-none focus:ring-2 focus:ring-indigo-500" 
        />
        <button onClick={() => val === 'UY2024' && onLogin()} className="w-full bg-indigo-600 py-4 rounded-2xl font-bold text-white shadow-lg shadow-indigo-500/40 hover:scale-[1.02] transition-transform">Initialize</button>
      </div>
    </div>
  );
}