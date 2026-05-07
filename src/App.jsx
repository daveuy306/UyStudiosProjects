import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  onSnapshot, 
  setDoc,
  collection
} from 'firebase/firestore';
import { 
  getAuth,
  signInWithCustomToken,
  signInAnonymously,
  onAuthStateChanged
} from 'firebase/auth';
import { 
  Users, Plus, Trash2, Briefcase, 
  MapPin, DollarSign, ExternalLink,
  ShieldCheck, ShoppingCart, Tag, 
  BarChart3, Activity, X, Link as LinkIcon,
  FileText
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

// Global variables provided by environment
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const appId = typeof __app_id !== 'undefined' ? __app_id : 'uy-studios-db';

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState('connecting');
  const [projects, setProjects] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Updated Draft State with missing fields
  const [newProjectDraft, setNewProjectDraft] = useState({
    name: '',
    location: '',
    budget: '',
    amountPaid: '',
    mapLink: '',
    notes: '',
    initialMember: '',
    initialRole: '',
    filesLink: ''
  });

  // 1. Initialize Firebase & Auth
  useEffect(() => {
    if (!firebaseConfig.apiKey) {
      setSyncStatus('offline');
      setLoading(false);
      return;
    }

    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const auth = getAuth(app);

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth Error:", err);
        setSyncStatus('offline');
      } finally {
        setLoading(false);
      }
    };

    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. Sync Data (Mandatory Firestore Pathing)
  useEffect(() => {
    if (!user) return;
    const db = getFirestore();
    
    // Using strict path: /artifacts/{appId}/public/data/{collectionName}
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'projects_v4');
    
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        setProjects(snap.data().projects || []);
      }
      setSyncStatus('synced');
    }, (err) => {
      console.error("Sync Error:", err);
      setSyncStatus('error');
    });

    return () => unsubscribe();
  }, [user]);

  const saveToCloud = async (updatedList) => {
    if (!user) return;
    const db = getFirestore();
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'projects_v4');
    try {
      await setDoc(docRef, { projects: updatedList }, { merge: true });
    } catch (err) {
      console.error("Cloud Save Failed:", err);
    }
  };

  // Stats logic
  const stats = useMemo(() => {
    let budget = 0, paid = 0, expenses = 0;
    projects.forEach(p => {
      budget += parseFloat(p.budget) || 0;
      paid += parseFloat(p.amountPaid) || 0;
      (p.expenses || []).forEach(e => expenses += parseFloat(e.price) || 0);
    });
    return { ongoing: projects.length, owing: budget - paid, revenue: paid, expenses };
  }, [projects]);

  const chartData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map(m => ({ name: m, revenue: 0, expenses: 0 }));
    // Mock data distribution for visualization
    projects.forEach((p, i) => {
      const idx = i % 6;
      months[idx].revenue += (parseFloat(p.amountPaid) || 0) / (projects.length || 1);
    });
    return months;
  }, [projects]);

  const handleCreateProject = () => {
    const newProject = {
      id: crypto.randomUUID(),
      name: newProjectDraft.name,
      location: newProjectDraft.location,
      budget: newProjectDraft.budget,
      amountPaid: newProjectDraft.amountPaid,
      mapLink: newProjectDraft.mapLink,
      filesLink: newProjectDraft.filesLink,
      notes: newProjectDraft.notes,
      progress: 'in-progress',
      team: newProjectDraft.initialMember ? [{ id: '1', name: newProjectDraft.initialMember, role: newProjectDraft.initialRole }] : [],
      expenses: []
    };
    
    const updated = [...projects, newProject];
    setProjects(updated);
    saveToCloud(updated);
    setIsModalOpen(false);
    setNewProjectDraft({ name: '', location: '', budget: '', amountPaid: '', mapLink: '', notes: '', initialMember: '', initialRole: '', filesLink: '' });
  };

  const updateProject = (id, fields) => {
    const updated = projects.map(p => p.id === id ? { ...p, ...fields } : p);
    setProjects(updated);
    saveToCloud(updated);
  };

  if (loading) return <div className="min-h-screen bg-[#0a0c10] flex items-center justify-center text-blue-500 font-black italic">CONNECTING...</div>;

  return (
    <div className="min-h-screen bg-[#0a0c10] text-slate-200 p-6 md:p-10 font-sans selection:bg-blue-500/30">
      <div className="max-w-7xl mx-auto">
        
        {/* Top Header - Reverting to requested style */}
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-3 rounded-xl shadow-lg">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white uppercase italic tracking-tight">UY Studios Database</h1>
              <div className="flex items-center gap-2 mt-1">
                <div className={`w-2 h-2 rounded-full ${syncStatus === 'synced' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  {syncStatus === 'synced' ? 'Online Mode' : 'Offline Mode'}
                </span>
              </div>
            </div>
          </div>

          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-white hover:bg-slate-100 text-slate-950 px-6 py-3 rounded-xl font-black transition-all active:scale-95 flex items-center justify-center gap-2 uppercase text-xs tracking-tighter"
          >
            <Plus className="w-4 h-4" /> Initiate Asset
          </button>
        </header>

        {/* Sync Warning if offline */}
        {syncStatus !== 'synced' && (
          <div className="mb-6 bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex items-center gap-3 text-rose-500">
            <div className="bg-rose-500 rounded-full p-1"><X className="w-3 h-3 text-white" /></div>
            <p className="text-xs font-bold uppercase tracking-tight">Cloud configuration missing. Operating in local mode.</p>
          </div>
        )}

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
          {[
            { label: 'Ongoing', val: stats.ongoing, icon: Activity, color: 'text-blue-400' },
            { label: 'Owing', val: `$${stats.owing.toLocaleString()}`, icon: DollarSign, color: 'text-rose-400' },
            { label: 'Revenue', val: `$${stats.revenue.toLocaleString()}`, icon: BarChart3, color: 'text-emerald-400' },
            { label: 'Expenses', val: `$${stats.expenses.toLocaleString()}`, icon: ShoppingCart, color: 'text-amber-400' }
          ].map((s, i) => (
            <div key={i} className="bg-[#11141b] border border-slate-800 p-5 rounded-2xl">
              <div className="flex justify-between items-center mb-2">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{s.label}</p>
                <s.icon className={`w-4 h-4 ${s.color} opacity-40`} />
              </div>
              <p className="text-xl font-black text-white">{s.val}</p>
            </div>
          ))}
        </div>

        {/* Project Cards */}
        <div className="space-y-8">
          {projects.map((project) => (
            <div key={project.id} className="bg-[#11141b] border border-slate-800 rounded-[2rem] overflow-hidden">
              <div className="p-6 bg-slate-900/40 border-b border-slate-800 flex justify-between items-center">
                <h2 className="text-lg font-black text-white uppercase italic">{project.name || 'Untitled Project'}</h2>
                <button onClick={() => {
                  const updated = projects.filter(p => p.id !== project.id);
                  setProjects(updated);
                  saveToCloud(updated);
                }} className="text-slate-600 hover:text-rose-500"><Trash2 className="w-5 h-5" /></button>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
                <div className="p-6 space-y-4">
                   <div className="flex items-center gap-2 text-slate-500"><MapPin className="w-4 h-4" /><span className="text-xs uppercase font-bold">{project.location}</span></div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="bg-black/20 p-4 rounded-xl">
                        <label className="text-[9px] font-black text-slate-600 uppercase block mb-1">Contract</label>
                        <p className="text-sm font-black text-white">${project.budget}</p>
                      </div>
                      <div className="bg-black/20 p-4 rounded-xl">
                        <label className="text-[9px] font-black text-slate-600 uppercase block mb-1">Paid</label>
                        <p className="text-sm font-black text-emerald-400">${project.amountPaid}</p>
                      </div>
                   </div>
                   <div className="space-y-2">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><LinkIcon className="w-3 h-3" /> Links</p>
                      {project.mapLink && <a href={project.mapLink} target="_blank" className="block text-[10px] text-blue-400 hover:underline">Location Map</a>}
                      {project.filesLink && <a href={project.filesLink} target="_blank" className="block text-[10px] text-blue-400 hover:underline">Project Files</a>}
                   </div>
                </div>

                <div className="p-6">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Users className="w-3 h-3" /> Team</p>
                  <div className="space-y-2">
                    {project.team?.map(m => (
                      <div key={m.id} className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex justify-between items-center">
                        <div>
                          <p className="text-[10px] font-black text-white uppercase">{m.name}</p>
                          <p className="text-[9px] font-bold text-slate-600 uppercase tracking-tighter">{m.role}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-6 bg-black/10">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-4">Notes</p>
                  <p className="text-xs text-slate-400 leading-relaxed italic">{project.notes || 'No notes added.'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal - Updated with missing fields */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-2xl bg-[#0f1218] border border-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-8 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-xl font-black text-white italic tracking-tight uppercase">Initiate Asset</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto max-h-[70vh]">
              <div className="col-span-2 space-y-1.5">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Title</label>
                <input className="w-full bg-[#161b22] border border-slate-800 rounded-xl p-4 text-white font-bold" placeholder="e.g. PROJECT X" value={newProjectDraft.name} onChange={e => setNewProjectDraft({...newProjectDraft, name: e.target.value})} />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Location</label>
                <input className="w-full bg-[#161b22] border border-slate-800 rounded-xl p-4 text-slate-300 text-sm" placeholder="City" value={newProjectDraft.location} onChange={e => setNewProjectDraft({...newProjectDraft, location: e.target.value})} />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Map URL</label>
                <input className="w-full bg-[#161b22] border border-slate-800 rounded-xl p-4 text-blue-400 text-sm" placeholder="Link" value={newProjectDraft.mapLink} onChange={e => setNewProjectDraft({...newProjectDraft, mapLink: e.target.value})} />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Budget ($)</label>
                <input className="w-full bg-[#161b22] border border-slate-800 rounded-xl p-4 text-white font-black" placeholder="0" value={newProjectDraft.budget} onChange={e => setNewProjectDraft({...newProjectDraft, budget: e.target.value})} />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Amount Paid ($)</label>
                <input className="w-full bg-[#161b22] border border-slate-800 rounded-xl p-4 text-emerald-400 font-black" placeholder="0" value={newProjectDraft.amountPaid} onChange={e => setNewProjectDraft({...newProjectDraft, amountPaid: e.target.value})} />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Initial Member</label>
                <input className="w-full bg-[#161b22] border border-slate-800 rounded-xl p-4 text-white text-sm" placeholder="Name" value={newProjectDraft.initialMember} onChange={e => setNewProjectDraft({...newProjectDraft, initialMember: e.target.value})} />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Role</label>
                <input className="w-full bg-[#161b22] border border-slate-800 rounded-xl p-4 text-slate-400 text-sm" placeholder="e.g. Lead" value={newProjectDraft.initialRole} onChange={e => setNewProjectDraft({...newProjectDraft, initialRole: e.target.value})} />
              </div>

              <div className="col-span-2 space-y-1.5">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Pertinent Links / Files</label>
                <input className="w-full bg-[#161b22] border border-slate-800 rounded-xl p-4 text-blue-400 text-sm" placeholder="https://..." value={newProjectDraft.filesLink} onChange={e => setNewProjectDraft({...newProjectDraft, filesLink: e.target.value})} />
              </div>

              <div className="col-span-2 pt-4">
                <button 
                  onClick={handleCreateProject}
                  disabled={!newProjectDraft.name}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-20 text-white p-5 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-600/20"
                >
                  Create Asset
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="mt-20 border-t border-slate-900 pt-10 text-center opacity-20">
         <div className="flex items-center justify-center gap-3 mb-2">
            <ShieldCheck className="w-4 h-4 text-blue-500" />
            <p className="text-[8px] font-black uppercase tracking-[0.4em] text-slate-500">Encrypted Terminal</p>
         </div>
      </footer>
    </div>
  );
};

export default App;