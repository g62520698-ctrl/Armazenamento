import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Database, AlertTriangle, Calendar, User, Info, Shield } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function Settings() {
  const { deleteRecords, records, operators, loading } = useApp();
  const [confirmType, setConfirmType] = useState<string | null>(null);
  const [confirmValue, setConfirmValue] = useState('');
  const [selectedOperator, setSelectedOperator] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (type: 'all' | 'day' | 'week' | 'month' | 'operator', value?: string) => {
    setDeleting(true);
    try {
      await deleteRecords(type, value);
      setConfirmType(null);
      setConfirmValue('');
    } finally {
      setDeleting(false);
    }
  };

  const showConfirm = (type: string) => {
    setConfirmType(type);
    setConfirmValue('');
  };

  const uniqueDates = [...new Set(records.map(r => r.dataIni))].sort((a, b) => {
    const [dA, mA, yA] = a.split('/');
    const [dB, mB, yB] = b.split('/');
    return new Date(`${yB}-${mB}-${dB}`).getTime() - new Date(`${yA}-${mA}-${dA}`).getTime();
  });

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
        <h1 className="text-2xl font-bold text-slate-100">Configurações</h1>
        <p className="text-sm text-slate-500 mt-1">Gerenciamento de dados e operações do sistema</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-[#111827] rounded-xl border border-gray-800/60 p-4 text-center">
          <p className="text-2xl font-bold text-blue-400">{records.length.toLocaleString('pt-BR')}</p>
          <p className="text-xs text-slate-500">Total de Registros</p>
        </div>
        <div className="bg-[#111827] rounded-xl border border-gray-800/60 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400">{operators.length}</p>
          <p className="text-xs text-slate-500">Operadores</p>
        </div>
        <div className="bg-[#111827] rounded-xl border border-gray-800/60 p-4 text-center">
          <p className="text-2xl font-bold text-amber-400">{uniqueDates.length}</p>
          <p className="text-xs text-slate-500">Datas</p>
        </div>
      </div>

      {/* Delete Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#111827] rounded-xl border border-red-500/20 p-4"
      >
        <h3 className="text-sm font-semibold text-red-300 mb-4 flex items-center gap-2">
          <Trash2 size={16} className="text-red-400" />
          Gerenciamento de Dados
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Exclua registros importados. Os operadores cadastrados não serão removidos.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Delete All */}
          <button
            onClick={() => showConfirm('all')}
            className="flex items-center gap-3 p-3 bg-red-500/5 border border-red-500/10 rounded-lg hover:bg-red-500/10 transition-colors text-left group"
          >
            <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center">
              <Database size={18} className="text-red-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200 group-hover:text-red-300 transition-colors">Limpar Tudo</p>
              <p className="text-[10px] text-slate-500">Remover todos os registros</p>
            </div>
          </button>

          {/* Delete by Day */}
          <div className="flex flex-col gap-2">
            <select
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-[#0f172a] border border-gray-800/60 rounded-lg px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50"
            >
              <option value="">Selecione uma data</option>
              {uniqueDates.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => { if (selectedDate) { setConfirmType('day'); setConfirmValue(selectedDate); } }}
                disabled={!selectedDate}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-500/5 border border-red-500/10 rounded-lg text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-30 transition-colors"
              >
                <Calendar size={14} />
                Excluir Dia
              </button>
              <button
                onClick={() => { if (selectedDate) { setConfirmType('week'); setConfirmValue(selectedDate); } }}
                disabled={!selectedDate}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-500/5 border border-red-500/10 rounded-lg text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-30 transition-colors"
              >
                <Calendar size={14} />
                Excluir Semana
              </button>
              <button
                onClick={() => { if (selectedDate) { setConfirmType('month'); setConfirmValue(selectedDate); } }}
                disabled={!selectedDate}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-500/5 border border-red-500/10 rounded-lg text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-30 transition-colors"
              >
                <Calendar size={14} />
                Excluir Mês
              </button>
            </div>
          </div>

          {/* Delete by Operator */}
          <div className="flex gap-2 items-end sm:col-span-2">
            <div className="flex-1">
              <select
                value={selectedOperator}
                onChange={e => setSelectedOperator(e.target.value)}
                className="w-full bg-[#0f172a] border border-gray-800/60 rounded-lg px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50"
              >
                <option value="">Selecione um operador</option>
                {operators.map(op => (
                  <option key={op} value={op}>{op}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => { if (selectedOperator) { setConfirmType('operator'); setConfirmValue(selectedOperator); } }}
              disabled={!selectedOperator}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-red-500/5 border border-red-500/10 rounded-lg text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-30 transition-colors whitespace-nowrap"
            >
              <User size={16} />
              Excluir Operador
            </button>
          </div>
        </div>
      </motion.div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmType && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setConfirmType(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#111827] rounded-xl border border-gray-800/60 p-6 max-w-md w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle size={20} className="text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">Confirmar Exclusão</h3>
                  <p className="text-xs text-slate-500">Esta ação não pode ser desfeita</p>
                </div>
              </div>
              <p className="text-sm text-slate-400 mb-4">
                {confirmType === 'all' && `Tem certeza que deseja excluir TODOS os ${records.length} registros?`}
                {confirmType === 'day' && `Excluir todos os registros do dia ${confirmValue}?`}
                {confirmType === 'week' && `Excluir todos os registros da semana de ${confirmValue}?`}
                {confirmType === 'month' && `Excluir todos os registros do mês de ${confirmValue}?`}
                {confirmType === 'operator' && `Excluir todos os registros de ${confirmValue}?`}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmType(null)}
                  className="flex-1 px-4 py-2.5 bg-gray-800 text-slate-300 rounded-lg text-sm hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDelete(confirmType as any, confirmValue)}
                  disabled={deleting}
                  className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {deleting ? 'Excluindo...' : 'Confirmar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* App Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-[#111827] rounded-xl border border-gray-800/60 p-4"
      >
        <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
          <Info size={16} className="text-blue-400" />
          Informações do Sistema
        </h3>
        <div className="space-y-2">
          {[
            { label: 'Aplicação', value: 'Produtividade Ressuprimento' },
            { label: 'Versão', value: '1.0.0' },
            { label: 'Stack', value: 'React + Firebase + Tailwind' },
            { label: 'Dados', value: 'Firebase Firestore' },
          ].map(info => (
            <div key={info.label} className="flex items-center justify-between py-1.5 border-b border-gray-800/40 last:border-0">
              <span className="text-xs text-slate-500">{info.label}</span>
              <span className="text-xs text-slate-300 font-medium">{info.value}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Footer */}
      <div className="text-center py-4">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Shield size={14} className="text-slate-600" />
          <p className="text-xs text-slate-600">Desenvolvido por Guilherme Lopes</p>
        </div>
        <p className="text-[10px] text-slate-700">Sistema de Produtividade Operacional Logística</p>
      </div>
    </div>
  );
}
