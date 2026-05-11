import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AppProvider } from './context/AppContext';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Import from './pages/Import';
import Ranking from './pages/Ranking';
import Alerts from './pages/Alerts';
import Evolution from './pages/Evolution';
import Insights from './pages/Insights';
import Settings from './pages/Settings';

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <div className="flex min-h-screen bg-[#0f172a]">
          <Sidebar />
          <main className="flex-1 lg:ml-64 min-h-screen">
            <div className="p-4 lg:p-6 max-w-[1600px] mx-auto">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/import" element={<Import />} />
                <Route path="/ranking" element={<Ranking />} />
                <Route path="/alerts" element={<Alerts />} />
                <Route path="/evolution" element={<Evolution />} />
                <Route path="/insights" element={<Insights />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </div>
          </main>
        </div>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1e293b',
              color: '#f1f5f9',
              border: '1px solid #334155',
              borderRadius: '12px',
              fontSize: '13px',
            },
          }}
        />
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
