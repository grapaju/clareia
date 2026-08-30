
import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

const LOW_STIMULATION_KEY = 'clareia_low_stimulation_mode';

export function ThemeProvider({ children }) {
  const [themeSetting, setThemeSetting] = useState(() => {
    const saved = localStorage.getItem('clareia_theme');
    return ['light', 'dark', 'auto'].includes(saved) ? saved : 'auto';
  });
  const [theme, setResolvedTheme] = useState(() => themeSetting === 'auto'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : themeSetting);
  const [lowStimulationMode, setLowStimulationMode] = useState(() => localStorage.getItem(LOW_STIMULATION_KEY) === 'true');

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
    localStorage.setItem(LOW_STIMULATION_KEY, String(lowStimulationMode));
  }, [lowStimulationMode]);

  const toggleTheme = () => {
    setThemeSetting(theme === 'light' ? 'dark' : 'light');
  };

  const setTheme = (value) => setThemeSetting(['light', 'dark', 'auto'].includes(value) ? value : 'auto');

  const toggleLowStimulationMode = () => {
    setLowStimulationMode((prev) => !prev);
  };

  return (
    <ThemeContext.Provider value={{ theme, themeSetting, setTheme, toggleTheme, lowStimulationMode, setLowStimulationMode, toggleLowStimulationMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
