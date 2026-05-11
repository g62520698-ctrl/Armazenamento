// ============================================================
// PRODUTIVIDADE RESSUPRIMENTO - Calculation Engine
// All business rules and formulas implemented here
// ============================================================

// --- Types ---

export interface RawRecord {
  id?: number;
  operatorName: string;
  dateStr: string;
  timeStr: string;
  product: string;
  volumes: number;
}

export interface TaskInterval {
  operatorName: string;
  dateStr: string;
  startTime: string;
  endTime: string;
  durationMin: number;
  product: string;
  volumes: number;
  classification: 'excelente' | 'bom' | 'aviso' | 'ociosidade';
}

export interface OperatorDaySummary {
  operatorName: string;
  dateStr: string;
  totalTasks: number;
  totalVolumes: number;
  productiveTimeMin: number;
  idleTimeMin: number;
  avgTimePerTask: number;
  tasksPerHour: number;
  performance: number;
  status: string;
  inconsistency: { percent: number; classification: string };
  intervals: TaskInterval[];
  firstTime: string;
  lastTime: string;
}

export interface Insight {
  type: 'success' | 'warning' | 'danger' | 'info';
  title: string;
  description: string;
}

export interface HeatmapCell {
  operator: string;
  hour: number;
  count: number;
  level: 'low' | 'medium' | 'high' | 'very-high';
}

export interface MetricsResponse {
  operators: string[];
  dates: string[];
  summaries: OperatorDaySummary[];
  heatmap: HeatmapCell[];
  insights: Insight[];
  peakHour: number;
  peakCount: number;
  avgPerformance: number;
  avgTasksPerHour: number;
  avgTimePerTask: number;
  totalTasks: number;
  totalVolumes: number;
  activeOperators: number;
  dailyEvolution: { date: string; performance: number; tasksPerHour: number; avgTime: number; tasks: number }[];
}

// --- Constants ---
export const META_TASKS_PER_HOUR = 12;
export const META_TIME_PER_TASK = 5; // minutes
export const META_DAILY_TASKS = 100;
export const JORNADA_HORAS = 9;
export const HIGH_PRODUCTION_THRESHOLD = 2000;

// --- Helpers ---

export function timeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  return h * 60 + m;
}

