import React, { createContext, useContext, useState, useEffect } from 'react';
import { getMe } from './api';

interface User { id: string; username: string; name: string; email: string; role: string; }
interface AuthCtx { user: User | null; token: string | null; setAuth: (token: string, user: User) => void; logout: () => void; }

const AuthContext = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(() => {
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  });

  useEffect(() => {
    if (token && !user) {
      getMe().then(setUser).catch(() => logout());
    }
  }, [token]);

  const setAuth = (t: string, u: User) => {
    localStorage.setItem('token', t);
    localStorage.setItem('user', JSON.stringify(u));
    setToken(t); setUser(u);
  };

  const logout = () => {
    localStorage.removeItem('token'); localStorage.removeItem('user');
    setToken(null); setUser(null);
  };

  return <AuthContext.Provider value={{ user, token, setAuth, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
