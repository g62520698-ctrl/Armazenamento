import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { UserMetrics, TaskRecord } from '../types';
import { formatMin, getDesempenhoColor, getDesempenhoBar, aggregateMetrics, aggregateByUser, getPeakHour, getStatusLabel } from '../utils';
import { Activity, Zap, Timer, Target, TrendingUp, Package, Flame, BarChart3 } from 'lucide-react';

interface Props { metrics: UserMetrics[]; records: TaskRecord[] }

export default function Dashboard({ metrics, records }: Props) {
  const summary = useMemo(() => metrics.length > 0 ? aggregateMetrics(metrics) : null, [metrics]);
  const byUser = useMemo(() => aggregateByUser(metrics), [metrics]);
  const peak = useMemo(() => getPeakHour(records), [records]);
  const cnt = metrics.length || 1;

  const chart = useMemo(() => byUser.map(m => ({
    name: m.usuario.length > 14 ? m.usuario.substring(0, 14) + '…' : m.usuario,
    tempoMedio: Math.round(m.tempoMedio / 60 * 10) / 10, desempenho: m.desempenho,
    tarefasHora: m.tarefasHora, totalTarefas: m.totalTarefas,
  })), [byUser]);

  const heatmap = useMemo(() => {
    const ops = [...new Set(records.map(r => r.usuario))].sort();
    const hours = Array.from({ length: 14 }, (_, i) => i + 5);
    const grid = new Map<string, number>();
    for (const r of records) { const h = new Date(r.datetime).getHours(); if (h >= 5 && h <= 18) grid.set(`${r.usuario}-${h}`, (grid.get(`${r.usuario}-${h}`) || 0) + 1); }
    return { ops, hours, grid, max: Math.max(...grid.values(), 1) };
  }, [records]);

  if (!summary) return (
    <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
      <div className="w-24 h-24 rounded-full bg-blue-500/10 flex items-center justify-center mb-6"><Activity className="w-12 h-12 text-blue-400" /></div>
      <h2 className="text-2xl font-bold text-white mb-2">Dashboard</h2>
      <p className="text-gray-400 text-center max-w-md">Importe uma planilha para começar.</p>
    </div>
  );

  const avgTarefas = summary.totalTarefas / cnt;
  const avgTHora = summary.tarefasHora;
  const avgTMedio = summary.tempoMedio;

  const kpis = [
    { label: 'Desempenho', value: `${summary.desempenho.toFixed(1)}%`, sub: getStatusLabel(summary.status), icon: Target, color: 'from-cyan-500/20 to-cyan-600/10', ic: getDesempenhoColor(summary.desempenho) },
    { label: 'Tarefas/H', value: avgTHora.toFixed(1), sub: 'Meta: 12/h', icon: Zap, color: 'from-purple-500/20 to-purple-600/10', ic: 'text-purple-400' },
    { label: 'Tempo Médio', value: formatMin(avgTMedio), sub: 'Meta: 5 min', icon: Timer, color: 'from-amber-500/20 to-amber-600/10', ic: 'text-amber-400' },
    { label: 'Total Tarefas', value: summary.totalTarefas.toLocaleString(), sub: `Média ${avgTarefas.toFixed(0)}/op`, icon: Package, color: 'from-blue-500/20 to-blue-600/10', ic: 'text-blue-400' },
    { label: 'Pico', value: peak?.label ?? '—', sub: peak ? `${peak.count} tarefas` : '', icon: Flame, color: 'from-orange-500/20 to-orange-600/10', ic: 'text-orange-400' },
    { label: 'Operadores', value: cnt.toString(), sub: 'ativos', icon: BarChart3, color: 'from-emerald-500/20 to-emerald-600/10', ic: 'text-emerald-400' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Target className="w-6 h-6 text-blue-400" />Dashboard Operacional</h2>
        <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">{cnt} operador(es)</span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((c, i) => (
          <div key={i} className={`bg-gradient-to-br ${c.color} border border-gray-700/50 rounded-xl p-4 card-hover animate-slide-in`} style={{ animationDelay: `${i * 50}ms` }}>
            <div className="flex items-center gap-2 mb-2"><c.icon className={`w-4 h-4 ${c.ic}`} /><span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">{c.label}</span></div>
            <p className="text-xl font-bold text-white leading-tight">{c.value}</p>
            {c.sub && <p className="text-[10px] text-gray-500 mt-1">{c.sub}</p>}
          </div>
        ))}
      </div>

      {/* Performance Bar */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400">Desempenho Médio = (Tarefas/Hora + Tempo Médio) / 2</span>
          <span className={`text-sm font-bold ${getDesempenhoColor(summary.desempenho)}`}>{summary.desempenho.toFixed(1)}%</span>
        </div>
        <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${Math.min(summary.desempenho, 200) / 2}%`, backgroundColor: getDesempenhoBar(summary.desempenho) }} /></div>
        <div className="flex justify-between mt-1 text-[9px] text-gray-600"><span>0%</span><span>Meta 100%</span><span>200%</span></div>
      </div>

      {/* Charts */}
      {chart.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-4"><TrendingUp className="w-4 h-4 text-blue-400 inline mr-1" />Desempenho (%)</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chart} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" /><XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} /><YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} formatter={(v: any) => [`${v}%`]} />
                <Bar dataKey="desempenho" radius={[4, 4, 0, 0]}>{chart.map((e, i) => <Cell key={i} fill={getDesempenhoBar(e.desempenho)} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-4"><Zap className="w-4 h-4 text-purple-400 inline mr-1" />Tarefas / Hora</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chart} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" /><XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} /><YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} formatter={(v: any) => [`${Number(v).toFixed(1)} t/h`]} />
                <Bar dataKey="tarefasHora" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-4"><Timer className="w-4 h-4 text-amber-400 inline mr-1" />Tempo Médio (min)</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chart} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" /><XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} /><YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} formatter={(v: any) => [`${v} min`]} />
                <Bar dataKey="tempoMedio" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Heatmap */}
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-4"><Flame className="w-4 h-4 text-orange-400 inline mr-1" />Heatmap por Operador</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr><th className="p-1 text-gray-400 text-left font-medium min-w-[90px]">Operador</th>{heatmap.hours.map(h => <th key={h} className="p-1 text-gray-500 text-center font-normal w-8">{String(h).padStart(2, '0')}</th>)}</tr></thead>
                <tbody>{heatmap.ops.map(op => (
                  <tr key={op} className="border-t border-gray-700/20">
                    <td className="p-1 text-gray-300 font-medium truncate max-w-[110px]" title={op}>{op}</td>
                    {heatmap.hours.map(hr => { const c = heatmap.grid.get(`${op}-${hr}`) || 0; const i = c / heatmap.max; const bg = c === 0 ? 'rgba(55,65,81,0.3)' : i >= 0.6 ? `rgba(16,185,129,${0.3 + i * 0.5})` : i >= 0.3 ? `rgba(245,158,11,${0.3 + i * 0.4})` : `rgba(239,68,68,${0.3 + i * 0.3})`; return (<td key={hr} className="p-0.5 text-center"><div className="w-full h-5 rounded flex items-center justify-center text-[9px] font-medium" style={{ background: bg, color: c > 0 ? '#fff' : '#4b5563' }}>{c || ''}</div></td>); })}
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="flex items-center gap-2 mt-2 justify-end text-[9px] text-gray-500">
              <span>Baixo</span><div className="w-3 h-2 rounded-sm" style={{ background: 'rgba(239,68,68,0.4)' }} /><div className="w-3 h-2 rounded-sm" style={{ background: 'rgba(245,158,11,0.5)' }} /><div className="w-3 h-2 rounded-sm" style={{ background: 'rgba(16,185,129,0.6)' }} /><span>Alto</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
