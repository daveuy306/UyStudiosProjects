import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Edit2, Trash2, X, MapPin, LayoutDashboard, 
  Briefcase, BarChart3, Film, CheckCircle2, 
  TrendingUp, Users, Calendar, 
  UserPlus, MinusCircle, Database
} from 'lucide-react';
import { 
  XAxis, YAxis, Tooltip, ResponsiveContainer, 
  AreaChart, Area
} from 'recharts';

// Firebase Imports
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, onSnapshot, addDoc, 
  updateDoc, deleteDoc, doc, writeBatch
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

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
const auth = getAuth(app);
const db = getFirestore(app);

const APP_ID = 'uystudios-prod';
const COLLECTION_PATH = ['artifacts', APP_ID, 'public', 'data', 'projects'];
const STATUS_OPTIONS = ['Completed', 'In Progress', 'Pending', 'Cancelled'];

// Data extracted from the Google Doc provided
const MOCK_DATA = [
  { date: '2024-06-08', client: 'Marilyn Bautista', event: 'Engagement', location: 'Spadina', budget: 200, paid: 200, status: 'Completed' },
  { date: '2024-06-23', client: 'Lorela Viloria', event: 'Graduation', location: 'Spadina', budget: 100, paid: 100, status: 'Completed' },
  { date: '2024-06-26', client: 'Kat Poncelet', event: 'Graduation', location: 'Home', budget: 300, paid: 125, status: 'In Progress' },
  { date: '2024-07-13', client: 'Jhen Gonzaga', event: 'Wedding', location: 'The Cardinals', budget: 700, paid: 700, status: 'Completed' },
  { date: '2024-10-12', client: 'Nap Navarro', event: 'Birthday', location: 'Home', budget: 500, paid: 500, status: 'Completed' },
  { date: '2024-12-22', client: 'Jane Pasion', event: 'Dedication', location: 'First Mennonite Church', budget: 200, paid: 200, status: 'Completed' },
  { date: '2025-01-04', client: 'Annaliza Pacion', event: 'Dedication', location: 'SNLCF', budget: 290, paid: 290, status: 'Completed' },
  { date: '2025-04-13', client: 'Jerrelei Sabri', event: 'Baptism', location: 'Sacred Heart Church', budget: 700, paid: 700, status: 'Completed' },
  { date: '2025-05-10', client: 'Marilyn Bautista', event: 'Wedding', location: 'Hilton Garden', budget: 2200, paid: 2200, status: 'Completed' },
  { date: '2025-05-17', client: 'Summer Norman', event: 'Wedding', location: 'Family Farm', budget: 1300, paid: 1350, status: 'Completed' },
  { date: '2025-06-16', client: 'Mavelyn Bautista', event: 'Graduation', location: 'Saskpoly', budget: 130, paid: 130, status: 'Completed' },
  { date: '2025-06-16', client: 'Shania Locano', event: 'Graduation', location: 'Saskpoly', budget: 130, paid: 140, status: 'Completed' },
  { date: '2025-06-16', client: 'James', event: 'Graduation', location: 'Saskpoly', budget: 80, paid: 80, status: 'Completed' },
  { date: '2025-07-12', client: 'Christine Corpus', event: 'Wedding', location: 'Remai', budget: 3800, paid: 3800, status: 'Completed' },
  { date: '2025-08-08', client: 'Edna C', event: 'Wedding', location: 'RUH', budget: 350, paid: 350, status: 'Completed' },
  { date: '2025-09-17', client: 'Caroline Brookfield', event: 'Keynote', location: 'Prairieland Park', budget: 550, paid: 450, status: 'Completed' },
  { date: '2025-10-25', client: 'Gracelyn Whitefish', event: 'Wedding', location: 'Wanuskewin', budget: 1200, paid: 0, status: 'In Progress' },
  { 
    date: '2025-11-18', 
    client: 'Shara Miranda', 
    event: 'Wedding', 
    location: 'Hepburn, SK', 
    budget: 700, 
    paid: 500, 
    status: 'Completed',
    locationUrl: 'https://goo.gl/maps/hnX3y55MTMVXPnQA7',
    payrollMembers: [
      { name: 'Chris', rate: 120, id: 1 },
      { name: 'Nicko', rate: 120, id: 2 }
    ]
  },
  { date: '2025-11-23', client: 'Fritz Racho', event: 'Baby shoot', location: 'Saskatoon', budget: 0, paid: 0, status: 'Completed' },
  { date: '2026-03-30', client: 'IG Wealth', event: 'Headshots', location: 'Saskatoon', budget: 400, paid: 400, status: 'Completed' },
  { date: '2026-05-05', client: 'IG Wealth', event: 'Corporate Event', location: 'Saskatoon Club', budget: 500, paid: 500, status: 'In Progress' },
  { date: '2026-08-29', client: 'Brandon Lee', event: 'Wedding', location: 'Shekinah Retreat Center', budget: 4000, paid: 0, status: 'In Progress' }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [projects, setProjects] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [payrollMembers, setPayrollMembers] = useState([]);
  const [isSeeding, setIsSeeding] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      try { await signInAnonymously(auth); } catch (e) { console.error(e); }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const colRef = collection(db, ...COLLECTION_PATH);
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const seedData = async () => {
    if (!user || projects.length > 0) return;
    setIsSeeding(true);
    try {
      const colRef = collection(db, ...COLLECTION_PATH);
      for (const item of MOCK_DATA) {
        await addDoc(colRef, { ...item, createdAt: new Date().toISOString() });
      }
    } catch (e) { console.error(e); }
    setIsSeeding(false);
  };

  const stats = useMemo(() => {
    const totalRevenue = projects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
    const totalPayroll = projects.reduce((sum, p) => {
      const pSum = (p.payrollMembers || []).reduce((mSum, m) => mSum + (Number(m.rate) || 0), 0);
      return sum + pSum;
    }, 0);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const trendsObj = {};
    projects.forEach(p => {
      if (!p.date) return;
      const d = new Date(p.date);
      const m = monthNames[d.getMonth()];
      if (!trendsObj[m]) trendsObj[m] = { name: m, revenue: 0, payroll: 0 };
      trendsObj[m].revenue += (Number(p.budget) || 0);
      trendsObj[m].payroll += (p.payrollMembers || []).reduce((s, mem) => s + (Number(mem.rate) || 0), 0);
    });
    const incomeChartData = monthNames.map(m => trendsObj[m] || { name: m, revenue: 0, payroll: 0 }).filter((_, i) => i <= new Date().getMonth() || projects.some(p => p.date?.includes('2025') || p.date?.includes('2026')));
    return { totalRevenue, totalPayroll, netProfit: totalRevenue - totalPayroll, incomeChartData };
  }, [projects]);

  const filteredProjects = useMemo(() => {
    return projects.filter(p => 
      (p.client?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (p.event?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    ).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [projects, searchTerm]);

  const handleSave = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      client: fd.get('client'),
      event: fd.get('event'),
      location: fd.get('location'),
      locationUrl: fd.get('locationUrl'),
      date: fd.get('date'),
      budget: Number(fd.get('budget')),
      paid: Number(fd.get('paid') || 0),
      status: fd.get('status'),
      payrollMembers,
      updatedAt: new Date().toISOString()
    };
    if (editingProject) await updateDoc(doc(db, ...COLLECTION_PATH, editingProject.id), data);
    else await addDoc(collection(db, ...COLLECTION_PATH), { ...data, createdAt: new Date().toISOString() });
    setIsModalOpen(false);
  };

  if (loading && !user) return <div className="min-h-screen bg-[#020617] flex items-center justify-center text-indigo-500 animate-pulse font-black uppercase tracking-widest text-xs">Syncing Studio Cloud...</div>;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 flex flex-col md:flex-row font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-[#0F172A] border-r border-white/5 flex flex-col h-screen sticky top-0 hidden md:flex">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white"><Film size={20} /></div>
            <h1 className="text-lg font-black tracking-tighter uppercase text-white">UY Studios</h1>
          </div>
          <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest px-1">v2.3 Cloud Sync</div>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          <SidebarLink icon={<LayoutDashboard size={18}/>} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarLink icon={<Briefcase size={18}/>} label="Productions" active={activeTab === 'projects'} onClick={() => setActiveTab('projects')} />
        </nav>
        {projects.length === 0 && (
          <div className="p-4">
            <button onClick={seedData} disabled={isSeeding} className="w-full py-3 bg-white/5 border border-dashed border-white/10 rounded-xl text-[10px] font-black text-indigo-400 hover:bg-white/10 flex items-center justify-center gap-2">
              <Database size={14}/> {isSeeding ? 'SEEDING...' : 'IMPORT LOGS'}
            </button>
          </div>
        )}
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-20 border-b border-white/5 px-8 flex items-center justify-between bg-[#020617]/50 backdrop-blur-md sticky top-0 z-50">
          <div className="relative w-96 hidden md:block">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
            <input type="text" placeholder="Search productions..." className="bg-white/5 border border-white/5 rounded-2xl px-11 py-2.5 text-xs w-full outline-none focus:border-indigo-500/50" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <button onClick={() => { setEditingProject(null); setPayrollMembers([]); setIsModalOpen(true); }} className="bg-indigo-600 text-white px-6 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 hover:bg-indigo-500">
            <Plus size={16} /> NEW PRODUCTION
          </button>
        </header>

        <main className="p-4 md:p-8 space-y-8 pb-24 md:pb-8">
          {activeTab === 'dashboard' && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Pipeline Value" value={`$${stats.totalRevenue.toLocaleString()}`} color="indigo" icon={<TrendingUp size={16}/>} />
                <StatCard label="Total Cost" value={`$${stats.totalPayroll.toLocaleString()}`} color="rose" icon={<Users size={16}/>} />
                <StatCard label="Estimated Net" value={`$${stats.netProfit.toLocaleString()}`} color="emerald" icon={<CheckCircle2 size={16}/>} />
                <StatCard label="Active Shoots" value={projects.filter(p => p.status === 'In Progress').length} color="amber" icon={<Calendar size={16}/>} />
              </div>

              <div className="bg-[#0F172A] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden">
                <h3 className="text-[10px] font-black uppercase text-slate-500 mb-10 tracking-widest opacity-50">Financial Forecasting</h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.incomeChartData}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient>
                      </defs>
                      <XAxis dataKey="name" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{background: '#0F172A', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px'}} />
                      <Area type="monotone" dataKey="revenue" stroke="#6366f1" fillOpacity={1} fill="url(#colorRev)" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          {activeTab === 'projects' && (
            <div className="bg-[#0F172A] rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] uppercase font-black tracking-widest text-slate-500 border-b border-white/5">
                      <th className="px-8 py-5">Project</th>
                      <th className="px-8 py-5">Logistics</th>
                      <th className="px-8 py-5 text-right">Revenue</th>
                      <th className="px-8 py-5">Status</th>
                      <th className="px-8 py-5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredProjects.map(p => (
                      <tr key={p.id} className="hover:bg-white/[0.02] group">
                        <td className="px-8 py-6">
                          <div className="text-sm font-bold text-white leading-none mb-1">{p.client}</div>
                          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">{p.event} • {p.date}</div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                            <MapPin size={12} className="text-indigo-500 opacity-50" />
                            <span className="truncate max-w-[150px]">{p.location || 'TBD'}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right font-black text-white text-xs">${(Number(p.budget) || 0).toLocaleString()}</td>
                        <td className="px-8 py-6"><StatusBadge status={p.status} /></td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditingProject(p); setPayrollMembers(p.payrollMembers || []); setIsModalOpen(true); }} className="p-2 text-slate-500 hover:text-white"><Edit2 size={14}/></button>
                            <button onClick={async () => { if(confirm("Delete entry?")) await deleteDoc(doc(db, ...COLLECTION_PATH, p.id)) }} className="p-2 text-slate-500 hover:text-rose-400"><Trash2 size={14}/></button>
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

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#020617]/95 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-[#0F172A] border border-white/10 w-full max-w-2xl rounded-[3rem] p-10 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-xl font-black text-white uppercase tracking-tighter">{editingProject ? 'Edit' : 'New'} Production</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-500 hover:text-white"><X /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <FormInput label="Client" name="client" defaultValue={editingProject?.client} required />
                <FormInput label="Event" name="event" defaultValue={editingProject?.event} required />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <FormInput label="Location" name="location" defaultValue={editingProject?.location} />
                <FormInput label="Date" name="date" type="date" defaultValue={editingProject?.date} />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <FormInput label="Budget ($)" name="budget" type="number" defaultValue={editingProject?.budget} />
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Status</label>
                  <select name="status" defaultValue={editingProject?.status || 'Pending'} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-sm text-white outline-none">
                    {STATUS_OPTIONS.map(s => <option key={s} value={s} className="bg-[#0F172A]">{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="pt-6 border-t border-white/5 space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Crew Payroll</label>
                  <button type="button" onClick={() => setPayrollMembers([...payrollMembers, { id: Date.now(), name: '', rate: '' }])} className="text-[10px] font-black text-indigo-400 uppercase">Add Crew</button>
                </div>
                {payrollMembers.map(m => (
                  <div key={m.id} className="flex gap-4 items-center bg-white/5 p-4 rounded-2xl border border-white/5">
                    <input placeholder="Name" className="flex-1 bg-transparent text-xs outline-none" value={m.name} onChange={e => setPayrollMembers(payrollMembers.map(item => item.id === m.id ? {...item, name: e.target.value} : item))} />
                    <input placeholder="Rate ($)" type="number" className="w-24 bg-transparent text-xs text-rose-400 font-bold outline-none text-right" value={m.rate} onChange={e => setPayrollMembers(payrollMembers.map(item => item.id === m.id ? {...item, rate: e.target.value} : item))} />
                    <button type="button" onClick={() => setPayrollMembers(payrollMembers.filter(item => item.id !== m.id))} className="text-rose-500/50 hover:text-rose-500"><MinusCircle size={16}/></button>
                  </div>
                ))}
              </div>
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-[10px] transition-all">Execute Update</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SidebarLink({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-xl text-xs font-black transition-all ${active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/20' : 'text-slate-500 hover:bg-white/5'}`}>
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
    <div className={`p-6 rounded-[2rem] border ${themes[color]} shadow-lg`}>
      <div className="flex justify-between items-center mb-2 text-[9px] font-black uppercase text-slate-500 tracking-widest">{label} {icon}</div>
      <div className="text-2xl font-black text-white tracking-tight">{value}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = { 'Completed': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', 'In Progress': 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', 'Pending': 'bg-slate-500/10 text-slate-500 border-slate-500/20', 'Cancelled': 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
  return <span className={`text-[9px] font-black px-2 py-1 rounded-md uppercase border ${styles[status]}`}>{status}</span>;
}

function FormInput({ label, ...props }) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">{label}</label>
      <input {...props} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white focus:border-indigo-500 outline-none transition-colors" />
    </div>
  );
}