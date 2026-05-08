import { useState, useRef } from 'react';
import type { UserMetrics } from '../types';
import { importExcelFile, exportToExcel } from '../utils';
import { Upload, Download, FileSpreadsheet, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface Props {
  onImportComplete: () => void;
  filteredMetrics: UserMetrics[];
  allMetrics: UserMetrics[];
}

export default function ImportExport({ onImportComplete, filteredMetrics, allMetrics }: Props) {
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setMessage(null);

    try {
      const result = await importExcelFile(file);
      setMessage({ type: 'success', text: `✅ ${result.count} registros importados com sucesso! ${result.usuarios.length} operador(es) identificado(s).` });
      onImportComplete();
    } catch (err) {
      setMessage({ type: 'error', text: `❌ Erro na importação: ${err instanceof Error ? err.message : 'Erro desconhecido'}` });
    }

    setImporting(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleExport = () => {
    if (allMetrics.length === 0) {
      setMessage({ type: 'error', text: '❌ Nenhum dado disponível para exportar.' });
      return;
    }
    try {
      exportToExcel(filteredMetrics, allMetrics);
      setMessage({ type: 'success', text: '✅ Arquivo Excel exportado com sucesso!' });
    } catch (err) {
      setMessage({ type: 'error', text: `❌ Erro na exportação: ${err instanceof Error ? err.message : 'Erro desconhecido'}` });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
        <FileSpreadsheet className="w-6 h-6 text-blue-400" />
        Importar / Exportar
      </h2>

      {/* Import Section */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Upload className="w-5 h-5 text-blue-400" />
          Importar Planilha
        </h3>

        <div className="mb-4 bg-gray-900/50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-300 mb-2">📋 Estrutura esperada da planilha:</h4>
          <div className="grid grid-cols-5 gap-2 text-xs">
            <div className="bg-gray-700/30 rounded p-2 text-center">
              <span className="text-blue-400 font-bold">A</span><br />
              <span className="text-gray-400">USUARIO</span>
            </div>
            <div className="bg-gray-700/30 rounded p-2 text-center">
              <span className="text-blue-400 font-bold">B</span><br />
              <span className="text-gray-400">DATAINI</span>
            </div>
            <div className="bg-gray-700/30 rounded p-2 text-center">
              <span className="text-blue-400 font-bold">C</span><br />
              <span className="text-gray-400">HORA_INI</span>
            </div>
            <div className="bg-gray-700/30 rounded p-2 text-center">
              <span className="text-blue-400 font-bold">D</span><br />
              <span className="text-gray-400">PRODUTO</span>
            </div>
            <div className="bg-gray-700/30 rounded p-2 text-center">
              <span className="text-blue-400 font-bold">E</span><br />
              <span className="text-gray-400">QTD_VOL</span>
            </div>
          </div>
        </div>

        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
            importing ? 'border-gray-600 bg-gray-800/20' : 'border-blue-500/30 hover:border-blue-500/60 hover:bg-blue-500/5'
          }`}
          onClick={() => !importing && fileRef.current?.click()}
        >
          {importing ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
              <p className="text-gray-300">Importando dados...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload className="w-10 h-10 text-blue-400" />
              <p className="text-gray-300">Clique ou arraste o arquivo Excel aqui</p>
              <p className="text-gray-500 text-sm">Aceita .xlsx e .xls</p>
            </div>
          )}
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} disabled={importing} />
        </div>
      </div>

      {/* Export Section */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Download className="w-5 h-5 text-emerald-400" />
          Exportar Excel
        </h3>

        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={handleExport}
            disabled={allMetrics.length === 0}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar Produtividade
          </button>
          <div className="text-gray-400 text-sm flex items-center">
            {allMetrics.length > 0 ? (
              <span>{allMetrics.length} registros disponíveis para exportação</span>
            ) : (
              <span>Nenhum dado para exportar</span>
            )}
          </div>
        </div>

        <div className="mt-4 bg-gray-900/50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-300 mb-2">📄 O arquivo conterá:</h4>
          <ul className="text-xs text-gray-400 space-y-1">
            <li>• <strong className="text-gray-300">Aba Resumo:</strong> Dados detalhados por operador e data</li>
            <li>• <strong className="text-gray-300">Aba Alertas:</strong> Todos os alertas e classificações registrados</li>
            <li>• <strong className="text-gray-300">Aba Ranking:</strong> Ranking completo de produtividade</li>
            <li>• <strong className="text-gray-300">Aba Evolução:</strong> Evolução diária da equipe</li>
            <li>• Todos os tempos em HH:MM — Produtivo + Ocioso = 09:00</li>
          </ul>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`border rounded-xl p-4 flex items-start gap-3 animate-fade-in ${
          message.type === 'success' ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-red-500/20 bg-red-500/10'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          )}
          <p className="text-sm text-gray-200">{message.text}</p>
          <button onClick={() => setMessage(null)} className="text-gray-400 hover:text-white ml-auto text-lg leading-none">&times;</button>
        </div>
      )}
    </div>
  );
}
