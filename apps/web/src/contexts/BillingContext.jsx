
import React, { createContext, useState, useEffect } from 'react';
import apiClient, { getCurrentAccountId } from '@/lib/apiClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';

export const BillingContext = createContext();

export function BillingProvider({ children }) {
  const { currentUser } = useAuth();
  const [charges, setCharges] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      setCharges([]);
      setIsLoading(false);
      return;
    }

    const fetchBillings = async () => {
      try {
        const records = await apiClient.collection('billings').getFullList({
          sort: 'dueDate',
          $autoCancel: false
        });
        setCharges(records);
      } catch (error) {
        console.error("Erro ao buscar cobranças:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBillings();
  }, [currentUser]);

  const addCharge = async (chargeData) => {
    try {
      const accountId = currentUser?.currentAccountId || getCurrentAccountId();
      const record = await apiClient.collection('billings').create({
        ...chargeData,
        userId: currentUser?.id,
        ...(accountId ? { accountId } : {})
      }, { $autoCancel: false });
      setCharges(prev => [...prev, record]);
      return record;
    } catch (error) {
      console.error(error);
      toast.error('Erro ao adicionar cobrança.');
      throw error;
    }
  };

  const updateCharge = async (id, updates) => {
    try {
      const record = await apiClient.collection('billings').update(id, updates, { $autoCancel: false });
      setCharges(prev => prev.map(c => c.id === id ? record : c));
      return record;
    } catch (error) {
      console.error(error);
      toast.error('Erro ao atualizar cobrança.');
      throw error;
    }
  };

  const deleteCharge = async (id) => {
    try {
      await apiClient.collection('billings').delete(id, { $autoCancel: false });
      setCharges(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir cobrança.');
      throw error;
    }
  };

  const markAsPaid = (id) => updateCharge(id, { status: 'Paga' });

  return (
    <BillingContext.Provider value={{ charges, addCharge, updateCharge, deleteCharge, markAsPaid, isLoading }}>
      {children}
    </BillingContext.Provider>
  );
}
