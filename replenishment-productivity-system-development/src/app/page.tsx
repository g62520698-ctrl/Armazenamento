'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3, Upload, Trophy, AlertTriangle, TrendingUp,
  Lightbulb, Download, Trash2, RefreshCw, Users, Clock,
  Target, Zap, Search, ChevronDown, ChevronUp,
  Menu, X, Activity, CheckCircle2, AlertOctagon,
  Info, ArrowUpDown, Package, Filter, ChevronRight,
  BarChart2, TrendingDown, Clock4, Boxes, Layers,
  Sparkles, Timer, Shield, Calendar, XCircle, CircleCheck, CircleAlert, CircleX
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell as RechartsCell,
  AreaChart, Area, RadialBarChart, RadialBar
} from 'recharts';
import toast, { Toaster } from 'react-hot-toast';
import type { MetricsResponse, OperatorDaySummary, TaskInterval, HeatmapCell } from '@/lib/calculations';
import { formatMinutes } from '@/lib/calculations';

// ============================================================
type Tab = 'dashboard' | 'import' | 'ranking' | 'alerts' | 'evolution' | 'insights' | 'export';
type PeriodMode = 'all' | 'day' | 'week' | 'month' | 'custom';
interface SortConfig { key: string; direction: 'asc' | 'desc'; }
interface DeleteConfig { scope: string; value: string; label: string; operator?: string; startDate?: string; endDate?: string; }

const TAB_CONFIG: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'import', label: 'Importar', icon: Upload },
  { id: 'ranking', label: 'Ranking', icon: Trophy },
  { id: 'alerts', label: 'Alertas', icon: AlertTriangle },
  { id: 'evolution', label: 'Evolução', icon: TrendingUp },
  { id: 'insights', label: 'Insights IA', icon: Lightbulb },
  { id: 'export', label: 'Exportar', icon: Download },
];

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  EXCELENTE: { color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30' },
  'MUITO BOM': { color: 'text-blue-400', bg: 'bg-blue-500/15', border: 'border-blue-500/30' },
  BOM: { color: 'text-cyan-400', bg: 'bg-cyan-500/15', border: 'border-cyan-500/30' },
  ATENÇÃO: { color: 'text-yellow-400', bg: 'bg-yellow-500/15', border: 'border-yellow-500/30' },
  CRÍTICO: { color: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/30' },
};

const CLASSIFICATION_CONFIG: Record<string, { color: string; bg: string; icon: typeof CheckCircle2 }> = {
  excelente: { color: 'text-emerald-400', bg: 'bg-emerald-500/15', icon: CircleCheck },
  bom: { color: 'text-blue-400', bg: 'bg-blue-500/15', icon: CheckCircle2 },
  aviso: { color: 'text-yellow-400', bg: 'bg-yellow-500/15', icon: CircleAlert },
  ociosidade: { color: 'text-red-400', bg: 'bg-red-500/15', icon: CircleX },
};

const HEATMAP_LEVELS: Record<string, { bg: string; text: string }> = {
  low: { bg: 'bg-slate-700/40', text: 'text-slate-500' },
  medium: { bg: 'bg-blue-600/40', text: 'text-blue-300' },
  high: { bg: 'bg-emerald-600/50', text: 'text-emerald-300' },
  'very-high': { bg: 'bg-emerald-500/60', text: 'text-emerald-200' },
};

const CHART_COLORS = ['#3b82f6', '#22c55e', '#eab308', '#ef4444', '#a855f7', '#f97316', '#06b6d4', '#ec4899'];

const fadeIn = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -12 } };
const stagger = { animate: { transition: { staggerChildren: 0.06 } } };

function Skeleton({ className = '' }: { className?: string }) { return <div className={`skeleton ${className}`} />; }

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card-premium p-5"><Skeleton className="h-3 w-20 mb-3" /><Skeleton className="h-8 w-24 mb-2" /><Skeleton className="h-2 w-16" /></div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-premium p-5"><Skeleton className="h-4 w-40 mb-4" /><Skeleton className="h-[280px]" /></div>
        <div className="card-premium p-5"><Skeleton className="h-4 w-40 mb-4" /><Skeleton className="h-[280px]" /></div>
      </div>
    </div>
  );
}

