import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Upload, Trophy, AlertTriangle,
  TrendingUp, Brain, Settings, Menu, X,
  Package, Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/import', icon: Upload, label: 'Importar' },
  { path: '/ranking', icon: Trophy, label: 'Ranking' },
  { path: '/alerts', icon: AlertTriangle, label: 'Alertas' },
  { path: '/evolution', icon: TrendingUp, label: 'Evolução' },
  { path: '/insights', icon: Brain, label: 'Insights IA' },
  { path: '/settings', icon: Settings, label: 'Configurações' },
];

export default function Sidebar() {
  const { sidebarOpen, setSidebarOpen } = useApp();


  return (
    <>
      {/* Mobile toggle */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 bg-gray-900/90 backdrop-blur rounded-xl border border-gray-800 text-slate-300 hover:text-white transition-colors"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-40 bg-[#111827] border-r border-gray-800/60 flex flex-col
          transition-transform duration-300 ease-in-out w-64
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
      >
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-gray-800/60 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Zap size={20} className="text-blue-400" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm text-slate-100 leading-tight">Produtividade</span>
            <span className="text-[10px] text-slate-500 leading-tight">Ressuprimento</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                  isActive
                    ? 'bg-blue-500/10 text-blue-400 shadow-sm'
                    : 'text-slate-400 hover:bg-gray-800/60 hover:text-slate-200'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={19} className={isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'} />
                  <span className="text-sm font-medium">{item.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400"
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800/60 shrink-0">
          <div className="flex items-center gap-2">
            <Package size={14} className="text-slate-600" />
            <div>
              <p className="text-[10px] text-slate-600">Desenvolvido por</p>
              <p className="text-xs text-slate-400 font-medium">Guilherme Lopes</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
