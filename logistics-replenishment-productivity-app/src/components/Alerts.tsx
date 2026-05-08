import { useMemo, useState } from 'react';
import type { UserMetrics, TaskClassification } from '../types';
import { getDesempenhoColor, getTypeLabel, getClassLabel, getClassColor, getClassBg, getClassDot, aggregateMetrics } from '../utils';
import { Bell, Filter, ChevronDown, ChevronUp, Search } from 'lucide-react';

interface Props { metrics: UserMetrics[] }

export default function Alerts({ metrics }: Props) {
  const [fClass, setFClass] = useState('all');
  const [fUser, setFUser] = useState('all');
  const [fProd, setFProd] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const users = useMemo(() => [...new Set(metrics.map(m => m.usuario))].sort(), [metrics]);
  const grouped = useMemo(() => {
    const g = new Map<string, UserMetrics[]>();
    for (const m of metrics) { const k = `${m.usuario}|||${m.data}`; if (!g.has(k)) g.set(k, []); g.get(k)!.push(m); }
    return [...g.entries()].map(([, ms]) => aggregateMetrics(ms)).sort((a, b) => b.desempenho - a.desempenho);
  }, [metrics]);
  const stats = useMemo(() => {
    const all = metrics.flatMap(m => m.intervals);
    return { total: all.length, excelente: all.filter(i => i.classification === 'excelente').length, bom: all.filter(i => i.classification === 'bom').length, aviso: all.filter(i => i.classification === 'aviso').length, ocioso: all.filter(i => i.classification === 'ocioso').length, avisoOp: all.filter(i => i.classification === 'aviso_op').length };
  }, [metrics]);

  const toggle = (k: string) => { const n = new Set(expanded); if (n.has(k)) n.delete(k); else n.add(k); setExpanded(n); };
  useMemo(() => { if (grouped.length <= 6 && expanded.size === 0) setExpanded(new Set(grouped.map(g => `${g.usuario}|||${g.data}`))); }, [grouped.length, expanded.size]);

  const filterInts = (ints: Props['metrics'][0]['intervals']) => {
    let r = ints;
    if (fClass !== 'all') { if (fClass === 'ocioso') r = r.filter(i => i.type === 'ocioso'); else r = r.filter(i => i.classification === fClass); }
    if (fProd) r = r.filter(i => i.produto.toLowerCase().includes(fProd.toLowerCase()));
    return r;
  };

  if (metrics.length === 0) return (<div className="flex flex-col items-center justify-center py-20 animate-fade-in"><Bell className="w-12 h-12 text-red-400 mb-4" /><h2 className="text-2xl font-bold text-white mb-2">Alertas</h2><p className="text-gray-400">Nenhum dado.</p></div>);

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Bell className="w-6 h-6 text-red-400" />Alertas Operacionais</h2>
      <div className="flex flex-wrap items-center gap-3 bg-gray-800/40 rounded-xl p-4">
        <Filter className="w-4 h-4 text-gray-400" />
        <select value={fUser} onChange={e => setFUser(e.target.value)} className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none">
          <option value="all">Todos Operadores</option>{users.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <select value={fClass} onChange={e => setFClass(e.target.value)} className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none">
          <option value="all">Classificação</option><option value="excelente">🟢 Excelente</option><option value="bom">🔵 Bom</option><option value="aviso">🟡 Aviso</option><option value="ocioso">🔴 Ocioso</option><option value="aviso_op">🟠 Aviso Oper.</option>
        </select>
        <div className="relative flex-1 min-w-[130px]"><Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" /><input value={fProd} onChange={e => setFProd(e.target.value)} placeholder="Produto..." className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-8 pr-3 py-1.5 text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none" /></div>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {[{ l: 'Total', n: stats.total, c: 'text-gray-300', bg: 'bg-gray-700/30' }, { l: 'Excelente', n: stats.excelente, c: 'text-emerald-400', bg: 'bg-emerald-500/10' }, { l: 'Bom', n: stats.bom, c: 'text-sky-400', bg: 'bg-sky-500/10' }, { l: 'Aviso', n: stats.aviso, c: 'text-yellow-400', bg: 'bg-yellow-500/10' }, { l: 'Ocioso', n: stats.ocioso, c: 'text-red-400', bg: 'bg-red-500/10' }, { l: 'Aviso Op.', n: stats.avisoOp, c: 'text-orange-300', bg: 'bg-orange-500/10' }].map((s, i) => (<div key={i} className={`${s.bg} rounded-lg p-2 text-center`}><p className={`text-lg font-bold ${s.c}`}>{s.n}</p><p className="text-[10px] text-gray-500">{s.l}</p></div>))}
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-gray-400 bg-gray-800/30 rounded-lg p-3">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> ≤5min</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-400" /> 5–8min</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400" /> 8–20min</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> &gt;20min</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-300" /> Alto volume</span>
      </div>
      <div className="space-y-3">
        {grouped.filter(g => fUser === 'all' || g.usuario === fUser).map(grp => {
          const key = `${grp.usuario}|||${grp.data}`; const isExp = expanded.has(key); const filtered = filterInts(grp.intervals);
          if (fClass !== 'all' && filtered.length === 0) return null; if (fProd && filtered.length === 0) return null;
          return (
            <div key={key} className="bg-gray-800/40 border border-gray-700/40 rounded-xl overflow-hidden">
              <button onClick={() => toggle(key)} className="w-full flex items-center justify-between p-4 hover:bg-gray-700/20 transition-colors">
                <div className="flex items-center gap-3"><div className={`w-3 h-3 rounded-full ${getClassDot(grp.desempenho >= 100 ? 'excelente' : grp.desempenho >= 90 ? 'bom' : grp.desempenho >= 70 ? 'aviso' as TaskClassification : 'ocioso')}`} /><div className="text-left"><p className="text-white font-semibold text-sm">{grp.usuario}</p><p className="text-gray-500 text-xs">{grp.data} · {grp.totalTarefas} tarefas · {grp.totalVolumes} vol</p></div></div>
                <div className="flex items-center gap-4"><div className="hidden sm:flex items-center gap-3 text-xs"><span className="text-purple-400">{grp.tarefasHora.toFixed(1)} t/h</span><span className={`font-bold ${getDesempenhoColor(grp.desempenho)}`}>{grp.desempenho.toFixed(1)}%</span></div>{isExp ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}</div>
              </button>
              {isExp && (
                <div className="border-t border-gray-700/30">
                  <div className="sm:hidden flex gap-2 p-3 bg-gray-900/30 text-xs"><span className="text-gray-400">{grp.totalTarefas} tarefas</span><span className={`font-bold ${getDesempenhoColor(grp.desempenho)}`}>{grp.desempenho.toFixed(1)}%</span></div>
                  <div className="max-h-[500px] overflow-y-auto">
                    {filtered.length === 0 && <p className="p-4 text-center text-gray-500 text-sm">Nenhum registro.</p>}
                    {filtered.map((iv, idx) => { const color = getClassColor(iv.classification); const bgc = getClassBg(iv.classification); const segVol = iv.qtdVolumes > 0 && iv.type === 'tarefa' ? Math.round(iv.durationMin * 60 / iv.qtdVolumes) : null; return (
                      <div key={idx} className={`flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2.5 border-b border-gray-700/20 ${bgc} gap-1`}>
                        <div className="flex items-center gap-3"><div className={`w-1.5 h-1.5 rounded-full shrink-0 ${getClassDot(iv.classification)}`} /><div>
                          <div className="flex items-center gap-2 flex-wrap"><span className={`text-xs font-semibold ${color}`}>{getTypeLabel(iv.type)}</span><span className="text-gray-300 text-xs font-mono">{iv.from} → {iv.to}</span><span className={`text-xs font-mono font-medium ${color}`}>{iv.durationMin.toFixed(0)} min</span></div>
                          <div className="flex items-center gap-3 text-[10px] text-gray-500 mt-0.5">{iv.produto && iv.produto !== '—' && <span>{iv.produto}</span>}{iv.qtdVolumes > 0 && <span>Vol: {iv.qtdVolumes}</span>}{segVol !== null && <span>{segVol} seg/vol</span>}</div>
                        </div></div>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${bgc} ${color} shrink-0`}>{getClassLabel(iv.classification)}</span>
                      </div>); })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
