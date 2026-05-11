import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import {
  TrendingUp, Clock, Target, Users, Zap,
  Activity, Calendar, Filter, Download,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  formatMinutes, getPerformanceColor,
  exportToExcel,
} from '../utils/calculations';

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] },
  }),
};

export default function Dashboard() {
  const {
    filters, setFilters, operators, filteredMetrics,
    filteredTasks, dashboardData, loading,
  } = useApp();

  const dateInputValue = filters.selectedDate
    ? filters.selectedDate.split('/').reverse().join('-')
    : '';

  const kpis = [
    {
      label: 'Desempenho Médio',
      value: `${dashboardData.desempenhoMedio}%`,
      icon: TrendingUp,
      color: getPerformanceColor(dashboardData.desempenhoMedio),
      bg: 'from-blue-500/10 to-blue-600/5',
    },
    {
      label: 'Tarefas/Hora',
      value: dashboardData.tarefasHoraMedia.toFixed(1),
      icon: Zap,
      color: '#60a5fa',
      bg: 'from-cyan-500/10 to-cyan-600/5',
    },
    {
      label: 'Tempo Médio',
      value: formatMinutes(dashboardData.tempoMedioGeral),
      icon: Clock,
      color: '#22d3ee',
      bg: 'from-teal-500/10 to-teal-600/5',
    },
    {
      label: 'Total Tarefas',
      value: dashboardData.totalTarefas.toLocaleString('pt-BR'),
      icon: Target,
      color: '#a78bfa',
      bg: 'from-purple-500/10 to-purple-600/5',
    },
    {
      label: 'Operadores Ativos',
      value: dashboardData.operadoresAtivos.toString(),
      icon: Users,
      color: '#f472b6',
      bg: 'from-pink-500/10 to-pink-600/5',
    },
  ];

  // Heatmap: group by operator
  const heatmapOperators = useMemo(() => {
    const ops = [...new Set(filteredTasks.map(t => t.usuario))].sort();
    return ops;
  }, [filteredTasks]);

  const heatmapHours = useMemo(() => {
    if (filteredTasks.length === 0) return [];
    const hours = [...new Set(filteredTasks.map(t => parseInt(t.horaInicio.split(':')[0])))].sort((a, b) => a - b);
    return hours;
  }, [filteredTasks]);

  const heatmapCells = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of filteredTasks) {
      const h = parseInt(t.horaInicio.split(':')[0]);
      const key = `${t.usuario}-${h}`;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [filteredTasks]);

  const maxHeat = useMemo(() => {
    let m = 0;
    for (const v of heatmapCells.values()) { if (v > m) m = v; }
    return m || 1;
  }, [heatmapCells]);

  const getHeatColor = (count: number) => {
    if (count === 0) return '#1e293b';
    const ratio = count / maxHeat;
    if (ratio > 0.7) return '#22c55e';
    if (ratio > 0.4) return '#eab308';
    return '#ef4444';
  };

  const tooltipStyle = {
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '8px',
    color: '#f1f5f9',
    fontSize: '12px',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-400 text-sm">Carregando dados...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-12 lg:pt-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Visão geral da produtividade operacional</p>
        </div>
        <button
          onClick={() => exportToExcel(dashboardData, filteredMetrics, filteredTasks)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-colors text-sm font-medium border border-blue-500/20"
        >
          <Download size={16} />
          Exportar Excel
        </button>
      </div>

      {/* Filters */}
      <div className="bg-[#111827] rounded-xl border border-gray-800/60 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-slate-500" />
          <span className="text-sm font-medium text-slate-400">Filtros</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select
            value={filters.period}
            onChange={e => setFilters({ period: e.target.value as any })}
            className="bg-[#0f172a] border border-gray-800/60 rounded-lg px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50"
          >
            <option value="all">Todos os períodos</option>
            <option value="day">Dia</option>
            <option value="week">Semana</option>
            <option value="month">Mês</option>
          </select>
          <input
            type="date"
            value={dateInputValue}
            onChange={e => {
              const v = e.target.value;
              if (v) {
                const [y, m, d] = v.split('-');
                setFilters({ selectedDate: `${d}/${m}/${y}` });
              } else {
                setFilters({ selectedDate: '' });
              }
            }}
            disabled={filters.period === 'all'}
            className="bg-[#0f172a] border border-gray-800/60 rounded-lg px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50 disabled:opacity-40"
          />
          <select
            value={filters.operator}
            onChange={e => setFilters({ operator: e.target.value })}
            className="bg-[#0f172a] border border-gray-800/60 rounded-lg px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50"
          >
            <option value="">Todos os operadores</option>
            {operators.map(op => (
              <option key={op} value={op}>{op}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {kpis.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            custom={i}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className={`bg-gradient-to-br ${kpi.bg} rounded-xl border border-gray-800/60 p-4 relative overflow-hidden`}
          >
            <div className="flex items-center justify-between mb-2">
              <kpi.icon size={18} style={{ color: kpi.color }} />
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: kpi.color }} />
            </div>
            <p className="text-2xl font-bold text-slate-100">{kpi.value}</p>
            <p className="text-xs text-slate-500 mt-1">{kpi.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      {filteredMetrics.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Performance by Operator */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-[#111827] rounded-xl border border-gray-800/60 p-4"
          >
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <Activity size={16} className="text-blue-400" />
              Desempenho por Operador
            </h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={filteredMetrics.slice(0, 15).map(m => ({
                name: m.usuario.length > 12 ? m.usuario.substring(0, 12) + '...' : m.usuario,
                desempenho: m.desempenho,
                fill: getPerformanceColor(m.desempenho),
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="desempenho" name="Desempenho (%)" radius={[4, 4, 0, 0]}>
                  {filteredMetrics.slice(0, 15).map((m, idx) => (
                    <rect key={idx} fill={getPerformanceColor(m.desempenho)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Daily Evolution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-[#111827] rounded-xl border border-gray-800/60 p-4"
          >
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <Calendar size={16} className="text-cyan-400" />
              Evolução Diária
            </h3>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={dashboardData.evolucaoDiaria}>
                <defs>
                  <linearGradient id="colorDesemp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="data" stroke="#64748b" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="desempenho" name="Desempenho (%)" stroke="#3b82f6" fill="url(#colorDesemp)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        </div>
      )}

      {/* Tasks per Hour Chart */}
      {filteredTasks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-[#111827] rounded-xl border border-gray-800/60 p-4"
        >
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <Zap size={16} className="text-amber-400" />
            Distribuição por Hora
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={Array.from({ length: 24 }, (_, h) => {
              const count = filteredTasks.filter(t => parseInt(t.horaInicio.split(':')[0]) === h).length;
              return { hora: `${h}h`, tarefas: count };
            })}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="hora" stroke="#64748b" tick={{ fontSize: 10 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="tarefas" name="Tarefas" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* Heatmap */}
      {heatmapOperators.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-[#111827] rounded-xl border border-gray-800/60 p-4"
        >
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <Activity size={16} className="text-emerald-400" />
            Heatmap Operacional
          </h3>
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Header */}
              <div className="flex items-center mb-1">
                <div className="w-32 shrink-0" />
                {heatmapHours.map(h => (
                  <div key={h} className="flex-1 text-center text-[10px] text-slate-500 px-0.5">
                    {h}h
                  </div>
                ))}
              </div>
              {/* Rows */}
              {heatmapOperators.map(op => (
                <div key={op} className="flex items-center mb-1">
                  <div className="w-32 shrink-0 text-xs text-slate-400 truncate pr-2" title={op}>
                    {op}
                  </div>
                  {heatmapHours.map(h => {
                    const count = heatmapCells.get(`${op}-${h}`) || 0;
                    return (
                      <div
                        key={h}
                        className="flex-1 h-7 mx-0.5 rounded-sm flex items-center justify-center text-[10px] font-medium transition-colors"
                        style={{
                          backgroundColor: getHeatColor(count),
                          color: count > 0 ? '#fff' : '#475569',
                        }}
                        title={`${op} - ${h}h: ${count} tarefas`}
                      >
                        {count > 0 ? count : ''}
                      </div>
                    );
                  })}
                </div>
              ))}
              {/* Legend */}
              <div className="flex items-center gap-4 mt-3 justify-center">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#22c55e' }} />
                  <span className="text-[10px] text-slate-500">Alta</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#eab308' }} />
                  <span className="text-[10px] text-slate-500">Média</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#ef4444' }} />
                  <span className="text-[10px] text-slate-500">Baixa</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#1e293b' }} />
                  <span className="text-[10px] text-slate-500">Sem dados</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Empty State */}
      {filteredMetrics.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-800/50 flex items-center justify-center mb-4">
            <Target size={32} className="text-slate-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-400">Nenhum dado encontrado</h3>
          <p className="text-sm text-slate-600 mt-1">Importe uma planilha Excel para começar a análise</p>
        </div>
      )}
    </div>
  );
}
