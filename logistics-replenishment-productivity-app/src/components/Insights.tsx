import { useMemo } from 'react';
import type { UserMetrics } from '../types';
import { generateInsights, getDesempenhoColor } from '../utils';
import { Brain, Lightbulb, TrendingDown, TrendingUp, AlertCircle, BarChart3, Package, Zap, Award } from 'lucide-react';

interface Props { metrics: UserMetrics[] }
function icon(t: string) {
  if (t.startsWith('✅') || t.startsWith('🟢') || t.startsWith('📈')) return <TrendingUp className="w-5 h-5 text-emerald-400 shrink-0" />;
  if (t.startsWith('🔴') || t.startsWith('📉')) return <TrendingDown className="w-5 h-5 text-red-400 shrink-0" />;
  if (t.startsWith('⚠️') || t.startsWith('💤') || t.startsWith('🟠')) return <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />;
  if (t.startsWith('🔥') || t.startsWith('⭐')) return <Zap className="w-5 h-5 text-orange-400 shrink-0" />;
  if (t.startsWith('📦')) return <Package className="w-5 h-5 text-blue-400 shrink-0" />;
  if (t.startsWith('📊')) return <BarChart3 className="w-5 h-5 text-purple-400 shrink-0" />;
  return <Lightbulb className="w-5 h-5 text-gray-400 shrink-0" />;
}
function bg(t: string) {
  if (t.startsWith('✅') || t.startsWith('🟢') || t.startsWith('📈')) return 'border-emerald-500/20 bg-emerald-500/5';
  if (t.startsWith('🔴') || t.startsWith('📉')) return 'border-red-500/20 bg-red-500/5';
  if (t.startsWith('⚠️') || t.startsWith('💤') || t.startsWith('🟠')) return 'border-amber-500/20 bg-amber-500/5';
  if (t.startsWith('🔥') || t.startsWith('⭐')) return 'border-orange-500/20 bg-orange-500/5';
  if (t.startsWith('📦')) return 'border-blue-500/20 bg-blue-500/5';
  return 'border-gray-700/50 bg-gray-800/30';
}

export default function Insights({ metrics }: Props) {
  const insights = useMemo(() => generateInsights(metrics), [metrics]);
  const top3 = useMemo(() => [...metrics].sort((a, b) => b.desempenho - a.desempenho).slice(0, 3), [metrics]);
  const products = useMemo(() => {
    const c = new Map<string, { count: number; avg: number }>();
    metrics.flatMap(m => m.intervals).filter(i => i.produto && i.produto !== '—').forEach(i => { const e = c.get(i.produto) || { count: 0, avg: 0 }; c.set(i.produto, { count: e.count + 1, avg: e.avg + i.durationMin }); });
    return [...c.entries()].map(([p, d]) => ({ product: p, count: d.count, avg: d.avg / d.count })).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [metrics]);

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Brain className="w-6 h-6 text-purple-400" />Insights IA<span className="text-xs font-normal text-gray-400 bg-purple-500/20 px-2 py-0.5 rounded-full ml-2">IA</span></h2>
      {top3.length > 0 && (
        <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2"><Award className="w-4 h-4 text-amber-400" />Top Operadores</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {top3.map((m, i) => (
              <div key={m.usuario} className={`rounded-lg p-3 border ${i === 0 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-gray-700/20 border-gray-700/30'}`}>
                <div className="flex items-center gap-2 mb-2"><span className="text-lg">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span><span className="text-white font-medium text-sm truncate">{m.usuario}</span></div>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <div><span className="text-gray-500">Desemp.</span><p className={`font-bold ${getDesempenhoColor(m.desempenho)}`}>{m.desempenho.toFixed(1)}%</p></div>
                  <div><span className="text-gray-500">Tarefas/H</span><p className="text-purple-400 font-bold">{m.tarefasHora.toFixed(1)}</p></div>
                  <div><span className="text-gray-500">Tarefas</span><p className="text-blue-400 font-bold">{m.totalTarefas}</p></div>
                  <div><span className="text-gray-500">Volumes</span><p className="text-indigo-400 font-bold">{m.totalVolumes.toLocaleString()}</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="grid gap-3">{insights.map((t, i) => (<div key={i} className={`border rounded-xl p-4 flex items-start gap-3 animate-slide-in card-hover ${bg(t)}`} style={{ animationDelay: `${i * 60}ms` }}>{icon(t)}<p className="text-gray-200 text-sm leading-relaxed">{t}</p></div>))}</div>
      {products.length > 0 && (
        <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2"><Package className="w-4 h-4 text-blue-400" />Produtos (Top 5)</h3>
          <div className="space-y-2">{products.map((p, i) => (<div key={p.product} className="flex items-center justify-between bg-gray-700/20 rounded-lg p-3">
            <div className="flex items-center gap-3"><span className="text-xs text-gray-500 w-4">{i + 1}</span><span className="text-white text-sm font-medium truncate max-w-[180px]">{p.product}</span></div>
            <div className="flex items-center gap-4 text-xs"><span className="text-blue-400">{p.count}×</span><span className="text-amber-400">{p.avg.toFixed(1)} min</span></div>
          </div>))}</div>
        </div>
      )}
      {metrics.length > 0 && (
        <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2"><Brain className="w-4 h-4 text-purple-400" />Resumo</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><span className="text-gray-400 text-xs">Operadores</span><p className="text-white font-bold text-lg">{new Set(metrics.map(m => m.usuario)).size}</p></div>
            <div><span className="text-gray-400 text-xs">Tarefas</span><p className="text-white font-bold text-lg">{metrics.reduce((s, m) => s + m.totalTarefas, 0).toLocaleString()}</p></div>
            <div><span className="text-gray-400 text-xs">Volumes</span><p className="text-white font-bold text-lg">{metrics.reduce((s, m) => s + m.totalVolumes, 0).toLocaleString()}</p></div>
            <div><span className="text-gray-400 text-xs">Desemp. Médio</span><p className="text-white font-bold text-lg">{metrics.length > 0 ? (metrics.reduce((s, m) => s + m.desempenho, 0) / metrics.length).toFixed(1) : 0}%</p></div>
          </div>
        </div>
      )}
    </div>
  );
}