export function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function parseDateStr(dateStr: string): Date {
  const [d, m, y] = dateStr.split('/').map(Number);
  return new Date(y, m - 1, d);
}

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}min`;
  return `${h}h${String(m).padStart(2, '0')}m`;
}

// --- Classification ---

export function classifyInterval(durationMin: number, volumes: number): TaskInterval['classification'] {
  if (durationMin <= 5) return 'excelente';
  if (durationMin <= 8) return 'bom';
  if (durationMin <= 20) return 'aviso';
  // > 20 min: check high production exception
  if (volumes > HIGH_PRODUCTION_THRESHOLD) return 'aviso'; // Only warning
  return 'ociosidade';
}

// --- Interval Calculation ---

export function calculateIntervals(records: RawRecord[]): TaskInterval[] {
  if (records.length < 2) return [];

  const sorted = [...records].sort((a, b) => {
    return timeToMinutes(a.timeStr) - timeToMinutes(b.timeStr);
  });

  const intervals: TaskInterval[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];

    const startMin = timeToMinutes(current.timeStr);
    const endMin = timeToMinutes(next.timeStr);
    const duration = endMin - startMin;

    if (duration <= 0) continue; // Skip invalid or same-time records

    intervals.push({
      operatorName: current.operatorName,
      dateStr: current.dateStr,
      startTime: current.timeStr,
      endTime: next.timeStr,
      durationMin: duration,
      product: next.product || current.product,
      volumes: next.volumes,
      classification: classifyInterval(duration, next.volumes),
    });
  }

  return intervals;
}

// --- Summary Calculation ---

export function calculateSummary(
  operatorName: string,
  dateStr: string,
  intervals: TaskInterval[]
): OperatorDaySummary {
  const totalTasks = intervals.length;
  const totalVolumes = intervals.reduce((sum, i) => sum + i.volumes, 0);

  // Productive time: sum of intervals <= 20 minutes
  const productiveTimeMin = intervals
    .filter((i) => i.durationMin <= 20)
    .reduce((sum, i) => sum + i.durationMin, 0);

  // Idle time: sum of intervals > 20 minutes (NOT jornada - produtivo)
  const idleTimeMin = intervals
    .filter((i) => i.durationMin > 20)
    .reduce((sum, i) => sum + i.durationMin, 0);

  const avgTimePerTask = totalTasks > 0 ? productiveTimeMin / totalTasks : 0;
  const productiveHours = productiveTimeMin / 60;
  const tasksPerHour = productiveHours > 0 ? totalTasks / productiveHours : 0;

  // --- Inconsistency ---
  // Based on: expectedTime vs realTime (productiveTime)
  const expectedTime = totalTasks * META_TIME_PER_TASK;
  const realTime = productiveTimeMin;
  const inconsistencyPercent =
    expectedTime > 0 ? (Math.abs(realTime - expectedTime) / expectedTime) * 100 : 0;

  let inconsistencyClass = 'NORMAL';
  if (inconsistencyPercent > 40) inconsistencyClass = 'INCONSISTENTE';
  else if (inconsistencyPercent > 20) inconsistencyClass = 'ATENÇÃO';

  // --- Performance ---
  // Weighted: tasksPerHour (45%) + avgTime (45%) + meta (10%)
  const scoreTasksPerHour = tasksPerHour > 0 ? (tasksPerHour / META_TASKS_PER_HOUR) * 100 : 0;
  const scoreAvgTime = avgTimePerTask > 0 ? (META_TIME_PER_TASK / avgTimePerTask) * 100 : 0;
  const scoreMeta = (totalTasks / META_DAILY_TASKS) * 100;

  let performance =
    scoreTasksPerHour * 0.45 + scoreAvgTime * 0.45 + scoreMeta * 0.10;
  performance = Math.max(0, Math.min(200, performance));
  performance = Math.round(performance * 100) / 100;

  // --- Status ---
  let status = 'CRÍTICO';
  if (performance >= 120) status = 'EXCELENTE';
  else if (performance >= 100) status = 'MUITO BOM';
  else if (performance >= 85) status = 'BOM';
  else if (performance >= 70) status = 'ATENÇÃO';

  const firstTime = intervals.length > 0 ? intervals[0].startTime : '';
  const lastTime = intervals.length > 0 ? intervals[intervals.length - 1].endTime : '';

  return {
    operatorName,
    dateStr,
    totalTasks,
    totalVolumes,
    productiveTimeMin: Math.round(productiveTimeMin),
    idleTimeMin: Math.round(idleTimeMin),
    avgTimePerTask: Math.round(avgTimePerTask * 100) / 100,
    tasksPerHour: Math.round(tasksPerHour * 100) / 100,
    performance,
    status,
    inconsistency: {
      percent: Math.round(inconsistencyPercent * 100) / 100,
      classification: inconsistencyClass,
    },
    intervals,
    firstTime,
    lastTime,
  };
}

// --- Full Metrics Calculation ---

export function calculateAllMetrics(records: RawRecord[]): MetricsResponse {
  // Group records by operator + date
  const grouped = new Map<string, RawRecord[]>();

  for (const record of records) {
    const key = `${record.operatorName}|||${record.dateStr}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(record);
  }

  // Calculate summaries for each group
  const summaries: OperatorDaySummary[] = [];
  const operatorsSet = new Set<string>();
  const datesSet = new Set<string>();

  for (const [key, groupRecords] of grouped) {
    const [operatorName, dateStr] = key.split('|||');
    operatorsSet.add(operatorName);
    datesSet.add(dateStr);

    const intervals = calculateIntervals(groupRecords);
    const summary = calculateSummary(operatorName, dateStr, intervals);
    summaries.push(summary);
  }

  // Sort summaries by date (desc) then performance (desc)
  summaries.sort((a, b) => {
    const dateA = parseDateStr(a.dateStr);
    const dateB = parseDateStr(b.dateStr);
    if (dateB.getTime() !== dateA.getTime()) return dateB.getTime() - dateA.getTime();
    return b.performance - a.performance;
  });

  // --- Heatmap ---
  const heatmap: HeatmapCell[] = [];
  const heatmapMap = new Map<string, number>();

  for (const summary of summaries) {
    for (const interval of summary.intervals) {
      const hour = parseInt(interval.startTime.split(':')[0], 10);
      const key = `${summary.operatorName}|||${hour}`;
      heatmapMap.set(key, (heatmapMap.get(key) || 0) + 1);
    }
  }

  for (const [key, count] of heatmapMap) {
    const [operator, hourStr] = key.split('|||');
    const hour = parseInt(hourStr, 10);
    let level: HeatmapCell['level'] = 'low';
    if (count >= 10) level = 'very-high';
    else if (count >= 7) level = 'high';
    else if (count >= 4) level = 'medium';

    heatmap.push({ operator, hour, count, level });
  }

  // --- Peak Hour ---
  const hourCounts = new Map<number, number>();
  for (const summary of summaries) {
    for (const interval of summary.intervals) {
      const hour = parseInt(interval.startTime.split(':')[0], 10);
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    }
  }

  let peakHour = 0;
  let peakCount = 0;
  for (const [hour, count] of hourCounts) {
    if (count > peakCount) {
      peakHour = hour;
      peakCount = count;
    }
  }

  // --- Averages ---
  const avgPerformance =
    summaries.length > 0
      ? Math.round((summaries.reduce((s, x) => s + x.performance, 0) / summaries.length) * 100) / 100
      : 0;
  const avgTasksPerHour =
    summaries.length > 0
      ? Math.round((summaries.reduce((s, x) => s + x.tasksPerHour, 0) / summaries.length) * 100) / 100
      : 0;
  const avgTimePerTask =
    summaries.length > 0
      ? Math.round((summaries.reduce((s, x) => s + x.avgTimePerTask, 0) / summaries.length) * 100) / 100
      : 0;
  const totalTasks = summaries.reduce((s, x) => s + x.totalTasks, 0);
  const totalVolumes = summaries.reduce((s, x) => s + x.totalVolumes, 0);

  // --- Daily Evolution ---
  const dailyMap = new Map<
    string,
    { performance: number; tasksPerHour: number; avgTime: number; tasks: number; count: number }
  >();

  for (const summary of summaries) {
    const existing = dailyMap.get(summary.dateStr);
    if (existing) {
      existing.performance += summary.performance;
      existing.tasksPerHour += summary.tasksPerHour;
      existing.avgTime += summary.avgTimePerTask;
      existing.tasks += summary.totalTasks;
      existing.count += 1;
    } else {
      dailyMap.set(summary.dateStr, {
        performance: summary.performance,
        tasksPerHour: summary.tasksPerHour,
        avgTime: summary.avgTimePerTask,
        tasks: summary.totalTasks,
        count: 1,
      });
    }
  }

  const dailyEvolution = Array.from(dailyMap.entries())
    .map(([date, data]) => ({
      date,
      performance: Math.round((data.performance / data.count) * 100) / 100,
      tasksPerHour: Math.round((data.tasksPerHour / data.count) * 100) / 100,
      avgTime: Math.round((data.avgTime / data.count) * 100) / 100,
      tasks: data.tasks,
    }))
    .sort((a, b) => parseDateStr(a.date).getTime() - parseDateStr(b.date).getTime());

  // --- Insights ---
  const insights = generateInsights(summaries, peakHour, peakCount);

  return {
    operators: Array.from(operatorsSet).sort(),
    dates: Array.from(datesSet).sort((a, b) => parseDateStr(a).getTime() - parseDateStr(b).getTime()),
    summaries,
    heatmap,
    insights,
    peakHour,
    peakCount,
    avgPerformance,
    avgTasksPerHour,
    avgTimePerTask,
    totalTasks,
    totalVolumes,
    activeOperators: operatorsSet.size,
    dailyEvolution,
  };
}

