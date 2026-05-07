import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Edit2, Trash2, X, Camera, 
  DollarSign, CheckCircle2, Clock, 
  AlertCircle, Package as PackageIcon, 
  Wallet, Film, Wifi, WifiOff, LayoutDashboard,
  Layers, BarChart3, Settings, LogOut, ChevronRight
} from 'lucide-react';

// Firebase Imports
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, collection, onSnapshot, addDoc, 
  updateDoc, deleteDoc, doc, query 
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

/**
 * UY STUDIOS 2025 - PRODUCTION DATABASE CONFIG
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

// Initialize Firebase safely
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const STATUS_OPTIONS = ['Completed', 'In Progress', 'Pending', 'Cancelled'];

export default function App() {
  const [projects, setProjects] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [error, setError] = useState(null);

  // Authentication Setup
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth Error:", err);
        setError("Database Auth Failed. Check Firebase Settings.");
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  // Real-time Cloud Sync
  useEffect(() => {
    if (!user) return;
    
    // Listening to the 'projects' collection in your cloud database
    const colRef = collection(db, 'projects');
    
    const unsubscribe = onSnapshot(colRef, 
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        }));
        setProjects(data);
        setLoading(false);
        setIsOnline(true);
      }, 
      (err) => {
        console.error("Firestore Sync Error:", err);
        setError("Sync Access Denied. Check Firestore Rules.");
        setLoading(false);
        setIsOnline(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleSaveProject = async (projectData) => {
    if (!user) return;
    try {
      if (editingProject) {
        const docRef = doc(db, 'projects', editingProject.id);
        await updateDoc(docRef, projectData);
      } else {
        await addDoc(collection(db, 'projects'), { 
          ...projectData, 
          createdAt: new Date().toISOString(),
          ownerId: user.uid
        });
      }
      setIsModalOpen(false);
      setEditingProject(null);
    } catch (e) {
      setError("Failed to save to cloud.");
    }
  };

  const handleDelete = async (id) => {
    if (!user || !window.confirm("Delete this project forever?")) return;
    try {
      await deleteDoc(doc(db, 'projects', id));
    } catch (e) {
      console.error("Delete Error:", e);
    }
  };

  const stats = useMemo(() => {
    const totalBudget = projects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
    const totalPaid = projects.reduce((sum, p) => sum + (Number(p.paid) || 0), 0);
    const outstanding = totalBudget - totalPaid;
    const active = projects.filter(p => p.status === 'In Progress').length;
    return { totalBudget, totalPaid, outstanding, active };
  }, [projects]);

  const filteredProjects = useMemo(() => {
    return projects.filter(p => 
      (p.client?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (p.event?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [projects, searchTerm]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020617]">
        <div className="text-center space-y-6">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center text-white animate-bounce shadow-2xl shadow-indigo-500/40">
             <Film size={32} />
          </div>
          <p className="text-slate-500 font-bold uppercase tracking-[0.4em] text-[10px]">Loading Uy Studios Cloud...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 flex">
      {/* Sidebar - Desktop Only */}
      <aside className="w-64 border-r border-white/5 bg-[#020617] hidden lg:flex flex-col p-6 sticky top-0 h-screen">
        <div className="flex items-center gap-3 mb-12 px-2">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-black">
            <Film size={16} />
          </div>
          <h1 className="font-black tracking-tighter text-white text-lg">UY STUDIOS</h1>
        </div>

        <nav className="space-y-1 flex-1">
          <NavItem icon={<LayoutDashboard size={18}/>} label="Dashboard" active />
          <NavItem icon={<Layers size={18}/>} label="Projects" />
          <NavItem icon={<BarChart3 size={18}/>} label="Financials" />
          <NavItem icon={<Settings size={18}/>} label="Settings" />
        </nav>

        <div className="pt-6 border-t border-white/5">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-indigo-600/20 flex items-center justify-center text-indigo-400 font-bold text-xs">US</div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black text-white uppercase truncate">UY Administrator</p>
              <p className="text-[9px] text-slate-500 truncate">{user?.uid.substring(0, 8)}...</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-20 border-b border-white/5 px-8 flex items-center justify-between sticky top-0 z-40 bg-[#020617]/80 backdrop-blur-md">
          <div className="flex items-center gap-4 lg:hidden">
            <Film className="text-white" size={24} />
            <h1 className="font-black tracking-tighter text-white">UY STUDIOS</h1>
          </div>

          <div className="flex-1 max-w-xl mx-4">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400 transition-colors" size={16} />
              <input 
                type="text" 
                placeholder="Search production data..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-white/5 border border-white/5 rounded-2xl text-sm outline-none focus:bg-white/10 focus:border-indigo-500/50 transition-all text-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
             <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/5">
                <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{isOnline ? 'Online' : 'Offline'}</span>
             </div>
             <button 
              onClick={() => { setEditingProject(null); setIsModalOpen(true); }}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-xl shadow-indigo-600/20 active:scale-95"
            >
              <Plus size={16} strokeWidth={3} /> <span className="hidden sm:inline">NEW JOB</span>
            </button>
          </div>
        </header>

        <main className="p-4 sm:p-8 space-y-8">
          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-400 text-xs font-bold">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {/* Stats Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <SummaryCard label="Pipeline" value={`$${stats.totalBudget.toLocaleString()}`} icon={<DollarSign size={18}/>} color="indigo" />
            <SummaryCard label="Paid" value={`$${stats.totalPaid.toLocaleString()}`} icon={<CheckCircle2 size={18}/>} color="emerald" />
            <SummaryCard label="Balance" value={`$${stats.outstanding.toLocaleString()}`} icon={<Wallet size={18}/>} color="rose" />
            <SummaryCard label="Active" value={stats.active} icon={<Clock size={18}/>} color="amber" />
          </div>

          {/* Project List */}
          <section className="bg-white/5 border border-white/5 rounded-[2rem] overflow-hidden">
            <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Recent Productions</h2>
              <div className="text-[9px] font-bold text-slate-600 uppercase">Showing {filteredProjects.length} entries</div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    <th className="px-8 py-5">Production</th>
                    <th className="px-8 py-5">Status</th>
                    <th className="px-8 py-5 text-right">Financials</th>
                    <th className="px-8 py-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredProjects.map((p) => (
                    <tr key={p.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-8 py-6">
                        <div className="font-bold text-white leading-tight">{p.client}</div>
                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-2 uppercase tracking-tighter">
                          <Film size={10} /> {p.event}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <StatusPill status={p.status} />
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="text-sm font-black text-slate-200">${Number(p.budget).toLocaleString()}</div>
                        <div className="text-[10px] font-bold text-emerald-500/70 mt-0.5">Paid: ${Number(p.paid).toLocaleString()}</div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                          <button onClick={() => {setEditingProject(p); setIsModalOpen(true);}} className="p-2.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl transition-all">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDelete(p.id)} className="p-2.5 bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl transition-all">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredProjects.length === 0 && (
                    <tr>
                      <td colSpan="4" className="px-8 py-24 text-center">
                        <div className="w-16 h-16 bg-white/5 rounded-3xl mx-auto flex items-center justify-center text-slate-700 mb-4">
                          <PackageIcon size={32} />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">No project data available</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#020617]/90 backdrop-blur-sm flex items-center justify-center p-6 z-[100] animate-in fade-in duration-200">
          <div className="bg-[#0F172A] border border-white/10 rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-8 py-6 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
              <h2 className="text-xl font-black text-white uppercase tracking-tighter">{editingProject ? 'Edit Production' : 'Initialize Job'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white"><X size={20}/></button>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.target);
              handleSaveProject({
                client: fd.get('client'),
                event: fd.get('event'),
                budget: Number(fd.get('budget')),
                paid: Number(fd.get('paid')),
                status: fd.get('status')
              });
            }} className="p-8 space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <InputField label="Client Name" name="client" defaultValue={editingProject?.client} placeholder="John Doe" />
                <InputField label="Project Type" name="event" defaultValue={editingProject?.event} placeholder="Music Video" />
              </div>
              
              <div className="grid grid-cols-2 gap-5">
                <InputField label="Budget ($)" name="budget" type="number" defaultValue={editingProject?.budget} />
                <InputField label="Paid ($)" name="paid" type="number" defaultValue={editingProject?.paid} />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Status</label>
                <select name="status" defaultValue={editingProject?.status || 'Pending'} className="w-full px-5 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold text-white outline-none focus:border-indigo-500/50 appearance-none">
                  {STATUS_OPTIONS.map(s => <option key={s} value={s} className="bg-[#0F172A]">{s}</option>)}
                </select>
              </div>

              <button type="submit" className="w-full mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-600/10 transition-all uppercase tracking-widest text-[10px]">
                {editingProject ? 'Apply Updates' : 'Sync to Cloud'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Components
function NavItem({ icon, label, active = false }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all ${active ? 'bg-indigo-600/10 text-indigo-400 font-bold' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'}`}>
      {icon}
      <span className="text-sm">{label}</span>
    </div>
  );
}

function SummaryCard({ label, value, icon, color }) {
  const themes = {
    indigo: 'text-indigo-400 border-indigo-500/20 bg-indigo-500/[0.03]',
    emerald: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/[0.03]',
    rose: 'text-rose-400 border-rose-500/20 bg-rose-500/[0.03]',
    amber: 'text-amber-400 border-amber-500/20 bg-amber-500/[0.03]',
  };
  return (
    <div className={`p-5 rounded-3xl border ${themes[color]} shadow-lg shadow-black/20`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
        <div className="opacity-50">{icon}</div>
      </div>
      <p className="text-xl sm:text-2xl font-black text-white tracking-tighter">{value}</p>
    </div>
  );
}

function InputField({ label, ...props }) {
  return (
    <div className="space-y-2">
      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">{label}</label>
      <input {...props} required className="w-full px-5 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-sm text-white outline-none focus:bg-white/10 focus:border-indigo-500/50 transition-all placeholder:text-slate-700" />
    </div>
  );
}

function StatusPill({ status }) {
  const themes = {
    'Completed': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    'In Progress': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    'Pending': 'bg-slate-500/10 text-slate-500 border-slate-500/20',
    'Cancelled': 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  };
  return (
    <span className={`text-[8px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-widest inline-block ${themes[status] || themes.Pending}`}>
      {status}
    </span>
  );
}