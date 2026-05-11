import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { db } from '@/db';
import { rawRecords } from '@/db/schema';
import { calculateAllMetrics, parseDateStr, minutesToTime, formatMinutes, type RawRecord } from '@/lib/calculations';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const operatorFilter = searchParams.get('operator');
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    // Fetch all records
    const allRecords = await db.select().from(rawRecords);

    let filtered = allRecords;

    if (operatorFilter && operatorFilter !== 'all') {
      filtered = filtered.filter((r) => r.operatorName === operatorFilter);
    }

    if (startDateStr || endDateStr) {
      filtered = filtered.filter((r) => {
        try {
          const recordDate = parseDateStr(r.dateStr);
          if (startDateStr && recordDate < parseDateStr(startDateStr)) return false;
          if (endDateStr && recordDate > parseDateStr(endDateStr)) return false;
          return true;
        } catch {
          return true;
        }
      });
    }

    const rawRecs: RawRecord[] = filtered.map((r) => ({
      id: r.id,
      operatorName: r.operatorName,
      dateStr: r.dateStr,
      timeStr: r.timeStr,
      product: r.product || '',
      volumes: r.volumes || 0,
    }));

    const metrics = calculateAllMetrics(rawRecs);

    const workbook = XLSX.utils.book_new();

    // --- Sheet 1: Dashboard ---
    const dashboardData = [
      { Métrica: 'Desempenho Médio (%)', Valor: metrics.avgPerformance },
      { Métrica: 'Tarefas/Hora Médio', Valor: metrics.avgTasksPerHour },
      { Métrica: 'Tempo Médio por Tarefa (min)', Valor: metrics.avgTimePerTask },
      { Métrica: 'Total de Tarefas', Valor: metrics.totalTasks },
      { Métrica: 'Total de Volumes', Valor: metrics.totalVolumes },
      { Métrica: 'Operadores Ativos', Valor: metrics.activeOperators },
      { Métrica: 'Horário de Pico', Valor: `${String(metrics.peakHour).padStart(2, '0')}:00` },
      { Métrica: 'Tarefas no Pico', Valor: metrics.peakCount },
    ];
    const ws1 = XLSX.utils.json_to_sheet(dashboardData);
    XLSX.utils.book_append_sheet(workbook, ws1, 'Dashboard');

    // --- Sheet 2: Ranking ---
    const rankingData = metrics.summaries.map((s) => ({
      Operador: s.operatorName,
      Data: s.dateStr,
      Tarefas: s.totalTasks,
      Volumes: s.totalVolumes,
      'Tempo Produtivo': formatMinutes(s.productiveTimeMin),
      'Tempo Ocioso': formatMinutes(s.idleTimeMin),
      'Tempo Médio (min)': s.avgTimePerTask,
      'Tarefas/Hora': s.tasksPerHour,
      'Desempenho (%)': s.performance,
      Status: s.status,
      'Inconsistência (%)': s.inconsistency.percent,
      'Classificação Inconsistência': s.inconsistency.classification,
    }));
    const ws2 = XLSX.utils.json_to_sheet(rankingData);
    XLSX.utils.book_append_sheet(workbook, ws2, 'Ranking');

    // --- Sheet 3: Alertas ---
    const alertsData: Record<string, unknown>[] = [];
    for (const s of metrics.summaries) {
      for (const interval of s.intervals) {
        alertsData.push({
          Operador: interval.operatorName,
          Data: interval.dateStr,
          'Hora Inicial': interval.startTime,
          'Hora Final': interval.endTime,
          'Duração (min)': interval.durationMin,
          Produto: interval.product,
          Volumes: interval.volumes,
          Classificação: interval.classification.toUpperCase(),
        });
      }
    }
    const ws3 = XLSX.utils.json_to_sheet(alertsData);
    XLSX.utils.book_append_sheet(workbook, ws3, 'Alertas');

    // --- Sheet 4: Evolução ---
    const evolutionData = metrics.dailyEvolution.map((e) => ({
      Data: e.date,
      'Desempenho Médio (%)': e.performance,
      'Tarefas/Hora': e.tasksPerHour,
      'Tempo Médio (min)': e.avgTime,
      'Total Tarefas': e.tasks,
    }));
    const ws4 = XLSX.utils.json_to_sheet(evolutionData);
    XLSX.utils.book_append_sheet(workbook, ws4, 'Evolução');

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename=produtividade_ressuprimento.xlsx',
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: `Erro na exportação: ${error instanceof Error ? error.message : 'Erro desconhecido'}` },
      { status: 500 }
    );
  }
}
