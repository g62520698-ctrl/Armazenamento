import { useState } from 'react';
import { collection, getDocs, doc, deleteDoc, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Trash2, AlertTriangle, Loader2, Shield, Database, UserX, CalendarX } from 'lucide-react';

interface Props {
  usuarios: string[];
  onRefresh: () => void;
}

export default function DataManagement({ usuarios, onRefresh }: Props) {
  const [loading, setLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'all' | 'date' | 'user' | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const clearAll = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'registros'));
      const batch = writeBatch(db);
      snap.forEach(d => batch.delete(d.ref));
      await batch.commit();
      // Also clear separadores
      const usersSnap = await getDocs(collection(db, 'separadores'));
      const batch2 = writeBatch(db);
      usersSnap.forEach(d => batch2.delete(d.ref));
      await batch2.commit();
      setMessage({ type: 'success', text: '✅ Todos os dados foram removidos com sucesso!' });
      onRefresh();
    } catch (err) {
      setMessage({ type: 'error', text: `❌ Erro: ${err instanceof Error ? err.message : 'Erro desconhecido'}` });
    }
    setLoading(false);
    setConfirmAction(null);
  };

  const clearByDate = async () => {
    if (!selectedDate) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'registros'), where('data', '==', selectedDate));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.forEach(d => batch.delete(d.ref));
      await batch.commit();
      setMessage({ type: 'success', text: `✅ Registros de ${selectedDate} removidos com sucesso! (${snap.size} registros)` });
      onRefresh();
    } catch (err) {
      setMessage({ type: 'error', text: `❌ Erro: ${err instanceof Error ? err.message : 'Erro desconhecido'}` });
    }
    setLoading(false);
    setConfirmAction(null);
  };

  const clearByUser = async () => {
    if (!selectedUser) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'registros'), where('usuario', '==', selectedUser));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.forEach(d => batch.delete(d.ref));
      await batch.commit();
      // Also remove from separadores
      await deleteDoc(doc(db, 'separadores', selectedUser));
      setMessage({ type: 'success', text: `✅ Registros de "${selectedUser}" removidos com sucesso! (${snap.size} registros)` });
      onRefresh();
    } catch (err) {
      setMessage({ type: 'error', text: `❌ Erro: ${err instanceof Error ? err.message : 'Erro desconhecido'}` });
    }
    setLoading(false);
    setConfirmAction(null);
  };

  const ConfirmDialog = ({ title, description, onConfirm, danger }: { title: string; description: string; onConfirm: () => void; danger: boolean }) => (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-md w-full">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${danger ? 'bg-red-500/20' : 'bg-amber-500/20'}`}>
            <AlertTriangle className={`w-5 h-5 ${danger ? 'text-red-400' : 'text-amber-400'}`} />
          </div>
          <h3 className="text-lg font-bold text-white">{title}</h3>
        </div>
        <p className="text-gray-400 text-sm mb-6">{description}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={() => setConfirmAction(null)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors">
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={loading} className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors flex items-center gap-2 ${danger ? 'bg-red-600 hover:bg-red-500' : 'bg-amber-600 hover:bg-amber-500'}`}>
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
        <Shield className="w-6 h-6 text-red-400" />
        Gerenciar Dados
        <span className="text-xs font-normal text-gray-400 bg-red-500/20 px-2 py-0.5 rounded-full ml-2">Restrito</span>
      </h2>

      <div className="grid gap-4">
        {/* Clear All */}
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <Database className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-medium">Limpar Todos os Dados</h3>
                <p className="text-gray-400 text-xs">Remove todos os registros e operadores do sistema</p>
              </div>
            </div>
            <button onClick={() => setConfirmAction('all')} className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-lg text-sm font-medium transition-colors">
              <Trash2 className="w-4 h-4 inline mr-1" />
              Limpar Tudo
            </button>
          </div>
        </div>

        {/* Clear by Date */}
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <CalendarX className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-white font-medium">Limpar por Data</h3>
                <p className="text-gray-400 text-xs">Remove todos os registros de uma data específica</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                onClick={() => selectedDate && setConfirmAction('date')}
                disabled={!selectedDate}
                className="px-4 py-2 bg-amber-600/20 hover:bg-amber-600/30 disabled:opacity-50 text-amber-400 border border-amber-500/30 rounded-lg text-sm font-medium transition-colors"
              >
                Limpar
              </button>
            </div>
          </div>
        </div>

        {/* Clear by User */}
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <UserX className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="text-white font-medium">Limpor por Operador</h3>
                <p className="text-gray-400 text-xs">Remove todos os registros de um operador específico</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedUser}
                onChange={e => setSelectedUser(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Selecione...</option>
                {usuarios.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <button
                onClick={() => selectedUser && setConfirmAction('user')}
                disabled={!selectedUser}
                className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 disabled:opacity-50 text-purple-400 border border-purple-500/30 rounded-lg text-sm font-medium transition-colors"
              >
                Limpar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`border rounded-xl p-4 flex items-center gap-3 animate-fade-in ${
          message.type === 'success' ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-red-500/20 bg-red-500/10'
        }`}>
          <span className="text-sm text-gray-200">{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-gray-400 hover:text-white ml-auto text-lg">&times;</button>
        </div>
      )}

      {/* Confirmation Dialogs */}
      {confirmAction === 'all' && (
        <ConfirmDialog
          title="Limpar Todos os Dados"
          description="Tem certeza que deseja remover TODOS os registros e operadores? Esta ação não pode ser desfeita."
          onConfirm={clearAll}
          danger
        />
      )}
      {confirmAction === 'date' && (
        <ConfirmDialog
          title={`Limpar Data: ${selectedDate}`}
          description={`Tem certeza que deseja remover todos os registros de ${selectedDate}?`}
          onConfirm={clearByDate}
          danger={false}
        />
      )}
      {confirmAction === 'user' && (
        <ConfirmDialog
          title={`Limpar Operador: ${selectedUser}`}
          description={`Tem certeza que deseja remover todos os registros de "${selectedUser}"? O operador também será removido do cadastro.`}
          onConfirm={clearByUser}
          danger={false}
        />
      )}
    </div>
  );
}
