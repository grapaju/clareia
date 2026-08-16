
import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  changePasswordWithApi,
  clearAuthSession,
  getMeFromApi,
  getStoredAuthToken,
  getStoredAuthUser,
  loginWithApi,
  saveAuthSession,
  signupWithApi,
} from '@/services/authApiService.js';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => getStoredAuthUser());
  const [token, setToken] = useState(() => getStoredAuthToken());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      if (!token) {
        if (mounted) setIsLoading(false);
        return;
      }

      try {
        const result = await getMeFromApi();
        if (mounted && result?.user) {
          setCurrentUser(result.user);
          saveAuthSession({ token, user: result.user });
        }
      } catch {
        clearAuthSession();
        if (mounted) {
          setCurrentUser(null);
          setToken('');
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  const login = async (email, password) => {
    try {
      const authData = await loginWithApi({ email, password });
      if (!authData?.token || !authData?.user) {
        return { success: false, error: 'Resposta de login invalida.' };
      }

      saveAuthSession({ token: authData.token, user: authData.user });
      setToken(authData.token);
      setCurrentUser(authData.user);
      return { success: true };
    } catch (error) {
      console.error(error);
      return { success: false, error: 'E-mail ou senha incorretos.' };
    }
  };

  const signup = async (email, password, passwordConfirm) => {
    try {
      const authData = await signupWithApi({
        email,
        password,
        passwordConfirm,
      });

      if (!authData?.token || !authData?.user) {
        return { success: false, error: 'Resposta de cadastro invalida.' };
      }

      saveAuthSession({ token: authData.token, user: authData.user });
      setToken(authData.token);
      setCurrentUser(authData.user);
      return { success: true };
    } catch (error) {
      console.error(error);
      return { success: false, error: 'Não foi possível criar a conta. Verifique os dados.' };
    }
  };

  const logout = () => {
    clearAuthSession();
    setToken('');
    setCurrentUser(null);
    toast.success('Sessão encerrada com sucesso.');
  };

  const changePassword = async ({ currentPassword, newPassword, newPasswordConfirm }) => {
    if (!currentUser?.id) {
      return { success: false, error: 'Sessao invalida. Faca login novamente.' };
    }

    try {
      await changePasswordWithApi({
        currentPassword,
        newPassword,
        newPasswordConfirm,
      });

      const refreshed = await getMeFromApi();
      if (refreshed?.user) {
        setCurrentUser(refreshed.user);
        saveAuthSession({ token, user: refreshed.user });
      }

      return { success: true };
    } catch (error) {
      console.error(error);
      const fallbackMessage = 'Nao foi possivel alterar a senha. Verifique a senha atual e tente novamente.';
      const parsedMessage = error?.response?.message || error?.message;
      return { success: false, error: parsedMessage || fallbackMessage };
    }
  };

  const value = {
    currentUser,
    isAuthenticated: Boolean(token && currentUser?.id),
    login,
    signup,
    changePassword,
    logout,
    isLoading
  };

  return (
    <AuthContext.Provider value={value}>
      {!isLoading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
