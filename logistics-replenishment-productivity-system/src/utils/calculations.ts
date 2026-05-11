import { startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import * as XLSX from 'xlsx';

// ====================================================================
// TYPES
// ====================================================================

export interface RawRecord {
  id?: string;
  usuario: string;
  dataIni: string;
  horaIni: string;
  produto: string;
  volumes: number;
}

export interface Task {
  id: string;
  usuario: string;
  dataIni: string;
  horaInicio: string;
  horaFim: string;
  duracao: number;
  produto: string;
  volumes: number;
  segundosPorVolume: number;
  classificacao: 'Excelente' | 'Normal' | 'Alerta' | 'Ociosidade' | 'Aviso Operacional';
}

export interface OperatorMetrics {
  usuario: string;
  dataIni: string;
  totalTarefas: number;
  totalVolumes: number;
  tempoProdutivo: number;
  tempoOcioso: number;
  tempoMedio: number;
  tarefasHora: number;
  desempenho: number;
  status: string;
  inconsistencia: string;
  horasProdutivas: number;
  fatorConsistencia: number;
}

export interface DashboardData {
  desempenhoMedio: number;
  tarefasHoraMedia: number;
  tempoMedioGeral: number;
  totalTarefas: number;
  operadoresAtivos: number;
  picoOperacional: string;
  picoHora: number;
  evolucaoDiaria: { data: string; desempenho: number; tarefas: number; operadores: number }[];
  heatmapData: { operador: string; hora: number; tarefas: number }[];
}

export interface Insight {
  tipo: 'positivo' | 'negativo' | 'neutro' | 'alerta';
  titulo: string;
  descricao: string;
  operador?: string;
  icone: string;
}

export interface FilterState {
  period: 'day' | 'week' | 'month' | 'all';
  selectedDate: string;
  operator: string;
}

// ====================================================================
// CONSTANTS — REGRAS OPERACIONAIS OFICIAIS
// ====================================================================

/** Média oficial: 5 minutos por tarefa */
export const TEMPO_MEDIO_IDEAL = 5;

/** Média oficial: 12 tarefas por hora */
export const TAREFAS_HORA_META = 12;

/** Turno operacional: 9 horas */
export const TURNO_HORAS = 9;

/** Meta diária oficial: 108 tarefas por operador (12 * 9) */
export const META_DIARIA = 108;

/** Limite de tarefas mínimas para cálculo confiável (1 hora de trabalho) */
export const MIN_TAREFAS_CONFIABILIDADE = 12;

// ====================================================================
// PARSERS
// ====================================================================

export function parseExcelDate(value: any): string {
  if (!value && value !== 0) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    const day = date.getUTCDate().toString().padStart(2, '0');
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }
  if (value instanceof Date) {
    const day = value.getDate().toString().padStart(2, '0');
    const month = (value.getMonth() + 1).toString().padStart(2, '0');
    const year = value.getFullYear();
    return `${day}/${month}/${year}`;
  }
  return String(value).trim();
}

