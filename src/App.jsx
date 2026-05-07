import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Edit2, Trash2, X, MapPin, LayoutDashboard, 
  Briefcase, BarChart3, Film, CheckCircle2, Wallet, 
  TrendingUp, Users, Calendar, Link as LinkIcon, 
  FileText, DollarSign, ChevronRight, Menu, UserPlus, MinusCircle,
  ExternalLink, Github, Code
} from 'lucide-react';
import { 
  XAxis, YAxis, Tooltip, ResponsiveContainer, 
  AreaChart, Area
} from 'recharts';

// Firebase Imports
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, onSnapshot, addDoc, 
  updateDoc, deleteDoc, doc
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

/**
 * CACHE BUSTER VERSION: 1.0.4 - Force Update
 * This version uses HARDCODED credentials to bypass any environment variable 
 * issues that were causing the "YOUR_API_KEY" error.
 */
const firebaseConfig = {
  apiKey: "AIzaSyAiSo4QbPqEOX-bTvbE7BjHtOY78_fTHpY",
  authDomain: "uystudiosprojectdatabase.firebaseapp.com",
  projectId: "uystudiosprojectdatabase",
  storageBucket: "uystudiosprojectdatabase.firebasestorage.app",
  messagingSenderId: "167809203911",
  appId: "1:167809203911:web:9b72b71460cfd92ab8c8e2",
  measurementId: "G-8R4PKT6WM4"
};

