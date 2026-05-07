import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Users, 
  MapPin, 
  DollarSign, 
  BrainCircuit, 
  ExternalLink, 
  Trash2, 
  Loader2,
  TrendingUp,
  CreditCard,
  Receipt
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from 'recharts';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

// --- Firebase Configuration ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'project-manager-app';
const apiKey = ""; 

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // State for project and historical data
  const [projectData, setProjectData] = useState({
    details: { location: '', mapsLink: '', clientPaid: 0, clientDebt: 0 },
    team: [],
    aiInsights: '',
    history: [] // Holds monthly data for the rolling annual graph
  });

  // Generate 12 months of empty data if none exists
  const defaultHistory = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.map(m => ({ name: m, revenue: 0, debt: 0, expenses: 0 }));
  }, []);

  // --- Auth & Data Sync ---
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'mainProject');
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setProjectData(prev => ({
          ...data,
          history: data.history?.length ? data.history : defaultHistory
        }));
      } else {
        setProjectData(prev => ({ ...prev, history: defaultHistory }));
      }
    }, (err) => console.error("Firestore error:", err));
    return () => unsubscribe();
  }, [user, defaultHistory]);

  const saveData = async (newData) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'mainProject'), newData);
    } catch (err) {
      console.error("Save error:", err);
    }
  };

  // --- Logic ---
  const currentExpenses = projectData.team?.reduce((sum, m) => sum + (Number(m.cost) || 0), 0) || 0;
  
  const updateDetail = (field, value) => {
    const updated = { ...projectData, details: { ...projectData.details, [field]: value } };
    setProjectData(updated);
    saveData(updated);
  };

  const updateHistoryValue = (monthIndex, field, value) => {
    const newHistory = [...projectData.history];
    newHistory[monthIndex] = { ...newHistory[monthIndex], [field]: Number(value) };
    const updated = { ...projectData, history: newHistory };
    setProjectData(updated);
    saveData(updated);
  };

  const addTeamMember = () => {
    const updated = { ...projectData, team: [...(projectData.team || []), { id: Date.now(), name: '', role: '', cost: 0 }] };
    setProjectData(updated);
    saveData(updated);
  };

  // --- Gemini AI ---
  const runAIAnalysis = async () => {
    setIsAnalyzing(true);
    const prompt = `Analyze: Location: ${projectData.details.location}, Paid: $${projectData.details.clientPaid}, Debt: $${projectData.details.clientDebt}, Total Expenses: $${currentExpenses}. Provide 3 financial risk management tips.`;
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Analysis unavailable.";
      saveData({ ...projectData, aiInsights: text });
    } catch (err) { console.error(err); } finally { setIsAnalyzing(false); }
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-600" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 text-slate-900 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Top Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Financial & Project Dashboard</h1>
            <p className="text-slate-500 text-sm">Real-time rolling annual trends and team logistics</p>
          </div>
          <button 
            onClick={runAIAnalysis}
            disabled={isAnalyzing}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium transition-all"
          >
            {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
            Run AI Audit
          </button>
        </header>

        {/* Rolling Annual Graph Section */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 font-bold text-slate-800 mb-6">
            <TrendingUp className="w-5 h-5 text-indigo-600" /> Rolling Annual Trends
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={projectData.history}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Legend verticalAlign="top" height={36}/>
                <Line type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Revenue" />
                <Line type="monotone" dataKey="expenses" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4 }} name="Expenses" />
                <Line type="monotone" dataKey="debt" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} name="Client Debt" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          
          {/* Data Entry Grid for the Graph */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2 overflow-x-auto pb-2">
            {projectData.history.map((m, idx) => (
              <div key={idx} className="min-w-[80px] space-y-1">
                <div className="text-[10px] font-bold text-center text-slate-400">{m.name}</div>
                <input 
                  type="number" 
                  placeholder="Rev"
                  value={m.revenue || ''} 
                  onChange={(e) => updateHistoryValue(idx, 'revenue', e.target.value)}
                  className="w-full text-center text-xs p-1 border border-slate-100 rounded bg-slate-50"
                />
                <input 
                  type="number" 
                  placeholder="Exp"
                  value={m.expenses || ''} 
                  onChange={(e) => updateHistoryValue(idx, 'expenses', e.target.value)}
                  className="w-full text-center text-xs p-1 border border-slate-100 rounded bg-slate-50"
                />
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Logistics & Direct Financials */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
              <h3 className="font-bold flex items-center gap-2 text-slate-700"><MapPin className="w-4 h-4"/> Location</h3>
              <input 
                type="text"
                placeholder="Project Venue"
                value={projectData.details.location}
                onChange={(e) => updateDetail('location', e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 ring-indigo-500/20"
              />
              <div className="relative">
                <input 
                  type="text"
                  placeholder="Google Maps Link"
                  value={projectData.details.mapsLink}
                  onChange={(e) => updateDetail('mapsLink', e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none pr-10"
                />
                <a href={projectData.details.mapsLink} target="_blank" rel="noreferrer" className="absolute right-3 top-3 text-indigo-500">
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
              <h3 className="font-bold flex items-center gap-2 text-slate-700"><DollarSign className="w-4 h-4"/> Live Balance</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500 flex items-center gap-1"><Receipt className="w-3 h-3"/> Paid</span>
                  <input 
                    type="number"
                    value={projectData.details.clientPaid}
                    onChange={(e) => updateDetail('clientPaid', e.target.value)}
                    className="w-24 text-right font-bold text-emerald-600 bg-transparent"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500 flex items-center gap-1"><CreditCard className="w-3 h-3"/> Debt</span>
                  <input 
                    type="number"
                    value={projectData.details.clientDebt}
                    onChange={(e) => updateDetail('clientDebt', e.target.value)}
                    className="w-24 text-right font-bold text-amber-600 bg-transparent"
                  />
                </div>
                <div className="pt-3 border-t flex justify-between font-bold text-lg">
                  <span>Margin</span>
                  <span className={projectData.details.clientPaid - currentExpenses >= 0 ? "text-indigo-600" : "text-red-500"}>
                    ${projectData.details.clientPaid - currentExpenses}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Team Management */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold flex items-center gap-2 text-slate-700"><Users className="w-4 h-4"/> Team & Roles</h3>
              <button onClick={addTeamMember} className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg text-sm font-bold hover:bg-indigo-100 transition-colors">
                + Add Member
              </button>
            </div>
            
            <div className="space-y-3">
              {projectData.team?.map((member) => (
                <div key={member.id} className="grid grid-cols-12 gap-3 items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="col-span-5">
                    <input 
                      placeholder="Name"
                      value={member.name}
                      onChange={(e) => {
                        const updated = projectData.team.map(m => m.id === member.id ? {...m, name: e.target.value} : m);
                        saveData({...projectData, team: updated});
                      }}
                      className="w-full bg-transparent text-sm font-medium outline-none"
                    />
                  </div>
                  <div className="col-span-4">
                    <input 
                      placeholder="Role"
                      value={member.role}
                      onChange={(e) => {
                        const updated = projectData.team.map(m => m.id === member.id ? {...m, role: e.target.value} : m);
                        saveData({...projectData, team: updated});
                      }}
                      className="w-full bg-transparent text-sm text-slate-500 outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <input 
                      type="number"
                      placeholder="0"
                      value={member.cost}
                      onChange={(e) => {
                        const updated = projectData.team.map(m => m.id === member.id ? {...m, cost: e.target.value} : m);
                        saveData({...projectData, team: updated});
                      }}
                      className="w-full bg-transparent text-sm font-bold text-right outline-none"
                    />
                  </div>
                  <div className="col-span-1 text-right">
                    <button 
                      onClick={() => {
                        const updated = projectData.team.filter(m => m.id !== member.id);
                        saveData({...projectData, team: updated});
                      }}
                      className="text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {projectData.aiInsights && (
              <div className="mt-8 p-5 bg-indigo-50 rounded-2xl border border-indigo-100">
                <div className="flex items-center gap-2 text-indigo-800 font-bold mb-2">
                  <BrainCircuit className="w-4 h-4" /> AI Strategy
                </div>
                <div className="text-sm text-indigo-900 leading-relaxed whitespace-pre-line">
                  {projectData.aiInsights}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;