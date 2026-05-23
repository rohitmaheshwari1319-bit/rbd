import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import { PageLoader } from './components/Spinner.jsx';

const Login        = lazy(() => import('./pages/Login.jsx'));
const Dashboard    = lazy(() => import('./pages/Dashboard.jsx'));
const FileManager  = lazy(() => import('./pages/FileManager.jsx'));
const Databases    = lazy(() => import('./pages/Databases.jsx'));
const Email        = lazy(() => import('./pages/Email.jsx'));
const Domains      = lazy(() => import('./pages/Domains.jsx'));
const DNS          = lazy(() => import('./pages/DNS.jsx'));
const FTP          = lazy(() => import('./pages/FTP.jsx'));
const Cron         = lazy(() => import('./pages/Cron.jsx'));
const SSL          = lazy(() => import('./pages/SSL.jsx'));
const Statistics   = lazy(() => import('./pages/Statistics.jsx'));
const Backup       = lazy(() => import('./pages/Backup.jsx'));
const Software     = lazy(() => import('./pages/Software.jsx'));
const Preferences  = lazy(() => import('./pages/Preferences.jsx'));

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader label="Authenticating…" />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="files"       element={<FileManager />} />
          <Route path="databases"   element={<Databases />} />
          <Route path="email"       element={<Email />} />
          <Route path="domains"     element={<Domains />} />
          <Route path="dns"         element={<DNS />} />
          <Route path="ftp"         element={<FTP />} />
          <Route path="cron"        element={<Cron />} />
          <Route path="ssl"         element={<SSL />} />
          <Route path="stats"       element={<Statistics />} />
          <Route path="backup"      element={<Backup />} />
          <Route path="software"    element={<Software />} />
          <Route path="preferences" element={<Preferences />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
