
import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

const LOW_STIMULATION_KEY = 'clareia_low_stimulation_mode';

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('clareia_theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [lowStimulationMode, setLowStimulationMode] = useState(() => localStorage.getItem(LOW_STIMULATION_KEY) === 'true');

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    root.classList.toggle('low-stimulation', lowStimulationMode);
    localStorage.setItem('clareia_theme', theme);
    localStorage.setItem(LOW_STIMULATION_KEY, String(lowStimulationMode));
  }, [theme, lowStimulationMode]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const toggleLowStimulationMode = () => {
    setLowStimulationMode((prev) => !prev);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, lowStimulationMode, toggleLowStimulationMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
