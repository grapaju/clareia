
import { useContext } from 'react';
import { BillingContext } from '@/contexts/BillingContext.jsx';

export function useBillingContext() {
  const context = useContext(BillingContext);
  
  if (!context) {
    throw new Error('useBillingContext must be used within a BillingProvider');
  }
  
  return context;
}
