import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  collection, getDocs, writeBatch, doc, addDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  RawRecord, Task, OperatorMetrics, DashboardData, Insight, FilterState,
  processRecordsToTasks, getAllMetrics, calculateDashboardData,
  generateInsights, filterRecords,
} from '../utils/calculations';
import toast from 'react-hot-toast';

interface AppContextType {
  records: RawRecord[];
  operators: string[];
  filters: FilterState;
  loading: boolean;
  setFilters: (f: Partial<FilterState>) => void;
  importRecords: (newRecords: RawRecord[]) => Promise<number>;
  deleteRecords: (type: 'all' | 'day' | 'week' | 'month' | 'operator', value?: string) => Promise<void>;
  filteredRecords: RawRecord[];
  filteredTasks: Task[];
  filteredMetrics: OperatorMetrics[];
  dashboardData: DashboardData;
  insights: Insight[];
  refreshData: () => Promise<void>;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [records, setRecords] = useState<RawRecord[]>([]);
  const [operators, setOperators] = useState<string[]>([]);
  const [filters, setFiltersState] = useState<FilterState>({
    period: 'all', selectedDate: '', operator: '',
  });
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [recSnap, opSnap] = await Promise.all([
        getDocs(collection(db, 'records')),
        getDocs(collection(db, 'operators')),
      ]);
      const recs: RawRecord[] = recSnap.docs.map(d => ({ id: d.id, ...d.data() } as RawRecord));
      const ops: string[] = opSnap.docs.map(d => d.data().nome as string).filter(Boolean);
      setRecords(recs);
      setOperators(ops);
    } catch (err) {
      console.error('Firebase fetch error:', err);
      toast.error('Erro ao carregar dados do Firebase');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const setFilters = useCallback((f: Partial<FilterState>) => {
    setFiltersState(prev => ({ ...prev, ...f }));
  }, []);

  // Derived data
  const filteredRecords = useMemo(() => filterRecords(records, filters), [records, filters]);
  const filteredTasks = useMemo(() => processRecordsToTasks(filteredRecords), [filteredRecords]);
  const filteredMetrics = useMemo(() => getAllMetrics(filteredRecords), [filteredRecords]);
  const dashboardData = useMemo(
    () => calculateDashboardData(filteredMetrics, filteredTasks, operators),
    [filteredMetrics, filteredTasks, operators]
  );
  const insights = useMemo(
    () => generateInsights(filteredMetrics, filteredTasks),
    [filteredMetrics, filteredTasks]
  );

  // Import
  const importRecords = useCallback(async (newRecords: RawRecord[]): Promise<number> => {
    try {
      // Deduplicate
      const existingKeys = new Set(
        records.map(r => `${r.usuario}|${r.dataIni}|${r.horaIni}|${r.produto}`)
      );
      const unique = newRecords.filter(r => {
        const key = `${r.usuario}|${r.dataIni}|${r.horaIni}|${r.produto}`;
        if (existingKeys.has(key)) return false;
        existingKeys.add(key);
        return true;
      });

      if (unique.length === 0) {
        toast('Todos os registros já existem!', { icon: 'ℹ️' });
        return 0;
      }

      // Batch write records
      const BATCH = 450;
      for (let i = 0; i < unique.length; i += BATCH) {
        const batch = writeBatch(db);
        const chunk = unique.slice(i, i + BATCH);
        for (const rec of chunk) {
          const ref = doc(collection(db, 'records'));
          batch.set(ref, {
            usuario: rec.usuario,
            dataIni: rec.dataIni,
            horaIni: rec.horaIni,
            produto: rec.produto,
            volumes: rec.volumes,
          });
        }
        await batch.commit();
      }

      // Register new operators
      const newOps: string[] = [];
      for (const rec of unique) {
        if (!operators.includes(rec.usuario) && !newOps.includes(rec.usuario)) {
          newOps.push(rec.usuario);
        }
      }
      for (const op of newOps) {
        await addDoc(collection(db, 'operators'), { nome: op });
      }

      // Update local state
      setRecords(prev => [...prev, ...unique]);
      if (newOps.length > 0) setOperators(prev => [...prev, ...newOps]);

      toast.success(`${unique.length} registros importados com sucesso!`);
      return unique.length;
    } catch (err) {
      console.error('Import error:', err);
      toast.error('Erro ao importar registros');
      return 0;
    }
  }, [records, operators]);

  // Delete
  const deleteRecords = useCallback(async (type: 'all' | 'day' | 'week' | 'month' | 'operator', value?: string) => {
    try {
      let toDelete: RawRecord[];

      switch (type) {
        case 'all':
          toDelete = [...records];
          break;
        case 'day':
          toDelete = records.filter(r => r.dataIni === value);
          break;
        case 'week':
        case 'month': {
          const parsed = value ? value.split('/') : null;
          if (!parsed) { toDelete = []; break; }
          const d = new Date(parseInt(parsed[2]), parseInt(parsed[1]) - 1, parseInt(parsed[0]));
          toDelete = records.filter(r => {
            const rd = r.dataIni.split('/');
            const rDate = new Date(parseInt(rd[2]), parseInt(rd[1]) - 1, parseInt(rd[0]));
            if (type === 'week') {
              const ws = new Date(d);
              ws.setDate(d.getDate() - d.getDay() + 1);
              const we = new Date(ws);
              we.setDate(ws.getDate() + 6);
              return rDate >= ws && rDate <= we;
            } else {
              return rDate.getMonth() === d.getMonth() && rDate.getFullYear() === d.getFullYear();
            }
          });
          break;
        }
        case 'operator':
          toDelete = records.filter(r => r.usuario === value);
          break;
        default:
          toDelete = [];
      }

      if (toDelete.length === 0) {
        toast('Nenhum registro encontrado para excluir', { icon: 'ℹ️' });
        return;
      }

      // Batch delete
      const BATCH = 450;
      for (let i = 0; i < toDelete.length; i += BATCH) {
        const batch = writeBatch(db);
        const chunk = toDelete.slice(i, i + BATCH);
        for (const rec of chunk) {
          if (rec.id) batch.delete(doc(db, 'records', rec.id));
        }
        await batch.commit();
      }

      const deleteIds = new Set(toDelete.map(r => r.id));
      setRecords(prev => prev.filter(r => !deleteIds.has(r.id)));

      toast.success(`${toDelete.length} registros excluídos com sucesso!`);
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Erro ao excluir registros');
    }
  }, [records]);

  const value: AppContextType = {
    records, operators, filters, loading, setFilters,
    importRecords, deleteRecords,
    filteredRecords, filteredTasks, filteredMetrics, dashboardData, insights,
    refreshData: fetchData, sidebarOpen, setSidebarOpen,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