// ============================================================
// HELPERS
// ============================================================
function convertToDDMMYYYY(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function convertToYYYYMMDD(dateStr: string): string {
  if (!dateStr.includes('/')) return dateStr;
  const [d, m, y] = dateStr.split('/');
  return `${y}-${m}-${d}`;
}

function getPerformanceColor(val: number): string {
  if (val >= 120) return '#22c55e';
  if (val >= 100) return '#3b82f6';
  if (val >= 85) return '#06b6d4';
  if (val >= 70) return '#facc15';
  return '#ef4444';
}

function getWeekRange(dateStr: string): [string, string] {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday start
  const monday = new Date(d);
  monday.setDate(d.getDate() - diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  return [fmt(monday), fmt(sunday)];
}

function getMonthRange(monthYear: string): [string, string] {
  const [m, y] = monthYear.split('/');
  const start = `${y}-${m}-01`;
  const endDate = new Date(parseInt(y), parseInt(m), 0);
  const end = `${y}-${m}-${String(endDate.getDate()).padStart(2, '0')}`;
  return [start, end];
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function HomePage() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [data, setData] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  // Global filters
  const [periodMode, setPeriodMode] = useState<PeriodMode>('all');
  const [operatorFilter, setOperatorFilter] = useState('all');
  const [dayFilter, setDayFilter] = useState('');
  const [weekFilter, setWeekFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Data lists
  const [operators, setOperators] = useState<string[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);

  // Sort
  const [rankingSort, setRankingSort] = useState<SortConfig>({ key: 'performance', direction: 'desc' });

  // Alert filters
  const [alertOperator, setAlertOperator] = useState('all');
  const [alertClassification, setAlertClassification] = useState('all');
  const [alertSearch, setAlertSearch] = useState('');

  // Import
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete modal
  const [deleteModal, setDeleteModal] = useState<DeleteConfig | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Compute effective start/end dates from period mode
  const getFilterDates = useCallback((): { startDate: string; endDate: string } => {
    switch (periodMode) {
      case 'day':
        return dayFilter ? { startDate: convertToDDMMYYYY(dayFilter), endDate: convertToDDMMYYYY(dayFilter) } : { startDate: '', endDate: '' };
      case 'week':
        return weekFilter ? { startDate: convertToDDMMYYYY(getWeekRange(weekFilter)[0]), endDate: convertToDDMMYYYY(getWeekRange(weekFilter)[1]) } : { startDate: '', endDate: '' };
      case 'month':
        return monthFilter ? { startDate: convertToDDMMYYYY(getMonthRange(monthFilter)[0]), endDate: convertToDDMMYYYY(getMonthRange(monthFilter)[1]) } : { startDate: '', endDate: '' };
      case 'custom':
        return { startDate: customStart ? convertToDDMMYYYY(customStart) : '', endDate: customEnd ? convertToDDMMYYYY(customEnd) : '' };
      default:
        return { startDate: '', endDate: '' };
    }
  }, [periodMode, dayFilter, weekFilter, monthFilter, customStart, customEnd]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (operatorFilter !== 'all') params.set('operator', operatorFilter);
      const { startDate, endDate } = getFilterDates();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const res = await fetch(`/api/metrics?${params}`);
      if (!res.ok) throw new Error('Failed');
      setData(await res.json());
    } catch { toast.error('Erro ao carregar dados'); }
    finally { setLoading(false); }
  }, [operatorFilter, getFilterDates]);

  const fetchMeta = useCallback(async () => {
    try {
      const res = await fetch('/api/data');
      if (!res.ok) return;
      const json = await res.json();
      setOperators(json.operators || []);
      setAvailableDates(json.dates || []);
      setAvailableMonths(json.months || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (mounted) { fetchData(); fetchMeta(); }
  }, [mounted, fetchData, fetchMeta]);

  // ============================================================
  // Handlers
  // ============================================================
  async function handleImport(file: File) {
    if (!file.name.toLowerCase().match(/\.(xlsx|xls|csv)$/)) {
      toast.error('Apenas arquivos Excel (.xlsx, .xls)');
      return;
    }
    setImporting(true);
    const tid = toast.loading('Processando planilha...');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/import', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || 'Erro na importação', { id: tid }); return; }
      const msg = `${json.imported} registros importados · ${json.operatorCount} operadores${json.duplicates > 0 ? ` · ${json.duplicates} duplicatas ignoradas` : ''}`;
      toast.success(msg, { id: tid, duration: 5000 });
      fetchData(); fetchMeta();
    } catch { toast.error('Erro na importação', { id: tid }); }
    finally { setImporting(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  }

  async function confirmDelete() {
    if (!deleteModal) return;
    setDeleting(true);
    try {
      const params = new URLSearchParams({ scope: deleteModal.scope });
      if (deleteModal.scope === 'date') params.set('value', deleteModal.value);
      if (deleteModal.scope === 'range') { params.set('startDate', deleteModal.startDate || ''); params.set('endDate', deleteModal.endDate || ''); }
      if (deleteModal.scope === 'operator') params.set('operator', deleteModal.operator || '');
      const res = await fetch(`/api/data?${params}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || 'Erro ao excluir'); return; }
      toast.success(json.message);
      fetchData(); fetchMeta();
    } catch { toast.error('Erro ao excluir dados'); }
    finally { setDeleting(false); setDeleteModal(null); }
  }

  async function handleExport() {
    try {
      toast.loading('Gerando relatório...', { id: 'export' });
      const params = new URLSearchParams();
      if (operatorFilter !== 'all') params.set('operator', operatorFilter);
      const { startDate, endDate } = getFilterDates();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const res = await fetch(`/api/export?${params}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'produtividade_ressuprimento.xlsx'; a.click();
      URL.revokeObjectURL(url);
      toast.success('Planilha exportada!', { id: 'export' });
    } catch { toast.error('Erro na exportação', { id: 'export' }); }
  }

  function sortSummaries(summaries: OperatorDaySummary[]): OperatorDaySummary[] {
    return [...summaries].sort((a, b) => {
      const key = rankingSort.key as keyof OperatorDaySummary;
      const aVal = typeof a[key] === 'number' ? a[key] : String(a[key] || '');
      const bVal = typeof b[key] === 'number' ? b[key] : String(b[key] || '');
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return rankingSort.direction === 'asc' ? cmp : -cmp;
    });
  }

  function toggleSort(key: string) {
    setRankingSort(prev => ({ key, direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc' }));
  }

  function getMedalEmoji(i: number): string { return i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : ''; }
  function getMedalClass(i: number): string { return i === 0 ? 'medal-gold' : i === 1 ? 'medal-silver' : i === 2 ? 'medal-bronze' : ''; }

  function clearFilters() {
    setPeriodMode('all'); setOperatorFilter('all');
    setDayFilter(''); setWeekFilter(''); setMonthFilter('');
    setCustomStart(''); setCustomEnd('');
  }

  function getPeriodLabel(): string {
    switch (periodMode) {
      case 'day': return dayFilter ? convertToDDMMYYYY(dayFilter) : '';
      case 'week': { if (!weekFilter) return ''; const [s, e] = getWeekRange(weekFilter); return `${convertToDDMMYYYY(s)} até ${convertToDDMMYYYY(e)}`; }
      case 'month': return monthFilter;
      case 'custom': { const s = customStart ? convertToDDMMYYYY(customStart) : ''; const e = customEnd ? convertToDDMMYYYY(customEnd) : ''; return s && e ? `${s} até ${e}` : ''; }
      default: return '';
    }
  }

  // ============================================================
  // SIDEBAR
  // ============================================================
  function renderSidebar() {
    return (
      <>
        <aside className="hidden lg:flex flex-col w-[260px] fixed left-0 top-0 bottom-0 z-40 glass-strong">
          <div className="p-6 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-[15px] font-bold text-white tracking-tight">Produtividade</h1>
                <p className="text-[11px] text-slate-500 font-medium tracking-wide uppercase">Ressuprimento</p>
              </div>
            </div>
          </div>
          <div className="mx-5 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
          <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
            {TAB_CONFIG.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <motion.button key={tab.id} whileHover={{ x: 4 }} whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveTab(tab.id)}
                  className={`sidebar-item w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-medium transition-all ${isActive ? 'active bg-blue-500/10 text-blue-400' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}>
                  <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                  <span>{tab.label}</span>
                  {isActive && <motion.div layoutId="activeTab" className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400" />}
                </motion.button>
              );
            })}
          </nav>
          <div className="p-4 mx-3 mb-3 rounded-xl bg-slate-800/30 border border-slate-800">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] text-slate-500">Sistema ativo</span>
            </div>
            <p className="text-[10px] text-slate-600 text-center">Desenvolvido por Guilherme Lopes</p>
          </div>
        </aside>

        <header className="lg:hidden fixed top-0 left-0 right-0 z-50 glass-strong">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <div><h1 className="text-sm font-bold text-white leading-none">Produtividade</h1><p className="text-[10px] text-slate-500">Ressuprimento</p></div>
            </div>
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setMobileNav(!mobileNav)} className="text-slate-400 p-2 rounded-lg hover:bg-slate-800">
              {mobileNav ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </motion.button>
          </div>
        </header>

        <AnimatePresence>
          {mobileNav && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setMobileNav(false)}>
              <motion.nav initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="absolute right-0 top-0 bottom-0 w-64 bg-dark-900 border-l border-slate-800 p-4 pt-16"
                onClick={e => e.stopPropagation()}>
                <div className="space-y-1">
                  {TAB_CONFIG.map(tab => {
                    const Icon = tab.icon;
                    return (
                      <button key={tab.id} onClick={() => { setActiveTab(tab.id); setMobileNav(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-blue-500/10 text-blue-400' : 'text-slate-400 hover:bg-slate-800'}`}>
                        <Icon className="w-4 h-4" />{tab.label}
                      </button>
                    );
                  })}
                </div>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

  // ============================================================
  // DELETE CONFIRMATION MODAL
  // ============================================================
  function renderDeleteModal() {
    if (!deleteModal) return null;
    return (
      <AnimatePresence>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => !deleting && setDeleteModal(null)}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
            className="card-premium p-8 max-w-md w-full text-center" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-5">
              <AlertTriangle className="w-7 h-7 text-red-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Confirmar Exclusão</h3>
            <p className="text-sm text-slate-400 mb-1">ATENÇÃO: Esta ação não pode ser desfeita.</p>
            <p className="text-sm text-red-400 font-medium mb-6">{deleteModal.label}</p>
            <div className="flex gap-3">
              <motion.button whileTap={{ scale: 0.95 }} disabled={deleting}
                onClick={() => setDeleteModal(null)}
                className="flex-1 py-3 rounded-xl border border-slate-700 text-sm text-slate-400 hover:bg-slate-800 transition-colors disabled:opacity-40">
                Cancelar
              </motion.button>
              <motion.button whileTap={{ scale: 0.95 }} disabled={deleting}
                onClick={confirmDelete}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-40">
                {deleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deleting ? 'Excluindo...' : 'Excluir'}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // ============================================================
  // GLOBAL FILTER BAR
  // ============================================================
  function renderGlobalFilters() {
    const periodModes: { id: PeriodMode; label: string }[] = [
      { id: 'all', label: 'Todos' },
      { id: 'day', label: 'Dia' },
      { id: 'week', label: 'Semana' },
      { id: 'month', label: 'Mês' },
      { id: 'custom', label: 'Período' },
    ];

    const hasFilters = periodMode !== 'all' || operatorFilter !== 'all';

    return (
      <motion.div {...fadeIn} className="mb-6 space-y-3">
        {/* Period mode chips */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-1.5 mr-1">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Período</span>
          </div>
          {periodModes.map(mode => (
            <button key={mode.id}
              onClick={() => setPeriodMode(mode.id)}
              className={`chip ${periodMode === mode.id ? 'chip-active' : ''}`}>
              {mode.label}
            </button>
          ))}

          {/* Operator filter */}
          <div className="ml-2 flex items-center gap-2">
            <select value={operatorFilter} onChange={e => setOperatorFilter(e.target.value)}
              className="chip appearance-none pr-8 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20fill%3D%22%2394a3b8%22%20viewBox%3D%220%200%2016%2016%22%3E%3Cpath%20d%3D%22M8%2011L3%206h10z%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_10px_center] bg-no-repeat">
              <option value="all">Todos Operadores</option>
              {operators.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {hasFilters && (
            <button onClick={clearFilters}
              className="chip !bg-red-500/10 !border-red-500/20 !text-red-400 hover:!bg-red-500/20 flex items-center gap-1 text-xs">
              <X className="w-3 h-3" />Limpar
            </button>
          )}
        </div>

        {/* Period-specific inputs */}
        <AnimatePresence mode="wait">
          {periodMode === 'day' && (
            <motion.div key="day" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-2">
                <input type="date" value={dayFilter} onChange={e => setDayFilter(e.target.value)}
                  className="chip !px-3 !py-1.5 text-center" />
                {dayFilter && <span className="text-xs text-slate-500">{convertToDDMMYYYY(dayFilter)}</span>}
                {availableDates.length > 0 && (
                  <select onChange={e => { if (e.target.value) setDayFilter(convertToYYYYMMDD(e.target.value)); }}
                    className="chip text-xs" defaultValue="">
                    <option value="">Datas disponíveis...</option>
                    {availableDates.slice(-30).reverse().map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                )}
              </div>
            </motion.div>
          )}

          {periodMode === 'week' && (
            <motion.div key="week" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-2">
                <input type="date" value={weekFilter} onChange={e => setWeekFilter(e.target.value)}
                  className="chip !px-3 !py-1.5 text-center" />
                {weekFilter && (
                  <span className="text-xs text-slate-500">
                    {convertToDDMMYYYY(getWeekRange(weekFilter)[0])} até {convertToDDMMYYYY(getWeekRange(weekFilter)[1])}
                  </span>
                )}
              </div>
            </motion.div>
          )}

          {periodMode === 'month' && (
            <motion.div key="month" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-2">
                {availableMonths.length > 0 ? (
                  <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
                    className="chip text-xs">
                    <option value="">Selecione o mês...</option>
                    {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <div className="flex items-center gap-2">
                    <input type="month" onChange={e => { if (e.target.value) { const [y, m] = e.target.value.split('-'); setMonthFilter(`${m}/${y}`); } }}
                      className="chip !px-3 !py-1.5 text-center" />
                  </div>
                )}
                {monthFilter && <span className="text-xs text-slate-500">{convertToDDMMYYYY(getMonthRange(monthFilter)[0])} até {convertToDDMMYYYY(getMonthRange(monthFilter)[1])}</span>}
              </div>
            </motion.div>
          )}

          {periodMode === 'custom' && (
            <motion.div key="custom" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-2">
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                  className="chip !px-3 !py-1.5 text-center" placeholder="Início" />
                <span className="text-slate-600 text-xs">até</span>
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                  className="chip !px-3 !py-1.5 text-center" placeholder="Fim" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active filter summary */}
        {hasFilters && (
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <Filter className="w-3 h-3" />
            <span>
              {operatorFilter !== 'all' && <span className="text-blue-400">{operatorFilter}</span>}
              {operatorFilter !== 'all' && periodMode !== 'all' && <span> · </span>}
              {periodMode !== 'all' && <span className="text-emerald-400">{getPeriodLabel()}</span>}
            </span>
          </div>
        )}
      </motion.div>
    );
  }

  // ============================================================
  // KPI CARD
  // ============================================================
  function KPICard({ title, value, subtitle, icon: Icon, color, delay = 0 }: {
    title: string; value: string | number; subtitle: string; icon: typeof BarChart3; color: string; delay?: number;
  }) {
    return (
      <motion.div {...fadeIn} transition={{ delay }} className="card-premium p-5 relative overflow-hidden group">
        <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-0 group-hover:opacity-30 transition-opacity duration-500`} style={{ background: color }} />
        <div className="relative">
          <div className="flex items-start justify-between mb-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center`} style={{ background: `${color}15` }}>
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider mb-1">{title}</p>
          <p className="text-2xl font-bold text-white leading-none">{value}</p>
          <p className="text-[11px] text-slate-500 mt-1.5">{subtitle}</p>
          <div className="mt-3 h-1 bg-slate-800 rounded-full overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, typeof value === 'number' ? (value / 150) * 100 : 50)}%` }}
              transition={{ duration: 1, delay: delay + 0.3, ease: 'easeOut' }}
              className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${color}, ${color}88)` }} />
          </div>
        </div>
      </motion.div>
    );
  }

  // ============================================================
  // HEATMAP
  // ============================================================
  function renderHeatmap(cells: HeatmapCell[]) {
    const opSet = new Set(cells.map(c => c.operator));
    const hourSet = new Set(cells.map(c => c.hour));
    const opList = Array.from(opSet).sort();
    const hours = Array.from(hourSet).sort((a, b) => a - b);
    const cellMap = new Map<string, HeatmapCell>();
    cells.forEach(c => cellMap.set(`${c.operator}|||${c.hour}`, c));

    return (
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left text-slate-500 p-2 min-w-[100px] sticky left-0 bg-[#111827] z-10">Operador</th>
              {hours.map(h => <th key={h} className="text-center text-slate-500 p-1 min-w-[40px] font-medium">{String(h).padStart(2, '0')}h</th>)}
            </tr>
          </thead>
          <tbody>
            {opList.map(op => (
              <tr key={op}>
                <td className="text-slate-400 p-2 truncate max-w-[100px] text-[11px] font-medium sticky left-0 bg-[#111827] z-10" title={op}>
                  {op.length > 14 ? op.substring(0, 14) + '…' : op}
                </td>
                {hours.map(h => {
                  const cell = cellMap.get(`${op}|||${h}`);
                  const level = cell ? HEATMAP_LEVELS[cell.level] : null;
                  return (
                    <td key={h} className="p-0.5">
                      <motion.div whileHover={{ scale: 1.2 }}
                        className={`heatmap-cell ${level ? `${level.bg} ${level.text}` : 'bg-slate-800/30 text-slate-700'}`}
                        title={cell ? `${op}: ${cell.count} tarefas às ${String(h).padStart(2, '0')}:00` : ''}>
                        {cell ? cell.count : ''}
                      </motion.div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center gap-4 mt-4 px-2">
          <span className="text-[10px] text-slate-600">Menos</span>
          <div className="flex gap-1">
            {[{ bg: 'bg-slate-700/40', text: 'text-slate-500' }, { bg: 'bg-blue-600/40', text: 'text-blue-300' }, { bg: 'bg-emerald-600/50', text: 'text-emerald-300' }, { bg: 'bg-emerald-500/60', text: 'text-emerald-200' }].map((l, i) => (
              <div key={i} className={`w-6 h-6 rounded ${l.bg} ${l.text} flex items-center justify-center text-[9px]`}>·</div>
            ))}
          </div>
          <span className="text-[10px] text-slate-600">Mais</span>
        </div>
      </div>
    );
  }

  // ============================================================
  // DASHBOARD
  // ============================================================
  function renderDashboard() {
    if (!data) return <DashboardSkeleton />;
    const statusDist = [
      { name: 'Excelente', value: data.summaries.filter(s => s.status === 'EXCELENTE').length, color: '#22c55e' },
      { name: 'Muito Bom', value: data.summaries.filter(s => s.status === 'MUITO BOM').length, color: '#3b82f6' },
      { name: 'Bom', value: data.summaries.filter(s => s.status === 'BOM').length, color: '#06b6d4' },
      { name: 'Atenção', value: data.summaries.filter(s => s.status === 'ATENÇÃO').length, color: '#facc15' },
      { name: 'Crítico', value: data.summaries.filter(s => s.status === 'CRÍTICO').length, color: '#ef4444' },
    ].filter(d => d.value > 0);

    return (
      <motion.div {...stagger} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <KPICard title="Desempenho" value={`${data.avgPerformance}%`} subtitle={data.avgPerformance >= 100 ? 'Acima da meta' : 'Abaixo da meta'} icon={Target} color={getPerformanceColor(data.avgPerformance)} delay={0} />
          <KPICard title="Tarefas/Hora" value={data.avgTasksPerHour} subtitle="Meta: 12 t/h" icon={Clock} color={data.avgTasksPerHour >= 12 ? '#22c55e' : '#facc15'} delay={0.05} />
          <KPICard title="Tempo Médio" value={`${data.avgTimePerTask}m`} subtitle="Meta: 5 min" icon={Timer} color={data.avgTimePerTask <= 5 ? '#22c55e' : '#facc15'} delay={0.1} />
          <KPICard title="Total Tarefas" value={data.totalTasks} subtitle={`${data.totalVolumes.toLocaleString()} volumes`} icon={Boxes} color="#3b82f6" delay={0.15} />
          <KPICard title="Pico" value={`${String(data.peakHour).padStart(2, '0')}h`} subtitle={`${data.peakCount} tarefas`} icon={Zap} color="#f97316" delay={0.2} />
          <KPICard title="Operadores" value={data.activeOperators} subtitle={`${data.dates.length} dias`} icon={Users} color="#a855f7" delay={0.25} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div {...fadeIn} transition={{ delay: 0.2 }} className="lg:col-span-2 card-premium p-6">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center"><TrendingUp className="w-4 h-4 text-blue-400" /></div>
              <div><h3 className="text-sm font-semibold text-white">Evolução Diária</h3><p className="text-[11px] text-slate-500">Desempenho e tarefas por hora</p></div>
            </div>
            {mounted && data.dailyEvolution.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={data.dailyEvolution}>
                  <defs>
                    <linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} /><stop offset="100%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient>
                    <linearGradient id="gradGreen" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} /><stop offset="100%" stopColor="#22c55e" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="date" stroke="#475569" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#475569" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: 'rgba(17,24,39,0.95)', border: '1px solid #374151', borderRadius: '12px', color: '#e2e8f0', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="performance" stroke="#3b82f6" strokeWidth={2.5} fill="url(#gradBlue)" name="Desempenho %" dot={{ fill: '#3b82f6', r: 3, strokeWidth: 0 }} />
                  <Area type="monotone" dataKey="tasksPerHour" stroke="#22c55e" strokeWidth={2.5} fill="url(#gradGreen)" name="Tarefas/Hora" dot={{ fill: '#22c55e', r: 3, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (<div className="h-[300px] flex items-center justify-center text-slate-600 text-sm"><Package className="w-8 h-8 mr-3 opacity-30" />Sem dados</div>)}
          </motion.div>

          <motion.div {...fadeIn} transition={{ delay: 0.3 }} className="card-premium p-6">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center"><Shield className="w-4 h-4 text-purple-400" /></div>
              <div><h3 className="text-sm font-semibold text-white">Distribuição</h3><p className="text-[11px] text-slate-500">Status operacional</p></div>
            </div>
            {mounted && statusDist.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart><Pie data={statusDist} cx="50%" cy="50%" outerRadius={80} innerRadius={45} dataKey="value" stroke="none">
                    {statusDist.map((entry, i) => <RechartsCell key={i} fill={entry.color} />)}
                  </Pie><Tooltip contentStyle={{ background: 'rgba(17,24,39,0.95)', border: '1px solid #374151', borderRadius: '12px', color: '#e2e8f0', fontSize: 12 }} /></PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2">
                  {statusDist.map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} /><span className="text-slate-400">{s.name}</span></div>
                      <span className="text-white font-semibold">{s.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (<div className="h-[260px] flex items-center justify-center text-slate-600 text-sm">Sem dados</div>)}
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div {...fadeIn} transition={{ delay: 0.35 }} className="lg:col-span-2 card-premium p-6">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center"><Layers className="w-4 h-4 text-orange-400" /></div>
              <div><h3 className="text-sm font-semibold text-white">Heatmap Operacional</h3><p className="text-[11px] text-slate-500">Atividade por horário</p></div>
            </div>
            {data.heatmap.length > 0 ? renderHeatmap(data.heatmap) : (<div className="h-[200px] flex items-center justify-center text-slate-600 text-sm">Sem dados</div>)}
          </motion.div>

          <motion.div {...fadeIn} transition={{ delay: 0.4 }} className="space-y-4">
            <div className="card-premium p-6 text-center">
              <h3 className="text-sm font-semibold text-white mb-3">Desempenho Médio</h3>
              {mounted && (<ResponsiveContainer width="100%" height={100}>
                <RadialBarChart cx="50%" cy="100%" innerRadius="70%" outerRadius="100%" startAngle={180} endAngle={0} barSize={12}
                  data={[{ name: 'desempenho', value: Math.min(data.avgPerformance, 200), fill: getPerformanceColor(data.avgPerformance) }]}>
                  <RadialBar dataKey="value" cornerRadius={6} />
                </RadialBarChart>
              </ResponsiveContainer>)}
              <p className="text-3xl font-bold -mt-4" style={{ color: getPerformanceColor(data.avgPerformance) }}>{data.avgPerformance}%</p>
            </div>
            <div className="card-premium p-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Resumo</h3>
              <div className="space-y-3">
                {[
                  { label: 'Melhor', value: `${data.summaries.length > 0 ? Math.max(...data.summaries.map(s => s.performance)) : 0}%`, color: 'text-emerald-400' },
                  { label: 'Menor', value: `${data.summaries.length > 0 ? Math.min(...data.summaries.map(s => s.performance)) : 0}%`, color: 'text-red-400' },
                  { label: 'Inconsistentes', value: data.summaries.filter(s => s.inconsistency.classification === 'INCONSISTENTE').length, color: 'text-orange-400' },
                  { label: 'Registros', value: data.summaries.length, color: 'text-blue-400' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">{item.label}</span>
                    <span className={`text-xs font-bold ${item.color}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  // ============================================================
  // IMPORT
  // ============================================================
  function renderImport() {
    return (
      <motion.div {...fadeIn} className="max-w-2xl mx-auto space-y-6">
        <div className="card-premium p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center"><Upload className="w-5 h-5 text-blue-400" /></div>
            <div>
              <h2 className="text-lg font-bold text-white">Importar Planilha</h2>
              <p className="text-xs text-slate-500">Colunas esperadas: USUARIO, DATAINI, HORA_INI, PRODUTO, QTD_VOLUMES_PDR_EXP</p>
            </div>
          </div>

          <motion.div onDragOver={e => { e.preventDefault(); setDragActive(true); }} onDragLeave={() => setDragActive(false)}
            onDrop={e => { e.preventDefault(); setDragActive(false); const f = e.dataTransfer.files[0]; if (f) handleImport(f); }}
            onClick={() => fileInputRef.current?.click()}
            whileHover={{ scale: 1.01 }}
            className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all ${dragActive ? 'border-blue-500 bg-blue-500/5' : importing ? 'border-blue-400 bg-blue-500/5' : 'border-slate-700/50 hover:border-blue-500/40 hover:bg-slate-800/30'}`}>
            <motion.div animate={importing ? { rotate: 360 } : {}} transition={importing ? { repeat: Infinity, duration: 1, ease: 'linear' } : {}}>
              <Upload className={`w-14 h-14 mx-auto mb-5 ${importing ? 'text-blue-400' : 'text-slate-600'}`} />
            </motion.div>
            <p className="text-sm font-semibold text-slate-300 mb-1">
              {importing ? 'Processando planilha...' : dragActive ? 'Solte o arquivo aqui' : 'Arraste ou clique para selecionar'}
            </p>
            <p className="text-xs text-slate-500">Excel .xlsx · .xls · .csv</p>
          </motion.div>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={e => { const f = e.target.files?.[0]; if (f) handleImport(f); }} className="hidden" />
        </div>

        {/* Data management */}
        <div className="card-premium p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center"><Trash2 className="w-4 h-4 text-red-400" /></div>
            <h3 className="text-sm font-semibold text-white">Gerenciar Dados</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => setDeleteModal({ scope: 'all', value: '', label: 'Todos os dados operacionais serão removidos permanentemente.' })}
              className="px-4 py-3 bg-red-500/8 border border-red-500/20 text-red-400 rounded-xl text-xs font-semibold hover:bg-red-500/15 transition-colors flex items-center justify-center gap-2">
              <Trash2 className="w-3.5 h-3.5" />Limpar Tudo
            </motion.button>

            {availableDates.length > 0 && (
              <select onChange={e => { if (e.target.value) setDeleteModal({ scope: 'date', value: e.target.value, label: `Dados do dia ${e.target.value} serão removidos permanentemente.` }); }}
                className="px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-xs text-slate-400" defaultValue="">
                <option value="">Limpar por dia...</option>
                {availableDates.slice().reverse().map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            )}

            {availableMonths.length > 0 && (
              <select onChange={e => { if (e.target.value) { const [s, end] = getMonthRange(e.target.value); setDeleteModal({ scope: 'range', value: '', label: `Dados do mês ${e.target.value} serão removidos permanentemente.`, startDate: convertToDDMMYYYY(s), endDate: convertToDDMMYYYY(end) }); } }}
                className="px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-xs text-slate-400" defaultValue="">
                <option value="">Limpar por mês...</option>
                {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            )}

            {operators.length > 0 && (
              <select onChange={e => { if (e.target.value) setDeleteModal({ scope: 'operator', value: '', label: `Dados do operador ${e.target.value} serão removidos permanentemente.`, operator: e.target.value }); }}
                className="px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-xs text-slate-400" defaultValue="">
                <option value="">Limpor por operador...</option>
                {operators.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  // ============================================================
  // RANKING
  // ============================================================
  function renderRanking() {
    if (!data) return <DashboardSkeleton />;
    const sorted = sortSummaries(data.summaries);
    const columns: { key: string; label: string }[] = [
      { key: '_rank', label: '#' }, { key: 'operatorName', label: 'Operador' }, { key: 'dateStr', label: 'Data' },
      { key: 'totalTasks', label: 'Tarefas' }, { key: 'totalVolumes', label: 'Volumes' },
      { key: 'productiveTimeMin', label: 'Produtivo' }, { key: 'idleTimeMin', label: 'Ocioso' },
      { key: 'avgTimePerTask', label: 'Tempo Médio' }, { key: 'tasksPerHour', label: 'Tarefas/H' },
      { key: 'performance', label: 'Desempenho' }, { key: 'status', label: 'Status' },
    ];

    return (
      <motion.div {...fadeIn} className="space-y-4">
        <div className="card-premium overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-premium">
              <thead>
                <tr>{columns.map(col => (
                  <th key={col.key} onClick={() => col.key !== '_rank' && toggleSort(col.key)}
                    className={`px-4 py-3.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap ${col.key !== '_rank' ? 'cursor-pointer hover:text-slate-200' : ''}`}>
                    <span className="flex items-center gap-1">
                      {col.label}
                      {col.key !== '_rank' && rankingSort.key === col.key && (rankingSort.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-blue-400" /> : <ChevronDown className="w-3 h-3 text-blue-400" />)}
                    </span>
                  </th>
                ))}</tr>
              </thead>
              <tbody>
                {sorted.map((s, i) => {
                  const sc = STATUS_CONFIG[s.status] || STATUS_CONFIG['CRÍTICO'];
                  return (
                    <motion.tr key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}
                      className={`${i < 3 ? 'bg-blue-500/[0.03]' : ''}`}>
                      <td className="px-4 py-3">{getMedalEmoji(i) ? <span className={`text-lg ${getMedalClass(i)}`}>{getMedalEmoji(i)}</span> : <span className="text-slate-600 text-xs font-mono">{i + 1}</span>}</td>
                      <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ background: getPerformanceColor(s.performance) }} /><span className="text-slate-200 font-medium truncate max-w-[180px]" title={s.operatorName}>{s.operatorName}</span></div></td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{s.dateStr}</td>
                      <td className="px-4 py-3 text-white font-bold">{s.totalTasks}</td>
                      <td className="px-4 py-3 text-slate-400">{s.totalVolumes.toLocaleString()}</td>
                      <td className="px-4 py-3 text-slate-300 text-xs font-mono">{formatMinutes(s.productiveTimeMin)}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs font-mono">{formatMinutes(s.idleTimeMin)}</td>
                      <td className="px-4 py-3 text-xs">{s.avgTimePerTask.toFixed(1)}m</td>
                      <td className="px-4 py-3 text-xs font-semibold">{s.tasksPerHour.toFixed(1)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full rounded-full progress-bar" style={{ width: `${Math.min(100, s.performance)}%`, background: getPerformanceColor(s.performance) }} />
                          </div>
                          <span className="text-xs font-bold" style={{ color: getPerformanceColor(s.performance) }}>{s.performance}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className={`inline-flex px-2.5 py-1 rounded-lg text-[11px] font-bold ${sc.bg} ${sc.color} ${sc.border} border`}>{s.status}</span></td>
                    </motion.tr>
                  );
                })}
                {sorted.length === 0 && <tr><td colSpan={columns.length} className="px-4 py-16 text-center text-slate-600">Nenhum dado encontrado</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    );
  }

  // ============================================================
  // ALERTS
  // ============================================================
  function renderAlerts() {
    if (!data) return <DashboardSkeleton />;
    const allIntervals: TaskInterval[] = [];
    for (const s of data.summaries) allIntervals.push(...s.intervals);
    const filtered = allIntervals.filter(i => {
      if (alertOperator !== 'all' && i.operatorName !== alertOperator) return false;
      if (alertClassification !== 'all' && i.classification !== alertClassification) return false;
      if (alertSearch && !i.product.toLowerCase().includes(alertSearch.toLowerCase())) return false;
      return true;
    });
    const classCounts = { excelente: allIntervals.filter(i => i.classification === 'excelente').length, bom: allIntervals.filter(i => i.classification === 'bom').length, aviso: allIntervals.filter(i => i.classification === 'aviso').length, ociosidade: allIntervals.filter(i => i.classification === 'ociosidade').length };

    return (
      <motion.div {...fadeIn} className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Object.entries(classCounts).map(([key, count]) => {
            const cfg = CLASSIFICATION_CONFIG[key]; const Icon = cfg.icon;
            return (
              <motion.div key={key} whileHover={{ y: -2 }} className={`card-premium p-4 cursor-pointer ${alertClassification === key ? 'ring-1 ring-blue-500/30' : ''}`}
                onClick={() => setAlertClassification(alertClassification === key ? 'all' : key)}>
                <div className="flex items-center justify-between">
                  <div><p className="text-[11px] text-slate-500 font-semibold uppercase">{key}</p><p className="text-xl font-bold text-white mt-1">{count}</p></div>
                  <div className={`w-9 h-9 rounded-lg ${cfg.bg} flex items-center justify-center`}><Icon className={`w-4 h-4 ${cfg.color}`} /></div>
                </div>
              </motion.div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2.5 items-center">
          <select value={alertOperator} onChange={e => setAlertOperator(e.target.value)} className="chip text-xs">
            <option value="all">Todos Operadores</option>
            {data.operators.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input type="text" placeholder="Buscar produto..." value={alertSearch} onChange={e => setAlertSearch(e.target.value)} className="chip !pl-8 text-xs w-44" />
          </div>
          <span className="text-[11px] text-slate-500 ml-auto">{filtered.length} registros</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.slice(0, 100).map((interval, i) => {
            const cfg = CLASSIFICATION_CONFIG[interval.classification]; const Icon = cfg.icon;
            return (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.01, 0.5) }} className="card-premium p-4">
                <div className="flex items-start justify-between mb-3">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold ${cfg.bg} ${cfg.color}`}><Icon className="w-3 h-3" />{interval.classification.toUpperCase()}</span>
                  <span className="text-[10px] text-slate-500 font-mono">{interval.dateStr}</span>
                </div>
                <p className="text-xs text-slate-300 font-medium mb-1 truncate" title={interval.operatorName}>{interval.operatorName}</p>
                <div className="flex items-center gap-3 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1"><Clock4 className="w-3 h-3" />{interval.startTime} → {interval.endTime}</span>
                  <span className="font-bold text-white">{interval.durationMin}m</span>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/50">
                  <span className="text-[10px] text-slate-500 truncate max-w-[150px]">{interval.product || '—'}</span>
                  <span className="text-[10px] text-slate-500">{interval.volumes} vol</span>
                </div>
              </motion.div>
            );
          })}
        </div>
        {filtered.length === 0 && <div className="card-premium p-16 text-center text-slate-600 text-sm">Nenhum alerta encontrado</div>}
        {filtered.length > 100 && <p className="text-center text-xs text-slate-500">Mostrando 100 de {filtered.length}</p>}
      </motion.div>
    );
  }

  // ============================================================
  // EVOLUTION
  // ============================================================
  function renderEvolution() {
    if (!data) return <DashboardSkeleton />;
    const allDates = [...new Set(data.summaries.map(s => s.dateStr))].sort((a, b) => {
      const [da, ma, ya] = a.split('/').map(Number); const [db2, mb, yb] = b.split('/').map(Number);
      return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db2).getTime();
    });
    const operatorData = allDates.map(date => {
      const entry: Record<string, unknown> = { date };
      for (const s of data.summaries.filter(s => s.dateStr === date)) entry[s.operatorName] = s.performance;
      return entry;
    });

    return (
      <motion.div {...fadeIn} className="space-y-6">
        <div className="card-premium p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center"><TrendingUp className="w-4 h-4 text-blue-400" /></div>
            <div><h3 className="text-sm font-semibold text-white">Evolução por Operador</h3><p className="text-[11px] text-slate-500">Desempenho ao longo do tempo</p></div>
          </div>
          {mounted && operatorData.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={operatorData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" stroke="#475569" tick={{ fontSize: 11 }} />
                <YAxis stroke="#475569" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: 'rgba(17,24,39,0.95)', border: '1px solid #374151', borderRadius: '12px', color: '#e2e8f0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {data.operators.map((op, i) => (
                  <Line key={op} type="monotone" dataKey={op} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2.5}
                    dot={{ fill: CHART_COLORS[i % CHART_COLORS.length], r: 3, strokeWidth: 0 }}
                    name={op.length > 15 ? op.substring(0, 15) + '…' : op} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (<div className="h-[350px] flex items-center justify-center text-slate-600 text-sm">Sem dados</div>)}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card-premium p-6">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center"><BarChart2 className="w-4 h-4 text-emerald-400" /></div>
              <div><h3 className="text-sm font-semibold text-white">Tarefas por Hora</h3></div>
            </div>
            {mounted && data.dailyEvolution.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.dailyEvolution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="date" stroke="#475569" tick={{ fontSize: 11 }} /><YAxis stroke="#475569" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: 'rgba(17,24,39,0.95)', border: '1px solid #374151', borderRadius: '12px', color: '#e2e8f0', fontSize: 12 }} />
                  <Bar dataKey="tasksPerHour" fill="#22c55e" radius={[6, 6, 0, 0]} name="Tarefas/Hora" />
                </BarChart>
              </ResponsiveContainer>
            ) : (<div className="h-[250px] flex items-center justify-center text-slate-600 text-sm">Sem dados</div>)}
          </div>

          <div className="card-premium p-6">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center"><Timer className="w-4 h-4 text-yellow-400" /></div>
              <div><h3 className="text-sm font-semibold text-white">Tempo Médio por Tarefa</h3></div>
            </div>
            {mounted && data.dailyEvolution.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.dailyEvolution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="date" stroke="#475569" tick={{ fontSize: 11 }} /><YAxis stroke="#475569" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: 'rgba(17,24,39,0.95)', border: '1px solid #374151', borderRadius: '12px', color: '#e2e8f0', fontSize: 12 }} />
                  <Bar dataKey="avgTime" fill="#facc15" radius={[6, 6, 0, 0]} name="Tempo Médio (min)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (<div className="h-[250px] flex items-center justify-center text-slate-600 text-sm">Sem dados</div>)}
          </div>
        </div>
      </motion.div>
    );
  }

  // ============================================================
  // INSIGHTS
  // ============================================================
  function renderInsights() {
    if (!data) return <DashboardSkeleton />;
    const themes: Record<string, { gradient: string; icon: typeof Lightbulb; iconColor: string; from: string; to: string }> = {
      success: { gradient: 'from-emerald-500/20 to-emerald-500/5', icon: Sparkles, iconColor: 'text-emerald-400', from: '#22c55e', to: '#059669' },
      warning: { gradient: 'from-yellow-500/20 to-yellow-500/5', icon: AlertTriangle, iconColor: 'text-yellow-400', from: '#facc15', to: '#ca8a04' },
      danger: { gradient: 'from-red-500/20 to-red-500/5', icon: AlertOctagon, iconColor: 'text-red-400', from: '#ef4444', to: '#dc2626' },
      info: { gradient: 'from-blue-500/20 to-blue-500/5', icon: Info, iconColor: 'text-blue-400', from: '#3b82f6', to: '#2563eb' },
    };

    return (
      <motion.div {...fadeIn} className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div><h2 className="text-lg font-bold text-white">Insights Automáticos</h2><p className="text-xs text-slate-500">{data.insights.length} análises geradas</p></div>
        </div>
        {data.insights.length === 0 ? (
          <div className="card-premium p-16 text-center"><Lightbulb className="w-14 h-14 mx-auto mb-4 text-slate-700" /><p className="text-slate-500">Importe dados para gerar insights</p></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.insights.map((insight, i) => {
              const theme = themes[insight.type] || themes.info; const Icon = theme.icon;
              return (
                <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                  className="insight-card" style={{ '--insight-from': theme.from, '--insight-to': theme.to } as React.CSSProperties}>
                  <div className="insight-card-inner">
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${theme.gradient} flex items-center justify-center flex-shrink-0`}><Icon className={`w-4 h-4 ${theme.iconColor}`} /></div>
                      <div><h4 className="text-sm font-bold text-white mb-1">{insight.title}</h4><p className="text-xs text-slate-400 leading-relaxed">{insight.description}</p></div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    );
  }

  // ============================================================
  // EXPORT
  // ============================================================
  function renderExport() {
    return (
      <motion.div {...fadeIn} className="max-w-lg mx-auto">
        <div className="card-premium p-10 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5" />
          <div className="relative">
            <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/20">
              <Download className="w-7 h-7 text-white" />
            </motion.div>
            <h2 className="text-xl font-bold text-white mb-2">Exportar Relatório</h2>
            <p className="text-sm text-slate-400 mb-8 max-w-xs mx-auto">Planilha completa com análises em 4 abas</p>
            {data && data.summaries.length > 0 ? (
              <>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleExport}
                  className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2">
                  <Download className="w-5 h-5" />Baixar Planilha Completa
                </motion.button>
                <div className="grid grid-cols-2 gap-3 mt-6">
                  {[{ icon: BarChart3, label: 'Dashboard' }, { icon: Trophy, label: 'Ranking' }, { icon: AlertTriangle, label: 'Alertas' }, { icon: TrendingUp, label: 'Evolução' }].map((item, i) => {
                    const Icon = item.icon;
                    return (
                      <div key={i} className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-3 flex items-center gap-2.5">
                        <Icon className="w-4 h-4 text-slate-500 flex-shrink-0" />
                        <p className="text-xs font-semibold text-slate-300">{item.label}</p>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (<p className="text-sm text-slate-500">Importe dados primeiro.</p>)}
          </div>
        </div>
      </motion.div>
    );
  }

  // ============================================================
  // EMPTY
  // ============================================================
  function renderEmpty() {
    return (
      <motion.div {...fadeIn} className="flex flex-col items-center justify-center py-24 text-center">
        <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
          className="w-20 h-20 rounded-2xl bg-slate-800 flex items-center justify-center mb-6"><Package className="w-10 h-10 text-slate-600" /></motion.div>
        <h3 className="text-lg font-bold text-slate-400 mb-2">Nenhum dado carregado</h3>
        <p className="text-sm text-slate-500 max-w-md mb-6">Importe uma planilha Excel para começar a análise.</p>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={() => setActiveTab('import')}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-blue-500/20 flex items-center gap-2">
          <Upload className="w-4 h-4" />Importar Planilha
        </motion.button>
      </motion.div>
    );
  }

  // ============================================================
  // MAIN LAYOUT
  // ============================================================
  return (
    <div className="min-h-screen">
      <Toaster position="top-right" toastOptions={{
        style: { background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '12px', fontSize: '13px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' },
        success: { iconTheme: { primary: '#22c55e', secondary: '#0f172a' } },
        error: { iconTheme: { primary: '#ef4444', secondary: '#0f172a' } },
      }} />

      {renderSidebar()}
      {renderDeleteModal()}

      <main className="lg:ml-[260px] pt-[56px] lg:pt-0 min-h-screen">
        {/* Header */}
        <div className="px-4 lg:px-8 py-4 lg:py-5 border-b border-slate-800/50 bg-dark-900/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                {(() => { const T = TAB_CONFIG.find(t => t.id === activeTab)?.icon || BarChart3; return <T className="w-4 h-4 text-blue-400" />; })()}
              </div>
              <div>
                <h2 className="text-base lg:text-lg font-bold text-white">{TAB_CONFIG.find(t => t.id === activeTab)?.label}</h2>
                {data && <p className="text-[11px] text-slate-500 mt-0.5">{data.summaries.length} registros · {data.activeOperators} operadores · {data.dates.length} dias</p>}
              </div>
            </div>
            <motion.button whileTap={{ scale: 0.95 }} onClick={fetchData} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 rounded-xl text-xs text-slate-400 transition-colors disabled:opacity-40">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />Atualizar
            </motion.button>
          </div>
        </div>

        {/* Global Filters */}
        <div className="px-4 lg:px-8 pt-4">
          {renderGlobalFilters()}
        </div>

        {/* Content */}
        <div className="p-4 lg:px-8 lg:pb-8">
          <AnimatePresence mode="wait">
            {loading && !data ? (
              <motion.div key="loading" {...fadeIn}><DashboardSkeleton /></motion.div>
            ) : (
              <motion.div key={activeTab} {...fadeIn} transition={{ duration: 0.2 }}>
                {activeTab === 'dashboard' && renderDashboard()}
                {activeTab === 'import' && renderImport()}
                {activeTab === 'ranking' && renderRanking()}
                {activeTab === 'alerts' && renderAlerts()}
                {activeTab === 'evolution' && renderEvolution()}
                {activeTab === 'insights' && renderInsights()}
                {activeTab === 'export' && renderExport()}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <footer className="px-4 lg:px-8 py-5 border-t border-slate-800/30 text-center">
          <p className="text-[10px] text-slate-700 tracking-wide">Desenvolvido por Guilherme Lopes</p>
        </footer>
      </main>
    </div>
  );
}
