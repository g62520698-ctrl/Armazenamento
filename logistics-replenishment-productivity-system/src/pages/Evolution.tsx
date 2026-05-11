import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, AreaChart, Area,
} from 'recharts';
import { TrendingUp, Users, BarChart3 } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function Evolution() {
  const { filteredMetrics, filteredTasks, operators, loading } = useApp();
  const [selectedOperator, setSelectedOperator] = useState('');

  const tooltipStyle = {
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '8px',
    color: '#f1f5f9',
    fontSize: '12px',
  };

  // Operator evolution data
  const operatorEvolution = useMemo(() => {
    const ops = selectedOperator ? [selectedOperator] : [...new Set(filteredMetrics.map(m => m.usuario))];
    const data = new Map<string, { data: string; [key: string]: string | number }>();

    for (const m of filteredMetrics) {
      if (!ops.includes(m.usuario)) continue;
      if (!data.has(m.dataIni)) {
        data.set(m.dataIni, { data: m.dataIni });
      }
      const entry = data.get(m.dataIni)!;
      entry[m.usuario] = m.desempenho;
    }

    return Array.from(data.values()).sort((a, b) => {
      const [dA, mA, yA] = (a.data as string).split('/');
      const [dB, mB, yB] = (b.data as string).split('/');
      return new Date(`${yA}-${mA}-${dA}`).getTime() - new Date(`${yB}-${mB}-${dB}`).getTime();
    });
  }, [filteredMetrics, selectedOperator]);

  // Hourly distribution evolution
  const hourlyData = useMemo(() => {
    return Array.from({ length: 24 }, (_, h) => {
      const tasks = filteredTasks.filter(t => parseInt(t.horaInicio.split(':')[0]) === h);
      const avgDuration = tasks.length > 0 ? tasks.reduce((s, t) => s + t.duracao, 0) / tasks.length : 0;
      return {
        hora: `${h}h`,
        tarefas: tasks.length,
        tempoMedio: Math.round(avgDuration * 10) / 10,
      };
    }).filter(d => d.tarefas > 0);
  }, [filteredTasks]);

  // Trend data (moving average)
  const trendData = useMemo(() => {
    const byDate = new Map<string, { desempenho: number[]; tarefas: number }>();
    for (const m of filteredMetrics) {
      if (!byDate.has(m.dataIni)) byDate.set(m.dataIni, { desempenho: [], tarefas: 0 });
      const e = byDate.get(m.dataIni)!;
      e.desempenho.push(m.desempenho);
      e.tarefas += m.totalTarefas;
    }
    return Array.from(byDate.entries())
      .map(([data, e]) => ({
        data,
        desempenho: Math.round((e.desempenho.reduce((s, d) => s + d, 0) / e.desempenho.length) * 10) / 10,
        tarefas: e.tarefas,
        meta: 100,
      }))
      .sort((a, b) => {
        const [dA, mA, yA] = a.data.split('/');
        const [dB, mB, yB] = b.data.split('/');
        return new Date(`${yA}-${mA}-${dA}`).getTime() - new Date(`${yB}-${mB}-${dB}`).getTime();
      });
  }, [filteredMetrics]);

  // Colors for operators
  const opColors = useMemo(() => {
    const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#ec4899', '#14b8a6', '#f97316'];
    const ops = [...new Set(filteredMetrics.map(m => m.usuario))];
    const map: Record<string, string> = {};
    ops.forEach((op, i) => { map[op] = colors[i % colors.length]; });
    return map;
  }, [filteredMetrics]);

  const opsForChart = useMemo(() => {
    return selectedOperator
      ? [selectedOperator]
      : [...new Set(filteredMetrics.map(m => m.usuario))].slice(0, 6);
  }, [filteredMetrics, selectedOperator]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-12 lg:pt-0">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Evolução</h1>
        <p className="text-sm text-slate-500 mt-1">Análise de tendências e evolução operacional</p>
      </div>

      {filteredMetrics.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <TrendingUp size={32} className="text-slate-600 mb-3" />
          <p className="text-slate-400">Nenhum dado para exibir</p>
        </div>
      ) : (
        <>
          {/* Performance Trend */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#111827] rounded-xl border border-gray-800/60 p-4"
          >
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-400" />
              Desempenho Diário vs Meta
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="data" stroke="#64748b" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="desempenho" name="Desempenho (%)" stroke="#3b82f6" fill="url(#perfGrad)" strokeWidth={2} />
                <Line type="monotone" dataKey="meta" name="Meta (100%)" stroke="#ef4444" strokeDasharray="5 5" strokeWidth={1} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Tasks per day */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-[#111827] rounded-xl border border-gray-800/60 p-4"
            >
              <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <BarChart3 size={16} className="text-cyan-400" />
                Tarefas por Dia
              </h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="data" stroke="#64748b" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="tarefas" name="Tarefas" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Hourly Distribution */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-[#111827] rounded-xl border border-gray-800/60 p-4"
            >
              <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <TrendingUp size={16} className="text-amber-400" />
                Tempo Médio por Hora
              </h3>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="hora" stroke="#64748b" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit=" min" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="tempoMedio" name="Tempo Médio (min)" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </motion.div>
          </div>

          {/* Operator Evolution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-[#111827] rounded-xl border border-gray-800/60 p-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Users size={16} className="text-purple-400" />
                Evolução por Operador
              </h3>
              <select
                value={selectedOperator}
                onChange={e => setSelectedOperator(e.target.value)}
                className="bg-[#0f172a] border border-gray-800/60 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500/50"
              >
                <option value="">Todos os operadores</option>
                {operators.map(op => (
                  <option key={op} value={op}>{op}</option>
                ))}
              </select>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={operatorEvolution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="data" stroke="#64748b" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit="%" />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {opsForChart.map(op => (
                  <Line
                    key={op}
                    type="monotone"
                    dataKey={op}
                    name={op.length > 15 ? op.substring(0, 15) + '...' : op}
                    stroke={opColors[op]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        </>
      )}
    </div>
  );
}
