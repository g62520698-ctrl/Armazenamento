import { motion } from 'framer-motion';
import { Brain, TrendingUp, TrendingDown, AlertTriangle, Info, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';

const insightConfig: Record<string, { icon: typeof TrendingUp; border: string; bg: string; iconColor: string; badge: string; badgeBg: string }> = {
  positivo: {
    icon: TrendingUp, border: 'border-emerald-500/20', bg: 'bg-emerald-500/5',
    iconColor: 'text-emerald-400', badge: 'Positivo', badgeBg: 'bg-emerald-400/10 text-emerald-400',
  },
  negativo: {
    icon: TrendingDown, border: 'border-red-500/20', bg: 'bg-red-500/5',
    iconColor: 'text-red-400', badge: 'Atenção', badgeBg: 'bg-red-400/10 text-red-400',
  },
  alerta: {
    icon: AlertTriangle, border: 'border-amber-500/20', bg: 'bg-amber-500/5',
    iconColor: 'text-amber-400', badge: 'Alerta', badgeBg: 'bg-amber-400/10 text-amber-400',
  },
  neutro: {
    icon: Info, border: 'border-blue-500/20', bg: 'bg-blue-500/5',
    iconColor: 'text-blue-400', badge: 'Info', badgeBg: 'bg-blue-400/10 text-blue-400',
  },
};

export default function Insights() {
  const { insights, loading, filteredMetrics } = useApp();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const positiveCount = insights.filter(i => i.tipo === 'positivo').length;
  const negativeCount = insights.filter(i => i.tipo === 'negativo').length;
  const alertCount = insights.filter(i => i.tipo === 'alerta').length;

  return (
    <div className="space-y-6 pt-12 lg:pt-0">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Sparkles size={24} className="text-blue-400" />
          Insights IA
        </h1>
        <p className="text-sm text-slate-500 mt-1">Análises inteligentes automáticas da operação</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-emerald-500/5 rounded-xl border border-emerald-500/20 p-3 text-center">
          <p className="text-xl font-bold text-emerald-400">{positiveCount}</p>
          <p className="text-[10px] text-slate-500">Positivos</p>
        </div>
        <div className="bg-red-500/5 rounded-xl border border-red-500/20 p-3 text-center">
          <p className="text-xl font-bold text-red-400">{negativeCount}</p>
          <p className="text-[10px] text-slate-500">Negativos</p>
        </div>
        <div className="bg-amber-500/5 rounded-xl border border-amber-500/20 p-3 text-center">
          <p className="text-xl font-bold text-amber-400">{alertCount}</p>
          <p className="text-[10px] text-slate-500">Alertas</p>
        </div>
      </div>

      {/* Insights Grid */}
      {insights.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Brain size={40} className="text-slate-600 mb-3" />
          <p className="text-slate-400 text-lg font-medium">Gerando insights...</p>
          <p className="text-sm text-slate-600 mt-1">
            {filteredMetrics.length === 0
              ? 'Importe dados para gerar insights inteligentes'
              : 'Dados insuficientes para gerar insights'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {insights.map((insight, i) => {
            const config = insightConfig[insight.tipo] || insightConfig.neutro;

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.3 }}
                className={`${config.bg} rounded-xl border ${config.border} p-4 hover:scale-[1.01] transition-transform`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-900/50 flex items-center justify-center shrink-0">
                    <span className="text-lg">{insight.icone}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-slate-200">{insight.titulo}</h4>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${config.badgeBg}`}>
                        {config.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{insight.descricao}</p>
                    {insight.operador && (
                      <p className="text-[10px] text-slate-500 mt-2">Operador: {insight.operador}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* AI Disclaimer */}
      <div className="bg-[#111827] rounded-xl border border-gray-800/60 p-4 text-center">
        <p className="text-[10px] text-slate-600">
          💡 Insights gerados automaticamente com base nos dados importados.
          As análises são orientativas e devem ser validadas pela gestão operacional.
        </p>
      </div>
    </div>
  );
}
