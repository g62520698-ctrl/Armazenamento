import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { db } from '@/db';
import { rawRecords, operators } from '@/db/schema';
import { sql } from 'drizzle-orm';

// ============================================================
// Robust date parser — never uses new Date() for string dates
// ============================================================
function parseExcelDate(value: unknown): string {
  // String date: try multiple formats
  if (typeof value === 'string' && value.trim()) {
    const s = value.trim();

    // DD/MM/YYYY or DD/MM/YY
    const dmySlash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (dmySlash) {
      const d = dmySlash[1].padStart(2, '0');
      const m = dmySlash[2].padStart(2, '0');
      let y = dmySlash[3];
      if (y.length === 2) y = '20' + y;
      return `${d}/${m}/${y}`;
    }

    // DD-MM-YYYY or DD-MM-YY
    const dmyDash = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
    if (dmyDash) {
      const d = dmyDash[1].padStart(2, '0');
      const m = dmyDash[2].padStart(2, '0');
      let y = dmyDash[3];
      if (y.length === 2) y = '20' + y;
      return `${d}/${m}/${y}`;
    }

    // YYYY-MM-DD → convert to DD/MM/YYYY
    const ymdDash = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (ymdDash) {
      const d = ymdDash[3].padStart(2, '0');
      const m = ymdDash[2].padStart(2, '0');
      const y = ymdDash[1];
      return `${d}/${m}/${y}`;
    }

    // DD.MM.YYYY
    const dmyDot = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
    if (dmyDot) {
      const d = dmyDot[1].padStart(2, '0');
      const m = dmyDot[2].padStart(2, '0');
      let y = dmyDot[3];
      if (y.length === 2) y = '20' + y;
      return `${d}/${m}/${y}`;
    }

    return s;
  }

  // Excel serial date number
  if (typeof value === 'number' && value > 10000) {
    // Excel epoch: 30 Dec 1899
    const epochMs = -2209161600000; // 1899-12-30T00:00:00Z
    const ms = epochMs + value * 86400000;
    const dateObj = new Date(ms);
    const d = String(dateObj.getUTCDate()).padStart(2, '0');
    const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const y = dateObj.getUTCFullYear();
    return `${d}/${m}/${y}`;
  }

  // Date object (from XLSX with {raw: false})
  if (value instanceof Date) {
    const d = String(value.getDate()).padStart(2, '0');
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const y = value.getFullYear();
    return `${d}/${m}/${y}`;
  }

  return String(value || '').trim();
}

