import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  query
} from 'firebase/firestore';
import { 
  getAuth,
  signInWithCustomToken,
  signInAnonymously,
  onAuthStateChanged
} from 'firebase/auth'; // Fixed: Auth functions moved to firebase/auth
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area,
  BarChart, Bar, Cell
} from 'recharts';
import { 
  Plus, Trash2, Save, Download, RefreshCw, Database, 
  TrendingUp, Users, DollarSign, Briefcase, ChevronRight,
  AlertCircle, CheckCircle2, Loader2
} from 'lucide-react';

// --- FIREBASE CONFIGURATION & INITIALIZATION ---
let firebaseApp;
let auth;
let db;
let appId = 'default-app-id';

try {
  const configSource = typeof __firebase_config !== 'undefined' ? __firebase_config : '{}';
  const firebaseConfig = JSON.parse(configSource);
  
  if (firebaseConfig.apiKey) {
    firebaseApp = initializeApp(firebaseConfig);
    auth = getAuth(firebaseApp);
    db = getFirestore(firebaseApp);
    appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
  }
} catch (error) {
  console.error("Firebase Initialization Error:", error);
}

const App = () => {
  // State Management
  const [user, setUser] = useState(null);
  const [data, setData] = useState({
    team: [],
    revenue: [],
    expenses: [],
    settings: {
      currency: 'USD',
      projectName: 'UY Studios Database'
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  // --- AUTHENTICATION FLOW ---
  useEffect(() => {
    if (!auth) {
      setError("Cloud configuration missing. Operating in local mode.");
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
        console.error("Auth Error:", err);
        setError("Authentication failed. Please refresh.");
      }
    };

    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  // --- DATA SYNC FLOW ---
  useEffect(() => {
    if (!user || !db) return;

    const dataDoc = doc(db, 'artifacts', appId, 'public', 'data', 'dashboard_main');

    const unsubscribe = onSnapshot(dataDoc, 
      (docSnap) => {
        if (docSnap.exists()) {
          setData(docSnap.data());
        }
        setLoading(false);
      },
      (err) => {
        console.error("Firestore Sync Error:", err);
        setError("Failed to sync with cloud.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // --- ACTIONS ---
  const saveData = async (newData) => {
    if (!user || !db) return;
    try {
      const dataDoc = doc(db, 'artifacts', appId, 'public', 'data', 'dashboard_main');
      await setDoc(dataDoc, newData);
    } catch (err) {
      console.error("Error saving:", err);
    }
  };

  const handleUpdateTeam = (memberIndex, field, value) => {
    const updatedTeam = [...data.team];
    updatedTeam[memberIndex] = { ...updatedTeam[memberIndex], [field]: value };
    const newData = { ...data, team: updatedTeam };
    setData(newData);
    saveData(newData);
  };

  const addTeamMember = () => {
    const newMember = { id: Date.now(), name: 'New Member', role: 'Developer', cost: 0 };
    const newData = { ...data, team: [...data.team, newMember] };
    setData(newData);
    saveData(newData);
  };

  // --- CALCULATIONS ---
  const stats = useMemo(() => {
    const totalMonthlyCost = data.team.reduce((acc, curr) => acc + (Number(curr.cost) || 0), 0);
    const recentRevenue = data.revenue.length > 0 ? data.revenue[data.revenue.length - 1].amount : 0;
    const profitMargin = recentRevenue > 0 ? ((recentRevenue - totalMonthlyCost) / recentRevenue) * 100 : 0;
    
    return {
      monthlyBurn: totalMonthlyCost,
      currentRevenue: recentRevenue,
      margin: profitMargin.toFixed(1)
    };
  }, [data]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white p-6">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
        <h2 className="text-xl font-medium tracking-tight">Initializing Secure Connection...</h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">{data.settings.projectName}</h1>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${user ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
                  {user ? 'Cloud Synced' : 'Offline Mode'}
                </span>
              </div>
            </div>
          </div>
          
          <nav className="flex bg-slate-800/50 p-1 rounded-xl border border-slate-700/50">
            {['overview', 'team', 'financials'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab 
                    ? 'bg-blue-600 text-white shadow-lg' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 lg:p-8">
        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {activeTab === 'overview' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'Monthly Burn', value: `$${stats.monthlyBurn.toLocaleString()}`, icon: TrendingUp, color: 'text-rose-400' },
                { label: 'Active Talent', value: data.team.length, icon: Users, color: 'text-blue-400' },
                { label: 'Profit Margin', value: `${stats.margin}%`, icon: DollarSign, color: 'text-emerald-400' }
              ].map((item, idx) => (
                <div key={idx} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl hover:border-slate-700 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <div className={`p-3 rounded-xl bg-slate-800 ${item.color}`}>
                      <item.icon className="w-6 h-6" />
                    </div>
                  </div>
                  <p className="text-slate-400 text-sm font-medium mb-1">{item.label}</p>
                  <h3 className="text-3xl font-bold tracking-tight">{item.value}</h3>
                </div>
              ))}
            </div>

            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl h-[400px]">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-lg">Financial Trajectory</h3>
              </div>
              <ResponsiveContainer width="100%" height="90%">
                <AreaChart data={data.revenue.length > 0 ? data.revenue : [{month: 'Jan', amount: 0}]}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px' }}
                    itemStyle={{ color: '#f8fafc' }}
                  />
                  <Area type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'team' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-white">Personnel Database</h3>
                <p className="text-slate-400 text-sm">Manage team allocation and payroll costs</p>
              </div>
              <button 
                onClick={addTeamMember}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all"
              >
                <Plus className="w-4 h-4" /> Add Member
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-800/30 text-slate-400 text-xs uppercase tracking-widest font-bold">
                  <tr>
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Monthly Cost</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {data.team.map((member, idx) => (
                    <tr key={member.id} className="hover:bg-slate-800/20 transition-colors group">
                      <td className="px-6 py-4">
                        <input 
                          value={member.name}
                          onChange={(e) => handleUpdateTeam(idx, 'name', e.target.value)}
                          className="bg-transparent border-none focus:ring-1 focus:ring-blue-500 rounded px-2 py-1 w-full text-slate-200"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <select 
                          value={member.role}
                          onChange={(e) => handleUpdateTeam(idx, 'role', e.target.value)}
                          className="bg-slate-800 text-slate-300 border-none rounded-lg text-sm px-2 py-1 focus:ring-1 focus:ring-blue-500"
                        >
                          <option>Developer</option>
                          <option>Designer</option>
                          <option>Management</option>
                          <option>Marketing</option>
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-slate-300">
                          <span className="text-slate-500">$</span>
                          <input 
                            type="number"
                            value={member.cost}
                            onChange={(e) => handleUpdateTeam(idx, 'cost', e.target.value)}
                            className="bg-transparent border-none focus:ring-1 focus:ring-blue-500 rounded px-2 py-1 w-24"
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => {
                            const newTeam = data.team.filter((_, i) => i !== idx);
                            const newData = { ...data, team: newTeam };
                            setData(newData);
                            saveData(newData);
                          }}
                          className="text-slate-500 hover:text-rose-400 p-2 rounded-lg opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'financials' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in zoom-in-95 duration-500">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
              <h3 className="font-bold mb-4">Manual Revenue Logs</h3>
              <div className="space-y-3">
                {['Jan', 'Feb', 'Mar', 'Apr'].map((month) => (
                  <div key={month} className="flex items-center justify-between bg-slate-800/40 p-3 rounded-xl">
                    <span className="font-medium">{month} 2024</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">$</span>
                      <input 
                        type="number" 
                        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 w-28 text-right"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col items-center justify-center text-center">
              <div className="bg-blue-600/20 p-4 rounded-full mb-4">
                <CheckCircle2 className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="font-bold text-lg mb-2">Automated Sync Active</h3>
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-7xl mx-auto p-8 mt-12 border-t border-slate-900">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-slate-500 text-sm">
          <p>© 2024 UY Studios Database System</p>
          <div className="flex gap-6">
            <span className="flex items-center gap-1.5"><Database className="w-4 h-4" /> Workspace: {appId}</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;