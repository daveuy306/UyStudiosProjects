import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Edit2, Trash2, X, MapPin, LayoutDashboard, 
  Briefcase, BarChart3, Film, CheckCircle2, 
  TrendingUp, Users, Calendar, 
  UserPlus, MinusCircle, Database, Link as LinkIcon,
  Receipt, Wallet, ArrowDownCircle, ArrowUpCircle, Sparkles, Loader2, AlertCircle
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
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';

// Environment variables
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'uystudios-prod';

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
  const [aiError, setAiError] = useState(null);

  // Auth Initialization
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) {
        console.error("Auth Error:", e);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Data Sync
  useEffect(() => {
    if (!user) return;
    
    const projectsRef = collection(db, 'artifacts', appId, 'public', 'data', 'projects');
    const expensesRef = collection(db, 'artifacts', appId, 'public', 'data', 'expenses');

    const unsubProjects = onSnapshot(projectsRef, (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    }, (err) => console.error("Firestore Projects Error:", err));

    const unsubExpenses = onSnapshot(expensesRef, (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
      setLoading(false);
    }, (err) => console.error("Firestore Expenses Error:", err));

    return () => {
      unsubProjects();
      unsubExpenses();
    };
  }, [user]);

  const stats = useMemo(() => {
    const totalRevenue = (projects || []).reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
    const totalPayroll = (projects || []).reduce((sum, p) => {
      const pSum = (p.payrollMembers || []).reduce((mSum, m) => mSum + (Number(m.pay) || 0), 0);
      return sum + pSum;
    }, 0);
    const totalGeneralExpenses = (expenses || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const trendsObj = {};
    
    (projects || []).forEach(p => {
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
    return (projects || []).filter(p => 
      (p.client?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (p.event?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    ).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [projects, searchTerm]);

  const filteredExpenses = useMemo(() => {
    return (expenses || []).filter(e => 
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
    const path = ['artifacts', appId, 'public', 'data', 'projects'];
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
    const path = ['artifacts', appId, 'public', 'data', 'expenses'];
    if (editingExpense) await updateDoc(doc(db, ...path, editingExpense.id), data);
    else await addDoc(collection(db, ...path), { ...data, createdAt: new Date().toISOString() });
    setIsExpenseModalOpen(false);
  };

  const handleAiSync = async () => {
    if (!aiInput.trim()) return;
    setAiProcessing(true);
    setAiError(null);
    const apiKey = ""; // Provided by env
    
    const systemPrompt = `Analyze production text and extract jobs. 
    Return ONLY JSON: { "items": [{ "client": string, "event": string, "date": "YYYY-MM-DD", "budget": number, "status": "Pending" }] }.`;

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
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Could not parse data.");

      const extracted = JSON.parse(text);
      const projectsRef = collection(db, 'artifacts', appId, 'public', 'data', 'projects');
      
      for (const item of (extracted.items || [])) {
        await addDoc(projectsRef, {
          ...item,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          payrollMembers: [],
          paid: 0,
          location: "",
          locationUrl: ""
        });
      }
      
      setIsAiModalOpen(false);
      setAiInput('');
    } catch (error) {
      setAiError("Sync failed. Check format.");
    } finally {
      setAiProcessing(false);
    }
  };

  if (loading && !user) return <div className="min-h-screen bg-[#020617] flex items-center justify-center text-indigo-500 font-black uppercase tracking-widest text-xs">Loading Cloud...</div>;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 flex flex-col md:flex-row font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-[#0F172A] border-b md:border-r border-white/5 flex flex-col md:h-screen shrink-0">
        <div className="p-6 md:p-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white"><Film size={20} /></div>
            <h1 className="text-lg font-black tracking-tighter uppercase text-white">UY Studios</h1>
          </div>
        </div>
        <nav className="flex md:flex-col px-4 pb-4 md:space-y-1 overflow-x-auto md:overflow-x-visible">
          <SidebarLink icon={<LayoutDashboard size={18}/>} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarLink icon={<Briefcase size={18}/>} label="Productions" active={activeTab === 'projects'} onClick={() => setActiveTab('projects')} />
          <SidebarLink icon={<Receipt size={18}/>} label="Expenses" active={activeTab === 'expenses'} onClick={() => setActiveTab('expenses')} />
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <header className="h-20 border-b border-white/5 px-6 md:px-8 flex items-center justify-between bg-[#020617]/50 backdrop-blur-md sticky top-0 z-50 shrink-0">
          <div className="relative w-64 hidden lg:block">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
            <input type="text" placeholder={`Search...`} className="bg-white/5 border border-white/5 rounded-2xl px-11 py-2.5 text-xs w-full outline-none focus:border-indigo-500/50" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          
          <div className="flex gap-2">
             {activeTab === 'projects' && (
                <button onClick={() => setIsAiModalOpen(true)} className="bg-white/5 border border-white/10 text-white px-3 md:px-5 py-2.5 rounded-2xl text-[10px] font-black flex items-center gap-2 uppercase tracking-widest transition-all">
                  <Sparkles size={14} className="text-indigo-400" /> <span className="hidden md:inline">Sync Document</span>
                </button>
             )}
             <button onClick={() => { activeTab === 'expenses' ? setIsExpenseModalOpen(true) : setIsProjectModalOpen(true); }} className="bg-indigo-600 text-white px-4 md:px-6 py-2.5 rounded-2xl text-[10px] font-black flex items-center gap-2 shadow-lg shadow-indigo-600/20 uppercase tracking-widest">
               <Plus size={16} /> <span className="hidden md:inline">Create</span>
             </button>
          </div>
        </header>

        <main className="p-4 md:p-8 space-y-6 md:space-y-8">
          {activeTab === 'dashboard' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard label="Revenue" value={`$${stats.totalRevenue.toLocaleString()}`} color="indigo" icon={<TrendingUp size={16}/>} />
                <StatCard label="Costs" value={`$${stats.totalCosts.toLocaleString()}`} color="rose" icon={<ArrowDownCircle size={16}/>} />
                <StatCard label="Profit" value={`$${stats.netProfit.toLocaleString()}`} color="emerald" icon={<CheckCircle2 size={16}/>} />
                <StatCard label="Active" value={projects.filter(p => p.status === 'In Progress').length} color="amber" icon={<Calendar size={16}/>} />
              </div>

              <div className="bg-[#0F172A] p-6 md:p-8 rounded-[2rem] border border-white/5 shadow-2xl overflow-hidden">
                <h3 className="text-[10px] font-black uppercase text-slate-500 mb-6 tracking-widest opacity-50">Studio Performance</h3>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.incomeChartData}>
                      <XAxis dataKey="name" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{background: '#0F172A', border: 'none', borderRadius: '12px'}} />
                      <Area type="monotone" dataKey="revenue" stroke="#6366f1" fill="#6366f120" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          {activeTab === 'projects' && (
            <div className="bg-[#0F172A] rounded-[2rem] border border-white/5 overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[600px]">
                  <thead>
                    <tr className="text-[10px] uppercase font-black tracking-widest text-slate-500 border-b border-white/5">
                      <th className="px-8 py-5">Production</th>
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
                          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">{p.event} • {p.date}</div>
                        </td>
                        <td className="px-8 py-6 text-right font-black text-white text-xs">${(Number(p.budget) || 0).toLocaleString()}</td>
                        <td className="px-8 py-6"><StatusBadge status={p.status} /></td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditingProject(p); setIsProjectModalOpen(true); }} className="p-2 text-slate-500 hover:text-white transition-all"><Edit2 size={14}/></button>
                            <button onClick={async () => { if(confirm("Delete project?")) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', p.id)) }} className="p-2 text-slate-500 hover:text-rose-400 transition-all"><Trash2 size={14}/></button>
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
            <div className="bg-[#0F172A] rounded-[2rem] border border-white/5 overflow-hidden shadow-2xl">
               <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[600px]">
                  <thead>
                    <tr className="text-[10px] uppercase font-black tracking-widest text-slate-500 border-b border-white/5">
                      <th className="px-8 py-5">Expense</th>
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
                        <td className="px-8 py-6"><span className="text-[10px] uppercase font-black bg-white/5 px-2 py-1 rounded text-slate-400">{e.category}</span></td>
                        <td className="px-8 py-6 text-right font-black text-rose-400 text-xs">-${(Number(e.amount) || 0).toLocaleString()}</td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditingExpense(e); setIsExpenseModalOpen(true); }} className="p-2 text-slate-500 hover:text-white"><Edit2 size={14}/></button>
                            <button onClick={async () => { if(confirm("Delete expense?")) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'expenses', e.id)) }} className="p-2 text-slate-500 hover:text-rose-400"><Trash2 size={14}/></button>
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

      {/* Modals */}
      {isAiModalOpen && (
        <Modal title="Document Content Sync" onClose={() => setIsAiModalOpen(false)}>
          <div className="space-y-4">
            <textarea className="w-full h-48 bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white outline-none focus:border-indigo-500" placeholder="Paste data here..." value={aiInput} onChange={e => setAiInput(e.target.value)} disabled={aiProcessing} />
            <button onClick={handleAiSync} disabled={aiProcessing || !aiInput.trim()} className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] flex items-center justify-center gap-2">
              {aiProcessing ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
              {aiProcessing ? 'Syncing...' : 'Start Intelligent Sync'}
            </button>
          </div>
        </Modal>
      )}

      {isProjectModalOpen && (
        <Modal title="Production Details" onClose={() => setIsProjectModalOpen(false)}>
          <form onSubmit={handleSaveProject} className="space-y-4">
            <FormInput label="Client" name="client" defaultValue={editingProject?.client} required />
            <FormInput label="Event" name="event" defaultValue={editingProject?.event} required />
            <div className="grid grid-cols-2 gap-4">
              <FormInput label="Date" name="date" type="date" defaultValue={editingProject?.date} />
              <FormInput label="Budget" name="budget" type="number" defaultValue={editingProject?.budget} />
            </div>
            <button type="submit" className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-[10px]">Save Production</button>
          </form>
        </Modal>
      )}

      {isExpenseModalOpen && (
        <Modal title="Studio Expense" onClose={() => setIsExpenseModalOpen(false)}>
          <form onSubmit={handleSaveExpense} className="space-y-4">
            <FormInput label="Title" name="title" defaultValue={editingExpense?.title} required />
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Category</label>
                <select name="category" defaultValue={editingExpense?.category || 'Equipment'} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-sm text-white outline-none">
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c} className="bg-[#0F172A]">{c}</option>)}
                </select>
              </div>
              <FormInput label="Amount" name="amount" type="number" defaultValue={editingExpense?.amount} required />
            </div>
            <button type="submit" className="w-full bg-rose-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-[10px]">Log Expense</button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function SidebarLink({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className={`flex md:w-full items-center gap-3 px-5 py-3.5 rounded-xl text-xs font-black transition-all shrink-0 ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-white'}`}>
      {icon} <span className="uppercase tracking-widest hidden md:inline">{label}</span>
    </button>
  );
}

function StatCard({ label, value, color, icon }) {
  const styles = { indigo: 'border-indigo-500/20 text-indigo-400', rose: 'border-rose-500/20 text-rose-400', emerald: 'border-emerald-500/20 text-emerald-400', amber: 'border-amber-500/20 text-amber-400' };
  return (
    <div className={`p-6 rounded-[2rem] border bg-white/[0.02] ${styles[color]}`}>
      <div className="flex justify-between items-center mb-1 text-[9px] font-black uppercase tracking-widest opacity-60">{label} {icon}</div>
      <div className="text-xl font-black text-white">{value}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = { 'Completed': 'text-emerald-400 bg-emerald-400/10', 'In Progress': 'text-indigo-400 bg-indigo-400/10', 'Pending': 'text-slate-500 bg-slate-500/10' };
  return <span className={`text-[9px] font-black px-2 py-1 rounded uppercase ${styles[status] || styles.Pending}`}>{status}</span>;
}

function FormInput({ label, ...props }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">{label}</label>
      <input {...props} className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-sm text-white focus:border-indigo-500 outline-none" />
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-[#020617]/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-[#0F172A] border border-white/10 w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl relative">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-black text-white uppercase tracking-widest">{title}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={20}/></button>
        </div>
        {children}
      </div>
    </div>
  );
}