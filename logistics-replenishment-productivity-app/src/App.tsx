import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import type { TaskRecord, TabType, FilterPeriod } from './types';
import { filterRecords, calculateAllMetrics, getDateRange } from './utils';
import Dashboard from './components/Dashboard';
import Ranking from './components/Ranking';
import Alerts from './components/Alerts';
import Evolution from './components/Evolution';
import Insights from './components/Insights';
import ImportExport from './components/ImportExport';
import DataManagement from './components/DataManagement';
import {
  LayoutDashboard, Trophy, Bell, TrendingUp, Brain,
  Upload, Shield, Menu, X, Filter, Calendar, Users,
  ChevronDown, Loader2, Package
} from 'lucide-react';
import dayjs from 'dayjs';

const TABS: { key: TabType; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'ranking', label: 'Ranking', icon: Trophy },
  { key: 'alertas', label: 'Alertas', icon: Bell },
  { key: 'evolucao', label: 'Evolução', icon: TrendingUp },
  { key: 'insights', label: 'Insights IA', icon: Brain },
  { key: 'importar', label: 'Importar', icon: Upload },
  { key: 'gerenciar', label: 'Dados', icon: Shield },
];

export default function App() {
  const [records, setRecords] = useState<TaskRecord[]>([]);
  const [usuarios, setUsuarios] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('dia');
  const [filterDate, setFilterDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [filterUser, setFilterUser] = useState('');
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [regSnap, userSnap] = await Promise.all([
        getDocs(collection(db, 'registros')),
        getDocs(collection(db, 'separadores')),
      ]);
      const recs: TaskRecord[] = [];
      regSnap.forEach(d => recs.push({ id: d.id, ...d.data() } as TaskRecord));
      setRecords(recs);
      const users: string[] = [];
      userSnap.forEach(d => users.push(d.id));
      setUsuarios(users.sort());
    } catch (err) {
      console.error('Error fetching:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredRecords = useMemo(
    () => filterRecords(records, filterPeriod, filterDate, filterUser || undefined),
    [records, filterPeriod, filterDate, filterUser]
  );

  const filteredMetrics = useMemo(() => calculateAllMetrics(filteredRecords), [filteredRecords]);
  const allMetrics = useMemo(() => calculateAllMetrics(records), [records]);

  const dateRangeLabel = useMemo(() => {
    const { start, end } = getDateRange(filterPeriod, filterDate);
    if (start === end) return dayjs(start).format('DD/MM/YYYY');
    return `${dayjs(start).format('DD/MM')} - ${dayjs(end).format('DD/MM/YYYY')}`;
  }, [filterPeriod, filterDate]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard metrics={filteredMetrics} records={filteredRecords} />;
      case 'ranking': return <Ranking metrics={filteredMetrics} />;
      case 'alertas': return <Alerts metrics={filteredMetrics} />;
      case 'evolucao': return <Evolution allMetrics={allMetrics} usuarios={usuarios} />;
      case 'insights': return <Insights metrics={filteredMetrics} />;
      case 'importar': return <ImportExport onImportComplete={fetchData} filteredMetrics={filteredMetrics} allMetrics={allMetrics} />;
      case 'gerenciar': return <DataManagement usuarios={usuarios} onRefresh={fetchData} />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="bg-gray-900/80 backdrop-blur-md border-b border-gray-800 sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden text-gray-400 hover:text-white p-1">
              {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-white font-bold text-sm sm:text-base leading-tight">Produtividade Ressuprimento</h1>
                <p className="text-gray-500 text-[10px] hidden sm:block">{dateRangeLabel}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                showFilters ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Filtros</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
            {loading && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="border-t border-gray-800 px-4 py-3 animate-fade-in">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <select
                  value={filterPeriod}
                  onChange={e => setFilterPeriod(e.target.value as FilterPeriod)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="dia">Dia</option>
                  <option value="semana">Semana</option>
                  <option value="mes">Mês</option>
                </select>
              </div>
              <input
                type="date"
                value={filterDate}
                onChange={e => setFilterDate(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400" />
                <select
                  value={filterUser}
                  onChange={e => setFilterUser(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[140px]"
                >
                  <option value="">Todos os Operadores</option>
                  {usuarios.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="text-gray-500 text-xs">
                {filteredRecords.length} registros | {filteredMetrics.length} operadores
              </div>
            </div>
          </div>
        )}
      </header>

      <div className="flex flex-1">
        {/* Sidebar Desktop */}
        <nav className="hidden lg:flex flex-col w-56 bg-gray-900/50 border-r border-gray-800 py-4 px-3 shrink-0">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all mb-1 ${
                activeTab === tab.key
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50 border border-transparent'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
          <div className="mt-auto pt-4 border-t border-gray-800 px-3">
            <p className="text-[10px] text-gray-500 leading-relaxed">Desenvolvido por Guilherme Lopes</p>
          </div>
        </nav>

        {/* Sidebar Mobile Overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
            <nav className="absolute left-0 top-0 bottom-0 w-64 bg-gray-900 border-r border-gray-800 py-4 px-3 animate-slide-in">
              <div className="flex items-center justify-between px-3 mb-4">
                <span className="text-white font-bold text-sm">Menu</span>
                <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all mb-1 w-full text-left ${
                    activeTab === tab.key
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/50 border border-transparent'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
          {renderContent()}
        </main>
      </div>

      {/* Footer Mobile */}
      <footer className="lg:hidden bg-gray-900/80 border-t border-gray-800">
        <div className="flex justify-around py-1">
          {TABS.slice(0, 5).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-[10px] transition-colors ${
                activeTab === tab.key ? 'text-blue-400' : 'text-gray-500'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </footer>

      {/* Footer Desktop */}
      <footer className="hidden lg:block bg-gray-900/50 border-t border-gray-800 px-8 py-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">Desenvolvido por Guilherme Lopes</p>
          <p className="text-xs text-gray-600">Produtividade Ressuprimento v1.0</p>
        </div>
      </footer>
    </div>
  );
}
