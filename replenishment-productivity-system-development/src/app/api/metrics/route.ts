import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { rawRecords } from '@/db/schema';
import { eq, gte, lte, and, sql } from 'drizzle-orm';
import { calculateAllMetrics, parseDateStr, type RawRecord, type MetricsResponse } from '@/lib/calculations';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const operatorFilter = searchParams.get('operator');
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    // Build query conditions
    let query = db.select().from(rawRecords);

    // We need to filter, but since dateStr is stored as DD/MM/YYYY,
    // we need to fetch and filter in code for proper date comparison
    const allRecords = await db.select().from(rawRecords).orderBy(rawRecords.dateStr, rawRecords.timeStr);

    // Filter records
    let filtered: typeof allRecords = allRecords;

    if (operatorFilter && operatorFilter !== 'all') {
      filtered = filtered.filter((r) => r.operatorName === operatorFilter);
    }

    if (startDateStr || endDateStr) {
      filtered = filtered.filter((r) => {
        try {
          const recordDate = parseDateStr(r.dateStr);
          if (startDateStr) {
            const start = parseDateStr(startDateStr);
            if (recordDate < start) return false;
          }
          if (endDateStr) {
            const end = parseDateStr(endDateStr);
            if (recordDate > end) return false;
          }
          return true;
        } catch {
          return true; // Keep records with unparseable dates
        }
      });
    }

    // Convert to RawRecord format
    const rawRecs: RawRecord[] = filtered.map((r) => ({
      id: r.id,
      operatorName: r.operatorName,
      dateStr: r.dateStr,
      timeStr: r.timeStr,
      product: r.product || '',
      volumes: r.volumes || 0,
    }));

    // Calculate all metrics
    const metrics: MetricsResponse = calculateAllMetrics(rawRecs);

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Metrics error:', error);
    return NextResponse.json(
      { error: `Erro ao calcular métricas: ${error instanceof Error ? error.message : 'Erro desconhecido'}` },
      { status: 500 }
    );
  }
}
