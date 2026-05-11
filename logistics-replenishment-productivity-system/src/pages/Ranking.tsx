import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Trophy, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { OperatorMetrics, formatMinutes, getStatusColor, exportToExcel } from '../utils/calculations';

type SortField = keyof OperatorMetrics;
const PER_PAGE = 20;

export default function Ranking() {
  const { filteredMetrics, filteredTasks, dashboardData, loading } = useApp();
  const [sortField, setSortField] = useState<SortField>('desempenho');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    const arr = [...filteredMetrics];
    arr.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      const aNum = Number(aVal) || 0;
      const bNum = Number(bVal) || 0;
      return sortDir === 'asc' ? aNum - bNum : bNum - aNum;
    });
    return arr;
  }, [filteredMetrics, sortField, sortDir]);

  const totalPages = Math.ceil(sorted.length / PER_PAGE);
  const paged = sorted.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
    setPage(0);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={12} className="text-slate-600" />;
    return sortDir === 'asc' ? <ArrowUp size={12} className="text-blue-400" /> : <ArrowDown size={12} className="text-blue-400" />;
  };

  const columns: { key: SortField; label: string; align?: string }[] = [
    { key: 'usuario', label: 'Operador' },
    { key: 'dataIni', label: 'Data' },
    { key: 'totalTarefas', label: 'Tarefas', align: 'right' },
    { key: 'totalVolumes', label: 'Volumes', align: 'right' },
    { key: 'tempoProdutivo', label: 'Produtivo', align: 'right' },
    { key: 'tempoOcioso', label: 'Ocioso', align: 'right' },
    { key: 'tempoMedio', label: 'Tempo Médio', align: 'right' },
    { key: 'tarefasHora', label: 'Tarefas/h', align: 'right' },
    { key: 'desempenho', label: 'Desempenho', align: 'right' },
    { key: 'status', label: 'Status', align: 'center' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-12 lg:pt-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Ranking</h1>
          <p className="text-sm text-slate-500 mt-1">Classificação de desempenho dos operadores</p>
        </div>
        <button
          onClick={() => exportToExcel(dashboardData, filteredMetrics, filteredTasks)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-colors text-sm font-medium border border-blue-500/20"
        >
          <Download size={16} />
          Exportar
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Registros', value: sorted.length, color: 'text-blue-400' },
          { label: 'Excelente', value: sorted.filter(m => m.status === 'Excelente').length, color: 'text-emerald-400' },
          { label: 'Bom+', value: sorted.filter(m => ['Bom', 'Muito Bom'].includes(m.status)).length, color: 'text-cyan-400' },
          { label: 'Crítico', value: sorted.filter(m => m.status === 'Crítico').length, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-[#111827] rounded-xl border border-gray-800/60 p-3 text-center">
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Trophy size={32} className="text-slate-600 mb-3" />
          <p className="text-slate-400">Nenhum dado para exibir</p>
          <p className="text-sm text-slate-600">Importe uma planilha para visualizar o ranking</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#111827] rounded-xl border border-gray-800/60 overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#0f172a]">
                  <th className="text-left p-3 text-slate-400 font-medium w-10">#</th>
                  {columns.map(col => (
                    <th
                      key={col.key}
                      onClick={() => toggleSort(col.key)}
                      className={`${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} p-3 text-slate-400 font-medium cursor-pointer hover:text-slate-200 transition-colors whitespace-nowrap`}
                    >
                      <div className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : ''}`}>
                        {col.label}
                        <SortIcon field={col.key} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((m, i) => (
                  <tr
                    key={`${m.usuario}-${m.dataIni}`}
                    className="border-t border-gray-800/40 hover:bg-gray-800/20 transition-colors"
                  >
                    <td className="p-3 text-slate-500 text-xs">{page * PER_PAGE + i + 1}</td>
                    <td className="p-3 text-slate-200 font-medium text-xs">{m.usuario}</td>
                    <td className="p-3 text-slate-400 text-xs">{m.dataIni}</td>
                    <td className="p-3 text-slate-300 text-xs text-right font-mono">{m.totalTarefas}</td>
                    <td className="p-3 text-slate-400 text-xs text-right font-mono">{m.totalVolumes.toLocaleString('pt-BR')}</td>
                    <td className="p-3 text-slate-300 text-xs text-right font-mono">{formatMinutes(m.tempoProdutivo)}</td>
                    <td className="p-3 text-slate-400 text-xs text-right font-mono">{formatMinutes(m.tempoOcioso)}</td>
                    <td className="p-3 text-slate-300 text-xs text-right font-mono">{formatMinutes(m.tempoMedio)}</td>
                    <td className="p-3 text-slate-300 text-xs text-right font-mono">{m.tarefasHora.toFixed(1)}</td>
                    <td className="p-3 text-xs text-right">
                      <span className={`font-bold ${m.desempenho >= 100 ? 'text-emerald-400' : m.desempenho >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
                        {m.desempenho.toFixed(1)}%
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${getStatusColor(m.status)}`}>
                        {m.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-3 border-t border-gray-800/60">
              <p className="text-xs text-slate-500">
                {page * PER_PAGE + 1}-{Math.min((page + 1) * PER_PAGE, sorted.length)} de {sorted.length}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-1.5 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                  const pageNum = Math.max(0, Math.min(page - 2, totalPages - 5)) + idx;
                  if (pageNum >= totalPages) return null;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-7 h-7 rounded text-xs font-medium ${
                        page === pageNum ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400 hover:bg-gray-800'
                      }`}
                    >
                      {pageNum + 1}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-1.5 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
