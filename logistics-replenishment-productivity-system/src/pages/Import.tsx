import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Trash2, Eye } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { parseExcelDate, parseExcelTime, RawRecord } from '../utils/calculations';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

export default function Import() {
  const { importRecords } = useApp();
  const [preview, setPreview] = useState<RawRecord[]>([]);
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [fileName, setFileName] = useState('');
  const [importResult, setImportResult] = useState<{ total: number; imported: number } | null>(null);

  const parseFile = useCallback(async (file: File) => {
    try {
      setImportResult(null);
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        toast.error('Planilha vazia ou formato inválido');
        return;
      }

      const records: RawRecord[] = [];
      let invalidCount = 0;

      for (const row of jsonData as any[]) {
        const usuario = String(row['USUARIO'] || '').trim();
        const dataIni = parseExcelDate(row['DATAINI']);
        const horaIni = parseExcelTime(row['HORA_INI']);
        const produto = String(row['PRODUTO'] || '').trim();
        const volumes = Number(row['QTD_VOLUMES_PDR_EXP'] || 0);

        if (!usuario || !dataIni || !horaIni) {
          invalidCount++;
          continue;
        }

        records.push({ usuario, dataIni, horaIni, produto, volumes });
      }

      if (records.length === 0) {
        toast.error('Nenhum registro válido encontrado. Verifique os cabeçalhos: USUARIO, DATAINI, HORA_INI, PRODUTO, QTD_VOLUMES_PDR_EXP');
        return;
      }

      setPreview(records);
      setFileName(file.name);
      setShowPreview(true);

      if (invalidCount > 0) {
        toast(`${invalidCount} linhas inválidas ignoradas`, { icon: '⚠️' });
      }
    } catch (err) {
      console.error('Parse error:', err);
      toast.error('Erro ao ler o arquivo. Verifique se é um Excel válido.');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv'))) {
      parseFile(file);
    } else {
      toast.error('Formato inválido. Use .xlsx, .xls ou .csv');
    }
  }, [parseFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
    e.target.value = '';
  }, [parseFile]);

  const handleImport = async () => {
    if (preview.length === 0) return;
    setImporting(true);
    try {
      const count = await importRecords(preview);
      setImportResult({ total: preview.length, imported: count });
      if (count > 0) {
        setPreview([]);
        setFileName('');
        setShowPreview(false);
      }
    } finally {
      setImporting(false);
    }
  };

  const clearPreview = () => {
    setPreview([]);
    setFileName('');
    setShowPreview(false);
    setImportResult(null);
  };

  // Stats
  const uniqueOperators = new Set(preview.map(r => r.usuario)).size;
  const uniqueDates = new Set(preview.map(r => r.dataIni)).size;

  return (
    <div className="space-y-6 pt-12 lg:pt-0">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Importar Dados</h1>
        <p className="text-sm text-slate-500 mt-1">Importe planilhas Excel exportadas do WMS</p>
      </div>

      {/* Drop Zone */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          dragActive
            ? 'border-blue-400 bg-blue-500/5'
            : 'border-gray-700 hover:border-gray-600 bg-[#111827]'
        }`}
        onDragOver={e => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Upload size={28} className="text-blue-400" />
          </div>
          <div>
            <p className="text-slate-300 font-medium">Arraste o arquivo aqui ou clique para selecionar</p>
            <p className="text-xs text-slate-500 mt-1">Formatos aceitos: .xlsx, .xls, .csv</p>
          </div>
        </div>
      </motion.div>

      {/* File Info */}
      <AnimatePresence>
        {fileName && preview.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-[#111827] rounded-xl border border-gray-800/60 p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet size={20} className="text-emerald-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-200">{fileName}</p>
                    <p className="text-xs text-slate-500">{preview.length} registros encontrados</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="p-2 text-slate-400 hover:text-slate-200 hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <Eye size={18} />
                  </button>
                  <button
                    onClick={clearPreview}
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-[#0f172a] rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-blue-400">{preview.length}</p>
                  <p className="text-[10px] text-slate-500">Registros</p>
                </div>
                <div className="bg-[#0f172a] rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-emerald-400">{uniqueOperators}</p>
                  <p className="text-[10px] text-slate-500">Operadores</p>
                </div>
                <div className="bg-[#0f172a] rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-amber-400">{uniqueDates}</p>
                  <p className="text-[10px] text-slate-500">Datas</p>
                </div>
              </div>

              {/* Import Button */}
              <button
                onClick={handleImport}
                disabled={importing}
                className="w-full py-3 bg-blue-500 text-white rounded-lg font-medium text-sm hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {importing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    Importar {preview.length} Registros
                  </>
                )}
              </button>

              {/* Preview Table */}
              <AnimatePresence>
                {showPreview && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 overflow-hidden"
                  >
                    <div className="max-h-80 overflow-auto rounded-lg border border-gray-800/60">
                      <table className="w-full text-xs">
                        <thead className="bg-[#0f172a] sticky top-0">
                          <tr>
                            <th className="text-left p-2 text-slate-400 font-medium">Usuário</th>
                            <th className="text-left p-2 text-slate-400 font-medium">Data</th>
                            <th className="text-left p-2 text-slate-400 font-medium">Hora</th>
                            <th className="text-left p-2 text-slate-400 font-medium">Produto</th>
                            <th className="text-right p-2 text-slate-400 font-medium">Volumes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.slice(0, 50).map((r, i) => (
                            <tr key={i} className="border-t border-gray-800/40 hover:bg-gray-800/20">
                              <td className="p-2 text-slate-300">{r.usuario}</td>
                              <td className="p-2 text-slate-400">{r.dataIni}</td>
                              <td className="p-2 text-slate-400">{r.horaIni}</td>
                              <td className="p-2 text-slate-400 truncate max-w-[200px]">{r.produto}</td>
                              <td className="p-2 text-slate-300 text-right">{r.volumes.toLocaleString('pt-BR')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {preview.length > 50 && (
                        <div className="p-2 text-center text-xs text-slate-500 bg-[#0f172a]">
                          Mostrando 50 de {preview.length} registros
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Import Result */}
      <AnimatePresence>
        {importResult && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-start gap-3"
          >
            <CheckCircle size={20} className="text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-emerald-300">Importação Concluída</p>
              <p className="text-xs text-emerald-400/70 mt-1">
                {importResult.imported} de {importResult.total} registros importados com sucesso.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Help */}
      <div className="bg-[#111827] rounded-xl border border-gray-800/60 p-4">
        <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <AlertCircle size={16} className="text-blue-400" />
          Formato Esperado
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#0f172a]">
                <th className="text-left p-2 text-slate-400 font-medium">USUARIO</th>
                <th className="text-left p-2 text-slate-400 font-medium">DATAINI</th>
                <th className="text-left p-2 text-slate-400 font-medium">HORA_INI</th>
                <th className="text-left p-2 text-slate-400 font-medium">PRODUTO</th>
                <th className="text-left p-2 text-slate-400 font-medium">QTD_VOLUMES_PDR_EXP</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-gray-800/40">
                <td className="p-2 text-slate-300">118 CD_GILSON</td>
                <td className="p-2 text-slate-400">05/05/2026</td>
                <td className="p-2 text-slate-400">07:00</td>
                <td className="p-2 text-slate-400">PROD-001</td>
                <td className="p-2 text-slate-300">150</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-slate-600 mt-2">
          ⚠️ Os cabeçalhos devem ser exatamente como acima. Datas e horas são preservadas no formato original.
        </p>
      </div>
    </div>
  );
}