// Initialize services immediately
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Use a fixed path for project data
const APP_ID = 'uystudios-prod';
const COLLECTION_PATH = ['artifacts', APP_ID, 'public', 'data', 'projects'];
const STATUS_OPTIONS = ['Completed', 'In Progress', 'Pending', 'Cancelled'];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [projects, setProjects] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [payrollMembers, setPayrollMembers] = useState([]);

  // Auth Effect - Fixed initialization logic
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Force anonymous sign in to ensure we have a valid token for Firestore
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Firebase Auth Error:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // Firestore Real-time Sync
  useEffect(() => {
    if (!user) return;
    
    setLoading(true);
    const colRef = collection(db, ...COLLECTION_PATH);
    
    const unsubscribe = onSnapshot(colRef, 
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        setProjects(data);
        setLoading(false);
      }, 
      (err) => {
        console.error("Firestore Permission/Path Error:", err);
        setLoading(false);
      }
    );
    
    return () => unsubscribe();
  }, [user]);

  // Calculations for Dashboard
  const stats = useMemo(() => {
    const totalRevenue = projects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
    const totalPayroll = projects.reduce((sum, p) => {
      const pSum = (p.payrollMembers || []).reduce((mSum, m) => mSum + (Number(m.rate) || 0), 0);
      return sum + pSum;
    }, 0);

    const netProfit = totalRevenue - totalPayroll;
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    // Grouping for chart
    const trendsObj = {};
    projects.forEach(p => {
      if (!p.date) return;
      const d = new Date(p.date);
      const m = monthNames[d.getMonth()];
      if (!trendsObj[m]) trendsObj[m] = { name: m, revenue: 0, payroll: 0 };
      trendsObj[m].revenue += (Number(p.budget) || 0);
      trendsObj[m].payroll += (p.payrollMembers || []).reduce((s, mem) => s + (Number(mem.rate) || 0), 0);
    });

    const incomeChartData = monthNames
      .map(m => trendsObj[m] || { name: m, revenue: 0, payroll: 0 })
      .filter((_, i) => i <= new Date().getMonth());

    const statusData = STATUS_OPTIONS.map(status => ({
      name: status,
      value: projects.filter(p => p.status === status).length
    }));

    return { totalRevenue, totalPayroll, netProfit, incomeChartData, statusData };
  }, [projects]);

  const filteredProjects = useMemo(() => {
    return projects.filter(p => 
      (p.client?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (p.event?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    ).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [projects, searchTerm]);

  const handleOpenModal = (proj = null) => {
    setEditingProject(proj);
    setPayrollMembers(proj?.payrollMembers || []);
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user) return;
    
    const fd = new FormData(e.target);
    const data = {
      client: fd.get('client'),
      event: fd.get('event'),
      location: fd.get('location'),
      locationUrl: fd.get('locationUrl'),
      date: fd.get('date'),
      budget: Number(fd.get('budget')),
      status: fd.get('status'),
      payrollMembers: payrollMembers,
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingProject) {
        await updateDoc(doc(db, ...COLLECTION_PATH, editingProject.id), data);
      } else {
        await addDoc(collection(db, ...COLLECTION_PATH), { ...data, createdAt: new Date().toISOString() });
      }
      setIsModalOpen(false);
    } catch (err) { 
      console.error("Save failed:", err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this record?")) return;
    try {
      await deleteDoc(doc(db, ...COLLECTION_PATH, id));
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="animate-spin text-indigo-500"><BarChart3 size={40}/></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 flex flex-col md:flex-row font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-[#0F172A] border-r border-white/5 flex flex-col h-screen sticky top-0 hidden md:flex">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
              <Film size={20} />
            </div>
            <h1 className="text-lg font-black tracking-tighter uppercase text-white">UY Studios</h1>
          </div>
          <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest px-1">v1.0.4 PROD</div>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          <SidebarLink icon={<LayoutDashboard size={18}/>} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarLink icon={<Briefcase size={18}/>} label="Productions" active={activeTab === 'projects'} onClick={() => setActiveTab('projects')} />
        </nav>
      </aside>

      {/* Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-20 border-b border-white/5 px-8 items-center justify-between bg-[#020617]/50 backdrop-blur-md hidden md:flex">
          <div className="relative w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
            <input 
              type="text" 
              placeholder="Search by client or event..." 
              className="bg-white/5 border border-white/5 rounded-2xl px-11 py-2 text-xs w-full outline-none focus:border-indigo-500/50"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <button onClick={() => handleOpenModal()} className="bg-indigo-600 text-white px-6 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 hover:bg-indigo-500 transition-colors">
            <Plus size={16} /> CREATE PRODUCTION
          </button>
        </header>

        <main className="p-4 md:p-8 space-y-8 pb-24 md:pb-8">
          {activeTab === 'dashboard' && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Pipeline" value={`$${stats.totalRevenue.toLocaleString()}`} color="indigo" icon={<TrendingUp size={16}/>} />
                <StatCard label="Cost" value={`$${stats.totalPayroll.toLocaleString()}`} color="rose" icon={<Users size={16}/>} />
                <StatCard label="Net Profit" value={`$${stats.netProfit.toLocaleString()}`} color="emerald" icon={<CheckCircle2 size={16}/>} />
                <StatCard label="Active" value={stats.statusData.find(d => d.name === 'In Progress')?.value || 0} color="amber" icon={<Calendar size={16}/>} />
              </div>

              <div className="bg-[#0F172A] p-6 rounded-[2rem] border border-white/5">
                <h3 className="text-[10px] font-black uppercase text-slate-500 mb-6 tracking-widest">Financial Performance</h3>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.incomeChartData}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{background: '#0F172A', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px'}} />
                      <Area type="monotone" dataKey="revenue" stroke="#6366f1" fillOpacity={1} fill="url(#colorRev)" strokeWidth={3} />
                      <Area type="monotone" dataKey="payroll" stroke="#f43f5e" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          {activeTab === 'projects' && (
            <div className="bg-[#0F172A] rounded-[2rem] border border-white/5 overflow-hidden">
              <div className="p-6 border-b border-white/5 flex justify-between items-center">
                <h3 className="text-xs font-black uppercase text-slate-400">Production Log</h3>
                <div className="md:hidden">
                   <button onClick={() => handleOpenModal()} className="p-2 bg-indigo-600 rounded-full text-white"><Plus size={16}/></button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] uppercase font-black tracking-widest text-slate-500 border-b border-white/5">
                      <th className="px-6 py-4">Client / Event</th>
                      <th className="px-6 py-4">Location</th>
                      <th className="px-6 py-4">Crew Size</th>
                      <th className="px-6 py-4">Revenue</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredProjects.length === 0 ? (
                      <tr><td colSpan="6" className="p-10 text-center text-slate-600 text-xs italic">No productions found.</td></tr>
                    ) : filteredProjects.map(p => (
                      <tr key={p.id} className="hover:bg-white/[0.02] group">
                        <td className="px-6 py-5">
                          <div className="text-sm font-bold text-white">{p.client}</div>
                          <div className="text-[10px] text-slate-500 font-medium">{p.event} • {p.date}</div>
                        </td>
                        <td className="px-6 py-5">
                          {p.locationUrl ? (
                            <a href={p.locationUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[11px] text-indigo-400 hover:text-indigo-300">
                              <MapPin size={12} />
                              <span className="underline decoration-indigo-500/30 truncate max-w-[100px]">{p.location || 'Link'}</span>
                            </a>
                          ) : <span className="text-[11px] text-slate-600 italic">No link</span>}
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-xs text-slate-400 bg-white/5 px-2 py-1 rounded-lg">
                            {p.payrollMembers?.length || 0} crew
                          </span>
                        </td>
                        <td className="px-6 py-5 font-bold text-white text-xs">
                          ${(Number(p.budget) || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-5">
                          <StatusBadge status={p.status} />
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleOpenModal(p)} className="p-2 text-slate-500 hover:text-indigo-400"><Edit2 size={14}/></button>
                            <button onClick={() => handleDelete(p.id)} className="p-2 text-slate-500 hover:text-rose-400"><Trash2 size={14}/></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Mobile Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#0F172A] border-t border-white/5 flex items-center justify-around z-50">
        <button onClick={() => setActiveTab('dashboard')} className={activeTab === 'dashboard' ? 'text-indigo-500' : 'text-slate-500'}><LayoutDashboard size={20} /></button>
        <button onClick={() => setActiveTab('projects')} className={activeTab === 'projects' ? 'text-indigo-500' : 'text-slate-500'}><Briefcase size={20} /></button>
      </nav>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-[#0F172A] border border-white/10 w-full max-w-2xl rounded-[2.5rem] p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-black text-white uppercase">{editingProject ? 'Edit' : 'New'} Production</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-500 hover:text-white"><X /></button>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <FormInput label="Client Name" name="client" defaultValue={editingProject?.client} required />
                <FormInput label="Event" name="event" defaultValue={editingProject?.event} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormInput label="Location Name" name="location" defaultValue={editingProject?.location} />
                <FormInput label="Maps URL" name="locationUrl" defaultValue={editingProject?.locationUrl} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormInput label="Date" name="date" type="date" defaultValue={editingProject?.date} required />
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Status</label>
                  <select name="status" defaultValue={editingProject?.status || 'Pending'} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:border-indigo-500 outline-none">
                    {STATUS_OPTIONS.map(s => <option key={s} value={s} className="bg-[#0F172A]">{s}</option>)}
                  </select>
                </div>
              </div>
              <FormInput label="Total Revenue ($)" name="budget" type="number" defaultValue={editingProject?.budget} />
              
              <div className="pt-4 border-t border-white/5 space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Crew Payroll</label>
                  <button type="button" onClick={() => setPayrollMembers([...payrollMembers, { id: Date.now(), name: '', role: '', rate: '', paid: false }])} className="text-[10px] font-black text-indigo-400 flex items-center gap-1 uppercase">
                    <UserPlus size={14}/> Add Staff
                  </button>
                </div>
                {payrollMembers.map((member) => (
                  <div key={member.id} className="flex gap-2 bg-white/5 p-3 rounded-2xl items-center border border-white/5">
                    <input placeholder="Staff Name" className="flex-1 bg-transparent text-xs text-white outline-none" value={member.name} onChange={(e) => setPayrollMembers(payrollMembers.map(m => m.id === member.id ? { ...m, name: e.target.value } : m))} />
                    <input placeholder="Rate ($)" type="number" className="w-20 bg-transparent text-xs text-rose-400 outline-none font-bold text-right" value={member.rate} onChange={(e) => setPayrollMembers(payrollMembers.map(m => m.id === member.id ? { ...m, rate: e.target.value } : m))} />
                    <button type="button" onClick={() => setPayrollMembers(payrollMembers.filter(m => m.id !== member.id))} className="text-rose-500/50 hover:text-rose-500 transition-colors"><MinusCircle size={16}/></button>
                  </div>
                ))}
              </div>

              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs transition-all shadow-xl shadow-indigo-500/10">
                Confirm & Sync
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SidebarLink({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black transition-all ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:bg-white/5'}`}>
      {icon} <span className="uppercase tracking-widest">{label}</span>
    </button>
  );
}

function StatCard({ label, value, color, icon }) {
  const themes = {
    indigo: 'text-indigo-400 bg-indigo-400/5 border-indigo-500/10',
    rose: 'text-rose-400 bg-rose-400/5 border-rose-500/10',
    emerald: 'text-emerald-400 bg-emerald-400/5 border-emerald-500/10',
    amber: 'text-amber-400 bg-amber-400/5 border-amber-500/10'
  };
  return (
    <div className={`p-5 rounded-3xl border ${themes[color]}`}>
      <div className="flex justify-between items-center mb-1 text-[9px] font-black uppercase text-slate-500 tracking-widest">
        {label} <span>{icon}</span>
      </div>
      <div className="text-xl font-black text-white tracking-tight">{value}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    'Completed': 'bg-emerald-400/10 text-emerald-400 border-emerald-500/20',
    'In Progress': 'bg-amber-400/10 text-amber-400 border-amber-500/20',
    'Pending': 'bg-slate-400/10 text-slate-400 border-slate-500/20',
    'Cancelled': 'bg-rose-400/10 text-rose-400 border-rose-500/20'
  };
  return <span className={`text-[9px] font-black px-2 py-1 rounded-md uppercase border ${styles[status]}`}>{status}</span>;
}

function FormInput({ label, ...props }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">{label}</label>
      <input {...props} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:border-indigo-500 outline-none transition-colors" />
    </div>
  );
}