// ============================================================
// Robust time parser
// ============================================================
function parseExcelTime(value: unknown): string {
  // String time
  if (typeof value === 'string' && value.trim()) {
    const s = value.trim();

    // HH:MM or HH:MM:SS
    const hm = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (hm) {
      return `${hm[1].padStart(2, '0')}:${hm[2].padStart(2, '0')}`;
    }

    // HH.MM or HH.MM.SS
    const dot = s.match(/^(\d{1,2})\.(\d{2})(?:\.(\d{2}))?$/);
    if (dot) {
      return `${dot[1].padStart(2, '0')}:${dot[2].padStart(2, '0')}`;
    }

    // Just a number like "700" → "07:00"
    const numOnly = s.match(/^(\d{1,2})(\d{2})$/);
    if (numOnly) {
      return `${numOnly[1].padStart(2, '0')}:${numOnly[2]}`;
    }

    return s;
  }

  // Excel time fraction (0.0 to 1.0)
  if (typeof value === 'number') {
    if (value >= 0 && value < 1) {
      const totalSec = Math.round(value * 86400);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    // Could be HHMM integer like 700 → 07:00
    if (value >= 100 && value <= 2359) {
      const str = String(Math.round(value));
      const h = str.slice(0, -2).padStart(2, '0');
      const m = str.slice(-2);
      return `${h}:${m}`;
    }
  }

  // Date object (time portion)
  if (value instanceof Date) {
    const h = String(value.getHours()).padStart(2, '0');
    const m = String(value.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  return String(value || '').trim();
}

// ============================================================
// Fuzzy column name matching
// ============================================================
function detectColumns(keys: string[]): Record<string, string> {
  const colMap: Record<string, string> = {};

  for (const key of keys) {
    const norm = key.toUpperCase().trim().replace(/[^A-Z0-9_]/g, '');

    // USUARIO / USUÁRIO
    if (norm === 'USUARIO' || norm === 'USURIO' || norm === 'USER' || norm === 'OPERADOR') {
      if (!colMap.usuario) colMap.usuario = key;
    }

    // DATAINI / DATA_INI / DATA
    if (norm === 'DATAINI' || norm === 'DATA_INI' || norm === 'DATAINICIO' || norm === 'DATA_INICIO' || norm === 'DTINI') {
      if (!colMap.dataIni) colMap.dataIni = key;
    }
    // Generic DATA (only if no more specific match)
    if (norm === 'DATA' || norm === 'DATE') {
      if (!colMap.dataIni) colMap.dataIni = key;
    }

    // HORA_INI / HORA / HORAINICIO
    if (norm === 'HORA_INI' || norm === 'HORAINI' || norm === 'HORAINICIO' || norm === 'HORA_INICIO' || norm === 'HRINI') {
      if (!colMap.horaIni) colMap.horaIni = key;
    }
    if (norm === 'HORA' || norm === 'HOUR' || norm === 'TIME') {
      if (!colMap.horaIni) colMap.horaIni = key;
    }

    // PRODUTO
    if (norm === 'PRODUTO' || norm === 'PRODUCT' || norm === 'ITEM' || norm === 'CODPROD' || norm === 'CDPRODUTO') {
      if (!colMap.produto) colMap.produto = key;
    }

    // VOLUMES
    if (
      norm.includes('QTD_VOLUMES') ||
      norm.includes('QTDEVOLUMES') ||
      norm === 'VOLUMES' ||
      norm === 'VOLUME' ||
      norm === 'QTDVOL' ||
      norm === 'QTDPARES' ||
      norm.includes('PDR_EXP') ||
      norm === 'QTD'
    ) {
      if (!colMap.volumes) colMap.volumes = key;
    }
  }

  return colMap;
}

// ============================================================
// POST handler
// ============================================================
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo fornecido.' }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls') && !fileName.endsWith('.csv')) {
      return NextResponse.json(
        { error: 'Formato não suportado. Use .xlsx, .xls ou .csv' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Parse workbook — try both raw and formatted for better detection
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Get rows with raw values for number handling
    const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { raw: true, defval: '' });
    // Also get formatted rows for string-based parsing fallback
    const fmtRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: '' });

    if (rawRows.length === 0) {
      return NextResponse.json({ error: 'Planilha vazia ou sem dados na primeira aba.' }, { status: 400 });
    }

    // Detect columns from first row
    const allKeys = Object.keys(rawRows[0]);
    const colMap = detectColumns(allKeys);

    if (!colMap.usuario || !colMap.dataIni || !colMap.horaIni) {
      const found = allKeys.join(', ');
      const missing = [
        !colMap.usuario ? 'USUARIO' : '',
        !colMap.dataIni ? 'DATAINI' : '',
        !colMap.horaIni ? 'HORA_INI' : '',
      ].filter(Boolean).join(', ');
      return NextResponse.json(
        { error: `Colunas obrigatórias não encontradas (${missing}). Colunas detectadas: ${found}` },
        { status: 400 }
      );
    }

    // Process rows
    const recordsToInsert: { operatorName: string; dateStr: string; timeStr: string; product: string; volumes: number }[] = [];
    const operatorNames = new Set<string>();
    let skipped = 0;
    let line = 0;

    for (let idx = 0; idx < rawRows.length; idx++) {
      line++;
      const rawRow = rawRows[idx];
      const fmtRow = fmtRows[idx];

      // Operator name — preserve EXACTLY as-is
      const operatorName = String(rawRow[colMap.usuario] || '').trim();
      if (!operatorName) { skipped++; continue; }

      // Date — try raw first, then formatted
      let dateStr = parseExcelDate(rawRow[colMap.dataIni]);
      if (!dateStr || !/\d/.test(dateStr)) {
        dateStr = parseExcelDate(fmtRow[colMap.dataIni]);
      }
      if (!dateStr || !/\d/.test(dateStr)) { skipped++; continue; }

      // Time — try raw first, then formatted
      let timeStr = parseExcelTime(rawRow[colMap.horaIni]);
      if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) {
        timeStr = parseExcelTime(fmtRow[colMap.horaIni]);
      }
      if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) { skipped++; continue; }

      // Product
      const product = colMap.produto
        ? String(rawRow[colMap.produto] || fmtRow[colMap.produto] || '').trim()
        : '';

      // Volumes
      let volumes = 0;
      if (colMap.volumes) {
        const vol = rawRow[colMap.volumes];
        if (typeof vol === 'number') volumes = Math.round(vol);
        else if (vol) volumes = Math.round(Number(String(vol).replace(/[^\d.-]/g, '')) || 0);
      }

      operatorNames.add(operatorName);
      recordsToInsert.push({
        operatorName,
        dateStr,
        timeStr,
        product: product || '',
        volumes: Math.max(0, volumes),
      });
    }

    if (recordsToInsert.length === 0) {
      return NextResponse.json(
        { error: `Nenhum registro válido encontrado em ${line} linhas. ${skipped} linhas ignoradas. Verifique o formato das colunas.` },
        { status: 400 }
      );
    }

    // Register operators (skip if exists)
    for (const name of operatorNames) {
      await db.insert(operators).values({ name }).onConflictDoNothing();
    }

    // Batch insert using raw SQL for maximum reliability
    // Process in chunks of 200
    let inserted = 0;
    let duplicates = 0;
    const CHUNK = 200;

    for (let i = 0; i < recordsToInsert.length; i += CHUNK) {
      const chunk = recordsToInsert.slice(i, i + CHUNK);
      const values = chunk.map(r =>
        `('${r.operatorName.replace(/'/g, "''")}', '${r.dateStr.replace(/'/g, "''")}', '${r.timeStr.replace(/'/g, "''")}', '${r.product.replace(/'/g, "''")}', ${r.volumes})`
      ).join(', ');

      const query = sql`
        INSERT INTO raw_records (operator_name, date_str, time_str, product, volumes)
        VALUES ${sql.raw(values)}
        ON CONFLICT (operator_name, date_str, time_str, product) DO NOTHING
      `;

      try {
        const result = await db.execute(query);
        if (result && typeof result === 'object' && 'rowCount' in result) {
          const count = (result as { rowCount: number }).rowCount ?? 0;
          inserted += count;
          duplicates += chunk.length - count;
        }
      } catch (chunkError) {
        // If batch fails, try one by one
        for (const rec of chunk) {
          try {
            await db.insert(rawRecords).values(rec).onConflictDoNothing();
            inserted++;
          } catch {
            duplicates++;
          }
        }
      }
    }

    // If rowCount wasn't available
    if (inserted === 0 && duplicates === 0) {
      inserted = recordsToInsert.length;
    }

    return NextResponse.json({
      success: true,
      totalRows: line,
      imported: inserted,
      duplicates,
      skipped,
      operators: Array.from(operatorNames),
      operatorCount: operatorNames.size,
      columns: {
        detected: Object.entries(colMap).map(([k, v]) => `${k}→${v}`),
        available: allKeys,
      },
    });
  } catch (error) {
    console.error('Import error:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json(
      { error: `Erro na importação: ${message}` },
      { status: 500 }
    );
  }
}
