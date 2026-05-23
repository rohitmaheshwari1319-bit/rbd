import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, Warehouse, Users, Truck, ShoppingCart, Receipt,
  ScanLine, Bell, BarChart3, Sparkles, Settings, LogOut, Menu, X, Sun, Moon, ShieldCheck
} from 'lucide-react';
import { LogoMark } from './Logo.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { api } from '../api/client.js';

const NAV = [
  { to: '/',             label: 'Dashboard',     icon: LayoutDashboard },
  { to: '/products',     label: 'Products',      icon: Package },
  { to: '/warehouses',   label: 'Warehouses',    icon: Warehouse },
  { to: '/customers',    label: 'Customers',     icon: Users },
  { to: '/suppliers',    label: 'Suppliers',     icon: Truck },
  { to: '/purchases',    label: 'Purchases',     icon: ShoppingCart },
  { to: '/sales',        label: 'Sales',         icon: Receipt },
  { to: '/scanner',      label: 'Scanner',       icon: ScanLine },
  { to: '/ai',           label: 'AI Assistant',  icon: Sparkles },
  { to: '/reports',      label: 'Reports',       icon: BarChart3 },
  { to: '/notifications',label: 'Notifications', icon: Bell }
];

const ADMIN_NAV = [
  { to: '/users',    label: 'Users',    icon: ShieldCheck, role: 'admin' },
  { to: '/settings', label: 'Settings', icon: Settings,  role: 'admin' }
];

export default function Layout() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const nav = useNavigate();
  const [unread, setUnread] = useState(0);

  useEffect(() => { setOpen(false); }, [location.pathname]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const r = await api.get('/notifications/unread-count');
        if (mounted) setUnread(r.count || 0);
      } catch { /* ignore */ }
    };
    load();
    const t = setInterval(load, 30000);
    return () => { mounted = false; clearInterval(t); };
  }, [location.pathname]);

  const visibleNav = [...NAV, ...ADMIN_NAV.filter(n => user?.role === 'admin')];

  return (
    <div className="min-h-screen bg-ink-50 dark:bg-ink-950 text-ink-900 dark:text-ink-100">
      {/* Mobile topbar */}
      <header className="lg:hidden sticky top-0 z-30 bg-white/85 dark:bg-ink-900/85 backdrop-blur border-b border-ink-100 dark:border-ink-800 px-3 py-2 flex items-center gap-3">
        <button onClick={() => setOpen(o => !o)} className="btn-ghost !p-2" aria-label="Menu">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
        <LogoMark className="h-7 w-auto text-rbd-600" />
        <div className="ml-auto flex items-center gap-1">
          <button onClick={toggle} className="btn-ghost !p-2" aria-label="Toggle theme">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-40 w-72 transform bg-white dark:bg-ink-900 border-r border-ink-100 dark:border-ink-800 transition-transform duration-200
                ${open ? 'translate-x-0' : '-translate-x-full'} lg:static lg:translate-x-0 lg:flex flex flex-col`}>
          <div className="px-5 py-5 border-b border-ink-100 dark:border-ink-800 flex items-center gap-3">
            <LogoMark className="h-9 w-auto text-rbd-600" />
            <div className="leading-tight">
              <div className="text-sm font-extrabold tracking-wide">RBD INVENTORY</div>
              <div className="text-[11px] text-ink-500 dark:text-ink-400 font-semibold tracking-[0.2em]">TRUST OF INDIA</div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
            {visibleNav.map(item => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'}
                className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
                <item.icon size={18} />
                <span>{item.label}</span>
                {item.to === '/notifications' && unread > 0 && (
                  <span className="ml-auto badge-red text-[10px] !px-1.5">{unread}</span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="px-3 py-3 border-t border-ink-100 dark:border-ink-800">
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-rbd-500 to-rbd-700 text-white grid place-items-center font-bold">
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{user?.name}</div>
                <div className="text-xs text-ink-500 dark:text-ink-400 truncate capitalize">{user?.role}</div>
              </div>
              <button onClick={() => { logout(); nav('/login'); }}
                      className="btn-ghost !p-2" title="Sign out">
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </aside>

        {/* Backdrop on mobile */}
        {open && <div onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-black/40 lg:hidden" />}

        {/* Main */}
        <main className="flex-1 min-w-0">
          <header className="hidden lg:flex sticky top-0 z-20 items-center gap-4 px-6 py-3 bg-white/85 dark:bg-ink-900/85 backdrop-blur border-b border-ink-100 dark:border-ink-800">
            <PageTitle />
            <div className="ml-auto flex items-center gap-2">
              <button onClick={toggle} className="btn-ghost !p-2" aria-label="Toggle theme">
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <NavLink to="/notifications" className="btn-ghost !p-2 relative">
                <Bell size={18} />
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-rbd-600 text-white text-[10px] rounded-full min-w-[18px] h-[18px] grid place-items-center px-1">{unread}</span>
                )}
              </NavLink>
            </div>
          </header>

          <div className="px-4 py-5 sm:px-6 lg:px-8 lg:py-6 max-w-[1500px] mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function PageTitle() {
  const { pathname } = useLocation();
  const item = [...NAV, ...ADMIN_NAV].find(i => i.to === pathname || (i.to !== '/' && pathname.startsWith(i.to))) || NAV[0];
  return (
    <div className="flex items-center gap-3">
      <span className="text-rbd-600"><item.icon size={20} /></span>
      <h1 className="text-base font-bold tracking-tight">{item.label}</h1>
    </div>
  );
}
