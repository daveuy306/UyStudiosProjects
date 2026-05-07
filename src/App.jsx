import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  onSnapshot, 
  setDoc
} from 'firebase/firestore';
import { 
  getAuth,
  signInWithCustomToken,
  signInAnonymously,
  onAuthStateChanged
} from 'firebase/auth';
import { 
  Users, Plus, Trash2, Briefcase, 
  CheckCircle2, UserPlus, MapPin, 
  DollarSign, ExternalLink,
  ShieldCheck, Calendar, ShoppingCart,
  Tag, Receipt, BarChart3, TrendingUp,
  Clock, Wallet, CreditCard, Activity, X
} from 'lucide-react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Line
} from 'recharts';

// --- SAFE INITIALIZATION WRAPPER ---
// This prevents the "invalid-api-key" error by only initializing if a valid key exists
const getFirebaseInstance = () => {
  const configStr = typeof __firebase_config !== 'undefined' ? __firebase_config : null;
  if (!configStr) return { app: null, db: null, auth: null, valid: false };
  
  try {
    const config = JSON.parse(configStr);
    // Basic validation to ensure we aren't using a "preview" placeholder string
    if (!config.apiKey || config.apiKey === 'preview') {
      return { app: null, db: null, auth: null, valid: false };
    }
    
    const app = getApps().length > 0 ? getApp() : initializeApp(config);
    const db = getFirestore(app);
    const auth = getAuth(app);
    return { app, db, auth, valid: true };
  } catch (e) {
    console.warn("Firebase config parsing failed:", e);
    return { app: null, db: null, auth: null, valid: false };
  }
};

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState('connecting');
  const [projects, setProjects] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjectDraft, setNewProjectDraft] = useState({
    name: '',
    location: '',
    budget: '',
    amountPaid: '',
    mapLink: '',
    notes: ''
  });

  const appId = typeof __app_id !== 'undefined' ? __app_id : 'uy-project-manager';

  // --- AUTHENTICATION & INITIALIZATION ---
  useEffect(() => {
    const { auth, valid } = getFirebaseInstance();
    
    if (!valid) {
      setSyncStatus('offline');
      setLoading(false);
      return;
    }

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth failed:", err);
        setSyncStatus('offline');
      } finally {
        setLoading(false);
      }
    };

    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) setSyncStatus('synced');
    });
    
    return () => unsubscribe();
  }, []);

  // --- DATABASE SYNC ---
  useEffect(() => {
    const { db, valid } = getFirebaseInstance();
    if (!user || !valid) return;

    const dataDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'projects_v3');
    
    const unsubscribe = onSnapshot(dataDocRef, (snap) => {
      if (snap.exists()) {
        setProjects(snap.data().projects || []);
      }
      setSyncStatus('synced');
    }, (err) => {
      console.warn("Firestore sync error:", err);
      setSyncStatus('error');
    });
    
    return () => unsubscribe();
  }, [user]);

  const syncToCloud = async (newProjects) => {
    setProjects(newProjects);
    const { db, valid } = getFirebaseInstance();
    if (!user || !valid) return;

    try {
      const dataDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'projects_v3');
      await setDoc(dataDocRef, { projects: newProjects }, { merge: true });
    } catch (err) {
      setSyncStatus('error');
    }
  };

  // --- ANALYTICS CALCULATIONS ---
  const stats = useMemo(() => {
    const ongoing = projects.filter(p => p.progress !== 'completed').length;
    let totalBudget = 0;
    let totalPaid = 0;
    let totalExpenses = 0;

    projects.forEach(p => {
      totalBudget += parseFloat(p.budget) || 0;
      totalPaid += parseFloat(p.amountPaid) || 0;
      (p.expenses || []).forEach(e => {
        totalExpenses += parseFloat(e.price) || 0;
      });
    });

    return {
      ongoing,
      totalOwing: Math.max(0, totalBudget - totalPaid),
      annualRevenue: totalPaid,
      annualExpenses: totalExpenses
    };
  }, [projects]);

  const chartData = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        name: d.toLocaleString('default', { month: 'short' }),
        fullDate: d,
        revenue: 0,
        owing: 0,
        expenses: 0
      });
    }

    projects.forEach(p => {
      const budget = parseFloat(p.budget) || 0;
      const paid = parseFloat(p.amountPaid) || 0;
      const currentMonthIdx = months.length - 1; 
      months[currentMonthIdx].revenue += paid;
      months[currentMonthIdx].owing += Math.max(0, budget - paid);
      
      (p.expenses || []).forEach(e => {
        const expDate = new Date(e.date);
        const mIdx = months.findIndex(m => 
          m.fullDate.getMonth() === expDate.getMonth() && 
          m.fullDate.getFullYear() === expDate.getFullYear()
        );
        if (mIdx !== -1) months[mIdx].expenses += (parseFloat(e.price) || 0);
      });
    });

    return months;
  }, [projects]);

  // --- INTERACTION HANDLERS ---
  const handleInitiate = () => {
    const newProject = {
      ...newProjectDraft,
      id: crypto.randomUUID(),
      progress: 'not-started',
      team: [],
      expenses: []
    };
    syncToCloud([...projects, newProject]);
    setIsModalOpen(false);
    setNewProjectDraft({ name: '', location: '', budget: '', amountPaid: '', mapLink: '', notes: '' });
  };

  const updateProject = (id, updates) => {
    syncToCloud(projects.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const removeProject = (id) => {
    syncToCloud(projects.filter(p => p.id !== id));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0c10]">
        <div className="w-12 h-12 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4" />
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Encrypting Session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0c10] text-slate-200 p-4 md:p-12 font-sans selection:bg-blue-500/30 overflow-x-hidden">
      <div className="max-w-7xl mx-auto">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-blue-600 p-2.5 rounded-2xl shadow-lg shadow-blue-600/30">
                <Briefcase className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white uppercase italic">UY STUDIOS</h1>
            </div>
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border ${
              syncStatus === 'synced' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-500' : 
              syncStatus === 'error' ? 'bg-rose-500/5 border-rose-500/20 text-rose-500' : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${syncStatus === 'synced' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              <span className="text-[10px] font-black uppercase tracking-tighter">
                {syncStatus === 'synced' ? 'Cloud Link Secured' : syncStatus === 'error' ? 'Sync Interrupted' : 'Working Offline'}
              </span>
            </div>
          </div>

          <button 
            onClick={() => setIsModalOpen(true)}
            className="group flex items-center justify-center gap-2 bg-white hover:bg-blue-50 text-slate-950 px-8 py-4 rounded-2xl font-black transition-all active:scale-95 shadow-xl uppercase text-sm tracking-tighter"
          >
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
            <span>Initiate New Project</span>
          </button>
        </header>

        {/* Global Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {[
            { label: 'Ongoing Projects', val: stats.ongoing, icon: Activity, color: 'text-blue-400' },
            { label: 'Total Client Owing', val: `$${stats.totalOwing.toLocaleString()}`, icon: Wallet, color: 'text-rose-400' },
            { label: 'Annual Revenue', val: `$${stats.annualRevenue.toLocaleString()}`, icon: CreditCard, color: 'text-emerald-400' },
            { label: 'Annual Expenses', val: `$${stats.annualExpenses.toLocaleString()}`, icon: Receipt, color: 'text-amber-400' }
          ].map((item, idx) => (
            <div key={idx} className="bg-[#11141b] border border-slate-800/60 p-6 rounded-[1.8rem] hover:border-slate-700 transition-all group">
              <div className="flex justify-between items-start mb-4">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{item.label}</p>
                <item.icon className={`w-5 h-5 ${item.color} opacity-40 group-hover:opacity-100 transition-opacity`} />
              </div>
              <p className="text-2xl font-black text-white">{item.val}</p>
            </div>
          ))}
        </div>

        {/* Financial Visualization */}
        <div className="mb-12 bg-[#11141b] border border-slate-800/60 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden min-h-[420px]">
          <div className="mb-8">
            <h2 className="text-lg font-black text-white flex items-center gap-2 uppercase tracking-tight">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              Financial Velocity
            </h2>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                  <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#1e293b" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 10, fontWeight: 900}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 10, fontWeight: 900}} tickFormatter={(val) => `$${val/1000}k`} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '16px' }} />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="url(#gRev)" strokeWidth={4} />
                <Area type="monotone" dataKey="expenses" stroke="#10b981" fill="url(#gExp)" strokeWidth={4} />
                <Line type="monotone" dataKey="owing" stroke="#f43f5e" strokeWidth={3} dot={{ r: 5, fill: '#f43f5e', strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Project List */}
        <div className="space-y-12 pb-24">
          {projects.map((project) => (
            <div key={project.id} className="bg-[#11141b] border border-slate-800/60 rounded-[2.5rem] overflow-hidden shadow-2xl transition-all hover:border-slate-700/60 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="p-8 bg-slate-900/30 border-b border-slate-800/50 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="flex-1 space-y-6">
                  <div className="flex items-center gap-4">
                    <input className="bg-transparent border-none focus:ring-0 text-2xl font-black text-white p-0 w-full placeholder:text-slate-800 uppercase italic tracking-tight" value={project.name} onChange={(e) => updateProject(project.id, { name: e.target.value })} />
                    <select value={project.progress} onChange={(e) => updateProject(project.id, { progress: e.target.value })} className={`text-[10px] font-black uppercase px-4 py-1.5 rounded-full border-none focus:ring-0 cursor-pointer shadow-lg ${project.progress === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : project.progress === 'in-progress' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-500'}`}>
                      <option value="not-started">Hold</option>
                      <option value="in-progress">Active</option>
                      <option value="completed">Complete</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2 bg-black/30 px-4 py-2.5 rounded-2xl border border-slate-800/50"><MapPin className="w-4 h-4 text-slate-600" /><input className="bg-transparent border-none focus:ring-0 text-xs text-slate-400 w-full p-0" value={project.location} onChange={(e) => updateProject(project.id, { location: e.target.value })} /></div>
                    <div className="flex items-center gap-2 bg-black/30 px-4 py-2.5 rounded-2xl border border-slate-800/50"><ExternalLink className="w-4 h-4 text-blue-500/50" /><input className="bg-transparent border-none focus:ring-0 text-xs text-blue-400 w-full p-0" value={project.mapLink} onChange={(e) => updateProject(project.id, { mapLink: e.target.value })} /></div>
                  </div>
                </div>
                <button onClick={() => removeProject(project.id)} className="p-4 text-slate-700 hover:text-rose-500 transition-all hover:bg-rose-500/5 rounded-2xl"><Trash2 className="w-6 h-6" /></button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12">
                <div className="lg:col-span-4 p-8 border-b lg:border-b-0 lg:border-r border-slate-800/50 space-y-10 bg-slate-950/20">
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2"><DollarSign className="w-3 h-3" /> Financials</p>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl group">
                        <label className="text-[9px] text-slate-500 font-black uppercase block mb-1">Contract</label>
                        <input className="bg-transparent border-none focus:ring-0 text-xl font-black w-full p-0 text-white" value={project.budget} onChange={(e) => updateProject(project.id, { budget: e.target.value })} />
                      </div>
                      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl group">
                        <label className="text-[9px] text-slate-500 font-black uppercase block mb-1">Paid</label>
                        <input className="bg-transparent border-none focus:ring-0 text-xl font-black w-full p-0 text-emerald-400" value={project.amountPaid} onChange={(e) => updateProject(project.id, { amountPaid: e.target.value })} />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2"><Tag className="w-3 h-3" /> Notes</p>
                    <textarea className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-5 text-xs text-slate-400 min-h-[160px] focus:ring-1 focus:ring-blue-500 outline-none resize-none leading-relaxed" value={project.notes} onChange={(e) => updateProject(project.id, { notes: e.target.value })} />
                  </div>
                </div>

                <div className="lg:col-span-8 flex flex-col bg-[#11141b]">
                  <div className="p-8 border-b border-slate-800/50">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Users className="w-3 h-3" /> Personnel</h3>
                      <button onClick={() => updateProject(project.id, { team: [...(project.team || []), { id: crypto.randomUUID(), name: '', role: '' }] })} className="px-4 py-2 bg-blue-600/10 text-blue-500 rounded-xl text-[10px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all">+ Staff</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(project.team || []).map((m) => (
                        <div key={m.id} className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl flex items-center justify-between group">
                          <div className="flex-1">
                            <input className="w-full bg-transparent border-none p-0 text-sm font-bold text-white uppercase" value={m.name} onChange={(e) => updateProject(project.id, { team: project.team.map(tm => tm.id === m.id ? { ...tm, name: e.target.value } : tm) })} />
                            <input className="w-full bg-transparent border-none p-0 text-[10px] text-slate-500 uppercase font-black" value={m.role} onChange={(e) => updateProject(project.id, { team: project.team.map(tm => tm.id === m.id ? { ...tm, role: e.target.value } : tm) })} />
                          </div>
                          <button onClick={() => updateProject(project.id, { team: project.team.filter(tm => tm.id !== m.id) })} className="opacity-0 group-hover:opacity-100 text-rose-500 transition-opacity"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-8 flex-1 bg-black/10">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><ShoppingCart className="w-3 h-3" /> Expenses</h3>
                      <button onClick={() => updateProject(project.id, { expenses: [...(project.expenses || []), { id: crypto.randomUUID(), date: new Date().toISOString().split('T')[0], name: '', reason: '', price: '' }] })} className="px-4 py-2 bg-emerald-600/10 text-emerald-500 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-600 hover:text-white transition-all">+ Log</button>
                    </div>
                    <div className="space-y-2">
                      {(project.expenses || []).map((exp) => (
                        <div key={exp.id} className="grid grid-cols-12 gap-3 bg-slate-900/40 p-2.5 rounded-xl border border-slate-800 items-center">
                          <input type="date" className="col-span-2 bg-transparent border-none p-0 text-[10px] text-slate-400 font-black" value={exp.date} onChange={(e) => updateProject(project.id, { expenses: project.expenses.map(ex => ex.id === exp.id ? { ...ex, date: e.target.value } : ex) })} />
                          <input className="col-span-3 bg-transparent border-none p-0 text-xs font-bold text-white uppercase" value={exp.name} placeholder="ITEM" onChange={(e) => updateProject(project.id, { expenses: project.expenses.map(ex => ex.id === exp.id ? { ...ex, name: e.target.value } : ex) })} />
                          <input className="col-span-4 bg-transparent border-none p-0 text-[10px] text-slate-600 font-black uppercase" value={exp.reason} placeholder="DESC" onChange={(e) => updateProject(project.id, { expenses: project.expenses.map(ex => ex.id === exp.id ? { ...ex, reason: e.target.value } : ex) })} />
                          <input className="col-span-2 bg-transparent border-none p-0 text-xs font-black text-emerald-500" value={exp.price} placeholder="0.00" onChange={(e) => updateProject(project.id, { expenses: project.expenses.map(ex => ex.id === exp.id ? { ...ex, price: e.target.value } : ex) })} />
                          <button onClick={() => updateProject(project.id, { expenses: project.expenses.filter(ex => ex.id !== exp.id) })} className="col-span-1 text-slate-800 hover:text-rose-500 ml-auto"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Initiation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-2xl bg-[#11141b] border border-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-xl font-black text-white italic tracking-tight uppercase">Initiate Asset</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-500 hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-8 grid grid-cols-2 gap-6">
              <div className="col-span-2 space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Title</label>
                <input className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white font-bold" placeholder="e.g. PROJECT X" value={newProjectDraft.name} onChange={(e) => setNewProjectDraft({...newProjectDraft, name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Location</label>
                <input className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-slate-400 text-sm" placeholder="City" value={newProjectDraft.location} onChange={(e) => setNewProjectDraft({...newProjectDraft, location: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Map URL</label>
                <input className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-blue-400 text-sm" placeholder="Link" value={newProjectDraft.mapLink} onChange={(e) => setNewProjectDraft({...newProjectDraft, mapLink: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Budget ($)</label>
                <input className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white font-black" placeholder="0" value={newProjectDraft.budget} onChange={(e) => setNewProjectDraft({...newProjectDraft, budget: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Deposit ($)</label>
                <input className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-emerald-400 font-black" placeholder="0" value={newProjectDraft.amountPaid} onChange={(e) => setNewProjectDraft({...newProjectDraft, amountPaid: e.target.value})} />
              </div>
              <div className="col-span-2 pt-4">
                <button 
                  onClick={handleInitiate}
                  disabled={!newProjectDraft.name}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-20 text-white p-5 rounded-2xl font-black uppercase tracking-widest transition-all"
                >
                  Create Project
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer Meta */}
      <footer className="max-w-7xl mx-auto pt-12 opacity-20 flex flex-col md:flex-row items-center justify-between gap-4 pb-20 border-t border-slate-900">
         <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-blue-500" />
            <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-500">System Verified</p>
         </div>
         <p className="text-[9px] font-black text-slate-700 uppercase tracking-[0.3em]">UY STUDIOS PM • BUILD 3.1.5</p>
      </footer>
    </div>
  );
};

export default App;