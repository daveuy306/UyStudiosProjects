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

  // Real-time Connection Monitoring
  useEffect(() => {
    window.addEventListener('online', () => setIsOnline(true));
    window.addEventListener('offline', () => setIsOnline(false));
    return () => {
      window.removeEventListener('online', () => setIsOnline(true));
      window.removeEventListener('offline', () => setIsOnline(false));
    };
  }, []);

  // Firestore Sync
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
      {/* COLLAPSIBLE LEFT SIDEBAR */}
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

      {/* MAIN CONTROL PANEL */}
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
            <div className="flex justify-between text-sm font-bold border-b border-white/10 pb-3