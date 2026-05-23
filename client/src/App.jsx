import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import { PageLoader } from './components/Spinner.jsx';

const Login         = lazy(() => import('./pages/Login.jsx'));
const Dashboard     = lazy(() => import('./pages/Dashboard.jsx'));
const Products      = lazy(() => import('./pages/Products.jsx'));
const Warehouses    = lazy(() => import('./pages/Warehouses.jsx'));
const Customers     = lazy(() => import('./pages/Customers.jsx'));
const Suppliers     = lazy(() => import('./pages/Suppliers.jsx'));
const Purchases     = lazy(() => import('./pages/Purchases.jsx'));
const Sales         = lazy(() => import('./pages/Sales.jsx'));
const Scanner       = lazy(() => import('./pages/Scanner.jsx'));
const AIAssistant   = lazy(() => import('./pages/AIAssistant.jsx'));
const Reports       = lazy(() => import('./pages/Reports.jsx'));
const Notifications = lazy(() => import('./pages/Notifications.jsx'));
const Users         = lazy(() => import('./pages/Users.jsx'));
const Settings      = lazy(() => import('./pages/Settings.jsx'));

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader label="Authenticating…" />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index            element={<Dashboard />} />
          <Route path="products"     element={<Products />} />
          <Route path="warehouses"   element={<Warehouses />} />
          <Route path="customers"    element={<Customers />} />
          <Route path="suppliers"    element={<Suppliers />} />
          <Route path="purchases"    element={<Purchases />} />
          <Route path="sales"        element={<Sales />} />
          <Route path="scanner"      element={<Scanner />} />
          <Route path="ai"           element={<AIAssistant />} />
          <Route path="reports"      element={<Reports />} />
          <Route path="notifications"element={<Notifications />} />
          <Route path="users"        element={<AdminRoute><Users /></AdminRoute>} />
          <Route path="settings"     element={<AdminRoute><Settings /></AdminRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
