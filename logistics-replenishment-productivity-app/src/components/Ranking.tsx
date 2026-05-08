import { useState, useMemo } from 'react';
import type { UserMetrics } from '../types';
import { formatTime, getStatusLabel, getStatusColor, getStatusBg } from '../utils';
import { Trophy, ArrowUpDown, AlertTriangle } from 'lucide-react';

type SK = 'usuario' | 'totalTarefas' | 'totalVolumes' | 'tempoProdutivo' | 'tempoOcioso' | 'tempoMedio' | 'tarefasHora' | 'desempenho';
interface Props { metrics: UserMetrics[] }

export default function Ranking({ metrics }: Props) {
  const [sk, setSk] = useState<SK>('desempenho');
  const [sd, setSd] = useState<'asc' | 'desc'>('desc');
  const sort = (k: SK) => { if (sk === k) setSd(d => d === 'asc' ? 'desc' : 'asc'); else { setSk(k); setSd('desc'); } };
  const sorted = useMemo(() => [...metrics].sort((a, b) => {
    const va = a[sk], vb = b[sk];
    if (typeof va === 'string') return sd === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
    return sd === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
  }), [metrics, sk, sd]);

  if (metrics.length === 0) return (<div className="flex flex-col items-center justify-center py-20 animate-fade-in"><Trophy className="w-12 h-12 text-amber-400 mb-4" /><h2 className="text-2xl font-bold text-white mb-2">Ranking</h2><p className="text-gray-400">Nenhum dado.</p></div>);

  const cols: { k: SK; l: string; c: string }[] = [
    { k: 'usuario', l: 'Operador', c: '' },
    { k: 'totalTarefas', l: 'Tarefas', c: 'text-gray-300' },
    { k: 'totalVolumes', l: 'Volumes', c: 'text-indigo-400' },
    { k: 'tempoProdutivo', l: 'Produtivo', c: 'text-emerald-400' },
    { k: 'tempoOcioso', l: 'Ocioso', c: 'text-red-400' },
    { k: 'tempoMedio', l: 'T. Médio', c: 'text-purple-400' },
    { k: 'tarefasHora', l: 'Tarefas/H', c: 'text-amber-400' },
    { k: 'desempenho', l: 'Desemp.', c: '' },
  ];
  const fmt = (k: SK, m: UserMetrics) => {
    if (k === 'usuario') return '';
    if (k === 'totalTarefas') return String(m.totalTarefas);
    if (k === 'totalVolumes') return m.totalVolumes.toLocaleString();
    if (k === 'tempoProdutivo' || k === 'tempoOcioso') return formatTime(m[k]);
    if (k === 'tempoMedio') return formatTime(m.tempoMedio / 60);
    if (k === 'tarefasHora') return m.tarefasHora.toFixed(2);
    if (k === 'desempenho') return `${m.desempenho.toFixed(1)}%`;
    return String((m as any)[k] ?? '');
  };
  const inv = metrics.filter(m => !m.valid).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Trophy className="w-6 h-6 text-amber-400" />Ranking</h2>
      {inv > 0 && <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-400" /><span className="text-red-400 text-xs">{inv} registro(s) com inconsistência de tempo</span></div>}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead><tr className="border-b border-gray-700/50">
              <th className="p-3 text-gray-400 text-center w-10">#</th>
              {cols.map(c => <th key={c.k} className="p-3 text-gray-400 text-left font-medium cursor-pointer hover:text-white select-none whitespace-nowrap" onClick={() => sort(c.k)}>{c.l} <ArrowUpDown className={`w-3 h-3 inline ml-1 ${sk === c.k ? 'text-blue-400' : 'text-gray-600'}`} /></th>)}
              <th className="p-3 text-gray-400 text-left font-medium">Status</th>
            </tr></thead>
            <tbody>
              {sorted.map((m, i) => (
                <tr key={`${m.usuario}-${m.data}-${i}`} className={`border-b border-gray-700/30 hover:bg-gray-700/20 transition-colors ${!m.valid ? 'bg-red-500/5' : ''}`}>
                  <td className="p-3 text-center">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="text-gray-400">{i + 1}</span>}</td>
                  <td className="p-3"><span className="text-white font-medium">{m.usuario}</span>{m.data && <span className="text-gray-500 text-xs ml-2">{m.data}</span>}{!m.valid && <span className="text-red-400 text-[9px] ml-1">⚠</span>}</td>
                  {cols.slice(1).map(c => <td key={c.k} className={`p-3 ${c.c}`}>{fmt(c.k, m)}</td>)}
                  <td className="p-3"><span className={`px-2 py-0.5 rounded text-xs font-bold border ${getStatusBg(m.status)} ${getStatusColor(m.status)}`}>{getStatusLabel(m.status)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-gray-700/30 text-[10px] text-gray-500">Média por operador: Produtivo {formatTime(metrics.reduce((s, m) => s + m.tempoProdutivo, 0) / metrics.length)} + Ocioso {formatTime(metrics.reduce((s, m) => s + m.tempoOcioso, 0) / metrics.length)} ≈ 09:00</div>
      </div>
    </div>
  );
}
