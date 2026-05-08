import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import * as XLSX from 'xlsx';
import { collection, writeBatch, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { TaskRecord, UserMetrics, TaskInterval, TaskClassification, OpStatus, FilterPeriod } from './types';

dayjs.extend(customParseFormat);

const JORNADA = 540;
const META_TAREFAS_HORA = 12;
// Volumes are display-only — NOT used in performance calculation
const HIGH_PROD_TASKS = 200;
const HIGH_PROD_VOLS = 2000;
const IDLE_THRESHOLD = 20;
const IDLE_FACTOR = 0.3;

// ─── Data Treatment ──────────────────────────────────────────
export function tratarData(v: unknown): string {
  if (typeof v === 'number') return dayjs('1899-12-30').add(v, 'day').format('YYYY-MM-DD');
  const s = String(v ?? '');
  for (const f of ['DD/MM/YYYY', 'YYYY-MM-DD']) { const d = dayjs(s, [f], true); if (d.isValid()) return d.format('YYYY-MM-DD'); }
  const fb = dayjs(s); return fb.isValid() ? fb.format('YYYY-MM-DD') : '';
}
export function tratarHora(v: unknown): string {
  if (typeof v === 'number') { const t = Math.round(v * 86400); return `${String(Math.floor(t / 3600)).padStart(2, '0')}:${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; }
  return String(v ?? '').trim();
}

// ─── Classification helpers ──────────────────────────────────
function classifyDur(d: number): TaskClassification {
  if (d <= 5) return 'excelente'; if (d <= 8) return 'bom'; if (d <= 20) return 'aviso'; return 'ocioso';
}
export function getClassLabel(c: string): string {
  const m: Record<string, string> = { excelente: 'Excelente', bom: 'Bom', aviso: 'Aviso', ocioso: 'Ocioso', aviso_op: 'Aviso Operacional' };
  return m[c] ?? '';
}
export function getClassColor(c: string): string {
  const m: Record<string, string> = { excelente: 'text-emerald-400', bom: 'text-sky-400', aviso: 'text-yellow-400', ocioso: 'text-red-400', aviso_op: 'text-orange-300' };
  return m[c] ?? 'text-gray-400';
}
export function getClassBg(c: string): string {
  const m: Record<string, string> = { excelente: 'bg-emerald-500/10 border-emerald-500/20', bom: 'bg-sky-500/10 border-sky-500/20', aviso: 'bg-yellow-500/10 border-yellow-500/20', ocioso: 'bg-red-500/10 border-red-500/20', aviso_op: 'bg-orange-500/10 border-orange-500/20' };
  return m[c] ?? 'bg-gray-500/10 border-gray-500/20';
}
export function getClassDot(c: string): string {
  const m: Record<string, string> = { excelente: 'bg-emerald-400', bom: 'bg-sky-400', aviso: 'bg-yellow-400', ocioso: 'bg-red-400', aviso_op: 'bg-orange-300' };
  return m[c] ?? 'bg-gray-400';
}
export function getTypeLabel(t: string): string { return t === 'tarefa' ? 'Tarefa' : 'Intervalo'; }
export function getStatusLabel(s: OpStatus): string { return { excelente: 'Excelente', bom: 'Bom', atencao: 'Atenção', critico: 'Crítico' }[s]; }
export function getStatusColor(s: OpStatus): string { return { excelente: 'text-emerald-400', bom: 'text-sky-400', atencao: 'text-amber-400', critico: 'text-red-400' }[s]; }
export function getStatusBg(s: OpStatus): string { return { excelente: 'bg-emerald-500/20 border-emerald-500/30', bom: 'bg-sky-500/20 border-sky-500/30', atencao: 'bg-amber-500/20 border-amber-500/30', critico: 'bg-red-500/20 border-red-500/30' }[s]; }

function calcStatus(d: number): OpStatus {
  if (d >= 120) return 'excelente'; if (d >= 90) return 'bom'; if (d >= 70) return 'atencao'; return 'critico';
}

// ─── Empty ───────────────────────────────────────────────────
function empty(u: string, d: string): UserMetrics {
  return { usuario: u, data: d, totalTarefas: 0, totalVolumes: 0, tempoProdutivo: 0, tempoOcioso: 0, tempoMedio: 0, tarefasHora: 0, volumesHora: 0, segPorVolume: 0, desempenho: 0, status: 'critico', valid: true, intervals: [] };
}

// ─── Core Calculation ────────────────────────────────────────
export function calculateUserMetrics(usuario: string, data: string, records: TaskRecord[]): UserMetrics {
  const sorted = [...records].sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
  const n = sorted.length;
  if (n === 0) return empty(usuario, data);
  if (n === 1) return { ...empty(usuario, data), totalVolumes: sorted[0].qtdVolumes || 0, valid: true };

  // Each interval between records = 1 task
  const totalTarefas = n - 1;
  const totalVolumes = sorted.reduce((s, r) => s + (r.qtdVolumes || 0), 0);
  const isHighProd = totalTarefas > HIGH_PROD_TASKS || totalVolumes > HIGH_PROD_VOLS;

  const first = dayjs(sorted[0].datetime);
  const last = dayjs(sorted[n - 1].datetime);
  const shiftEnd = first.add(JORNADA, 'minute');

  let prodMin = 0;
  let idleMin = 0;
  const intervals: TaskInterval[] = [];

  // Between-task intervals (= tasks)
  for (let i = 0; i < totalTarefas; i++) {
    const cur = dayjs(sorted[i].datetime);
    const nxt = dayjs(sorted[i + 1].datetime);
    const dur = nxt.diff(cur, 'second') / 60;

    if (dur > IDLE_THRESHOLD) {
      if (isHighProd) {
        // Intelligent idle: 30% idle, 70% productive
        idleMin += dur * IDLE_FACTOR;
        prodMin += dur * (1 - IDLE_FACTOR);
        intervals.push({ from: cur.format('HH:mm'), to: nxt.format('HH:mm'), durationMin: Math.round(dur * 10) / 10, type: 'ocioso', classification: 'aviso_op', produto: sorted[i + 1].produto, qtdVolumes: sorted[i + 1].qtdVolumes });
      } else {
        idleMin += dur;
        intervals.push({ from: cur.format('HH:mm'), to: nxt.format('HH:mm'), durationMin: Math.round(dur * 10) / 10, type: 'ocioso', classification: 'ocioso', produto: sorted[i + 1].produto, qtdVolumes: sorted[i + 1].qtdVolumes });
      }
    } else {
      prodMin += dur;
      intervals.push({ from: cur.format('HH:mm'), to: nxt.format('HH:mm'), durationMin: Math.round(dur * 10) / 10, type: 'tarefa', classification: classifyDur(dur), produto: sorted[i + 1].produto, qtdVolumes: sorted[i + 1].qtdVolumes });
    }
  }

  // Idle after last task — only if > 20 min
  const idleAfterMin = Math.max(0, shiftEnd.diff(last, 'second') / 60);
  if (idleAfterMin > IDLE_THRESHOLD) {
    idleMin += idleAfterMin;
    intervals.push({ from: last.format('HH:mm'), to: shiftEnd.format('HH:mm'), durationMin: Math.round(idleAfterMin * 10) / 10, type: 'ocioso', classification: 'ocioso', produto: '—', qtdVolumes: 0 });
  } else if (idleAfterMin > 0) {
    prodMin += idleAfterMin;
  }

  prodMin = Math.round(prodMin * 100) / 100;
  idleMin = Math.round(idleMin * 100) / 100;

  // Cap at 9h
  const totalAcct = prodMin + idleMin;
  let valid = true;
  if (totalAcct > JORNADA + 1) {
    const scale = JORNADA / totalAcct;
    prodMin = Math.round(prodMin * scale * 100) / 100;
    idleMin = Math.round(idleMin * scale * 100) / 100;
    valid = false;
  } else {
    valid = Math.abs(prodMin + idleMin - JORNADA) < 2;
  }

  // Performance — based ONLY on tasks and time (NOT volumes)
  const tMedioSeg = totalTarefas > 0 ? (prodMin * 60) / totalTarefas : 0;
  const tMedioMin = tMedioSeg / 60;
  const hProd = prodMin / 60;
  const tHora = hProd > 0 ? totalTarefas / hProd : 0;
  const vHora = hProd > 0 ? totalVolumes / hProd : 0;
  const segVol = totalVolumes > 0 ? (prodMin * 60) / totalVolumes : 0;

  const sTH = tHora > 0 ? (tHora / META_TAREFAS_HORA) * 100 : 0;
  const sTM = tMedioMin > 0 ? (5 / tMedioMin) * 100 : 0;
  const sTD = totalTarefas > 0 ? (totalTarefas / 100) * 100 : 0;
  const desempenho = Math.min(sTH * 0.45 + sTM * 0.45 + sTD * 0.10, 200);

  // Validation log
  console.log('[Metrics]', { operador: usuario, data, totalRegistros: n, totalTarefas, tempoProdutivoMin: Math.round(prodMin), tempoOciosoMin: Math.round(idleMin), tarefasHora: Math.round(tHora * 100) / 100, tempoMedioMin: Math.round(tMedioMin * 10) / 10, desempenho: Math.round(desempenho * 10) / 10 });

  return {
    usuario, data, totalTarefas, totalVolumes,
    tempoProdutivo: prodMin, tempoOcioso: idleMin,
    tempoMedio: tMedioSeg, tarefasHora: Math.round(tHora * 100) / 100,
    volumesHora: Math.round(vHora * 100) / 100,
    segPorVolume: Math.round(segVol * 10) / 10,
    desempenho: Math.round(desempenho * 10) / 10,
    status: calcStatus(desempenho), valid, intervals,
  };
}

export function calculateAllMetrics(records: TaskRecord[]): UserMetrics[] {
  const g = new Map<string, TaskRecord[]>();
  for (const r of records) { const k = `${r.usuario}|||${r.data}`; if (!g.has(k)) g.set(k, []); g.get(k)!.push(r); }
  return [...g.entries()].map(([, rs]) => { const s = [...rs].sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()); return calculateUserMetrics(s[0].usuario, s[0].data, s); }).sort((a, b) => b.desempenho - a.desempenho);
}

export function aggregateMetrics(ms: UserMetrics[]): UserMetrics {
  if (ms.length === 0) return empty('', '');
  const tt = ms.reduce((s, m) => s + m.totalTarefas, 0);
  const tv = ms.reduce((s, m) => s + m.totalVolumes, 0);
  const tp = ms.reduce((s, m) => s + m.tempoProdutivo, 0);
  const ti = ms.reduce((s, m) => s + m.tempoOcioso, 0);
  const cnt = ms.length;
  const totalJ = cnt * JORNADA;
  const tMed = tt > 0 ? (tp * 60) / tt : 0;
  const hP = tp / 60;
  const tH = hP > 0 ? tt / hP : 0;
  const vH = hP > 0 ? tv / hP : 0;
  const sV = tv > 0 ? (tp * 60) / tv : 0;
  const sTH = tH > 0 ? (tH / META_TAREFAS_HORA) * 100 : 0;
  const sTM = (tMed / 60) > 0 ? (5 / (tMed / 60)) * 100 : 0;
  const sTD = tt > 0 ? (tt / cnt / 100) * 100 : 0;
  const desc = Math.min(sTH * 0.45 + sTM * 0.45 + sTD * 0.10, 200);
  return {
    usuario: cnt === 1 ? ms[0].usuario : 'Equipe', data: cnt === 1 ? ms[0].data : '',
    totalTarefas: tt, totalVolumes: tv,
    tempoProdutivo: Math.round(tp * 100) / 100, tempoOcioso: Math.round(ti * 100) / 100,
    tempoMedio: tMed, tarefasHora: Math.round(tH * 100) / 100,
    volumesHora: Math.round(vH * 100) / 100, segPorVolume: Math.round(sV * 10) / 10,
    desempenho: Math.round(desc * 10) / 10,
    status: calcStatus(desc),
    valid: Math.abs(tp + ti - totalJ) < cnt * 2,
    intervals: ms.flatMap(m => m.intervals),
  };
}

export function aggregateByUser(ms: UserMetrics[]): UserMetrics[] {
  const m = new Map<string, UserMetrics[]>();
  for (const x of ms) { if (!m.has(x.usuario)) m.set(x.usuario, []); m.get(x.usuario)!.push(x); }
  return [...m.values()].map(xs => aggregateMetrics(xs));
}

// ─── Filters ─────────────────────────────────────────────────
export function getDateRange(p: FilterPeriod, d: string) {
  const dj = dayjs(d);
  if (p === 'dia') return { start: d, end: d };
  if (p === 'semana') { const w = dj.day(); const mo = dj.subtract(w === 0 ? 6 : w - 1, 'day'); return { start: mo.format('YYYY-MM-DD'), end: mo.add(6, 'day').format('YYYY-MM-DD') }; }
  return { start: dj.startOf('month').format('YYYY-MM-DD'), end: dj.endOf('month').format('YYYY-MM-DD') };
}
export function filterRecords(recs: TaskRecord[], period: FilterPeriod, date: string, user?: string) {
  let f = [...recs]; if (user) f = f.filter(r => r.usuario === user);
  const { start, end } = getDateRange(period, date);
  return f.filter(r => r.data >= start && r.data <= end);
}

// ─── Formatting ──────────────────────────────────────────────
export function formatTime(m: number): string { const t = Math.round(Math.abs(m)); return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; }
export function formatMin(s: number): string { const m = Math.abs(s) / 60; return m < 60 ? `${m.toFixed(1)} min` : `${Math.floor(m / 60)}h${String(Math.round(m % 60)).padStart(2, '0')}`; }

// ─── Colors ──────────────────────────────────────────────────
export function getDesempenhoColor(d: number) { return d >= 100 ? 'text-emerald-400' : d >= 80 ? 'text-amber-400' : d >= 60 ? 'text-orange-400' : 'text-red-400'; }
export function getDesempenhoBg(d: number) { return d >= 100 ? 'bg-emerald-500/20 border-emerald-500/30' : d >= 80 ? 'bg-amber-500/20 border-amber-500/30' : d >= 60 ? 'bg-orange-500/20 border-orange-500/30' : 'bg-red-500/20 border-red-500/30'; }
export function getDesempenhoBar(d: number) { return d >= 100 ? '#10b981' : d >= 80 ? '#f59e0b' : d >= 60 ? '#f97316' : '#ef4444'; }

// ─── Peak / Product ──────────────────────────────────────────
export function getPeakHour(recs: TaskRecord[]) {
  const c = new Map<number, number>(); for (const r of recs) { const h = new Date(r.datetime).getHours(); if (h >= 5 && h <= 18) c.set(h, (c.get(h) || 0) + 1); }
  let p = { hour: 0, count: 0 }; for (const [h, n] of c) if (n > p.count) p = { hour: h, count: n };
  return p.count > 0 ? { ...p, label: `${String(p.hour).padStart(2, '0')}:00–${String(p.hour + 1).padStart(2, '0')}:00` } : null;
}
export function getTopProduct(recs: TaskRecord[]) {
  const c = new Map<string, number>(); for (const r of recs) if (r.produto) c.set(r.produto, (c.get(r.produto) || 0) + 1);
  const s = [...c.entries()].sort((a, b) => b[1] - a[1]); return s.length > 0 ? { product: s[0][0], count: s[0][1] } : null;
}

// ─── Import ──────────────────────────────────────────────────
export async function importExcelFile(file: File) {
  const buf = await file.arrayBuffer(); const wb = XLSX.read(buf); const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws);
  const regs: { usuario: string; data: string; hora: string; produto: string; qtdVolumes: number; datetime: string }[] = [];
  const users = new Set<string>();
  for (const row of rows) {
    const usuario = String(row['USUARIO'] ?? '').replace(/\s+/g, ' ').trim(); if (!usuario) continue;
    const data = tratarData(row['DATAINI']); if (!data) continue;
    const hora = tratarHora(row['HORA_INI']); const produto = String(row['PRODUTO'] ?? '').trim();
    const qtdVolumes = Number(row['QTD_VOLUMES_PDR_EXP'] ?? 0);
    const dt = dayjs(`${data} ${hora}`, 'YYYY-MM-DD HH:mm:ss'); if (!dt.isValid()) continue;
    regs.push({ usuario, data, hora, produto, qtdVolumes, datetime: dt.toISOString() }); users.add(usuario);
  }
  regs.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
  for (let i = 0; i < regs.length; i += 450) { const batch = writeBatch(db); regs.slice(i, i + 450).forEach(r => batch.set(doc(collection(db, 'registros')), r)); await batch.commit(); }
  const usuarios = [...users];
  for (const u of usuarios) { const ref = doc(db, 'separadores', u); if (!(await getDoc(ref)).exists()) await setDoc(ref, { nome: u, dataCadastro: new Date().toISOString() }); }
  return { count: regs.length, usuarios };
}

// ─── Export ──────────────────────────────────────────────────
export function exportToExcel(metrics: UserMetrics[], allMetrics: UserMetrics[]) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(metrics.map(m => ({
    Operador: m.usuario, Data: m.data, Tarefas: m.totalTarefas, Volumes: m.totalVolumes,
    Produtivo: formatTime(m.tempoProdutivo), Ocioso: formatTime(m.tempoOcioso),
    'Tarefas/H': m.tarefasHora.toFixed(2), 'Volumes/H': m.volumesHora.toFixed(2),
    'Tempo Médio': formatTime(m.tempoMedio / 60), 'Seg/Volume': m.segPorVolume.toFixed(1),
    'Desempenho %': m.desempenho.toFixed(1), Status: getStatusLabel(m.status),
  }))), 'Resumo');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([...allMetrics].sort((a, b) => b.desempenho - a.desempenho).map((m, i) => ({
    '#': i + 1, Operador: m.usuario, Data: m.data, Tarefas: m.totalTarefas, Volumes: m.totalVolumes,
    Produtivo: formatTime(m.tempoProdutivo), Ocioso: formatTime(m.tempoOcioso),
    'Tarefas/H': m.tarefasHora.toFixed(2), 'Volumes/H': m.volumesHora.toFixed(2),
    'Tempo Médio': formatTime(m.tempoMedio / 60), 'Desempenho %': m.desempenho.toFixed(1), Status: getStatusLabel(m.status),
  }))), 'Ranking');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(metrics.flatMap(m => m.intervals.map(i => ({
    Operador: m.usuario, Data: m.data, Tipo: getTypeLabel(i.type),
    Início: i.from, Fim: i.to, Produto: i.produto, Volumes: i.qtdVolumes,
    'Duração (min)': i.durationMin.toFixed(1), Classificação: getClassLabel(i.classification),
  })))), 'Alertas');
  const byDate = new Map<string, UserMetrics[]>(); allMetrics.forEach(m => { if (m.data) { if (!byDate.has(m.data)) byDate.set(m.data, []); byDate.get(m.data)!.push(m); } });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([...byDate.entries()].sort().map(([dt, ms]) => {
    const a = aggregateMetrics(ms);
    return { Data: dt, Operadores: ms.length, Tarefas: a.totalTarefas, Volumes: a.totalVolumes, Produtivo: formatTime(a.tempoProdutivo), Ocioso: formatTime(a.tempoOcioso), 'Desempenho %': a.desempenho.toFixed(1) };
  })), 'Evolução');
  XLSX.writeFile(wb, 'produtividade_ressuprimento.xlsx');
}

// ─── Insights ────────────────────────────────────────────────
export function generateInsights(ms: UserMetrics[]): string[] {
  if (ms.length === 0) return ['📥 Nenhum dado disponível. Importe uma planilha.'];
  const ins: string[] = [];
  const avg = ms.reduce((s, m) => s + m.desempenho, 0) / ms.length;
  if (avg >= 120) ins.push('✅ Desempenho excelente da equipe!');
  else if (avg >= 90) ins.push('🟢 Bom desempenho geral.');
  else if (avg >= 70) ins.push('⚠️ Desempenho em atenção.');
  else ins.push('🔴 Desempenho crítico. Ação necessária.');
  const sorted = [...ms].sort((a, b) => b.desempenho - a.desempenho);
  ins.push(`📈 Melhor: ${sorted[0].usuario} (${sorted[0].desempenho.toFixed(1)}%)`);
  if (sorted.length >= 2) ins.push(`📉 Menor: ${sorted[sorted.length - 1].usuario} (${sorted[sorted.length - 1].desempenho.toFixed(1)}%)`);
  const hp = ms.filter(m => m.totalTarefas > HIGH_PROD_TASKS || m.totalVolumes > HIGH_PROD_VOLS);
  if (hp.length > 0) ins.push(`⭐ ${hp.length} operador(es) de alta produção (>${HIGH_PROD_TASKS} tarefas ou >${HIGH_PROD_VOLS} volumes) — ociosidade reduzida.`);
  const worst = [...ms].sort((a, b) => b.tempoOcioso - a.tempoOcioso)[0];
  if (worst.tempoOcioso > 60) ins.push(`💤 Maior ociosidade: ${worst.usuario} (${formatTime(worst.tempoOcioso)})`);
  const inv = ms.filter(m => !m.valid).length; if (inv > 0) ins.push(`⚠️ ${inv} registro(s) com inconsistência de tempo.`);
  const hc = new Map<number, number>(); ms.flatMap(m => m.intervals).filter(i => i.type === 'tarefa').forEach(i => { const h = parseInt(i.from.split(':')[0]); hc.set(h, (hc.get(h) || 0) + 1); });
  const bh = [...hc.entries()].sort((a, b) => b[1] - a[1])[0]; if (bh) ins.push(`🔥 Pico: ${String(bh[0]).padStart(2, '0')}:00 (${bh[1]} tarefas)`);
  const pc = new Map<string, number>(); ms.flatMap(m => m.intervals).forEach(i => { if (i.produto && i.produto !== '—') pc.set(i.produto, (pc.get(i.produto) || 0) + 1); });
  const tp = [...pc.entries()].sort((a, b) => b[1] - a[1])[0]; if (tp) ins.push(`📦 Produto top: "${tp[0]}" (${tp[1]}×)`);
  const tv = ms.reduce((s, m) => s + m.totalVolumes, 0); const tt = ms.reduce((s, m) => s + m.totalTarefas, 0);
  ins.push(`📦 Total: ${tt} tarefas | ${tv} volumes | Desempenho médio: ${avg.toFixed(1)}%`);
  return ins;
}

export function getUniqueDates(r: TaskRecord[]): string[] { return [...new Set(r.map(x => x.data))].sort().reverse(); }
