import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { UserMetrics } from '../types';
import { TrendingUp } from 'lucide-react';

interface Props {
  allMetrics: UserMetrics[];
  usuarios: string[];
}

export default function Evolution({ allMetrics, usuarios }: Props) {
  const [selectedUser, setSelectedUser] = useState('');

  const availableUsers = useMemo(() => {
    if (allMetrics.length === 0) return usuarios;
    return [...new Set(allMetrics.map(m => m.usuario))].sort();
  }, [allMetrics, usuarios]);

  const chartData = useMemo(() => {
    const user = selectedUser || (availableUsers.length > 0 ? availableUsers[0] : '');
    if (!user) return [];

    const userMetrics = allMetrics
      .filter(m => m.usuario === user && m.data)
      .sort((a, b) => a.data.localeCompare(b.data));

    return userMetrics.map(m => ({
      data: m.data.substring(5),
      desempenho: m.desempenho,
      tarefasHora: m.tarefasHora,
      tempoMedio: Math.round(m.tempoMedio / 60 * 10) / 10,
      totalTarefas: m.totalTarefas,
    }));
  }, [allMetrics, selectedUser, availableUsers]);

  if (allMetrics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
        <div className="w-24 h-24 rounded-full bg-purple-500/10 flex items-center justify-center mb-6">
          <TrendingUp className="w-12 h-12 text-purple-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Evolução</h2>
        <p className="text-gray-400">Nenhum dado disponível para evolução.</p>
      </div>
    );
  }

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const comparisonsData = useMemo(() => {
    const byDate = new Map<string, { data: string; users: { name: string; desempenho: number }[] }>();
    for (const m of allMetrics) {
      if (!m.data) continue;
      if (!byDate.has(m.data)) byDate.set(m.data, { data: m.data.substring(5), users: [] });
      byDate.get(m.data)!.users.push({ name: m.usuario, desempenho: m.desempenho });
    }
    const dates = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
    return dates.map(([, v]) => {
      const row: Record<string, string | number> = { data: v.data };
      v.users.forEach(u => { row[u.name] = u.desempenho; });
      return row;
    });
  }, [allMetrics]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-purple-400" />
          Evolução Operacional
        </h2>
        <select
          value={selectedUser || (availableUsers[0] || '')}
          onChange={e => setSelectedUser(e.target.value)}
          className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {availableUsers.map(u => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
      </div>

      {chartData.length > 0 && (
        <div className="grid grid-cols-1 gap-6">
          {/* Desempenho Evolution */}
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">📈 Evolução do Desempenho (%)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="data" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
                <Line type="monotone" dataKey="desempenho" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 4 }} name="Desempenho %" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Tarefas/Hora Evolution */}
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">⚡ Evolução de Tarefas/Hora</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="data" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
                <Line type="monotone" dataKey="tarefasHora" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 4 }} name="Tarefas/Hora" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Tempo Médio Evolution */}
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">⏱️ Evolução do Tempo Médio (min)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="data" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
                <Line type="monotone" dataKey="tempoMedio" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 4 }} name="Tempo Médio (min)" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Comparative Chart */}
          {comparisonsData.length > 1 && (
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-4">👥 Comparativo de Desempenho entre Operadores</h3>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={comparisonsData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="data" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
                  <Legend />
                  {availableUsers.slice(0, 6).map((user, i) => (
                    <Line key={user} type="monotone" dataKey={user} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
