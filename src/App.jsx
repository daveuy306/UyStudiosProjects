import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { 
  LayoutDashboard, FolderPlus, Receipt, Menu, X, LogIn, 
  MapPin, Plus, Trash2, Edit3, Save, ChevronRight, CheckCircle2, 
  Clock, AlertCircle, PlayCircle 
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, onSnapshot, 
  query, orderBy, updateDoc, doc, deleteDoc 
} from 'firebase/firestore';

// --- FIREBASE CONFIGURATION ---
// Replace with your actual Firebase config from project settings
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
const db = getFirestore(app);

// --- COMPONENTS ---

const Login = ({ onLogin }) => {
  const [code, setCode] = useState('');
  const ACCESS_CODE = "UY2024"; // You can change this or manage via Firebase

  const handleSubmit = (e) => {
    e.preventDefault();
    if (code === ACCESS_CODE) onLogin();
    else alert("Invalid Access Code");
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 w-full max-w-md shadow-2xl">
        <div className="flex justify-center mb-6">
          <div className="bg-indigo-500/20 p-4 rounded-full">
            <LogIn className="w-8 h-8 text-indigo-400" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-white text-center mb-2">UY Studios</h1>
        <p className="text-slate-400 text-center mb-8">Enter access code to manage projects</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            placeholder="Access Code"
            className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg transition-colors">
            Access Dashboard
          </button>
        </form>
      </div>
    </div>
  );
};

