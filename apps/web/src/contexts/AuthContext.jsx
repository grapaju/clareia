
import React, { createContext, useContext, useState, useEffect } from 'react';
import pb from '@/lib/pocketbaseClient.js';
import { toast } from 'sonner';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(pb.authStore.model);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = pb.authStore.onChange((token, model) => {
      setCurrentUser(model);
    });
    setIsLoading(false);
    return () => unsubscribe();
  }, []);

  const login = async (email, password) => {
    try {
      const authData = await pb.collection('users').authWithPassword(email, password, { $autoCancel: false });
      setCurrentUser(authData.record);
      return { success: true };
    } catch (error) {
      console.error(error);
      return { success: false, error: 'E-mail ou senha incorretos.' };
    }
  };

  const signup = async (email, password, passwordConfirm) => {
    try {
      await pb.collection('users').create({
        email,
        password,
        passwordConfirm,
      }, { $autoCancel: false });
      
      await login(email, password);
      return { success: true };
    } catch (error) {
      console.error(error);
      return { success: false, error: 'Não foi possível criar a conta. Verifique os dados.' };
    }
  };

  const logout = () => {
    pb.authStore.clear();
    setCurrentUser(null);
    toast.success('Sessão encerrada com sucesso.');
  };

  const value = {
    currentUser,
    isAuthenticated: pb.authStore.isValid,
    login,
    signup,
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
