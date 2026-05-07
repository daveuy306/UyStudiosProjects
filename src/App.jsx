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
  Tag, Receipt, BarChart3, TrendingUp
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area
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
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth Error:", err);
        setSyncStatus('error');
      } finally {
        setLoading(false);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // --- DATABASE SYNC ---
  useEffect(() => {
    if (!user) return;
    const dataDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'projects_v3');
    const unsubscribe = onSnapshot(dataDocRef, (snap) => {
      if (snap.exists()) {
        setProjects(snap.data().projects || []);
        setSyncStatus('synced');
      } else {
        setSyncStatus('synced');
      }
    }, (err) => {
      console.error("Firestore Listen Error:", err);
      setSyncStatus('error');
    });
    return () => unsubscribe();
  }, [user, retryCount]);

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
  const chartData = useMemo(() => {
    const months = [];
    const now = new Date();
    
    // Create last 12 months
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
      
      // For simplicity in this mockup, we distribute current project financials 
      // across the "In Progress" or "Completed" months. 
      // Real-world logic would use transaction timestamps.
      const monthIdx = months.length - 1; 
      months[monthIdx].revenue += paid;
      months[monthIdx].owing += owing;
      
      (p.expenses || []).forEach(e => {
        const expDate = new Date(e.date);
        const expVal = parseFloat(e.price) || 0;
        
        const mIdx = months.findIndex(m => 
          m.fullDate.getMonth() === expDate.getMonth() && 
          m.fullDate.getFullYear() === expDate.getFullYear()
        );
        
        if (mIdx !== -1) {
          months[mIdx].expenses += expVal;
        }
      });
    });

    return months;
  }, [projects]);

  // --- PROJECT HANDLERS ---
  const addProject = () => {
    const newProject = {
      id: crypto.randomUUID(),
      name: 'New Project',
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

  const updateProject = (projectId, updates) => {
    const updated = projects.map(p => p.id === projectId ? { ...p, ...updates } : p);
    syncToCloud(updated);
  };

  const removeProject = (projectId) => {
    syncToCloud(projects.filter(p => p.id !== projectId));
  };

  // --- TEAM HANDLERS ---
  const addTeamMember = (projectId) => {
    const updated = projects.map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          team: [...(p.team || []), { id: crypto.randomUUID(), name: '', role: '' }]
        };
      }
      return p;
    });
    syncToCloud(updated);
  };

  const updateTeamMember = (projectId, memberId, updates) => {
    const updated = projects.map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          team: p.team.map(m => m.id === memberId ? { ...m, ...updates } : m)
        };
      }
      return p;
    });
    syncToCloud(updated);
  };

  const removeTeamMember = (projectId, memberId) => {
    const updated = projects.map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          team: p.team.filter(m => m.id !== memberId)
        };
      }
      return p;
    });
    syncToCloud(updated);
  };

  // --- EXPENSE HANDLERS ---
  const addExpense = (projectId) => {
    const updated = projects.map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          expenses: [...(p.expenses || []), { 
            id: crypto.randomUUID(), 
            date: new Date().toISOString().split('T')[0],
            name: '',
            reason: '',
            price: ''
          }]
        };
      }
      return p;
    });
    syncToCloud(updated);
  };

  const updateExpense = (projectId, expenseId, updates) => {
    const updated = projects.map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          expenses: p.expenses.map(e => e.id === expenseId ? { ...e, ...updates } : e)
        };
      }
      return p;
    });
    syncToCloud(updated);
  };

  const removeExpense = (projectId, expenseId) => {
    const updated = projects.map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          expenses: p.expenses.filter(e => e.id !== expenseId)
        };
      }
      return p;
    });
    syncToCloud(updated);
  };

  const calculateTotalExpenses = (expenses) => {
    if (!expenses) return 0;
    return expenses.reduce((sum, e) => sum + (parseFloat(e.price) || 0), 0);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0c10]">
        <div className="w-12 h-12 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Initializing Environment...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0c10] text-slate-200 p-4 md:p-12 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-600/20">
                <Briefcase className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white uppercase">Dave Uy Dashboard</h1>
            </div>
            <button 
              onClick={() => setRetryCount(c => c + 1)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all ${
                syncStatus === 'synced' ? 'bg-emerald-500/10 text-emerald-500' : 
                syncStatus === 'error' ? 'bg-rose-500/10 text-rose-500 animate-pulse' : 'bg-amber-500/10 text-amber-500'
              }`}
            >
              {syncStatus === 'synced' ? <CheckCircle2 className="w-3 h-3" /> : 
               syncStatus === 'error' ? <AlertCircle className="w-3 h-3" /> : <RefreshCcw className="w-3 h-3 animate-spin" />}
              <span className="text-[10px] font-bold uppercase tracking-tighter">
                {syncStatus === 'synced' ? 'Cloud Connected' : syncStatus === 'error' ? 'Sync Error - Tap to Retry' : 'Connecting...'}
              </span>
            </button>
          </div>

          <button 
            onClick={addProject}
            className="flex items-center justify-center gap-2 bg-white hover:bg-slate-200 text-slate-950 px-8 py-3.5 rounded-2xl font-black transition-all active:scale-95 shadow-xl uppercase text-sm tracking-tight"
          >
            <Plus className="w-5 h-5" />
            <span>Add New Project</span>
          </button>
        </header>

        {/* 12-Month Financial Chart */}
        <div className="mb-12 bg-[#11141b] border border-slate-800/60 rounded-[2.5rem] p-8 shadow-2xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2 uppercase tracking-tight">
                <TrendingUp className="w-5 h-5 text-blue-500" />
                Rolling 12-Month Trend
              </h2>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Revenue vs Debt vs Expenses</p>
            </div>
            <div className="hidden md:flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-[10px] font-bold text-slate-400 uppercase">Revenue</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-500" />
                <span className="text-[10px] font-bold text-slate-400 uppercase">Client Owing</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-bold text-slate-400 uppercase">Expenses</span>
              </div>
            </div>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#475569', fontSize: 10, fontWeight: 700}}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#475569', fontSize: 10, fontWeight: 700}}
                  tickFormatter={(val) => `$${val}`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px' }}
                  itemStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={3} />
                <Area type="monotone" dataKey="expenses" stroke="#10b981" fillOpacity={1} fill="url(#colorExpenses)" strokeWidth={3} />
                <Line type="monotone" dataKey="owing" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Project List */}
        <div className="space-y-12">
          {projects.length === 0 ? (
            <div className="border-2 border-dashed border-slate-800/50 rounded-[2rem] p-24 flex flex-col items-center justify-center text-center">
              <p className="font-bold text-slate-500 mb-2 uppercase tracking-widest">Workspace Empty</p>
            </div>
          ) : (
            projects.map((project) => (
              <div key={project.id} className="bg-[#11141b] border border-slate-800/60 rounded-[2rem] overflow-hidden shadow-2xl transition-all hover:border-slate-700/50">
                
                {/* 1. Header Strip */}
                <div className="p-6 bg-slate-900/40 border-b border-slate-800/50 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-4">
                      <input 
                        className="bg-transparent border-none focus:ring-0 text-xl font-black text-white p-0 w-full placeholder:text-slate-800 uppercase"
                        value={project.name}
                        onChange={(e) => updateProject(project.id, { name: e.target.value })}
                        placeholder="PROJECT NAME"
                      />
                      <select 
                        value={project.progress}
                        onChange={(e) => updateProject(project.id, { progress: e.target.value })}
                        className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border-none focus:ring-0 cursor-pointer transition-colors ${
                          project.progress === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                          project.progress === 'in-progress' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        <option value="not-started">Not Started</option>
                        <option value="in-progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center gap-2 bg-slate-950/40 px-3 py-2 rounded-xl border border-slate-800/50">
                        <MapPin className="w-4 h-4 text-slate-500" />
                        <input 
                          className="bg-transparent border-none focus:ring-0 text-xs text-slate-300 w-full p-0 placeholder:text-slate-700"
                          value={project.location}
                          onChange={(e) => updateProject(project.id, { location: e.target.value })}
                          placeholder="Project Location"
                        />
                      </div>
                      <div className="flex items-center gap-2 bg-slate-950/40 px-3 py-2 rounded-xl border border-slate-800/50">
                        <ExternalLink className="w-4 h-4 text-slate-500" />
                        <input 
                          className="bg-transparent border-none focus:ring-0 text-xs text-blue-400 w-full p-0 placeholder:text-slate-700"
                          value={project.mapLink}
                          onChange={(e) => updateProject(project.id, { mapLink: e.target.value })}
                          placeholder="Google Maps URL"
                        />
                      </div>
                    </div>
                  </div>
                  <button onClick={() => removeProject(project.id)} className="p-3 text-slate-700 hover:text-rose-500 transition-all">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                {/* 2. Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[400px]">
                  
                  {/* Financials & Notes (Left Column) */}
                  <div className="lg:col-span-4 p-8 border-b lg:border-b-0 lg:border-r border-slate-800/50 space-y-8 bg-slate-950/10">
                    <div className="space-y-4">
                      <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Financial Summary</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                          <label className="text-[9px] text-slate-500 font-bold uppercase block mb-1">Contract Budget</label>
                          <div className="flex items-center gap-1 text-emerald-500">
                            <DollarSign className="w-4 h-4" />
                            <input 
                              type="text"
                              className="bg-transparent border-none focus:ring-0 text-lg font-black w-full p-0"
                              value={project.budget}
                              onChange={(e) => updateProject(project.id, { budget: e.target.value })}
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                          <label className="text-[9px] text-slate-500 font-bold uppercase block mb-1">Amount Paid</label>
                          <div className="flex items-center gap-1 text-blue-400">
                            <DollarSign className="w-4 h-4" />
                            <input 
                              type="text"
                              className="bg-transparent border-none focus:ring-0 text-lg font-black w-full p-0"
                              value={project.amountPaid}
                              onChange={(e) => updateProject(project.id, { amountPaid: e.target.value })}
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/50 flex justify-between items-center group transition-all hover:bg-emerald-500/5">
                        <div>
                          <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Total Expenses</p>
                          <p className="text-xl font-black text-white">${calculateTotalExpenses(project.expenses).toFixed(2)}</p>
                        </div>
                        <Receipt className="w-8 h-8 text-slate-800 group-hover:text-emerald-500/20 transition-all" />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Notes & Documentation</h3>
                      <textarea 
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 min-h-[140px] focus:ring-1 focus:ring-blue-500 outline-none resize-none leading-relaxed"
                        value={project.notes}
                        onChange={(e) => updateProject(project.id, { notes: e.target.value })}
                        placeholder="Enter project details, file locations, or pertinent notes here..."
                      />
                    </div>
                  </div>

                  {/* Dynamic Sections (Right Column) */}
                  <div className="lg:col-span-8 flex flex-col">
                    
                    {/* Team Section */}
                    <div className="p-8 border-b border-slate-800/50 space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Team Members</h3>
                        <button onClick={() => addTeamMember(project.id)} className="flex items-center gap-2 px-4 py-1.5 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg text-[10px] font-black uppercase transition-all">
                          <UserPlus className="w-3.5 h-3.5" /> Add Staff
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(project.team || []).map((member) => (
                          <div key={member.id} className="group bg-slate-900/40 border border-slate-800/50 p-4 rounded-2xl relative hover:border-slate-700 transition-all flex justify-between items-start">
                            <div className="flex-1 space-y-2">
                              <input 
                                className="w-full bg-transparent border-none focus:ring-0 text-sm font-bold text-white p-0"
                                value={member.name}
                                onChange={(e) => updateTeamMember(project.id, member.id, { name: e.target.value })}
                                placeholder="Name"
                              />
                              <input 
                                className="w-full bg-transparent border-none focus:ring-0 text-[11px] text-slate-500 p-0"
                                value={member.role}
                                onChange={(e) => updateTeamMember(project.id, member.id, { role: e.target.value })}
                                placeholder="Role/Task"
                              />
                            </div>
                            <button onClick={() => removeTeamMember(project.id, member.id)} className="p-1 text-slate-800 hover:text-rose-500">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Expenses Section */}
                    <div className="p-8 space-y-6 flex-1 bg-slate-900/20">
                      <div className="flex items-center justify-between">
                        <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Project Ledger</h3>
                        <button onClick={() => addExpense(project.id)} className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-lg text-[10px] font-black uppercase transition-all">
                          <ShoppingCart className="w-3.5 h-3.5" /> Log Expense
                        </button>
                      </div>

                      <div className="space-y-3">
                        {(project.expenses || []).length === 0 ? (
                          <div className="py-12 border-2 border-dashed border-slate-800/30 rounded-2xl flex flex-col items-center justify-center text-slate-700">
                            <ShoppingCart className="w-6 h-6 mb-2 opacity-20" />
                            <span className="text-[9px] font-black uppercase tracking-widest">No expenses logged</span>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-separate border-spacing-y-2">
                              <thead>
                                <tr className="text-[9px] font-black text-slate-700 uppercase tracking-widest">
                                  <th className="pb-2 pl-4">Date</th>
                                  <th className="pb-2">Expense Name</th>
                                  <th className="pb-2">Description</th>
                                  <th className="pb-2">Price</th>
                                  <th className="pb-2 text-right pr-4">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {project.expenses.map((exp) => (
                                  <tr key={exp.id} className="bg-slate-950/60 border border-slate-800/50 group transition-all hover:bg-slate-900">
                                    <td className="py-3 pl-4 rounded-l-xl">
                                      <div className="flex items-center gap-2">
                                        <Calendar className="w-3 h-3 text-slate-600" />
                                        <input 
                                          type="date"
                                          className="bg-transparent border-none focus:ring-0 text-xs text-slate-400 p-0"
                                          value={exp.date}
                                          onChange={(e) => updateExpense(project.id, exp.id, { date: e.target.value })}
                                        />
                                      </div>
                                    </td>
                                    <td>
                                      <input 
                                        className="bg-transparent border-none focus:ring-0 text-xs font-bold text-white w-full p-0"
                                        value={exp.name}
                                        onChange={(e) => updateExpense(project.id, exp.id, { name: e.target.value })}
                                        placeholder="Item Name"
                                      />
                                    </td>
                                    <td>
                                      <div className="flex items-center gap-2">
                                        <Tag className="w-3 h-3 text-slate-700" />
                                        <input 
                                          className="bg-transparent border-none focus:ring-0 text-[11px] text-slate-500 w-full p-0"
                                          value={exp.reason}
                                          onChange={(e) => updateExpense(project.id, exp.id, { reason: e.target.value })}
                                          placeholder="Category/Reason"
                                        />
                                      </div>
                                    </td>
                                    <td>
                                      <div className="flex items-center gap-1 text-emerald-500 font-bold text-xs">
                                        <span>$</span>
                                        <input 
                                          className="bg-transparent border-none focus:ring-0 text-xs font-black w-20 p-0"
                                          value={exp.price}
                                          onChange={(e) => updateExpense(project.id, exp.id, { price: e.target.value })}
                                          placeholder="0.00"
                                        />
                                      </div>
                                    </td>
                                    <td className="py-3 pr-4 text-right rounded-r-xl">
                                      <button onClick={() => removeExpense(project.id, exp.id)} className="p-1.5 text-slate-800 hover:text-rose-500 transition-colors">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <footer className="mt-32 pt-8 border-t border-slate-900 flex flex-col md:flex-row items-center justify-between gap-6 opacity-40">
           <div className="flex items-center gap-3 text-slate-500">
              <ShieldCheck className="w-5 h-5" />
              <div className="text-[9px] font-black uppercase tracking-[0.2em] space-y-0.5">
                <div>Secure Portfolio Node</div>
                <div className="text-slate-700">UID: {user?.uid?.slice(0, 8)}...</div>
              </div>
           </div>
           <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.3em]">UY Studios • 12-Month Financial Ledger</p>
        </footer>
      </div>
    </div>
  );
};

export default App;