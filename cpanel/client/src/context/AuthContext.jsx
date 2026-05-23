import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) { setUser(null); setLoading(false); return; }
    try {
      const { user } = await api.get('/auth/me');
      setUser(user);
    } catch {
      setToken('');
      setUser(null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    setToken(res.token);
    setUser(res.user);
    return res.user;
  };

  const logout = () => { setToken(''); setUser(null); };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
