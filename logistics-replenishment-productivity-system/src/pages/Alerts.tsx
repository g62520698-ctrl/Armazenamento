import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ChevronLeft, ChevronRight, Search, Filter } from 'lucide-react';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { useApp } from '../context/AppContext';
import { getClassificationColor } from '../utils/calculations';

type SortField = 'usuario' | 'duracao' | 'horaInicio' | 'classificacao' | 'dataIni' | 'segundosPorVolume';
const PER_PAGE = 25;

function parseDateFilter(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  }
  return null;
}

export default function Alerts() {
  const { filteredTasks, loading, operators } = useApp();
  const [sortField, setSortField] = useState<SortField>('duracao');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [classFilter, setClassFilter] = useState('');
  const [search, setSearch] = useState('');
  const [operatorFilter, setOperatorFilter] = useState('');
  const [datePeriod, setDatePeriod] = useState<'day' | 'week' | 'month' | 'all'>('all');
  const [dateFilter, setDateFilter] = useState('');

  // Unique dates from tasks
  const uniqueDates = useMemo(() => {
    const dates = [...new Set(filteredTasks.map(t => t.dataIni))].sort((a, b) => {
      const da = parseDateFilter(a);
      const db = parseDateFilter(b);
      if (!da || !db) return 0;
      return da.getTime() - db.getTime();
    });
    return dates;
  }, [filteredTasks]);

  const filtered = useMemo(() => {
    let arr = [...filteredTasks];

    // Classification filter
    if (classFilter) arr = arr.filter(t => t.classificacao === classFilter);

    // Operator filter
    if (operatorFilter) arr = arr.filter(t => t.usuario === operatorFilter);

    // Search
    if (search) {
      const s = search.toLowerCase();
      arr = arr.filter(t =>
        t.usuario.toLowerCase().includes(s) ||
        t.produto.toLowerCase().includes(s)
      );
    }

    // Date filter
    if (datePeriod !== 'all' && dateFilter) {
      const parsed = parseDateFilter(dateFilter);
      if (parsed) {
        arr = arr.filter(t => {
          const rd = parseDateFilter(t.dataIni);
          if (!rd) return false;
          switch (datePeriod) {
            case 'day': return t.dataIni === dateFilter;
            case 'week': {
              const ws = startOfWeek(parsed, { weekStartsOn: 1 });
              const we = endOfWeek(parsed, { weekStartsOn: 1 });
              return rd >= ws && rd <= we;
            }
            case 'month': {
              const ms = startOfMonth(parsed);
              const me = endOfMonth(parsed);
              return rd >= ms && rd <= me;
            }
            default: return true;
          }
        });
      }
    }

    // Sort
    arr.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortField) {
        case 'usuario': return dir * a.usuario.localeCompare(b.usuario);
        case 'duracao': return dir * (a.duracao - b.duracao);
        case 'horaInicio': return dir * a.horaInicio.localeCompare(b.horaInicio);
        case 'classificacao': return dir * a.classificacao.localeCompare(b.classificacao);
        case 'dataIni': {
          const da = parseDateFilter(a.dataIni);
          const db = parseDateFilter(b.dataIni);
          return dir * ((da?.getTime() || 0) - (db?.getTime() || 0));
        }
        case 'segundosPorVolume': return dir * (a.segundosPorVolume - b.segundosPorVolume);
        default: return 0;
      }
    });
    return arr;
  }, [filteredTasks, sortField, sortDir, classFilter, search, operatorFilter, datePeriod, dateFilter]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paged = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  // Stats
  const stats = useMemo(() => ({
    excelente: filteredTasks.filter(t => t.classificacao === 'Excelente').length,
    normal: filteredTasks.filter(t => t.classificacao === 'Normal').length,
    alerta: filteredTasks.filter(t => t.classificacao === 'Alerta').length,
    ociosidade: filteredTasks.filter(t => t.classificacao === 'Ociosidade').length,
    avisoOp: filteredTasks.filter(t => t.classificacao === 'Aviso Operacional').length,
  }), [filteredTasks]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
    setPage(0);
  };

  const resetFilters = () => {
    setClassFilter('');
    setOperatorFilter('');
    setSearch('');
    setDatePeriod('all');
    setDateFilter('');
    setPage(0);
  };

  const hasActiveFilters = classFilter || operatorFilter || search || datePeriod !== 'all';

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
        <h1 className="text-2xl font-bold text-slate-100">Alertas</h1>
        <p className="text-sm text-slate-500 mt-1">Detalhamento completo de todas as tarefas e classificações</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Excelente', value: stats.excelente, color: 'text-emerald-400', bg: 'bg-emerald-400/10', sub: '≤ 5 min' },
          { label: 'Normal', value: stats.normal, color: 'text-blue-400', bg: 'bg-blue-400/10', sub: '5–7 min' },
          { label: 'Alerta', value: stats.alerta, color: 'text-amber-400', bg: 'bg-amber-400/10', sub: '7–20 min' },
          { label: 'Ociosidade', value: stats.ociosidade, color: 'text-red-400', bg: 'bg-red-400/10', sub: '> 20 min' },
          { label: 'Aviso Op.', value: stats.avisoOp, color: 'text-orange-400', bg: 'bg-orange-400/10', sub: 'Vol > 2000' },
        ].map(s => (
          <div key={s.label} className="bg-[#111827] rounded-xl border border-gray-800/60 p-3 text-center">
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-slate-500">{s.label}</p>
            <p className="text-[9px] text-slate-600">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-[#111827] rounded-xl border border-gray-800/60 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-slate-500" />
            <span className="text-xs font-medium text-slate-400">Filtros</span>
          </div>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              Limpar filtros
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar operador ou produto..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              className="w-full bg-[#0f172a] border border-gray-800/60 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500/50"
            />
          </div>

          {/* Operator */}
          <select
            value={operatorFilter}
            onChange={e => { setOperatorFilter(e.target.value); setPage(0); }}
            className="bg-[#0f172a] border border-gray-800/60 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500/50"
          >
            <option value="">Todos os operadores</option>
            {operators.map(op => (
              <option key={op} value={op}>{op}</option>
            ))}
          </select>

          {/* Classification */}
          <select
            value={classFilter}
            onChange={e => { setClassFilter(e.target.value); setPage(0); }}
            className="bg-[#0f172a] border border-gray-800/60 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500/50"
          >
            <option value="">Todas classificações</option>
            <option value="Excelente">Excelente (≤ 5 min)</option>
            <option value="Normal">Normal (5–7 min)</option>
            <option value="Alerta">Alerta (7–20 min)</option>
            <option value="Ociosidade">Ociosidade (&gt; 20 min)</option>
            <option value="Aviso Operacional">Aviso Operacional</option>
          </select>

          {/* Period */}
          <select
            value={datePeriod}
            onChange={e => { setDatePeriod(e.target.value as any); setPage(0); }}
            className="bg-[#0f172a] border border-gray-800/60 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500/50"
          >
            <option value="all">Todos os períodos</option>
            <option value="day">Dia</option>
            <option value="week">Semana</option>
            <option value="month">Mês</option>
          </select>

          {/* Date */}
          <select
            value={dateFilter}
            onChange={e => { setDateFilter(e.target.value); setPage(0); }}
            disabled={datePeriod === 'all'}
            className="bg-[#0f172a] border border-gray-800/60 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500/50 disabled:opacity-40"
          >
            <option value="">Selecione a data</option>
            {uniqueDates.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {filtered.length} tarefa{filtered.length !== 1 ? 's' : ''} encontrada{filtered.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <AlertTriangle size={32} className="text-slate-600 mb-3" />
          <p className="text-slate-400">Nenhum alerta encontrado</p>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-sm text-blue-400 hover:text-blue-300 mt-2"
            >
              Limpar filtros
            </button>
          )}
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
                  <th
                    onClick={() => toggleSort('usuario')}
                    className="text-left p-3 text-slate-400 font-medium cursor-pointer hover:text-slate-200 whitespace-nowrap"
                  >
                    Operador ↕
                  </th>
                  <th
                    onClick={() => toggleSort('dataIni')}
                    className="text-left p-3 text-slate-400 font-medium cursor-pointer hover:text-slate-200 whitespace-nowrap"
                  >
                    Data ↕
                  </th>
                  <th className="text-left p-3 text-slate-400 font-medium">Produto</th>
                  <th
                    onClick={() => toggleSort('horaInicio')}
                    className="text-left p-3 text-slate-400 font-medium cursor-pointer hover:text-slate-200 whitespace-nowrap"
                  >
                    Hora Início ↕
                  </th>
                  <th className="text-left p-3 text-slate-400 font-medium whitespace-nowrap">Hora Fim</th>
                  <th
                    onClick={() => toggleSort('duracao')}
                    className="text-right p-3 text-slate-400 font-medium cursor-pointer hover:text-slate-200 whitespace-nowrap"
                  >
                    Duração ↕
                  </th>
                  <th className="text-right p-3 text-slate-400 font-medium">Volumes</th>
                  <th
                    onClick={() => toggleSort('segundosPorVolume')}
                    className="text-right p-3 text-slate-400 font-medium cursor-pointer hover:text-slate-200 whitespace-nowrap"
                  >
                    Seg/Volume ↕
                  </th>
                  <th
                    onClick={() => toggleSort('classificacao')}
                    className="text-center p-3 text-slate-400 font-medium cursor-pointer hover:text-slate-200 whitespace-nowrap"
                  >
                    Classificação ↕
                  </th>
                </tr>
              </thead>
              <tbody>
                {paged.map((t, i) => (
                  <tr key={t.id} className="border-t border-gray-800/40 hover:bg-gray-800/20 transition-colors">
                    <td className="p-3 text-slate-500 text-xs">{page * PER_PAGE + i + 1}</td>
                    <td className="p-3 text-slate-200 text-xs font-medium">{t.usuario}</td>
                    <td className="p-3 text-slate-400 text-xs whitespace-nowrap">{t.dataIni}</td>
                    <td className="p-3 text-slate-400 text-xs truncate max-w-[120px]" title={t.produto}>{t.produto}</td>
                    <td className="p-3 text-slate-300 text-xs font-mono">{t.horaInicio}</td>
                    <td className="p-3 text-slate-400 text-xs font-mono">{t.horaFim}</td>
                    <td className="p-3 text-xs text-right">
                      <span className={`font-mono font-medium ${
                        t.duracao <= 5 ? 'text-emerald-400' :
                        t.duracao <= 7 ? 'text-blue-400' :
                        t.duracao <= 20 ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {t.duracao} min
                      </span>
                    </td>
                    <td className="p-3 text-slate-400 text-xs text-right font-mono">
                      {t.volumes.toLocaleString('pt-BR')}
                    </td>
                    <td className="p-3 text-xs text-right font-mono text-slate-400">
                      {t.segundosPorVolume > 0 ? t.segundosPorVolume.toFixed(2) : '-'}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${getClassificationColor(t.classificacao)}`}>
                        {t.classificacao}
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
                {page * PER_PAGE + 1}–{Math.min((page + 1) * PER_PAGE, filtered.length)} de {filtered.length}
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
                  const start = Math.max(0, Math.min(page - 2, totalPages - 5));
                  const pageNum = start + idx;
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