// --- Insights Generator ---

function generateInsights(
  summaries: OperatorDaySummary[],
  peakHour: number,
  peakCount: number
): Insight[] {
  const insights: Insight[] = [];

  if (summaries.length === 0) return insights;

  // Best performer
  const best = summaries.reduce((b, s) => (s.performance > b.performance ? s : b), summaries[0]);
  insights.push({
    type: 'success',
    title: 'Destaque de Produtividade',
    description: `${best.operatorName} obteve a melhor performance com ${best.performance}% em ${best.dateStr} (${best.totalTasks} tarefas).`,
  });

  // Worst performer (only if critical)
  const worst = summaries.reduce((w, s) => (s.performance < w.performance ? s : w), summaries[0]);
  if (worst.performance < 70) {
    insights.push({
      type: 'danger',
      title: 'Produtividade Crítica',
      description: `${worst.operatorName} registrou performance de ${worst.performance}% em ${worst.dateStr}. Necessita atenção imediata.`,
    });
  }

  // Excessive idle time
  const idleAlerts = summaries.filter((s) => s.idleTimeMin > 60);
  if (idleAlerts.length > 0) {
    const worst = idleAlerts.reduce((w, s) => (s.idleTimeMin > w.idleTimeMin ? s : w), idleAlerts[0]);
    insights.push({
      type: 'warning',
      title: 'Excesso de Ociosidade',
      description: `${worst.operatorName} teve ${formatMinutes(worst.idleTimeMin)} de ociosidade em ${worst.dateStr}. ${idleAlerts.length} registro(s) com ociosidade excessiva.`,
    });
  }

  // Peak hour
  if (peakCount > 0) {
    insights.push({
      type: 'info',
      title: 'Pico Operacional Detectado',
      description: `Horário de maior produtividade: ${String(peakHour).padStart(2, '0')}:00 com ${peakCount} tarefas registradas.`,
    });
  }

  // Inconsistency alerts
  const inconsistent = summaries.filter((s) => s.inconsistency.classification === 'INCONSISTENTE');
  if (inconsistent.length > 0) {
    insights.push({
      type: 'danger',
      title: 'Inconsistência de Tempo',
      description: `${inconsistent.length} registro(s) com inconsistência crítica (>40% de variação entre tempo produtivo e esperado).`,
    });
  }

  // Trends (need at least 2 dates)
  const operatorTrends = new Map<string, { perfs: number[]; dates: string[] }>();
  for (const s of summaries) {
    if (!operatorTrends.has(s.operatorName)) {
      operatorTrends.set(s.operatorName, { perfs: [], dates: [] });
    }
    const trend = operatorTrends.get(s.operatorName)!;
    trend.perfs.push(s.performance);
    trend.dates.push(s.dateStr);
  }

  for (const [operator, data] of operatorTrends) {
    if (data.perfs.length >= 2) {
      const first = data.perfs[0];
      const last = data.perfs[data.perfs.length - 1];
      const diff = last - first;
      if (diff > 15) {
        insights.push({
          type: 'success',
          title: 'Tendência de Melhora',
          description: `${operator} melhorou performance em ${Math.round(diff)} pontos percentuais (${data.dates[0]} → ${data.dates[data.dates.length - 1]}).`,
        });
      } else if (diff < -15) {
        insights.push({
          type: 'warning',
          title: 'Tendência de Queda',
          description: `${operator} teve queda de ${Math.round(Math.abs(diff))} pontos percentuais na performance (${data.dates[0]} → ${data.dates[data.dates.length - 1]}).`,
        });
      }
    }
  }

  // High achievers
  const excellentCount = summaries.filter((s) => s.performance >= 120).length;
  if (excellentCount > 0) {
    insights.push({
      type: 'success',
      title: 'Operadores Excelentes',
      description: `${excellentCount} registro(s) com performance EXCELENTE (≥120%). Parabéns à equipe!`,
    });
  }

  // Average below target
  if (summaries.length > 0) {
    const avg = summaries.reduce((s, x) => s + x.performance, 0) / summaries.length;
    if (avg < 85) {
      insights.push({
        type: 'warning',
        title: 'Média Abaixo da Meta',
        description: `Performance média do período: ${Math.round(avg)}%. Abaixo da meta de 85%. Considere revisar processos operacionais.`,
      });
    } else if (avg >= 100) {
      insights.push({
        type: 'success',
        title: 'Meta Atingida',
        description: `Performance média do período: ${Math.round(avg)}%. Equipe acima da meta de 100%!`,
      });
    }
  }

  return insights;
}
