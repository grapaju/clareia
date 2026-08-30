import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { isPrivilegedUser } from '@/lib/accessControl.js';

export default function AdminRoute({ children }) {
  const { currentUser } = useAuth();
  return isPrivilegedUser(currentUser) ? children : <Navigate to="/" replace />;
}