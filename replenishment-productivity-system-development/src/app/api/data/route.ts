import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { rawRecords, operators } from '@/db/schema';
import { eq, sql, gte, lte, and } from 'drizzle-orm';
import { parseDateStr } from '@/lib/calculations';

// ============================================================
// DELETE — Clear operational data (never deletes operators)
// ============================================================
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope') || 'all';
    const value = searchParams.get('value') || '';
    const operatorName = searchParams.get('operator') || '';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';

    let deletedCount = 0;

    if (scope === 'all') {
      const result = await db.delete(rawRecords).returning({ id: rawRecords.id });
      deletedCount = result.length;
      return NextResponse.json({
        success: true,
        message: `Todos os dados operacionais removidos. ${deletedCount} registros excluídos.`,
        deletedCount,
      });
    }

    if (scope === 'date' && value) {
      // Delete a specific date
      const result = await db.delete(rawRecords)
        .where(eq(rawRecords.dateStr, value))
        .returning({ id: rawRecords.id });
      deletedCount = result.length;
      if (deletedCount === 0) {
        return NextResponse.json({ success: true, message: `Nenhum registro encontrado para ${value}.`, deletedCount: 0 });
      }
      return NextResponse.json({
        success: true,
        message: `Dados de ${value} removidos. ${deletedCount} registros excluídos.`,
        deletedCount,
      });
    }

    if (scope === 'range' && startDate && endDate) {
      // Delete date range — filter in code since dateStr is text DD/MM/YYYY
      const allRecords = await db.select({ id: rawRecords.id, dateStr: rawRecords.dateStr }).from(rawRecords);
      const start = parseDateStr(startDate);
      const end = parseDateStr(endDate);
      const idsToDelete = allRecords
        .filter(r => {
          try {
            const d = parseDateStr(r.dateStr);
            return d >= start && d <= end;
          } catch { return false; }
        })
        .map(r => r.id);

      if (idsToDelete.length === 0) {
        return NextResponse.json({ success: true, message: 'Nenhum registro encontrado no período.', deletedCount: 0 });
      }

      // Delete in batches of 500
      for (let i = 0; i < idsToDelete.length; i += 500) {
        const batch = idsToDelete.slice(i, i + 500);
        await db.delete(rawRecords)
          .where(sql`${rawRecords.id} IN (${sql.join(batch.map(id => sql`${id}`), sql`, `)})`)
          .execute();
      }
      deletedCount = idsToDelete.length;
      return NextResponse.json({
        success: true,
        message: `Dados de ${startDate} até ${endDate} removidos. ${deletedCount} registros excluídos.`,
        deletedCount,
      });
    }

    if (scope === 'operator' && operatorName) {
      const result = await db.delete(rawRecords)
        .where(eq(rawRecords.operatorName, operatorName))
        .returning({ id: rawRecords.id });
      deletedCount = result.length;
      if (deletedCount === 0) {
        return NextResponse.json({ success: true, message: `Nenhum registro encontrado para ${operatorName}.`, deletedCount: 0 });
      }
      return NextResponse.json({
        success: true,
        message: `Dados de ${operatorName} removidos. ${deletedCount} registros excluídos.`,
        deletedCount,
      });
    }

    return NextResponse.json({ error: 'Parâmetros insuficientes. Use scope=all|date|range|operator com os parâmetros adequados.' }, { status: 400 });
  } catch (error) {
    console.error('Data delete error:', error);
    return NextResponse.json(
      { error: `Erro ao limpar dados: ${error instanceof Error ? error.message : 'Erro desconhecido'}` },
      { status: 500 }
    );
  }
}

// ============================================================
// GET — List operators and available dates
// ============================================================
export async function GET() {
  try {
    const allOperators = await db.select({ name: operators.name }).from(operators).orderBy(operators.name);

    // Get distinct dates
    const dateResult = await db
      .selectDistinct({ dateStr: rawRecords.dateStr })
      .from(rawRecords)
      .orderBy(rawRecords.dateStr);

    // Sort dates chronologically
    const dates = dateResult
      .map(r => r.dateStr)
      .sort((a, b) => {
        try { return parseDateStr(a).getTime() - parseDateStr(b).getTime(); }
        catch { return 0; }
      });

    // Get available months (MM/YYYY)
    const months = [...new Set(dates.map(d => {
      const parts = d.split('/');
      return parts.length === 3 ? `${parts[1]}/${parts[2]}` : d;
    }))];

    return NextResponse.json({
      operators: allOperators.map(o => o.name),
      dates,
      months,
    });
  } catch (error) {
    console.error('Data GET error:', error);
    return NextResponse.json(
      { error: `Erro ao buscar dados: ${error instanceof Error ? error.message : 'Erro desconhecido'}` },
      { status: 500 }
    );
  }
}
