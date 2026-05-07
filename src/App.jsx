import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
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
  AlertCircle, RefreshCcw, 
  CheckCircle2, UserPlus, MapPin, 
  DollarSign, ExternalLink,
  ShieldCheck, Calendar, ShoppingCart,
  Tag, Receipt, BarChart3, TrendingUp,
  Clock, Wallet, CreditCard, Activity
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

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : { apiKey: "preview", authDomain: "preview", projectId: "preview" };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'uy-project-manager';

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState('connecting');
  const [retryCount, setRetryCount] = useState(0);
  const [projects, setProjects] = useState([]);

  // --- AUTHENTICATION ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Use custom token if provided, otherwise anonymous
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth Error:", err);
        // Fallback to local mode if auth fails
        setSyncStatus('offline');
      } finally {
        setLoading(false);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, [retryCount]);

  // --- DATABASE SYNC ---
  useEffect(() => {
    if (!user) return;
    const dataDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'projects_v3');
    
    // Set up real-time listener
    const unsubscribe = onSnapshot(dataDocRef, (snap) => {
      if (snap.exists()) {
        setProjects(snap.data().projects || []);
      }
      setSyncStatus('synced');
    }, (err) => {
      console.error("Firestore Error:", err);
      setSyncStatus('error');
    });
    
    return () => unsubscribe();
  }, [user]);

  const syncToCloud = async (newProjects) => {
    setProjects(newProjects);
    if (!user) return;
    try {
      const dataDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'projects_v3');
      await setDoc(dataDocRef, { projects: newProjects }, { merge: true });
      setSyncStatus('synced');
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
      const owing = Math.max(0, budget - paid);
      
      const currentMonthIdx = months.length - 1; 
      months[currentMonthIdx].revenue += paid;
      months[currentMonthIdx].owing += owing;
      
      (p.expenses || []).forEach(e => {
        const expDate = new Date(e.date);
        const expVal = parseFloat(e.price) || 0;
        const mIdx = months.findIndex(m => 
          m.fullDate.getMonth() === expDate.getMonth() && 
          m.fullDate.getFullYear() === expDate.getFullYear()
        );
        if (mIdx !== -1) months[mIdx].expenses += expVal;
      });
    });

    return months;
  }, [projects]);

  // --- HANDLERS ---
  const addProject = () => {
    const newProject = {
      id: crypto.randomUUID(),
      name: 'NEW PROJECT',
      location: '',
      budget: '',
      amountPaid: '',
      mapLink: '',
      notes: '',
      progress: 'not-started',
      team: [],
      expenses: []
    };
    syncToCloud([...projects, newProject]);
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
        <div className="w-12 h-12 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Waking Database Node...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0c10] text-slate-200 p-4 md:p-12 font-sans selection:bg-blue-500/30">
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
            <button 
              onClick={() => setRetryCount(c => c + 1)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all border ${
                syncStatus === 'synced' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-500' : 
                syncStatus === 'error' ? 'bg-rose-500/5 border-rose-500/20 text-rose-500 animate-pulse' : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${syncStatus === 'synced' ? 'bg-emerald-500' : 'bg-rose-500 animate-ping'}`} />
              <span className="text-[10px] font-black uppercase tracking-tighter">
                {syncStatus === 'synced' ? 'Cloud Secure' : 'Sync Error - Reconnecting'}
              </span>
            </button>
          </div>

          <button 
            onClick={addProject}
            className="group flex items-center justify-center gap-2 bg-white hover:bg-blue-50 text-slate-950 px-8 py-4 rounded-2xl font-black transition-all active:scale-95 shadow-xl uppercase text-sm tracking-tighter"
          >
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
            <span>Initiate New Project</span>
          </button>
        </header>

        {/* Dashboard Analytics Strip */}
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

        {/* Rolling 12-Month Trend Graph */}
        <div className="mb-12 bg-[#11141b] border border-slate-800/60 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <TrendingUp className="w-32 h-32 text-blue-500" />
          </div>
          <div className="flex items-center justify-between mb-8 relative z-10">
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2 uppercase tracking-tight">
                <BarChart3 className="w-5 h-5 text-blue-500" />
                Rolling 12-Month Financials
              </h2>
              <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest mt-1">Live Trend Analysis</p>
            </div>
            <div className="hidden lg:flex gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-[9px] font-black text-slate-500 uppercase">Revenue</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[9px] font-black text-slate-500 uppercase">Expenses</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)]" />
                <span className="text-[9px] font-black text-slate-500 uppercase">Client Owing</span>
              </div>
            </div>
          </div>
          
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#1e293b" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#475569', fontSize: 10, fontWeight: 900}}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#475569', fontSize: 10, fontWeight: 900}}
                  tickFormatter={(val) => `$${val/1000}k`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.3)' }}
                  itemStyle={{ fontSize: '11px', fontWeight: '900', textTransform: 'uppercase' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="url(#gRev)" strokeWidth={4} />
                <Area type="monotone" dataKey="expenses" stroke="#10b981" fill="url(#gExp)" strokeWidth={4} />
                <Line type="monotone" dataKey="owing" stroke="#f43f5e" strokeWidth={3} dot={{ r: 5, fill: '#f43f5e', strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Project Ledger */}
        <div className="space-y-12 pb-24">
          {projects.map((project) => (
            <div key={project.id} className="bg-[#11141b] border border-slate-800/60 rounded-[2.5rem] overflow-hidden shadow-2xl transition-all hover:border-slate-700/60">
              
              {/* Card Header */}
              <div className="p-8 bg-slate-900/30 border-b border-slate-800/50 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="flex-1 space-y-6">
                  <div className="flex items-center gap-4">
                    <input 
                      className="bg-transparent border-none focus:ring-0 text-2xl font-black text-white p-0 w-full placeholder:text-slate-800 uppercase italic tracking-tight"
                      value={project.name}
                      onChange={(e) => updateProject(project.id, { name: e.target.value })}
                      placeholder="ENTER PROJECT TITLE"
                    />
                    <select 
                      value={project.progress}
                      onChange={(e) => updateProject(project.id, { progress: e.target.value })}
                      className={`text-[10px] font-black uppercase px-4 py-1.5 rounded-full border-none focus:ring-0 cursor-pointer shadow-lg ${
                        project.progress === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                        project.progress === 'in-progress' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      <option value="not-started">Hold</option>
                      <option value="in-progress">In Progress</option>
                      <option value="completed">Complete</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2 bg-black/30 px-4 py-2.5 rounded-2xl border border-slate-800/50">
                      <MapPin className="w-4 h-4 text-slate-600" />
                      <input 
                        className="bg-transparent border-none focus:ring-0 text-xs text-slate-400 w-full p-0"
                        value={project.location}
                        onChange={(e) => updateProject(project.id, { location: e.target.value })}
                        placeholder="Project Location"
                      />
                    </div>
                    <div className="flex items-center gap-2 bg-black/30 px-4 py-2.5 rounded-2xl border border-slate-800/50">
                      <ExternalLink className="w-4 h-4 text-blue-500/50" />
                      <input 
                        className="bg-transparent border-none focus:ring-0 text-xs text-blue-400 w-full p-0"
                        value={project.mapLink}
                        onChange={(e) => updateProject(project.id, { mapLink: e.target.value })}
                        placeholder="Asset Maps / URL"
                      />
                    </div>
                  </div>
                </div>
                <button onClick={() => removeProject(project.id)} className="p-4 text-slate-700 hover:text-rose-500 transition-all hover:bg-rose-500/5 rounded-2xl">
                  <Trash2 className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12">
                
                {/* Financial Panel */}
                <div className="lg:col-span-4 p-8 border-b lg:border-b-0 lg:border-r border-slate-800/50 space-y-10 bg-slate-950/20">
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                      <DollarSign className="w-3 h-3" /> Financial Distribution
                    </p>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-inner group">
                        <label className="text-[9px] text-slate-500 font-black uppercase block mb-1">Contract Total</label>
                        <input 
                          type="text"
                          className="bg-transparent border-none focus:ring-0 text-xl font-black w-full p-0 text-white group-hover:text-blue-400 transition-colors"
                          value={project.budget}
                          onChange={(e) => updateProject(project.id, { budget: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-inner group">
                        <label className="text-[9px] text-slate-500 font-black uppercase block mb-1">Liquid Revenue (Paid)</label>
                        <input 
                          type="text"
                          className="bg-transparent border-none focus:ring-0 text-xl font-black w-full p-0 text-emerald-400"
                          value={project.amountPaid}
                          onChange={(e) => updateProject(project.id, { amountPaid: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                      <Tag className="w-3 h-3" /> Internal Notes
                    </p>
                    <textarea 
                      className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-5 text-xs text-slate-400 min-h-[160px] focus:ring-1 focus:ring-blue-500 outline-none resize-none leading-relaxed"
                      value={project.notes}
                      onChange={(e) => updateProject(project.id, { notes: e.target.value })}
                      placeholder="Internal brief, client requests, or milestone tracking..."
                    />
                  </div>
                </div>

                {/* Logistics Panel */}
                <div className="lg:col-span-8 flex flex-col bg-[#11141b]">
                  
                  {/* Team */}
                  <div className="p-8 border-b border-slate-800/50">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <Users className="w-3 h-3" /> Personnel
                      </h3>
                      <button 
                        onClick={() => {
                          const updated = projects.map(p => p.id === project.id ? { ...p, team: [...(p.team || []), { id: crypto.randomUUID(), name: '', role: '' }] } : p);
                          syncToCloud(updated);
                        }}
                        className="px-4 py-2 bg-blue-600/10 text-blue-500 rounded-xl text-[10px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all"
                      >
                        + Assign Staff
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(project.team || []).map((m) => (
                        <div key={m.id} className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl flex items-center justify-between group">
                          <div className="flex-1 space-y-1">
                            <input className="w-full bg-transparent border-none p-0 text-sm font-bold text-white uppercase placeholder:text-slate-800" value={m.name} placeholder="STAFF NAME" onChange={(e) => {
                              const nt = project.team.map(tm => tm.id === m.id ? { ...tm, name: e.target.value } : tm);
                              updateProject(project.id, { team: nt });
                            }} />
                            <input className="w-full bg-transparent border-none p-0 text-[10px] text-slate-500 uppercase font-black" value={m.role} placeholder="DESIGNATION" onChange={(e) => {
                              const nt = project.team.map(tm => tm.id === m.id ? { ...tm, role: e.target.value } : tm);
                              updateProject(project.id, { team: nt });
                            }} />
                          </div>
                          <button onClick={() => updateProject(project.id, { team: project.team.filter(tm => tm.id !== m.id) })} className="opacity-0 group-hover:opacity-100 text-rose-500/50 hover:text-rose-500 transition-all">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Expenses (Detailed) */}
                  <div className="p-8 flex-1 bg-black/10">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <ShoppingCart className="w-3 h-3" /> Ledger Details
                      </h3>
                      <button 
                        onClick={() => {
                          const exp = [...(project.expenses || []), { id: crypto.randomUUID(), date: new Date().toISOString().split('T')[0], name: '', reason: '', price: '' }];
                          updateProject(project.id, { expenses: exp });
                        }}
                        className="px-4 py-2 bg-emerald-600/10 text-emerald-500 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-600 hover:text-white transition-all"
                      >
                        + Log Expense
                      </button>
                    </div>
                    <div className="space-y-3">
                      {(project.expenses || []).map((exp) => (
                        <div key={exp.id} className="grid grid-cols-12 gap-4 bg-slate-900/40 p-3 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all items-center">
                          <div className="col-span-2 flex items-center gap-2">
                            <Calendar className="w-3 h-3 text-slate-600" />
                            <input type="date" className="bg-transparent border-none p-0 text-[10px] text-slate-400 font-black w-full" value={exp.date} onChange={(e) => {
                              const ne = project.expenses.map(ex => ex.id === exp.id ? { ...ex, date: e.target.value } : ex);
                              updateProject(project.id, { expenses: ne });
                            }} />
                          </div>
                          <div className="col-span-3">
                            <input className="bg-transparent border-none p-0 text-xs font-bold text-white w-full uppercase" value={exp.name} placeholder="ITEM NAME" onChange={(e) => {
                              const ne = project.expenses.map(ex => ex.id === exp.id ? { ...ex, name: e.target.value } : ex);
                              updateProject(project.id, { expenses: ne });
                            }} />
                          </div>
                          <div className="col-span-4">
                            <input className="bg-transparent border-none p-0 text-[10px] text-slate-600 font-black w-full uppercase" value={exp.reason} placeholder="CATEGORY" onChange={(e) => {
                              const ne = project.expenses.map(ex => ex.id === exp.id ? { ...ex, reason: e.target.value } : ex);
                              updateProject(project.id, { expenses: ne });
                            }} />
                          </div>
                          <div className="col-span-2 text-emerald-400 font-black flex items-center gap-1">
                            <span className="text-[10px] opacity-50">$</span>
                            <input className="bg-transparent border-none p-0 text-xs w-full font-black text-emerald-500" value={exp.price} placeholder="0.00" onChange={(e) => {
                              const ne = project.expenses.map(ex => ex.id === exp.id ? { ...ex, price: e.target.value } : ex);
                              updateProject(project.id, { expenses: ne });
                            }} />
                          </div>
                          <div className="col-span-1 text-right">
                             <button onClick={() => updateProject(project.id, { expenses: project.expenses.filter(ex => ex.id !== exp.id) })} className="text-slate-800 hover:text-rose-500">
                                <Trash2 className="w-3.5 h-3.5" />
                             </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          ))}
        </div>

        <footer className="pt-12 border-t border-slate-900 opacity-20 flex flex-col md:flex-row items-center justify-between gap-4 pb-20">
           <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-blue-500" />
              <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-500">Encrypted Cloud Link Active • UID: {user?.uid?.slice(0, 10)}</p>
           </div>
           <p className="text-[9px] font-black text-slate-700 uppercase tracking-[0.3em]">UY STUDIOS ASSET MANAGEMENT • GLOBAL VERSION 3.1</p>
        </footer>
      </div>
    </div>
  );
};

export default App;