export function parseExcelTime(value: any): string {
  if (!value && value !== 0) return '';
  if (typeof value === 'number') {
    const totalMinutes = Math.round(value * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
  if (typeof value === 'string') {
    const cleaned = value.trim();
    if (/^\d{1,2}:\d{2}/.test(cleaned)) {
      const parts = cleaned.split(':');
      return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    }
    return cleaned;
  }
  if (value instanceof Date) {
    return `${value.getHours().toString().padStart(2, '0')}:${value.getMinutes().toString().padStart(2, '0')}`;
  }
  return String(value).trim();
}

export function timeToMinutes(time: string): number {
  if (!time || !time.includes(':')) return 0;
  const parts = time.split(':');
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

export function formatMinutes(minutes: number): string {
  if (isNaN(minutes) || !isFinite(minutes)) return '00:00';
  const absMins = Math.abs(Math.round(minutes));
  const h = Math.floor(absMins / 60);
  const m = absMins % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// ====================================================================
// CLASSIFICATIONS — REGRAS OFICIAIS
// ====================================================================

/**
 * Classificação VISUAL de cada tarefa para a aba Alertas:
 *   0–5 min  → Excelente
 *   5–7 min  → Normal
 *   7–20 min → Alerta
 *   >20 min  → Ociosidade
 *
 * Exceção: volumes > 2000 → Aviso Operacional
 */
export function classifyTask(minutes: number, volumes: number): Task['classificacao'] {
  if (volumes > 2000) return 'Aviso Operacional';
  if (minutes <= 5) return 'Excelente';
  if (minutes <= 7) return 'Normal';
  if (minutes <= 20) return 'Alerta';
  return 'Ociosidade';
}

/**
 * Tarefa produtiva: duração <= 20 minutos
 * Tarefa ociosa: duração > 20 minutos
 */
export function isProductive(minutes: number): boolean {
  return minutes <= 20;
}

// ====================================================================
// PROCESS RECORDS → TASKS
// ====================================================================

export function processRecordsToTasks(records: RawRecord[]): Task[] {
  const tasks: Task[] = [];
  const groups = new Map<string, RawRecord[]>();

  for (const record of records) {
    if (!record.usuario || !record.dataIni || !record.horaIni) continue;
    const key = `${record.usuario}|||${record.dataIni}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(record);
  }

  for (const [, groupRecords] of groups) {
    groupRecords.sort((a, b) => timeToMinutes(a.horaIni) - timeToMinutes(b.horaIni));

    for (let i = 0; i < groupRecords.length - 1; i++) {
      const current = groupRecords[i];
      const next = groupRecords[i + 1];
      const duration = timeToMinutes(next.horaIni) - timeToMinutes(current.horaIni);

      if (duration >= 0) {
        // Segundos por volume
        const segundosTotais = duration * 60;
        const segundosPorVolume = current.volumes > 0
          ? segundosTotais / current.volumes
          : 0;

        tasks.push({
          id: `${current.usuario}-${current.dataIni}-${i}`,
          usuario: current.usuario,
          dataIni: current.dataIni,
          horaInicio: current.horaIni,
          horaFim: next.horaIni,
          duracao: duration,
          produto: current.produto,
          volumes: current.volumes,
          segundosPorVolume: Math.round(segundosPorVolume * 100) / 100,
          classificacao: classifyTask(duration, current.volumes),
        });
      }
    }
  }

  return tasks;
}

// ====================================================================
// OPERATOR METRICS — CÁLCULO OFICIAL DE DESEMPENHO
// ====================================================================

/**
 * Cálculo de desempenho por operador/dia.
 *
 * FÓRMULA OFICIAL:
 *
 *   tarefasHora = totalTarefas / horasProdutivas
 *   tempoMedio  = tempoProdutivo / totalTarefas
 *
 *   scoreTH    = (tarefasHora / 12) * 100
 *   scoreTM    = (5 / tempoMedio)  * 100
 *   scoreMeta  = (totalTarefas / 108) * 100
 *
 *   desempenho = (scoreTH * 0.45) + (scoreTM * 0.45) + (scoreMeta * 0.10)
 *
 * LIMITADO A 0%–200%
 *
 * FATOR DE CONSISTÊNCIA:
 *   Se totalTarefas < 12 (1h de trabalho), aplica fator proporcional
 *   para impedir desempenho alto com poucas tarefas.
 */
export function calculateOperatorMetrics(
  tasks: Task[],
  usuario: string,
  dataIni: string
): OperatorMetrics {
  const opTasks = tasks.filter(t => t.usuario === usuario && t.dataIni === dataIni);
  const totalTarefas = opTasks.length;
  const totalVolumes = opTasks.reduce((s, t) => s + t.volumes, 0);

  // Tempo produtivo: soma APENAS tarefas <= 20 min
  const tempoProdutivo = opTasks
    .filter(t => isProductive(t.duracao))
    .reduce((s, t) => s + t.duracao, 0);

  // Tempo ocioso: soma APENAS intervalos > 20 min
  const tempoOcioso = opTasks
    .filter(t => !isProductive(t.duracao))
    .reduce((s, t) => s + t.duracao, 0);

  // Horas produtivas
  const horasProdutivas = tempoProdutivo / 60;

  // Tarefas por hora
  const tarefasHora = horasProdutivas > 0
    ? totalTarefas / horasProdutivas
    : 0;

  // Tempo médio por tarefa (em minutos)
  const tempoMedio = totalTarefas > 0
    ? tempoProdutivo / totalTarefas
    : 0;

  // ----------------------------------------------------------------
  // SCORES
  // ----------------------------------------------------------------
  const scoreTH = tarefasHora > 0
    ? (tarefasHora / TAREFAS_HORA_META) * 100
    : 0;

  const scoreTM = tempoMedio > 0
    ? (TEMPO_MEDIO_IDEAL / tempoMedio) * 100
    : 0;

  const scoreMeta = (totalTarefas / META_DIARIA) * 100;

  // ----------------------------------------------------------------
  // DESEMPENHO BRUTO
  // ----------------------------------------------------------------
  let desempenhoBruto = (scoreTH * 0.45) + (scoreTM * 0.45) + (scoreMeta * 0.10);

  // ----------------------------------------------------------------
  // FATOR DE CONSISTÊNCIA
  // Impede desempenho alto com poucas tarefas
  // Ex: 1 tarefa em 5 min → fator 1/12 = 0.083 → desempenho ~7.5%
  // Ex: 12 tarefas → fator 1.0 → desempenho integral
  // ----------------------------------------------------------------
  const fatorConsistencia = totalTarefas >= MIN_TAREFAS_CONFIABILIDADE
    ? 1.0
    : totalTarefas > 0
      ? totalTarefas / MIN_TAREFAS_CONFIABILIDADE
      : 0;

  const desempenho = Math.max(0, Math.min(200, desempenhoBruto * fatorConsistencia));

  // ----------------------------------------------------------------
  // STATUS
  // ----------------------------------------------------------------
  let status = 'Crítico';
  if (desempenho >= 120) status = 'Excelente';
  else if (desempenho >= 100) status = 'Muito Bom';
  else if (desempenho >= 85) status = 'Bom';
  else if (desempenho >= 70) status = 'Atenção';

  // ----------------------------------------------------------------
  // INCONSISTÊNCIA
  // Valida se tempo produtivo condiz com quantidade de tarefas
  // ----------------------------------------------------------------
  const tempoEsperado = totalTarefas * TEMPO_MEDIO_IDEAL;
  const percentualErro = tempoEsperado > 0
    ? (Math.abs(tempoProdutivo - tempoEsperado) / tempoEsperado) * 100
    : 0;

  let inconsistencia = 'Normal';
  if (percentualErro > 40) inconsistencia = 'Inconsistente';
  else if (percentualErro > 20) inconsistencia = 'Atenção';

  return {
    usuario,
    dataIni,
    totalTarefas,
    totalVolumes,
    tempoProdutivo,
    tempoOcioso,
    tempoMedio,
    tarefasHora,
    desempenho: Math.round(desempenho * 10) / 10,
    status,
    inconsistencia,
    horasProdutivas,
    fatorConsistencia: Math.round(fatorConsistencia * 1000) / 1000,
  };
}

export function getAllMetrics(records: RawRecord[]): OperatorMetrics[] {
  if (records.length === 0) return [];
  const tasks = processRecordsToTasks(records);
  const combos = new Set<string>();
  for (const r of records) {
    if (r.usuario && r.dataIni) combos.add(`${r.usuario}|||${r.dataIni}`);
  }
  const metrics: OperatorMetrics[] = [];
  for (const combo of combos) {
    const [usuario, dataIni] = combo.split('|||');
    metrics.push(calculateOperatorMetrics(tasks, usuario, dataIni));
  }
  return metrics.sort((a, b) => b.desempenho - a.desempenho);
}

// ====================================================================
// DASHBOARD
// ====================================================================

export function calculateDashboardData(
  metrics: OperatorMetrics[],
  tasks: Task[],
  operators: string[]
): DashboardData {
  if (metrics.length === 0) {
    return {
      desempenhoMedio: 0, tarefasHoraMedia: 0, tempoMedioGeral: 0,
      totalTarefas: 0, operadoresAtivos: 0, picoOperacional: '-',
      picoHora: 0, evolucaoDiaria: [], heatmapData: [],
    };
  }

  const desempenhoMedio = metrics.reduce((s, m) => s + m.desempenho, 0) / metrics.length;
  const tarefasHoraMedia = metrics.reduce((s, m) => s + m.tarefasHora, 0) / metrics.length;
  const tempoMedioGeral = metrics.reduce((s, m) => s + m.tempoMedio, 0) / metrics.length;
  const totalTarefas = metrics.reduce((s, m) => s + m.totalTarefas, 0);
  const operadoresAtivos = new Set(metrics.map(m => m.usuario)).size;

  // Evolution by date
  const byDate = new Map<string, { desempenho: number; tarefas: number; count: number }>();
  for (const m of metrics) {
    if (!byDate.has(m.dataIni)) byDate.set(m.dataIni, { desempenho: 0, tarefas: 0, count: 0 });
    const e = byDate.get(m.dataIni)!;
    e.desempenho += m.desempenho;
    e.tarefas += m.totalTarefas;
    e.count++;
  }
  const evolucaoDiaria = Array.from(byDate.entries())
    .map(([data, e]) => ({
      data,
      desempenho: Math.round((e.desempenho / e.count) * 10) / 10,
      tarefas: e.tarefas,
      operadores: e.count,
    }))
    .sort((a, b) => sortDates(a.data, b.data));

  // Peak hour
  const hourCount = new Map<number, number>();
  for (const t of tasks) {
    const h = parseInt(t.horaInicio.split(':')[0]);
    hourCount.set(h, (hourCount.get(h) || 0) + 1);
  }
  let picoHora = 0;
  let picoCount = 0;
  for (const [h, c] of hourCount) {
    if (c > picoCount) { picoHora = h; picoCount = c; }
  }

  // Heatmap
  const heatmapData: { operador: string; hora: number; tarefas: number }[] = [];
  for (const op of operators) {
    for (let h = 0; h < 24; h++) {
      const count = tasks.filter(t => t.usuario === op && parseInt(t.horaInicio.split(':')[0]) === h).length;
      heatmapData.push({ operador: op, hora: h, tarefas: count });
    }
  }

  return {
    desempenhoMedio: Math.round(desempenhoMedio * 10) / 10,
    tarefasHoraMedia: Math.round(tarefasHoraMedia * 10) / 10,
    tempoMedioGeral: Math.round(tempoMedioGeral * 10) / 10,
    totalTarefas,
    operadoresAtivos,
    picoOperacional: picoCount > 0 ? `${picoHora.toString().padStart(2, '0')}:00` : '-',
    picoHora,
    evolucaoDiaria,
    heatmapData,
  };
}

// ====================================================================
// INSIGHTS
// ====================================================================

export function generateInsights(metrics: OperatorMetrics[], tasks: Task[]): Insight[] {
  const insights: Insight[] = [];
  if (metrics.length === 0) return insights;

  // Only consider operators with meaningful task counts for performance insights
  const meaningful = metrics.filter(m => m.totalTarefas >= MIN_TAREFAS_CONFIABILIDADE);

  // Best performer (only from meaningful data)
  if (meaningful.length > 0) {
    const sorted = [...meaningful].sort((a, b) => b.desempenho - a.desempenho);
    const best = sorted[0];
    if (best.desempenho > 0) {
      insights.push({
        tipo: 'positivo', icone: '🏆',
        titulo: 'Operador Destaque',
        descricao: `${best.usuario} atingiu ${best.desempenho.toFixed(1)}% de desempenho com ${best.totalTarefas} tarefas em ${best.dataIni}.`,
        operador: best.usuario,
      });
    }
  }

  // Low performers
  const lowPerformers = metrics.filter(m => m.totalTarefas >= MIN_TAREFAS_CONFIABILIDADE && m.desempenho < 70);
  if (lowPerformers.length > 0) {
    const worst = lowPerformers.sort((a, b) => a.desempenho - b.desempenho)[0];
    insights.push({
      tipo: 'negativo', icone: '⚠️',
      titulo: 'Desempenho Crítico',
      descricao: `${worst.usuario} com desempenho de ${worst.desempenho.toFixed(1)}% em ${worst.dataIni} (${worst.totalTarefas} tarefas). Necessita acompanhamento.`,
      operador: worst.usuario,
    });
  }

  // Idle time
  const idleOps = metrics.filter(m => m.tempoOcioso > 60);
  if (idleOps.length > 0) {
    insights.push({
      tipo: 'alerta', icone: '⏰',
      titulo: 'Excesso de Ociosidade',
      descricao: `${idleOps.length} registro(s) com mais de 60 minutos de ociosidade identificados.`,
    });
  }

  // Average performance
  const avgPerf = metrics.reduce((s, m) => s + m.desempenho, 0) / metrics.length;
  if (avgPerf >= 100 && meaningful.length > 0) {
    insights.push({
      tipo: 'positivo', icone: '📈',
      titulo: 'Produtividade Acima da Meta',
      descricao: `Desempenho médio de ${avgPerf.toFixed(1)}% está acima da meta de 100%.`,
    });
  } else if (avgPerf < 70 && metrics.some(m => m.totalTarefas > 0)) {
    insights.push({
      tipo: 'negativo', icone: '📉',
      titulo: 'Produtividade Abaixo do Ideal',
      descricao: `Desempenho médio de ${avgPerf.toFixed(1)}% está abaixo do mínimo aceitável de 70%.`,
    });
  }

  // Trend
  const byDate = new Map<string, number[]>();
  for (const m of metrics) {
    if (!byDate.has(m.dataIni)) byDate.set(m.dataIni, []);
    byDate.get(m.dataIni)!.push(m.desempenho);
  }
  const dateEntries = Array.from(byDate.entries())
    .map(([date, perfs]) => ({ date, avg: perfs.reduce((s, p) => s + p, 0) / perfs.length }))
    .sort((a, b) => sortDates(a.date, b.date));

  if (dateEntries.length >= 2) {
    const last = dateEntries[dateEntries.length - 1];
    const prev = dateEntries[dateEntries.length - 2];
    const diff = last.avg - prev.avg;
    if (diff > 5) {
      insights.push({
        tipo: 'positivo', icone: '🚀',
        titulo: 'Tendência de Melhora',
        descricao: `Desempenho aumentou ${diff.toFixed(1)}% em relação ao período anterior.`
      });
    } else if (diff < -5) {
      insights.push({
        tipo: 'negativo', icone: '🔴',
        titulo: 'Queda na Produtividade',
        descricao: `Desempenho caiu ${Math.abs(diff).toFixed(1)}% em relação ao período anterior.`
      });
    }
  }

  // Peak
  const hourCount = new Map<number, number>();
  for (const t of tasks) {
    const h = parseInt(t.horaInicio.split(':')[0]);
    hourCount.set(h, (hourCount.get(h) || 0) + 1);
  }
  let peakH = 0, peakC = 0;
  for (const [h, c] of hourCount) { if (c > peakC) { peakH = h; peakC = c; } }
  if (peakC > 0) {
    insights.push({
      tipo: 'neutro', icone: '🕐',
      titulo: 'Pico Operacional',
      descricao: `Maior concentração às ${peakH.toString().padStart(2, '0')}:00 com ${peakC} tarefas.`
    });
  }

  // Inconsistency
  const inconsistent = metrics.filter(m => m.inconsistencia === 'Inconsistente');
  if (inconsistent.length > 0) {
    insights.push({
      tipo: 'alerta', icone: '🔍',
      titulo: 'Registros Inconsistentes',
      descricao: `${inconsistent.length} registro(s) com inconsistência. Verificar dados importados.`
    });
  }

  // Task volume (meta 108)
  const highVolume = metrics.filter(m => m.totalTarefas >= META_DIARIA);
  if (highVolume.length > 0) {
    insights.push({
      tipo: 'positivo', icone: '🎯',
      titulo: 'Meta de Tarefas Atingida',
      descricao: `${highVolume.length} registro(s) atingiram ou superaram ${META_DIARIA} tarefas no dia.`
    });
  }

  // Low data warning
  const lowData = metrics.filter(m => m.totalTarefas > 0 && m.totalTarefas < MIN_TAREFAS_CONFIABILIDADE);
  if (lowData.length > 0) {
    insights.push({
      tipo: 'alerta', icone: '📊',
      titulo: 'Dados Insuficientes',
      descricao: `${lowData.length} registro(s) com menos de ${MIN_TAREFAS_CONFIABILIDADE} tarefas. Desempenho penalizado por consistência.`
    });
  }

  return insights;
}

// ====================================================================
// FILTER
// ====================================================================

export function filterRecords(records: RawRecord[], filters: FilterState): RawRecord[] {
  if (filters.period === 'all' && !filters.operator) return records;

  let filtered = [...records];

  if (filters.operator) {
    filtered = filtered.filter(r => r.usuario === filters.operator);
  }

  if (filters.period !== 'all' && filters.selectedDate) {
    const parsed = parseDateFilter(filters.selectedDate);
    if (parsed) {
      filtered = filtered.filter(r => {
        const rd = parseDateFilter(r.dataIni);
        if (!rd) return false;
        switch (filters.period) {
          case 'day': return r.dataIni === filters.selectedDate;
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

  return filtered;
}

function parseDateFilter(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  }
  return null;
}

function sortDates(a: string, b: string): number {
  const da = parseDateFilter(a);
  const db = parseDateFilter(b);
  if (!da || !db) return 0;
  return da.getTime() - db.getTime();
}

// ====================================================================
// EXPORT EXCEL
// ====================================================================

export function exportToExcel(
  dashData: DashboardData,
  metrics: OperatorMetrics[],
  tasks: Task[],
) {
  const wb = XLSX.utils.book_new();

  // Dashboard
  const dRows = [
    { Indicador: 'Desempenho Médio (%)', Valor: dashData.desempenhoMedio },
    { Indicador: 'Tarefas/Hora', Valor: dashData.tarefasHoraMedia },
    { Indicador: 'Tempo Médio (min)', Valor: Math.round(dashData.tempoMedioGeral * 10) / 10 },
    { Indicador: 'Total Tarefas', Valor: dashData.totalTarefas },
    { Indicador: 'Operadores Ativos', Valor: dashData.operadoresAtivos },
    { Indicador: 'Pico Operacional', Valor: dashData.picoOperacional },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dRows), 'Dashboard');

  // Ranking
  const rRows = metrics.map(m => ({
    Operador: m.usuario,
    Data: m.dataIni,
    Tarefas: m.totalTarefas,
    Volumes: m.totalVolumes,
    'Produtivo (min)': m.tempoProdutivo,
    'Ocioso (min)': m.tempoOcioso,
    'Tempo Médio (min)': Math.round(m.tempoMedio * 10) / 10,
    'Tarefas/H': Math.round(m.tarefasHora * 10) / 10,
    'Desempenho (%)': m.desempenho,
    'Fator Consist.': m.fatorConsistencia,
    Status: m.status,
    Inconsistência: m.inconsistencia,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rRows), 'Ranking');

  // Alertas
  const aRows = tasks.map(t => ({
    Operador: t.usuario,
    Data: t.dataIni,
    Produto: t.produto,
    'Hora Início': t.horaInicio,
    'Hora Fim': t.horaFim,
    'Duração (min)': t.duracao,
    Volumes: t.volumes,
    'Seg/Volume': t.segundosPorVolume > 0 ? t.segundosPorVolume.toFixed(2) : '-',
    Classificação: t.classificacao,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(aRows), 'Alertas');

  // Evolução
  const eRows = dashData.evolucaoDiaria.map(e => ({
    Data: e.data,
    'Desempenho (%)': e.desempenho,
    Tarefas: e.tarefas,
    Operadores: e.operadores,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(eRows), 'Evolução');

  XLSX.writeFile(wb, 'relatorio_produtividade.xlsx');
}

// ====================================================================
// HELPERS
// ====================================================================

export function getStatusColor(status: string): string {
  switch (status) {
    case 'Excelente': return 'text-emerald-400 bg-emerald-400/10';
    case 'Muito Bom': return 'text-blue-400 bg-blue-400/10';
    case 'Bom': return 'text-cyan-400 bg-cyan-400/10';
    case 'Atenção': return 'text-amber-400 bg-amber-400/10';
    case 'Crítico': return 'text-red-400 bg-red-400/10';
    default: return 'text-slate-400 bg-slate-400/10';
  }
}

export function getClassificationColor(cls: string): string {
  switch (cls) {
    case 'Excelente': return 'text-emerald-400 bg-emerald-400/10';
    case 'Normal': return 'text-blue-400 bg-blue-400/10';
    case 'Alerta': return 'text-amber-400 bg-amber-400/10';
    case 'Ociosidade': return 'text-red-400 bg-red-500/10';
    case 'Aviso Operacional': return 'text-orange-400 bg-orange-400/10';
    default: return 'text-slate-400 bg-slate-400/10';
  }
}

export function getPerformanceColor(value: number): string {
  if (value >= 120) return '#34d399';
  if (value >= 100) return '#60a5fa';
  if (value >= 85) return '#22d3ee';
  if (value >= 70) return '#fbbf24';
  return '#f87171';
}

export function getHeatmapColor(count: number): string {
  if (count === 0) return '#1f2937';
  if (count <= 2) return '#7f1d1d';
  if (count <= 4) return '#f59e0b';
  return '#22c55e';
}

export function todayStr(): string {
  const d = new Date();
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
}
