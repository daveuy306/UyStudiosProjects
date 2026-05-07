import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Edit2, Trash2, X, MapPin, LayoutDashboard, 
  Briefcase, BarChart3, Film, CheckCircle2, 
  TrendingUp, Users, Calendar, 
  UserPlus, MinusCircle, Database, Link as LinkIcon,
  Receipt, Wallet, ArrowDownCircle, ArrowUpCircle, Sparkles, Loader2
} from 'lucide-react';
import { 
  XAxis, YAxis, Tooltip, ResponsiveContainer, 
  AreaChart, Area
} from 'recharts';

// Firebase Imports
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, onSnapshot, addDoc, 
  updateDoc, deleteDoc, doc, query
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
const STATUS_OPTIONS = ['Completed', 'In Progress', 'Pending', 'Cancelled'];
const EXPENSE_CATEGORIES = ['Equipment', 'Travel', 'Software', 'Marketing', 'Catering', 'Other'];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [projects, setProjects] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  
  // Editing states
  const [editingProject, setEditingProject] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);
  const [payrollMembers, setPayrollMembers] = useState([]);

  // AI State
  const [aiInput, setAiInput] = useState('');
  const [aiProcessing, setAiProcessing] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInAnonymously(auth); 
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) { console.error(e); }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const projectsRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'projects');
    const expensesRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'expenses');

    const unsubProjects = onSnapshot(projectsRef, (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    }, (err) => console.error(err));

    const unsubExpenses = onSnapshot(expensesRef, (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
      setLoading(false);
    }, (err) => console.error(err));

    return () => {
      unsubProjects();
      unsubExpenses();
    };
  }, [user]);

  const stats = useMemo(() => {
    const totalRevenue = projects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
    const totalPayroll = projects.reduce((sum, p) => {
      const pSum = (p.payrollMembers || []).reduce((mSum, m) => mSum + (Number(m.pay) || 0), 0);
      return sum + pSum;
    }, 0);
    const totalGeneralExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const trendsObj = {};
    
    projects.forEach(p => {
      if (!p.date) return;
      const d = new Date(p.date);
      const m = monthNames[d.getMonth()];
      if (!trendsObj[m]) trendsObj[m] = { name: m, revenue: 0 };
      trendsObj[m].revenue += (Number(p.budget) || 0);
    });

    const incomeChartData = monthNames.map(m => trendsObj[m] || { name: m, revenue: 0 });
    return { 
      totalRevenue, 
      totalPayroll, 
      totalGeneralExpenses,
      totalCosts: totalPayroll + totalGeneralExpenses,
      netProfit: totalRevenue - (totalPayroll + totalGeneralExpenses), 
      incomeChartData 
    };
  }, [projects, expenses]);

  const filteredProjects = useMemo(() => {
    return projects.filter(p => 
      (p.client?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (p.event?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    ).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [projects, searchTerm]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => 
      (e.title?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (e.category?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    ).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [expenses, searchTerm]);

  const handleSaveProject = async (e) => {
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
    const path = ['artifacts', APP_ID, 'public', 'data', 'projects'];
    if (editingProject) await updateDoc(doc(db, ...path, editingProject.id), data);
    else await addDoc(collection(db, ...path), { ...data, createdAt: new Date().toISOString() });
    setIsProjectModalOpen(false);
  };

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      title: fd.get('title'),
      category: fd.get('category'),
      amount: Number(fd.get('amount')),
      date: fd.get('date'),
      notes: fd.get('notes'),
      updatedAt: new Date().toISOString()
    };
    const path = ['artifacts', APP_ID, 'public', 'data', 'expenses'];
    if (editingExpense) await updateDoc(doc(db, ...path, editingExpense.id), data);
    else await addDoc(collection(db, ...path), { ...data, createdAt: new Date().toISOString() });
    setIsExpenseModalOpen(false);
  };

  const handleAiSync = async () => {
    if (!aiInput.trim()) return;
    setAiProcessing(true);
    const apiKey = "";
    const systemPrompt = `You are a production data parser for UY Studios. 
    Analyze the provided raw text (likely from a Google Doc) and extract production projects. 
    Return a JSON object with an 'items' array. Each item MUST have:
    - client: string (e.g. "Nike")
    - event: string (e.g. "Commercial Shoot")
    - date: string (YYYY-MM-DD)
    - budget: number (numeric value only)
    - status: string (One of: "Completed", "In Progress", "Pending")
    Ignore non-project text. If no date is found, use today's date.`;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: aiInput }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      const result = await response.json();
      const extracted = JSON.parse(result.candidates[0].content.parts[0].text);
      
      const projectsRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'projects');
      for (const item of extracted.items) {
        await addDoc(projectsRef, {
          ...item,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          payrollMembers: []
        });
      }
      setIsAiModalOpen(false);
      setAiInput('');
    } catch (error) {
      console.error(error);
    } finally {
      setAiProcessing(false);
    }
  };

  if (loading && !user) return <div className="min-h-screen bg-[#020617] flex items-center justify-center text-indigo-500 animate-pulse font-black uppercase tracking-widest text-xs">Syncing Studio Cloud...</div>;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 flex flex-col md:flex-row font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-[#0F172A] border-r border-white/5 flex flex-col h-screen sticky top-0 hidden md:flex">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/20"><Film size={20} /></div>
            <h1 className="text-lg font-black tracking-tighter uppercase text-white">UY Studios</h1>
          </div>
          <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest px-1">Production Registry</div>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          <SidebarLink icon={<LayoutDashboard size={18}/>} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarLink icon={<Briefcase size={18}/>} label="Productions" active={activeTab === 'projects'} onClick={() => setActiveTab('projects')} />
          <SidebarLink icon={<Receipt size={18}/>} label="Expenses" active={activeTab === 'expenses'} onClick={() => setActiveTab('expenses')} />
        </nav>
        <div className="p-6">
          <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
             <div className="text-[9px] font-black uppercase text-slate-500 mb-1 tracking-widest">Net Profit</div>
             <div className={`text-sm font-black ${stats.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>${stats.netProfit.toLocaleString()}</div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-20 border-b border-white/5 px-8 flex items-center justify-between bg-[#020617]/50 backdrop-blur-md sticky top-0 z-50">
          <div className="relative w-96 hidden md:block">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
            <input type="text" placeholder={`Search ${activeTab}...`} className="bg-white/5 border border-white/5 rounded-2xl px-11 py-2.5 text-xs w-full outline-none focus:border-indigo-500/50" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          
          <div className="flex gap-3">
             {activeTab === 'projects' && (
                <button onClick={() => setIsAiModalOpen(true)} className="bg-white/5 border border-white/10 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black flex items-center gap-2 hover:bg-white/10 uppercase tracking-widest">
                  <Sparkles size={14} className="text-indigo-400" /> Sync from Document
                </button>
             )}
             {activeTab === 'expenses' ? (
                <button onClick={() => { setEditingExpense(null); setIsExpenseModalOpen(true); }} className="bg-rose-600 text-white px-6 py-2.5 rounded-2xl text-[10px] font-black flex items-center gap-2 hover:bg-rose-500 shadow-lg shadow-rose-600/20 uppercase tracking-widest">
                  <Plus size={16} /> LOG EXPENSE
                </button>
             ) : (
                <button onClick={() => { setEditingProject(null); setPayrollMembers([]); setIsProjectModalOpen(true); }} className="bg-indigo-600 text-white px-6 py-2.5 rounded-2xl text-[10px] font-black flex items-center gap-2 hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 uppercase tracking-widest">
                  <Plus size={16} /> NEW PRODUCTION
                </button>
             )}
          </div>
        </header>

        <main className="p-4 md:p-8 space-y-8">
          {activeTab === 'dashboard' && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Gross Revenue" value={`$${stats.totalRevenue.toLocaleString()}`} color="indigo" icon={<TrendingUp size={16}/>} />
                <StatCard label="Total Costs" value={`$${stats.totalCosts.toLocaleString()}`} color="rose" icon={<ArrowDownCircle size={16}/>} />
                <StatCard label="Net Profit" value={`$${stats.netProfit.toLocaleString()}`} color="emerald" icon={<CheckCircle2 size={16}/>} />
                <StatCard label="Active Jobs" value={projects.filter(p => p.status === 'In Progress').length} color="amber" icon={<Calendar size={16}/>} />
              </div>

              <div className="bg-[#0F172A] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden">
                <h3 className="text-[10px] font-black uppercase text-slate-500 mb-10 tracking-widest opacity-50">Revenue Trends</h3>
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
                      <th className="px-8 py-5">Production</th>
                      <th className="px-8 py-5">Logistics</th>
                      <th className="px-8 py-5 text-right">Revenue</th>
                      <th className="px-8 py-5">Status</th>
                      <th className="px-8 py-5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredProjects.map(p => (
                      <tr key={p.id} className="hover:bg-white/[0.02] group transition-colors">
                        <td className="px-8 py-6">
                          <div className="text-sm font-bold text-white leading-none mb-1">{p.client}</div>
                          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter flex items-center gap-2">
                            {p.event} • {p.date}
                            {p.payrollMembers?.length > 0 && <span className="text-indigo-400 font-black flex items-center gap-1"><Users size={10}/> {p.payrollMembers.length}</span>}
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                            <MapPin size={12} className="text-indigo-500 opacity-50" />
                            <span className="truncate max-w-[150px]">{p.location || 'TBD'}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right font-black text-white text-xs">
                          ${(Number(p.budget) || 0).toLocaleString()}
                        </td>
                        <td className="px-8 py-6"><StatusBadge status={p.status} /></td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditingProject(p); setPayrollMembers(p.payrollMembers || []); setIsProjectModalOpen(true); }} className="p-2 text-slate-500 hover:text-white"><Edit2 size={14}/></button>
                            <button onClick={async () => { if(confirm("Delete?")) await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'projects', p.id)) }} className="p-2 text-slate-500 hover:text-rose-400"><Trash2 size={14}/></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'expenses' && (
            <div className="bg-[#0F172A] rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl">
               <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] uppercase font-black tracking-widest text-slate-500 border-b border-white/5">
                      <th className="px-8 py-5">Expense Title</th>
                      <th className="px-8 py-5">Category</th>
                      <th className="px-8 py-5 text-right">Amount</th>
                      <th className="px-8 py-5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredExpenses.map(e => (
                      <tr key={e.id} className="hover:bg-white/[0.02] group transition-colors">
                        <td className="px-8 py-6">
                          <div className="text-sm font-bold text-white leading-none mb-1">{e.title}</div>
                          <div className="text-[10px] text-slate-500">{e.date}</div>
                        </td>
                        <td className="px-8 py-6">
                           <span className="text-[10px] uppercase font-black bg-white/5 px-2 py-1 rounded text-slate-400 border border-white/5">{e.category}</span>
                        </td>
                        <td className="px-8 py-6 text-right font-black text-rose-400 text-xs">
                          -${(Number(e.amount) || 0).toLocaleString()}
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditingExpense(e); setIsExpenseModalOpen(true); }} className="p-2 text-slate-500 hover:text-white"><Edit2 size={14}/></button>
                            <button onClick={async () => { if(confirm("Delete?")) await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'expenses', e.id)) }} className="p-2 text-slate-500 hover:text-rose-400"><Trash2 size={14}/></button>
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

      {/* AI Sync Modal */}
      {isAiModalOpen && (
        <Modal title="Sync Productions via AI" onClose={() => setIsAiModalOpen(false)}>
          <div className="space-y-6">
            <p className="text-xs text-slate-400 leading-relaxed">Paste the content from your Google Doc or spreadsheet below. Our AI will automatically extract the production details and add them to your database.</p>
            <textarea 
              className="w-full h-64 bg-white/5 border border-white/10 rounded-2xl p-6 text-sm text-white outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-700" 
              placeholder="Paste project list here..."
              value={aiInput}
              onChange={e => setAiInput(e.target.value)}
            />
            <button 
              onClick={handleAiSync}
              disabled={aiProcessing || !aiInput.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-3"
            >
              {aiProcessing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {aiProcessing ? 'Processing Data...' : 'Start Intelligent Sync'}
            </button>
          </div>
        </Modal>
      )}

      {/* Project Modal */}
      {isProjectModalOpen && (
        <Modal title={`${editingProject ? 'Modify' : 'New'} Production`} onClose={() => setIsProjectModalOpen(false)}>
          <form onSubmit={handleSaveProject} className="space-y-8">
            <div className="grid grid-cols-2 gap-6">
              <FormInput label="Client" name="client" defaultValue={editingProject?.client} required />
              <FormInput label="Event" name="event" defaultValue={editingProject?.event} required />
            </div>
            <div className="grid grid-cols-2 gap-6">
              <FormInput label="Location" name="location" defaultValue={editingProject?.location} />
              <FormInput label="Maps URL" name="locationUrl" defaultValue={editingProject?.locationUrl} />
            </div>
            <div className="grid grid-cols-2 gap-6">
              <FormInput label="Date" name="date" type="date" defaultValue={editingProject?.date} />
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Status</label>
                <select name="status" defaultValue={editingProject?.status || 'Pending'} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-sm text-white outline-none">
                  {STATUS_OPTIONS.map(s => <option key={s} value={s} className="bg-[#0F172A]">{s}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <FormInput label="Budget ($)" name="budget" type="number" defaultValue={editingProject?.budget} />
              <FormInput label="Paid ($)" name="paid" type="number" defaultValue={editingProject?.paid} />
            </div>
            <div className="pt-6 border-t border-white/5 space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Crew Payroll</label>
                <button type="button" onClick={() => setPayrollMembers([...payrollMembers, { id: Date.now(), name: '', pay: '', role: '' }])} className="text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-white transition-all">+ Add Member</button>
              </div>
              {payrollMembers.map(m => (
                <div key={m.id} className="grid grid-cols-12 gap-3 items-center bg-white/5 p-4 rounded-2xl border border-white/5">
                  <input placeholder="Name" className="col-span-4 bg-transparent text-xs outline-none text-white" value={m.name} onChange={e => setPayrollMembers(payrollMembers.map(item => item.id === m.id ? {...item, name: e.target.value} : item))} />
                  <input placeholder="Role" className="col-span-4 bg-transparent text-xs outline-none text-slate-400" value={m.role} onChange={e => setPayrollMembers(payrollMembers.map(item => item.id === m.id ? {...item, role: e.target.value} : item))} />
                  <input placeholder="$ Pay" type="number" className="col-span-3 bg-transparent text-xs text-rose-400 font-bold outline-none text-right" value={m.pay} onChange={e => setPayrollMembers(payrollMembers.map(item => item.id === m.id ? {...item, pay: e.target.value} : item))} />
                  <button type="button" onClick={() => setPayrollMembers(payrollMembers.filter(item => item.id !== m.id))} className="col-span-1 text-rose-500/50 hover:text-rose-500 flex justify-center"><MinusCircle size={16}/></button>
                </div>
              ))}
            </div>
            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-[10px] transition-all">Update Database</button>
          </form>
        </Modal>
      )}

      {/* Expense Modal */}
      {isExpenseModalOpen && (
        <Modal title={`${editingExpense ? 'Edit' : 'Log'} Studio Expense`} onClose={() => setIsExpenseModalOpen(false)}>
          <form onSubmit={handleSaveExpense} className="space-y-8">
            <FormInput label="Title" name="title" defaultValue={editingExpense?.title} required />
            <div className="grid grid-cols-2 gap-6">
               <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Category</label>
                <select name="category" defaultValue={editingExpense?.category || 'Equipment'} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-sm text-white outline-none">
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c} className="bg-[#0F172A]">{c}</option>)}
                </select>
              </div>
              <FormInput label="Amount ($)" name="amount" type="number" defaultValue={editingExpense?.amount} required />
            </div>
            <FormInput label="Date" name="date" type="date" defaultValue={editingExpense?.date || new Date().toISOString().split('T')[0]} />
            <FormInput label="Notes" name="notes" defaultValue={editingExpense?.notes} />
            <button type="submit" className="w-full bg-rose-600 hover:bg-rose-500 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-[10px] transition-all shadow-xl shadow-rose-600/20">Log Expense</button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function SidebarLink({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-xl text-xs font-black transition-all ${active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/20' : 'text-slate-500 hover:bg-white/5 hover:text-white'}`}>
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
    <div className={`p-6 rounded-[2rem] border ${themes[color]} shadow-lg transition-transform hover:scale-[1.02] cursor-default`}>
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
      <input {...props} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white focus:border-indigo-500 outline-none transition-colors placeholder:text-slate-700" />
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-[#020617]/95 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-[#0F172A] border border-white/10 w-full max-w-2xl rounded-[3rem] p-10 max-h-[90vh] overflow-y-auto shadow-2xl relative">
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-xl font-black text-white uppercase tracking-tighter">{title}</h2>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-white transition-all"><X /></button>
        </div>
        {children}
      </div>
    </div>
  );
}