import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, Briefcase, BarChart3, Search, Zap, 
  PlusCircle, Camera, Clock, Wallet, TrendingUp, 
  MapPin, Sparkles, FileText, UserPlus, Calendar, 
  Settings, Edit3, Trash2, X, Check, ChevronLeft, ChevronRight, Plus
} from 'lucide-react';

// --- Note: This version uses local state. ---
// You can add the Firebase logic later once the basic build is running!

const STATUS_OPTIONS = ['Completed', 'In Progress', 'Pending', 'Cancelled'];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [projects, setProjects] = useState([
    { id: 1, date: '2024-10-24', client: 'Alice Johnson', event: 'Wedding', package: 'Premium', location: 'New York', budget: 5000, paid: 2500, status: 'In Progress' },
    { id: 2, date: '2024-11-12', client: 'Bob Smith', event: 'Corporate Gala', package: 'Standard', location: 'Chicago', budget: 8000, paid: 8000, status: 'Completed' }
  ]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const stats = useMemo(() => {
    const totalBudget = projects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
    const totalPaid = projects.reduce((sum, p) => sum + (Number(p.paid) || 0), 0);
    const active = projects.filter(p => p.status === 'In Progress').length;
    return { totalBudget, totalPaid, outstanding: totalBudget - totalPaid, active };
  }, [projects]);

  const filteredProjects = useMemo(() => {
    return projects.filter(p => 
      (p.client?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (p.event?.toLowerCase() || "").includes(searchTerm.toLowerCase())
    );
  }, [projects, searchTerm]);

  const handleSave = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());
    const projectData = {
      ...data,
      id: editingProject ? editingProject.id : Date.now(),
      budget: Number(data.budget),
      paid: Number(data.paid)
    };

    if (editingProject) {
      setProjects(projects.map(p => p.id === editingProject.id ? projectData : p));
    } else {
      setProjects([projectData, ...projects]);
    }
    setIsModalOpen(false);
    setEditingProject(null);
  };

  const handleDelete = (id) => {
    if (!window.confirm("Delete this project?")) return;
    setProjects(projects.filter(p => p.id !== id));
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-200">
      {/* Sidebar */}
      <aside className={`bg-slate-900 border-r border-slate-800 transition-all duration-300 flex flex-col fixed inset-y-0 left-0 z-50 ${sidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="h-16 flex items-center px-6 border-b border-slate-800 mb-4">
          <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-white shrink-0">
            <Zap size={20} />
          </div>
          {sidebarOpen && <h1 className="ml-3 font-serif font-bold text-xl tracking-tight text-white">StudioPro</h1>}
        </div>
        <nav className="flex-1">
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-6 py-3.5 transition-all text-sm font-medium ${activeTab === 'dashboard' ? 'bg-indigo-500/10 text-indigo-400 border-r-2 border-indigo-500' : 'text-slate-400 hover:text-slate-200'}`}>
            <LayoutDashboard size={20} /> {sidebarOpen && "Dashboard"}
          </button>
          <button onClick={() => setActiveTab('projects')} className={`w-full flex items-center gap-3 px-6 py-3.5 transition-all text-sm font-medium ${activeTab === 'projects' ? 'bg-indigo-500/10 text-indigo-400 border-r-2 border-indigo-500' : 'text-slate-400 hover:text-slate-200'}`}>
            <Briefcase size={20} /> {sidebarOpen && "Projects"}
          </button>
        </nav>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-4 flex justify-center text-slate-500 hover:text-white">
          {sidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
        </button>
      </aside>

      {/* Main Content Area */}
      <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-20'}`}>
        <header className="h-16 bg-slate-950/50 backdrop-blur-md border-b border-slate-800 px-8 flex items-center justify-between sticky top-0 z-40">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">{activeTab}</h2>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input 
                type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-1.5 bg-slate-900 border border-slate-800 rounded-full text-sm w-48 focus:w-64 transition-all outline-none"
              />
            </div>
          </div>
        </header>

        <main className="p-8 max-w-7xl mx-auto">
          {activeTab === 'dashboard' ? (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard label="Pipeline" value={`$${stats.totalBudget}`} icon={<TrendingUp size={20}/>} color="indigo" />
                <StatCard label="Paid" value={`$${stats.totalPaid}`} icon={<Wallet size={20}/>} color="emerald" />
                <StatCard label="Balance" value={`$${stats.outstanding}`} icon={<Clock size={20}/>} color="rose" />
                <StatCard label="Active" value={stats.active} icon={<Camera size={20}/>} color="amber" />
              </div>
              
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-lg">Recent Bookings</h3>
                  <button onClick={() => {setEditingProject(null); setIsModalOpen(true)}} className="text-indigo-400 text-sm font-bold flex items-center gap-1 hover:underline">
                    <Plus size={14}/> Add New
                  </button>
                </div>
                <div className="space-y-3">
                  {projects.slice(0, 5).map(p => (
                    <div key={p.id} className="flex items-center justify-between p-4 bg-slate-800/30 rounded-xl border border-slate-800 hover:border-slate-700 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-indigo-400 border border-slate-700 font-bold text-xs uppercase">
                          {p.date?.split('-')[1] || '??'}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-white">{p.client}</p>
                          <p className="text-xs text-slate-500">{p.event} · {p.location}</p>
                        </div>
                      </div>
                      <StatusBadge status={p.status} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
               <table className="w-full text-left">
                  <thead className="bg-slate-800/50 border-b border-slate-800 text-[10px] font-bold uppercase text-slate-500">
                    <tr>
                      <th className="px-6 py-4">Client</th>
                      <th className="px-6 py-4">Event</th>
                      <th className="px-6 py-4">Budget</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredProjects.map(p => (
                      <tr key={p.id} className="hover:bg-slate-800/20 group">
                        <td className="px-6 py-4 font-medium text-white">{p.client}</td>
                        <td className="px-6 py-4 text-slate-400 text-sm">{p.event}</td>
                        <td className="px-6 py-4 text-sm">${p.budget}</td>
                        <td className="px-6 py-4"><StatusBadge status={p.status} /></td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => {setEditingProject(p); setIsModalOpen(true)}} className="p-1.5 hover:bg-indigo-500/10 text-slate-500 hover:text-indigo-400 rounded"><Edit3 size={14}/></button>
                            <button onClick={() => handleDelete(p.id)} className="p-1.5 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 rounded"><Trash2 size={14}/></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
               </table>
            </div>
          )}
        </main>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h2 className="font-bold text-lg text-white">{editingProject ? 'Edit Project' : 'New Project'}</h2>
              <button onClick={() => setIsModalOpen(false)}><X size={20}/></button>
            </div>
            <form onSubmit={handleSave} className="p-6 grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Client Name</label>
                <input name="client" defaultValue={editingProject?.client} required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Event</label>
                <input name="event" defaultValue={editingProject?.event} required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Location</label>
                <input name="location" defaultValue={editingProject?.location} required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Budget ($)</label>
                <input name="budget" type="number" defaultValue={editingProject?.budget} required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Paid ($)</label>
                <input name="paid" type="number" defaultValue={editingProject?.paid} required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Status</label>
                <select name="status" defaultValue={editingProject?.status || 'Pending'} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm outline-none">
                  {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              <button type="submit" className="col-span-2 mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-950 flex items-center justify-center gap-2">
                <Check size={18}/> {editingProject ? 'Update Project' : 'Create Project'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color }) {
  const themes = {
    indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  };
  return (
    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${themes[color]} mb-4`}>
        {icon}
      </div>
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</p>
      <p className="text-2xl font-black text-white mt-1">{value}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    'Completed': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'In Progress': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    'Pending': 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    'Cancelled': 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  };
  return (
    <span className={`text-[9px] font-black px-2.5 py-1 rounded-md border uppercase tracking-widest ${styles[status]}`}>
      {status}
    </span>
  );
}