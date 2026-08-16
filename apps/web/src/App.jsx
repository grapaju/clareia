
import React from 'react';
import { Navigate, Route, Routes, BrowserRouter as Router } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/contexts/ThemeContext.jsx';
import { AuthProvider } from '@/contexts/AuthContext.jsx';
import { TaskProvider } from '@/contexts/TaskContext.jsx';
import { AppModeProvider } from '@/contexts/AppModeContext.jsx';
import ProtectedRoute from '@/components/ProtectedRoute.jsx';
import ModeRouteGuard from '@/components/ModeRouteGuard.jsx';

import LoginPage from './pages/LoginPage.jsx';
import SignupPage from './pages/SignupPage.jsx';
import HomePage from './pages/HomePage.jsx';
import UnloadMindPage from './pages/UnloadMindPage.jsx';
import ClearPlanPage from './pages/ClearPlanPage.jsx';
import PrioritiesPage from './pages/PrioritiesPage.jsx';
import ProjectsPage from './pages/ProjectsPage.jsx';
import FocusPage from './pages/FocusPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import AccountPage from './pages/AccountPage.jsx';
import GoogleDriveOAuthPage from './pages/GoogleDriveOAuthPage.jsx';
import WaitingReturnPage from './pages/WaitingReturnPage.jsx';
import RoutinesPage from './pages/RoutinesPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import CalendarPage from './pages/CalendarPage.jsx';
import GuidePage from './pages/GuidePage.jsx';

function App() {
  const withProtectedMode = (element) => (
    <ProtectedRoute>
      <ModeRouteGuard>{element}</ModeRouteGuard>
    </ProtectedRoute>
  );

  return (
    <ThemeProvider>
      <AuthProvider>
        <AppModeProvider>
          <TaskProvider>
            <Router>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                
                <Route path="/" element={withProtectedMode(<HomePage />)} />
                <Route path="/descarregar-mente" element={withProtectedMode(<UnloadMindPage />)} />
                <Route path="/criar-plano" element={withProtectedMode(<UnloadMindPage />)} />
                <Route path="/notas" element={<Navigate to="/descarregar-mente" replace />} />
                <Route path="/inbox" element={<Navigate to="/descarregar-mente" replace />} />
                <Route path="/plano-clareado" element={withProtectedMode(<ClearPlanPage />)} />
                <Route path="/prioridades" element={withProtectedMode(<PrioritiesPage />)} />
                <Route path="/projects" element={withProtectedMode(<ProjectsPage />)} />
                <Route path="/aguardando-retorno" element={withProtectedMode(<WaitingReturnPage />)} />
                <Route path="/rotinas" element={withProtectedMode(<RoutinesPage />)} />
                <Route path="/foco" element={withProtectedMode(<FocusPage />)} />
                <Route path="/calendario" element={withProtectedMode(<CalendarPage />)} />
                <Route path="/relatorios" element={withProtectedMode(<ReportsPage />)} />
                <Route path="/guia" element={withProtectedMode(<GuidePage />)} />
                <Route path="/configuracoes" element={withProtectedMode(<SettingsPage />)} />
                <Route path="/conta" element={withProtectedMode(<AccountPage />)} />
                <Route path="/integracoes/google-drive-oauth" element={withProtectedMode(<GoogleDriveOAuthPage />)} />
                
                <Route path="*" element={withProtectedMode(<HomePage />)} />
              </Routes>
              <Toaster />
            </Router>
          </TaskProvider>
        </AppModeProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
