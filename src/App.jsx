import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Edit2, Trash2, X, MapPin, LayoutDashboard, 
  Briefcase, BarChart3, Film, CheckCircle2, Wallet, 
  TrendingUp, Users, Calendar, Link as LinkIcon, 
  FileText, DollarSign, ChevronRight, Menu, UserPlus, MinusCircle,
  ExternalLink
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie,
  AreaChart, Area
} from 'recharts';

// Firebase Imports
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, onSnapshot, addDoc, 
  updateDoc, deleteDoc, doc, query 
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : {
      apiKey: "YOUR_API_KEY",
      authDomain: "YOUR_PROJECT.firebaseapp.com",
      projectId: "YOUR_PROJECT_ID",
      storageBucket: "YOUR_PROJECT.appspot.com",
      messagingSenderId: "YOUR_SENDER_ID",
      appId: "YOUR_APP_ID"
    };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const isPlayground = typeof __app_id !== 'undefined';
const appId = isPlayground ? __app_id : 'default';
const COLLECTION_PATH = isPlayground 
  ? ['artifacts', appId, 'public', 'data', 'projects'] 
  : ['projects'];

const STATUS_OPTIONS = ['Completed', 'In Progress', 'Pending', 'Cancelled'];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [projects, setProjects] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Payroll specific state for the form
  const [payrollMembers, setPayrollMembers] = useState([]);

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        setErrorMessage("Connection failed.");
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const colRef = collection(db, ...COLLECTION_PATH);
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
      setLoading(false);
    }, (err) => {
      setErrorMessage("Data fetch failed.");
    });
    return () => unsubscribe();
  }, [user]);

  const stats = useMemo(() => {
    const totalRevenue = projects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
    const totalCollected = projects.reduce((sum, p) => sum + (Number(p.paid) || 0), 0);
    
    const totalPayroll = projects.reduce((sum, p) => {
      const pSum = (p.payrollMembers || []).reduce((mSum, m) => mSum + (Number(m.rate) || 0), 0);
      return sum + pSum;
    }, 0);

    const netProfit = totalCollected - totalPayroll;
    
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

    const incomeChartData = monthNames.filter(m => trendsObj[m]).map(m => trendsObj[m]);
    const statusData = STATUS_OPTIONS.map(status => ({
      name: status,
      value: projects.filter(p => p.status === status).length
    }));

    return { totalRevenue, totalCollected, totalPayroll, netProfit, incomeChartData, statusData };
  }, [projects]);

  const filteredProjects = useMemo(() => {
    return projects.filter(p => 
      (p.client?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (p.event?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (p.location?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    ).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [projects, searchTerm]);

  const handleOpenModal = (proj = null) => {
    setEditingProject(proj);
    setPayrollMembers(proj?.payrollMembers || []);
    setIsModalOpen(true);
  };

  const handleAddMember = () => {
    setPayrollMembers([...payrollMembers, { id: Date.now(), name: '', role: '', rate: '', paid: false }]);
  };

  const handleRemoveMember = (id) => {
    setPayrollMembers(payrollMembers.filter(m => m.id !== id));
  };

  const handleMemberChange = (id, field, value) => {
    setPayrollMembers(payrollMembers.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.target);
    const data = {
      client: fd.get('client'),
      event: fd.get('event'),
      location: fd.get('location'),
      locationUrl: fd.get('locationUrl'), // New field for Maps link
      date: fd.get('date'),
      budget: Number(fd.get('budget')),
      paid: Number(fd.get('paid')),
      status: fd.get('status'),
      notes: fd.get('notes'),
      links: fd.get('links'),
      payrollMembers: payrollMembers 
    };

    try {
      if (editingProject) {
        await updateDoc(doc(db, ...COLLECTION_PATH, editingProject.id), data);
      } else {
        await addDoc(collection(db, ...COLLECTION_PATH), { ...data, createdAt: new Date().toISOString() });
      }
      setIsModalOpen(false);
    } catch (e) { 
      setErrorMessage("Error saving document.");
    }
  };

  const handleDelete = async (id) => {
    if (!user || !window.confirm("Confirm deletion?")) return;
    await deleteDoc(doc(db, ...COLLECTION_PATH, id));
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 flex flex-col md:flex-row font-sans">
      
      {/* Sidebar - Desktop */}
      <aside className="w-64 bg-[#0F172A] border-r border-white/5 flex flex-col h-screen sticky top-0 hidden md:flex">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
              <Film size={20} />
            </div>
            <h1 className="text-lg font-black tracking-tighter uppercase text-white">UY Studios</h1>
          </div>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          <SidebarLink icon={<LayoutDashboard size={18}/>} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarLink icon={<Briefcase size={18}/>} label="Projects" active={activeTab === 'projects'} onClick={() => setActiveTab('projects')} />
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-20 border-b border-white/5 px-8 items-center justify-between bg-[#020617]/50 backdrop-blur-md hidden md:flex">
          <div className="relative w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
            <input 
              type="text" 
              placeholder="Search clients, events, or locations..." 
              className="bg-white/5 border border-white/5 rounded-2xl px-11 py-2 text-xs w-full outline-none focus:border-indigo-500/50"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <button onClick={() => handleOpenModal()} className="bg-indigo-600 text-white px-6 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 transition-transform active:scale-95">
            <Plus size={16} /> NEW PROJECT
          </button>
        </header>

        <main className="p-4 md:p-8 space-y-8 pb-24 md:pb-8">
          {activeTab === 'dashboard' && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Pipeline" value={`$${stats.totalRevenue.toLocaleString()}`} color="indigo" icon={<TrendingUp size={16}/>} />
                <StatCard label="Total Payroll" value={`$${stats.totalPayroll.toLocaleString()}`} color="rose" icon={<Users size={16}/>} />
                <StatCard label="Net Profit" value={`$${stats.netProfit.toLocaleString()}`} color="emerald" icon={<CheckCircle2 size={16}/>} />
                <StatCard label="Pending Projects" value={stats.statusData.find(d => d.name === 'Pending')?.value || 0} color="amber" icon={<Calendar size={16}/>} />
              </div>

              <div className="bg-[#0F172A] p-6 rounded-[2rem] border border-white/5 h-[350px]">
                <h3 className="text-[10px] font-black uppercase text-slate-500 mb-6 tracking-widest">Revenue vs. Team Cost</h3>
                <ResponsiveContainer width="100%" height="90%">
                  <AreaChart data={stats.incomeChartData}>
                    <XAxis dataKey="name" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{background: '#0F172A', border: 'none', borderRadius: '12px'}} />
                    <Area type="monotone" dataKey="revenue" stroke="#6366f1" fill="#6366f1" fillOpacity={0.1} strokeWidth={3} />
                    <Area type="monotone" dataKey="payroll" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.1} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          <div className="bg-[#0F172A] rounded-[2rem] border border-white/5 overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/5 flex justify-between items-center">
              <h3 className="text-xs font-black uppercase text-slate-400">Live Productions</h3>
              <button className="md:hidden p-2 bg-indigo-600 rounded-lg text-white" onClick={() => handleOpenModal()}>
                <Plus size={16} />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] uppercase font-black tracking-widest text-slate-500 border-b border-white/5">
                    <th className="px-6 py-4">Client / Event</th>
                    <th className="px-6 py-4">Location</th>
                    <th className="px-6 py-4 text-center">Team</th>
                    <th className="px-6 py-4">Payroll</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredProjects.map(p => (
                    <tr key={p.id} className="hover:bg-white/[0.02]">
                      <td className="px-6 py-5">
                        <div className="text-sm font-bold text-white">{p.client}</div>
                        <div className="text-[10px] text-slate-500 font-medium">{p.event} • {p.date}</div>
                      </td>
                      <td className="px-6 py-5">
                        {p.locationUrl ? (
                          <a 
                            href={p.locationUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="group flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                          >
                            <MapPin size={12} />
                            <span className="underline underline-offset-4 decoration-indigo-500/30 group-hover:decoration-indigo-400">{p.location || 'View Map'}</span>
                            <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                          </a>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <MapPin size={12} className="text-slate-600" />
                            {p.location || 'TBD'}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 bg-white/5 px-2 py-1 rounded-lg">
                          <Users size={12} className="text-indigo-400"/>
                          {p.payrollMembers?.length || 0}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-xs font-bold text-white">
                          ${(p.payrollMembers || []).reduce((s, m) => s + (Number(m.rate) || 0), 0).toLocaleString()}
                        </div>
                        <div className="text-[9px] text-rose-400 font-bold uppercase tracking-tighter">Total Cost</div>
                      </td>
                      <td className="px-6 py-5">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => handleOpenModal(p)} className="p-2 text-slate-400 hover:text-indigo-400 transition-colors"><Edit2 size={14}/></button>
                          <button onClick={() => handleDelete(p.id)} className="p-2 text-slate-400 hover:text-rose-400 transition-colors"><Trash2 size={14}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Mobile Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#0F172A] border-t border-white/5 flex items-center justify-around z-50">
        <button onClick={() => setActiveTab('dashboard')} className={activeTab === 'dashboard' ? 'text-indigo-500' : 'text-slate-500'}><LayoutDashboard /></button>
        <button onClick={() => setActiveTab('projects')} className={activeTab === 'projects' ? 'text-indigo-500' : 'text-slate-500'}><Briefcase /></button>
      </nav>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-[#0F172A] border border-white/10 w-full max-w-3xl rounded-[2.5rem] p-6 md:p-8 max-h-[90vh] overflow-y-auto scrollbar-hide">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-xl font-black text-white uppercase">{editingProject ? 'Edit Project' : 'New Project'}</h2>
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1">Shoot details & payroll</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-500 hover:text-white transition-colors"><X /></button>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormInput label="Client" name="client" defaultValue={editingProject?.client} placeholder="e.g. Nike" />
                <FormInput label="Event" name="event" defaultValue={editingProject?.event} placeholder="e.g. Summer Campaign" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormInput label="Location Name" name="location" defaultValue={editingProject?.location} placeholder="e.g. Pier 59 Studios" />
                <FormInput label="Google Maps Link" name="locationUrl" defaultValue={editingProject?.locationUrl} placeholder="Paste Maps URL here..." />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormInput label="Shoot Date" name="date" type="date" defaultValue={editingProject?.date} />
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Status</label>
                  <select name="status" defaultValue={editingProject?.status || 'Pending'} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:border-indigo-500 outline-none appearance-none">
                    {STATUS_OPTIONS.map(s => <option key={s} value={s} className="bg-[#0F172A]">{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormInput label="Project Budget ($)" name="budget" type="number" defaultValue={editingProject?.budget} />
                <FormInput label="Amount Paid ($)" name="paid" type="number" defaultValue={editingProject?.paid} />
              </div>

              {/* Payroll / Team Section */}
              <div className="space-y-4 pt-4 border-t border-white/5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Team Payroll</label>
                  <button type="button" onClick={handleAddMember} className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 flex items-center gap-1 uppercase transition-colors">
                    <UserPlus size={14}/> Add Member
                  </button>
                </div>
                
                <div className="space-y-3">
                  {payrollMembers.map((member) => (
                    <div key={member.id} className="grid grid-cols-12 gap-2 bg-white/5 p-3 rounded-2xl items-center border border-white/[0.02]">
                      <div className="col-span-4">
                        <input 
                          placeholder="Name" 
                          className="w-full bg-transparent text-xs text-white outline-none border-b border-transparent focus:border-indigo-500/30" 
                          value={member.name}
                          onChange={(e) => handleMemberChange(member.id, 'name', e.target.value)}
                        />
                      </div>
                      <div className="col-span-3">
                        <input 
                          placeholder="Role" 
                          className="w-full bg-transparent text-[10px] text-slate-400 outline-none" 
                          value={member.role}
                          onChange={(e) => handleMemberChange(member.id, 'role', e.target.value)}
                        />
                      </div>
                      <div className="col-span-2">
                        <input 
                          type="number"
                          placeholder="Rate" 
                          className="w-full bg-transparent text-xs text-white outline-none font-bold" 
                          value={member.rate}
                          onChange={(e) => handleMemberChange(member.id, 'rate', e.target.value)}
                        />
                      </div>
                      <div className="col-span-2 flex items-center justify-center">
                        <button 
                          type="button"
                          onClick={() => handleMemberChange(member.id, 'paid', !member.paid)}
                          className={`text-[9px] font-black px-2 py-1 rounded-md transition-all active:scale-90 ${member.paid ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/50 text-slate-400'}`}
                        >
                          {member.paid ? 'PAID' : 'DUE'}
                        </button>
                      </div>
                      <div className="col-span-1 text-right">
                        <button type="button" onClick={() => handleRemoveMember(member.id)} className="text-rose-500/50 hover:text-rose-500 transition-colors"><MinusCircle size={16}/></button>
                      </div>
                    </div>
                  ))}
                  {payrollMembers.length === 0 && <p className="text-center py-6 text-[10px] text-slate-600 uppercase font-bold tracking-widest border border-dashed border-white/5 rounded-2xl">No team members assigned</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/5">
                <FormTextArea label="Relevant Links" name="links" defaultValue={editingProject?.links} placeholder="Dropbox, Frame.io, etc." />
                <FormTextArea label="Internal Notes" name="notes" defaultValue={editingProject?.notes} placeholder="Gear list, call times..." />
              </div>

              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs transition-all active:scale-[0.98] shadow-lg shadow-indigo-600/10">
                {editingProject ? 'Update Production' : 'Initialize Project'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Helpers
function SidebarLink({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black transition-all ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:bg-white/5'}`}>
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
        {label} <span className={themes[color].split(' ')[0]}>{icon}</span>
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

function FormTextArea({ label, ...props }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">{label}</label>
      <textarea {...props} rows={2} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:border-indigo-500 outline-none resize-none transition-colors" />
    </div>
  );
}