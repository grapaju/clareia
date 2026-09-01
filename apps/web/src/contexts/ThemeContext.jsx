
import React, { createContext, useContext, useEffect, useLayoutEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { applyUserPreferencesToRoot, loadUserPreferences, readUserPreferences, saveUserPreferences } from '@/services/userPreferencesService.js';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const { currentUser } = useAuth();
  const userId = currentUser?.id || '';
  const [themeSetting, setThemeSetting] = useState(() => {
    const saved = localStorage.getItem('clareia_theme');
    return ['light', 'dark', 'auto'].includes(saved) ? saved : 'auto';
  });
  const [theme, setResolvedTheme] = useState(() => themeSetting === 'auto'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : themeSetting);
  const [calmPreference, setCalmPreference] = useState(() => ({
    userId,
    enabled: userId ? readUserPreferences(userId).visualProfile === 'tranquilo' : false,
  }));
  const lowStimulationMode = calmPreference.userId === userId ? calmPreference.enabled : false;

  useLayoutEffect(() => {
    const preferences = userId ? readUserPreferences(userId) : readUserPreferences('');
    applyUserPreferencesToRoot(preferences);
    setCalmPreference({
      userId,
      enabled: userId ? preferences.visualProfile === 'tranquilo' : false,
    });
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    loadUserPreferences(userId).then((preferences) => {
      if (!active) return;
      applyUserPreferencesToRoot(preferences);
      setCalmPreference({ userId, enabled: preferences.visualProfile === 'tranquilo' });
    });
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    const root = window.document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const resolved = themeSetting === 'auto' ? (media.matches ? 'dark' : 'light') : themeSetting;
      root.classList.remove('light', 'dark');
      root.classList.add(resolved);
      setResolvedTheme(resolved);
    };

    applyTheme();
    media.addEventListener('change', applyTheme);
    localStorage.setItem('clareia_theme', themeSetting);
    return () => media.removeEventListener('change', applyTheme);
  }, [themeSetting]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.toggle('low-stimulation', lowStimulationMode);
  }, [lowStimulationMode]);

  const toggleTheme = () => {
    setThemeSetting(theme === 'light' ? 'dark' : 'light');
  };

  const setTheme = (value) => setThemeSetting(['light', 'dark', 'auto'].includes(value) ? value : 'auto');

  const setLowStimulationMode = (enabled, options = {}) => {
    const nextEnabled = Boolean(enabled);
    setCalmPreference({ userId, enabled: nextEnabled });
    if (userId && options.persist !== false) void saveUserPreferences(userId, { visualProfile: nextEnabled ? 'tranquilo' : 'equilibrado' });
  };

  const toggleLowStimulationMode = () => setLowStimulationMode(!lowStimulationMode);

  return (
    <ThemeContext.Provider value={{ theme, themeSetting, setTheme, toggleTheme, lowStimulationMode, setLowStimulationMode, toggleLowStimulationMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
