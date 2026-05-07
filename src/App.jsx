import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Edit2, Trash2, X, MapPin, LayoutDashboard, 
  Briefcase, BarChart3, Film, TrendingUp, Wallet, Clock, 
  Receipt, ChevronRight, MinusCircle, Link2, FileText, Users,
  ChevronLeft, Menu
} from 'lucide-react';
import { 
  XAxis, YAxis, Tooltip, ResponsiveContainer, 
  AreaChart, Area, CartesianGrid, Legend
} from 'recharts';

// Firebase Imports
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, collection, onSnapshot, addDoc, 
  updateDoc, deleteDoc, doc
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

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const APP_ID = 'uystudios-prod';
const PROJECTS_PATH = ['artifacts', APP_ID, 'public', 'data', 'projects'];
const EXPENSES_PATH = ['artifacts', APP_ID, 'public', 'data', 'expenses'];
const STATUS_OPTIONS = ['Completed', 'In Progress', 'Pending', 'Cancelled'];
const EXPENSE_TYPES = ['Gear/Hardware', 'Software/SaaS', 'Travel', 'Marketing', 'Office', 'Other'];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [projects, setProjects] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Modals
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);
  
  // Dynamic Team Payroll State
  const [payrollMembers, setPayrollMembers] = useState([]);

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
    
    const unsubProjects = onSnapshot(collection(db, ...PROJECTS_PATH), (s) => {
      setProjects(s.docs.map(d => ({ ...d.data(), id: d.id })));
    }, (err) => console.error(err));

    const unsubExpenses = onSnapshot(collection(db, ...EXPENSES_PATH), (s) => {
      setExpenses(s.docs.map(d => ({ ...d.data(), id: d.id })));
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => {
      unsubProjects();
      unsubExpenses();
    };
  }, [user]);

  const stats = useMemo(() => {
    const totalRevenue = projects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
    const totalPaid = projects.reduce((sum, p) => sum + (Number(p.paid) || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.cost) || 0), 0);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const currentMonth = new Date().getMonth();
    
    const chartData = [];
    for (let i = 5; i >= 0; i--) {
      let mIdx = currentMonth - i;
      if (mIdx < 0) mIdx += 12;
      chartData.push({ name: monthNames[mIdx], revenue: 0, owing: 0, exp: 0, monthIdx: mIdx });
    }

    projects.forEach(p => {
      if (!p.date) return;
      const mIdx = new Date(p.date).getMonth();
      const dp = chartData.find(cd => cd.monthIdx === mIdx);
      if (dp) {
        dp.revenue += (Number(p.budget) || 0);
        dp.owing += (Number(p.budget) || 0) - (Number(p.paid) || 0);
      }
    });

    expenses.forEach(e => {
      if (!e.date) return;
      const mIdx = new Date(e.date).getMonth();
      const dp = chartData.find(cd => cd.monthIdx === mIdx);
      if (dp) dp.exp += (Number(e.cost) || 0);
    });

    return { totalRevenue, totalExpenses, outstanding: totalRevenue - totalPaid, active: projects.filter(p => p.status === 'In Progress').length, chartData };
  }, [projects, expenses]);

  const handleProjectSave = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      client: fd.get('client'),
      event: fd.get('event'),
      location: fd.get('location'),
      locationUrl: fd.get('locationUrl'),
      notes: fd.get('notes'),
      date: fd.get('date'),
      budget: Number(fd.get('budget')),
      paid: Number(fd.get('paid')),
      status: fd.get('status'),
      payrollMembers: payrollMembers.filter(m => m.name.trim() !== ''),
      updatedAt: new Date().toISOString()
    };
    if (editingProject) await updateDoc(doc(db, ...PROJECTS_PATH, editingProject.id), data);
    else await addDoc(collection(db, ...PROJECTS_PATH), { ...data, createdAt: new Date().toISOString() });
    setIsProjectModalOpen(false);
  };

  const handleExpenseSave = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      type: fd.get('type'),
      cost: Number(fd.get('cost')),
      date: fd.get('date'),
      itemName: fd.get('itemName'),
      notes: fd.get('notes'),
      updatedAt: new Date().toISOString()
    };
    if (editingExpense) await updateDoc(doc(db, ...EXPENSES_PATH, editingExpense.id), data);
    else await addDoc(collection(db, ...EXPENSES_PATH), { ...data, createdAt: new Date().toISOString() });
    setIsExpenseModalOpen(false);
  };

  const addPayrollMember = () => {
    setPayrollMembers([...payrollMembers, { name: '', role: '', pay: 0 }]);
  };

  const updatePayrollMember = (index, field, value) => {
    const newMembers = [...payrollMembers];
    newMembers[index][field] = value;
    setPayrollMembers(newMembers);
  };

  const removePayrollMember = (index) => {
    setPayrollMembers(payrollMembers.filter((_, i) => i !== index));
  };

  if (loading && !user) return <div className="h-screen bg-[#050810] flex items-center justify-center text-indigo-400 animate-pulse font-bold tracking-widest uppercase text-xs">Initializing UY Engine...</div>;

  return (
    <div className="min-h-screen bg-[#050810] text-slate-300 flex flex-col md:flex-row font-sans selection:bg-indigo-500/30 overflow-x-hidden">
      
      {/* Desktop Sidebar */}
      <aside 
        className={`bg-[#0A0D16] border-r border-white/5 hidden md:flex flex-col h-screen sticky top-0 transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'w-24' : 'w-72'}`}
      >
        <div className={`p-8 flex items-center mb-10 ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-3">
              <Film className="text-indigo-500" size={20}/>
              <h1 className="text-xs font-black tracking-widest uppercase text-white">UY Studios</h1>
            </div>
          )}
          {isSidebarCollapsed && <Film className="text-indigo-500" size={24}/>}
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <SidebarItem 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
            icon={<LayoutDashboard size={20}/>} 
            label="Dashboard" 
            collapsed={isSidebarCollapsed}
          />
          <SidebarItem 
            active={activeTab === 'projects'} 
            onClick={() => setActiveTab('projects')} 
            icon={<Briefcase size={20}/>} 
            label="Productions" 
            collapsed={isSidebarCollapsed}
          />
          <SidebarItem 
            active={activeTab === 'expenses'} 
            onClick={() => setActiveTab('expenses')} 
            icon={<Receipt size={20}/>} 
            label="Expenses" 
            collapsed={isSidebarCollapsed}
          />
        </nav>

        <div className="p-4 border-t border-white/5">
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="w-full flex items-center justify-center p-3 rounded-xl hover:bg-white/5 text-slate-500 hover:text-white transition-all"
          >
            {isSidebarCollapsed ? <ChevronRight size={20}/> : <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-widest"><ChevronLeft size={16}/> Collapse</div>}
          </button>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between p-6 bg-[#0A0D16] border-b border-white/5">
        <div className="flex items-center gap-3">
          <Film className="text-indigo-500" size={20}/>
          <h1 className="text-[10px] font-black tracking-widest uppercase text-white">UY Studios</h1>
        </div>
        <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-white">
          <Menu size={24} />
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="absolute top-0 right-0 h-full w-3/4 bg-[#0A0D16] shadow-2xl p-8 slide-in-right">
            <div className="flex justify-between items-center mb-12">
              <Film className="text-indigo-500" size={24}/>
              <button onClick={() => setIsMobileMenuOpen(false)}><X size={24}/></button>
            </div>
            <nav className="space-y-4">
               {['dashboard', 'projects', 'expenses'].map((tab) => (
                 <button 
                  key={tab}
                  onClick={() => { setActiveTab(tab); setIsMobileMenuOpen(false); }}
                  className={`w-full text-left p-4 rounded-2xl font-bold uppercase text-xs tracking-widest ${activeTab === tab ? 'bg-indigo-500 text-white' : 'text-slate-400'}`}
                 >
                   {tab}
                 </button>
               ))}
            </nav>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-20 px-8 flex items-center justify-between bg-[#050810]/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-40">
          <div className="relative w-full max-w-md hidden sm:block">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input 
              type="text" 
              placeholder="Filter records..." 
              className="bg-white/5 border border-white/5 rounded-xl px-12 py-2.5 text-sm w-full focus:border-indigo-500/50 outline-none transition-all" 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
            />
          </div>
          <div className="sm:hidden flex-1" />
          <button onClick={() => {
            if(activeTab === 'expenses') {
              setEditingExpense(null);
              setIsExpenseModalOpen(true);
            } else {
              setEditingProject(null);
              setPayrollMembers([]);
              setIsProjectModalOpen(true);
            }
          }} className="bg-indigo-500 hover:bg-indigo-400 text-white px-5 py-2.5 rounded-xl text-[10px] font-black flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20 uppercase tracking-tighter shrink-0">
            <Plus size={16}/> New Entry
          </button>
        </header>

        <main className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
          {activeTab === 'dashboard' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                <StatCard label="Gross Revenue" value={`$${stats.totalRevenue.toLocaleString()}`} icon={<TrendingUp size={16}/>} />
                <StatCard label="Client Debt" value={`$${stats.outstanding.toLocaleString()}`} icon={<Wallet size={16}/>} warning={stats.outstanding > 0} />
                <StatCard label="OpEx Total" value={`$${stats.totalExpenses.toLocaleString()}`} icon={<Receipt size={16}/>} />
                <StatCard label="Live Sets" value={stats.active} icon={<Clock size={16}/>} />
              </div>

              <div className="bg-[#0A0D16] p-4 md:p-8 rounded-3xl border border-white/5 shadow-2xl">
                <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-8 opacity-40">Financial Analytics (Rolling 6M)</h3>
                <div className="h-[300px] md:h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.chartData}>
                      <defs>
                        <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.02)" />
                      <XAxis dataKey="name" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis stroke="#475569" fontSize={10} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                      <Tooltip contentStyle={{background: '#0A0D16', border: '1px solid #1e293b', borderRadius: '12px'}} />
                      <Area type="monotone" dataKey="revenue" stroke="#6366f1" fill="url(#gRev)" strokeWidth={3} name="Revenue" />
                      <Area type="monotone" dataKey="owing" stroke="#f43f5e" fill="none" strokeWidth={2} strokeDasharray="4 4" name="Debt" />
                      <Area type="monotone" dataKey="exp" stroke="#f59e0b" fill="none" strokeWidth={3} name="Expenses" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          <div className="bg-[#0A0D16] rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
             <div className="p-6 md:p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
                <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">{activeTab === 'expenses' ? 'Operational Ledger' : 'Production Pipeline'}</h3>
             </div>
             <div className="overflow-x-auto">
               <table className="w-full text-left">
                  <thead className="text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">
                    <tr>
                      <th className="px-6 md:px-8 py-5 min-w-[200px]">{activeTab === 'expenses' ? 'ITEM' : 'PRODUCTION'}</th>
                      <th className="px-6 md:px-8 py-5 min-w-[150px]">LOGISTICS</th>
                      <th className="px-6 md:px-8 py-5 min-w-[120px]">FINANCE</th>
                      <th className="px-6 md:px-8 py-5">STATUS</th>
                      <th className="px-6 md:px-8 py-5 text-right">MGMT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {(activeTab === 'expenses' ? expenses : projects)
                      .filter(i => (i.client || i.itemName || '').toLowerCase().includes(searchTerm.toLowerCase()))
                      .map(item => (
                        <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                          <td className="px-6 md:px-8 py-6">
                            <div className="text-sm font-bold text-white leading-none mb-2">{item.client || item.itemName}</div>
                            <div className="text-[10px] font-bold text-slate-500 uppercase opacity-60 flex items-center gap-1.5">
                              {item.event || item.date} 
                              {item.payrollMembers?.length > 0 && (
                                <span className="flex items-center gap-1 text-indigo-400">
                                  • <Users size={10}/> {item.payrollMembers.length}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 md:px-8 py-6">
                            {activeTab === 'expenses' ? (
                              <div className="space-y-1">
                                <span className="text-[9px] px-2 py-1 bg-white/5 rounded border border-white/5 text-slate-400 font-bold uppercase tracking-wider">{item.type}</span>
                                {item.notes && <div className="text-[10px] text-slate-500 italic line-clamp-1 max-w-[180px]">{item.notes}</div>}
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
                                  <MapPin size={12}/> {item.location || 'TBD'}
                                  {item.locationUrl && (
                                    <a href={item.locationUrl} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300">
                                      <Link2 size={12}/>
                                    </a>
                                  )}
                                </div>
                                {item.notes && <div className="text-[10px] text-slate-500 italic line-clamp-1 max-w-[180px]">{item.notes}</div>}
                              </div>
                            )}
                          </td>
                          <td className="px-6 md:px-8 py-6">
                            <div className="text-sm font-black text-white">${(item.budget || item.cost || 0).toLocaleString()}</div>
                            {item.budget !== undefined && (
                              <div className={`text-[9px] font-bold mt-0.5 ${(item.budget - item.paid) > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                {item.budget - item.paid > 0 ? `-$${(item.budget - item.paid).toLocaleString()}` : 'PAID'}
                              </div>
                            )}
                          </td>
                          <td className="px-6 md:px-8 py-6">
                            <StatusBadge status={item.status || 'Active'} />
                          </td>
                          <td className="px-6 md:px-8 py-6 text-right">
                            <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => {
                                if(activeTab === 'expenses') {
                                  setEditingExpense(item);
                                  setIsExpenseModalOpen(true);
                                } else {
                                  setEditingProject(item);
                                  setPayrollMembers(item.payrollMembers || []);
                                  setIsProjectModalOpen(true);
                                }
                              }} className="p-2 hover:bg-indigo-500/10 rounded-lg text-slate-500 hover:text-indigo-400 transition-all"><Edit2 size={14}/></button>
                              <button onClick={async () => {if(confirm("Confirm deletion?")) await deleteDoc(doc(db, ...[activeTab === 'expenses' ? EXPENSES_PATH : PROJECTS_PATH].flat(), item.id))}} className="p-2 hover:bg-rose-500/10 rounded-lg text-slate-500 hover:text-rose-500 transition-all"><Trash2 size={14}/></button>
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

      {/* Production Modal */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0A0D16] border border-white/10 w-full max-w-4xl rounded-[2rem] p-6 md:p-10 my-8 shadow-2xl">
            <div className="flex justify-between items-start mb-10">
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight">Production Registry</h2>
                <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-[0.2em] opacity-50">Manage operational logistics and crew payroll</p>
              </div>
              <button onClick={() => setIsProjectModalOpen(false)} className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition-all">
                <X size={20}/>
              </button>
            </div>
            
            <form onSubmit={handleProjectSave} className="space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <SectionTitle title="Client & Core" />
                  <FormInput label="Client Name" name="client" defaultValue={editingProject?.client} required />
                  <FormInput label="Event Description" name="event" defaultValue={editingProject?.event} required />
                  <div className="grid grid-cols-2 gap-4">
                    <FormInput label="Date" name="date" type="date" defaultValue={editingProject?.date} />
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Status</label>
                       <select name="status" defaultValue={editingProject?.status || 'Pending'} className="w-full bg-white/5 border border-white/5 rounded-xl px-5 py-3 text-sm outline-none text-white focus:border-indigo-500">
                        {STATUS_OPTIONS.map(s => <option key={s} value={s} className="bg-[#0A0D16]">{s}</option>)}
                       </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <SectionTitle title="Logistics & Finance" />
                  <div className="grid grid-cols-2 gap-4">
                    <FormInput label="Budget ($)" name="budget" type="number" defaultValue={editingProject?.budget} />
                    <FormInput label="Paid ($)" name="paid" type="number" defaultValue={editingProject?.paid} />
                  </div>
                  <FormInput label="Venue / Location" name="location" defaultValue={editingProject?.location} placeholder="Location name" />
                  <FormInput label="Map URL" name="locationUrl" defaultValue={editingProject?.locationUrl} placeholder="Paste Maps link" />
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex justify-between items-center border-b border-white/5 pb-4">
                   <SectionTitle title="Team Payroll" />
                   <button type="button" onClick={addPayrollMember} className="flex items-center gap-2 text-[10px] font-black text-white bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-4 py-2 rounded-xl hover:bg-indigo-500 hover:text-white transition-all uppercase tracking-widest">
                     <Plus size={14}/> Add Crew
                   </button>
                </div>
                
                <div className="space-y-3">
                  {payrollMembers.length === 0 ? (
                    <div className="bg-white/5 border border-dashed border-white/5 rounded-2xl p-10 text-center text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                      Assign team members to calculate project overhead
                    </div>
                  ) : (
                    payrollMembers.map((member, idx) => (
                      <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end bg-white/[0.02] p-5 rounded-2xl border border-white/5">
                        <div className="sm:col-span-5">
                          <label className="text-[9px] font-black uppercase text-slate-500 mb-2 block">Name</label>
                          <input value={member.name} onChange={e => updatePayrollMember(idx, 'name', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-xs outline-none text-white focus:border-indigo-500" />
                        </div>
                        <div className="sm:col-span-4">
                          <label className="text-[9px] font-black uppercase text-slate-500 mb-2 block">Role</label>
                          <input value={member.role} onChange={e => updatePayrollMember(idx, 'role', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-xs outline-none text-white focus:border-indigo-500" />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-[9px] font-black uppercase text-slate-500 mb-2 block">Pay ($)</label>
                          <input type="number" value={member.pay} onChange={e => updatePayrollMember(idx, 'pay', e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-xs outline-none text-white focus:border-indigo-500" />
                        </div>
                        <div className="sm:col-span-1 flex justify-center pb-1">
                          <button type="button" onClick={() => removePayrollMember(idx)} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all">
                            <MinusCircle size={18}/>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <SectionTitle title="Notes & Links" />
                <textarea name="notes" defaultValue={editingProject?.notes} rows={4} placeholder="Gear list, shared folders, or delivery notes..." className="w-full bg-white/5 border border-white/5 rounded-2xl p-6 text-sm outline-none focus:border-indigo-500 transition-all resize-none text-white"></textarea>
              </div>

              <div className="pt-6 flex flex-col sm:flex-row gap-4">
                <button type="submit" className="flex-1 bg-indigo-500 py-4 rounded-2xl font-black text-white tracking-widest hover:bg-indigo-400 transition-all uppercase shadow-lg shadow-indigo-500/20">Save Production</button>
                <button type="button" onClick={() => setIsProjectModalOpen(false)} className="px-10 py-4 bg-white/5 border border-white/5 rounded-2xl text-xs font-black text-slate-500 hover:text-white transition-all uppercase">Discard</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0A0D16] border border-white/10 w-full max-w-lg rounded-[2.5rem] p-10 shadow-2xl my-8">
            <h2 className="text-xl font-black text-white mb-8">Expense Entry</h2>
            <form onSubmit={handleExpenseSave} className="space-y-6">
              <FormInput label="Item Name" name="itemName" defaultValue={editingExpense?.itemName} required />
              <div className="grid grid-cols-2 gap-6">
                <FormInput label="Cost ($)" name="cost" type="number" defaultValue={editingExpense?.cost} required />
                <FormInput label="Date" name="date" type="date" defaultValue={editingExpense?.date || new Date().toISOString().split('T')[0]} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Category</label>
                <select name="type" defaultValue={editingExpense?.type} className="w-full bg-white/5 border border-white/5 rounded-xl px-5 py-3 text-sm outline-none text-white focus:border-indigo-500">
                  {EXPENSE_TYPES.map(t => <option key={t} value={t} className="bg-slate-900">{t}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Notes</label>
                <textarea name="notes" defaultValue={editingExpense?.notes} rows={3} placeholder="Receipt #, Vendor link, or details..." className="w-full bg-white/5 border border-white/5 rounded-xl px-5 py-3 text-sm outline-none text-white focus:border-indigo-500 transition-all resize-none"></textarea>
              </div>
              <button type="submit" className="w-full bg-indigo-500 py-4 rounded-2xl font-black text-white tracking-widest hover:bg-indigo-400 transition-all uppercase">Commit</button>
              <button type="button" onClick={() => setIsExpenseModalOpen(false)} className="w-full text-[10px] font-black text-slate-600 hover:text-white py-2 uppercase tracking-widest transition-all">Cancel</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SidebarItem({ active, onClick, icon, label, collapsed }) {
  return (
    <button 
      onClick={onClick} 
      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-[12px] font-bold transition-all ${active ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-white hover:bg-white/5'} ${collapsed ? 'justify-center' : ''}`}
      title={collapsed ? label : ''}
    >
      {icon}
      {!collapsed && <span>{label}</span>}
    </button>
  );
}

function SectionTitle({ title }) {
  return <h3 className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.2em]">{title}</h3>;
}

function StatCard({ label, value, icon, warning }) {
  return (
    <div className="bg-[#0A0D16] p-6 rounded-3xl border border-white/5 hover:border-white/10 transition-all duration-300 shadow-lg group">
      <div className="flex justify-between items-center mb-4">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-slate-400">{label}</span>
        <div className={`p-2 rounded-xl ${warning ? 'bg-rose-500/10 text-rose-500' : 'bg-indigo-500/10 text-indigo-400'}`}>{icon}</div>
      </div>
      <div className="text-2xl font-black text-white tracking-tight">{value}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    'Completed': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    'In Progress': 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    'Pending': 'text-slate-500 bg-slate-500/10 border-slate-500/20',
    'Cancelled': 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    'Active': 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'
  };
  return <span className={`text-[9px] font-black px-2.5 py-1.5 rounded-lg border uppercase tracking-tighter shrink-0 whitespace-nowrap ${map[status]}`}>{status}</span>;
}

function FormInput({ label, ...props }) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">{label}</label>
      <input {...props} className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 text-sm focus:border-indigo-500 outline-none transition-all placeholder:text-slate-700 text-white" />
    </div>
  );
}