const SidebarItem = ({ icon: Icon, label, active, onClick, collapsed }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center p-3 rounded-lg transition-all mb-2 ${
      active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
    }`}
  >
    <Icon className="w-5 h-5 flex-shrink-0" />
    {!collapsed && <span className="ml-3 font-medium">{label}</span>}
  </button>
);

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [projects, setProjects] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [isProjectModalOpen, setProjectModalOpen] = useState(false);

  // Sync with Firestore
  useEffect(() => {
    if (!isAuthenticated) return;

    const qProjects = query(collection(db, 'projects'), orderBy('date', 'desc'));
    const unsubProjects = onSnapshot(qProjects, (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qExpenses = query(collection(db, 'expenses'), orderBy('date', 'desc'));
    const unsubExpenses = onSnapshot(qExpenses, (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubProjects(); unsubExpenses(); };
  }, [isAuthenticated]);

  // Data Aggregation for Recharts
  const getChartData = () => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months.map(month => {
      const rev = projects
        .filter(p => p.date?.includes(month) || new Date(p.date).toLocaleString('default', { month: 'short' }) === month)
        .reduce((sum, p) => sum + (Number(p.paid) || 0), 0);
      
      const owed = projects
        .filter(p => p.date?.includes(month) || new Date(p.date).toLocaleString('default', { month: 'short' }) === month)
        .reduce((sum, p) => sum + (Number(p.budget) - Number(p.paid) || 0), 0);

      const exp = expenses
        .filter(e => e.date?.includes(month) || new Date(e.date).toLocaleString('default', { month: 'short' }) === month)
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

      return { name: month, revenue: rev, owed: owed, expenses: exp };
    });
  };

  if (!isAuthenticated) return <Login onLogin={() => setIsAuthenticated(true)} />;

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-200">
      {/* Sidebar */}
      <aside className={`${isSidebarCollapsed ? 'w-20' : 'w-64'} hidden md:flex flex-col bg-slate-900 border-r border-slate-800 transition-all duration-300 p-4`}>
        <div className="flex items-center justify-between mb-8 px-2">
          {!isSidebarCollapsed && <h2 className="text-xl font-bold text-white tracking-tight">UY STUDIOS</h2>}
          <button onClick={() => setSidebarCollapsed(!isSidebarCollapsed)} className="p-1 hover:bg-slate-800 rounded">
            <Menu className="w-5 h-5" />
          </button>
        </div>
        
        <SidebarItem icon={LayoutDashboard} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} collapsed={isSidebarCollapsed} />
        <SidebarItem icon={FolderPlus} label="Projects" active={activeTab === 'projects'} onClick={() => setActiveTab('projects')} collapsed={isSidebarCollapsed} />
        <SidebarItem icon={Receipt} label="Expenses" active={activeTab === 'expenses'} onClick={() => setActiveTab('expenses')} collapsed={isSidebarCollapsed} />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800">
          <h2 className="font-bold text-white">UY STUDIOS</h2>
          <div className="flex gap-4">
            <LayoutDashboard onClick={() => setActiveTab('dashboard')} className={activeTab === 'dashboard' ? 'text-indigo-400' : ''} />
            <FolderPlus onClick={() => setActiveTab('projects')} className={activeTab === 'projects' ? 'text-indigo-400' : ''} />
            <Receipt onClick={() => setActiveTab('expenses')} className={activeTab === 'expenses' ? 'text-indigo-400' : ''} />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {activeTab === 'dashboard' && <DashboardView data={getChartData()} projects={projects} />}
          {activeTab === 'projects' && <ProjectsView projects={projects} />}
          {activeTab === 'expenses' && <ExpensesView expenses={expenses} />}
        </div>
      </main>
    </div>
  );
}

// --- SUB-VIEWS ---

function DashboardView({ data, projects }) {
  const totalRevenue = projects.reduce((sum, p) => sum + (Number(p.paid) || 0), 0);
  const totalOwed = projects.reduce((sum, p) => sum + (Number(p.budget) - Number(p.paid) || 0), 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Total Revenue" value={`$${totalRevenue.toLocaleString()}`} color="text-emerald-400" />
        <StatCard title="Total Owed" value={`$${totalOwed.toLocaleString()}`} color="text-amber-400" />
        <StatCard title="Active Projects" value={projects.filter(p => p.status === 'In Progress').length} color="text-indigo-400" />
      </div>

      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
        <h3 className="text-lg font-semibold mb-6">Financial Trends (12 Months)</h3>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                itemStyle={{ fontSize: '12px' }}
              />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="owed" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" />
              <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function ProjectsView({ projects }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const initialForm = {
    clientName: '', eventType: '', duration: '', location: '', 
    googleMapsLink: '', budget: '', paid: '', date: '', 
    status: 'Not Started', teamMembers: []
  };
  const [form, setForm] = useState(initialForm);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingId) {
      await updateDoc(doc(db, 'projects', editingId), form);
      setEditingId(null);
    } else {
      await addDoc(collection(db, 'projects'), form);
    }
    setForm(initialForm);
    setShowAdd(false);
  };

  const startEdit = (project) => {
    setForm(project);
    setEditingId(project.id);
    setShowAdd(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Projects</h2>
        <button 
          onClick={() => { setForm(initialForm); setEditingId(null); setShowAdd(true); }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4" /> New Project
        </button>
      </div>

      {showAdd && (
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-2xl mb-8">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input placeholder="Client Name" className="form-input" value={form.clientName} onChange={e => setForm({...form, clientName: e.target.value})} required />
            <input placeholder="Event Type (e.g. Wedding)" className="form-input" value={form.eventType} onChange={e => setForm({...form, eventType: e.target.value})} />
            <input placeholder="Location" className="form-input" value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
            <input placeholder="Google Maps Link" className="form-input" value={form.googleMapsLink} onChange={e => setForm({...form, googleMapsLink: e.target.value})} />
            <input type="date" className="form-input" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
            <select className="form-input" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
              <option>Not Started</option>
              <option>In Progress</option>
              <option>Completed</option>
              <option>Cancelled</option>
            </select>
            <input type="number" placeholder="Budget ($)" className="form-input" value={form.budget} onChange={e => setForm({...form, budget: e.target.value})} />
            <input type="number" placeholder="Amount Paid ($)" className="form-input" value={form.paid} onChange={e => setForm({...form, paid: e.target.value})} />
            
            <div className="md:col-span-2 flex gap-3">
              <button type="submit" className="flex-1 bg-indigo-600 py-3 rounded-lg font-bold">
                {editingId ? 'Update Project' : 'Save Project'}
              </button>
              <button type="button" onClick={() => setShowAdd(false)} className="px-6 bg-slate-800 rounded-lg">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {projects.map(project => (
          <div key={project.id} className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex flex-col md:flex-row md:items-center justify-between hover:border-slate-700 transition-colors">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h4 className="text-lg font-semibold text-white">{project.clientName}</h4>
                <StatusBadge status={project.status} />
              </div>
              <p className="text-slate-400 text-sm">{project.eventType} • {project.date}</p>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <MapPin className="w-3 h-3" /> {project.location || 'No location set'}
              </div>
            </div>
            <div className="mt-4 md:mt-0 flex items-center gap-8">
              <div className="text-right">
                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Payments</p>
                <p className="text-white font-mono">${project.paid} / ${project.budget}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEdit(project)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400"><Edit3 className="w-5 h-5" /></button>
                <button onClick={() => deleteDoc(doc(db, 'projects', project.id))} className="p-2 hover:bg-red-900/30 rounded-lg text-red-400"><Trash2 className="w-5 h-5" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExpensesView({ expenses }) {
  const [form, setForm] = useState({ type: 'Equipment', date: '', amount: '', reason: '' });
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, 'expenses'), form);
    setForm({ type: 'Equipment', date: '', amount: '', reason: '' });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
        <h3 className="text-lg font-semibold mb-4">Log New Expense</h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <select className="form-input" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
            <option>Equipment</option>
            <option>Rentals</option>
            <option>Travel</option>
            <option>Marketing</option>
            <option>Payroll</option>
            <option>Other</option>
          </select>
          <input type="date" className="form-input" value={form.date} onChange={e => setForm({...form, date: e.target.value})} required />
          <input type="number" placeholder="Amount" className="form-input" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} required />
          <button className="bg-indigo-600 rounded-lg hover:bg-indigo-700 font-bold">Add</button>
          <input placeholder="Reason / Notes" className="form-input md:col-span-4" value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} />
        </form>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left bg-slate-900">
          <thead>
            <tr className="bg-slate-800/50 text-slate-400 text-sm uppercase">
              <th className="p-4">Date</th>
              <th className="p-4">Category</th>
              <th className="p-4">Reason</th>
              <th className="p-4">Amount</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {expenses.map(exp => (
              <tr key={exp.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="p-4 text-slate-300">{exp.date}</td>
                <td className="p-4 font-medium">{exp.type}</td>
                <td className="p-4 text-slate-400 text-sm">{exp.reason}</td>
                <td className="p-4 text-red-400 font-mono">-${Number(exp.amount).toFixed(2)}</td>
                <td className="p-4 text-right">
                  <button onClick={() => deleteDoc(doc(db, 'expenses', exp.id))} className="text-slate-600 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- UTILS & SHARED UI ---

const StatCard = ({ title, value, color }) => (
  <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
    <p className="text-slate-400 text-sm font-medium mb-1">{title}</p>
    <p className={`text-3xl font-bold ${color}`}>{value}</p>
  </div>
);

const StatusBadge = ({ status }) => {
  const styles = {
    'Completed': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'In Progress': 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    'Not Started': 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    'Cancelled': 'bg-red-500/10 text-red-400 border-red-500/20'
  };
  return (
    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${styles[status]}`}>
      {status}
    </span>
  );
};