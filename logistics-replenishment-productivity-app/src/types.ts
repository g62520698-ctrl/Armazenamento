export interface TaskRecord {
  id?: string;
  usuario: string;
  data: string;
  hora: string;
  produto: string;
  qtdVolumes: number;
  datetime: string;
}

export type TaskClassification = 'excelente' | 'bom' | 'aviso' | 'ocioso' | 'aviso_op';

export interface TaskInterval {
  from: string;
  to: string;
  durationMin: number;
  type: 'tarefa' | 'ocioso';
  classification: TaskClassification;
  produto: string;
  qtdVolumes: number;
}

export type OpStatus = 'excelente' | 'bom' | 'atencao' | 'critico';

export interface UserMetrics {
  usuario: string;
  data: string;
  totalTarefas: number;
  totalVolumes: number;
  tempoProdutivo: number;
  tempoOcioso: number;
  tempoMedio: number;
  tarefasHora: number;
  volumesHora: number;
  segPorVolume: number;
  desempenho: number;
  status: OpStatus;
  valid: boolean;
  intervals: TaskInterval[];
}

export type TabType = 'dashboard' | 'ranking' | 'alertas' | 'evolucao' | 'insights' | 'importar' | 'gerenciar';
export type FilterPeriod = 'dia' | 'semana' | 'mes';
