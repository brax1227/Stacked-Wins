import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService } from '../services/authService';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      login: async (email: string, password: string) => {
        const response = await authService.login({ email, password });
        set({
          user: response.user,
          isAuthenticated: true,
        });
      },
      register: async (email: string, password: string) => {
        const response = await authService.register({ email, password });
        set({
          user: response.user,
          isAuthenticated: true,
        });
      },
      logout: () => {
        authService.logout();
        set({
          user: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
