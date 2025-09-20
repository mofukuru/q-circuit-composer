import React, { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import './ThemeSwitcher.css';

const ThemeSwitcher = () => {
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    // If no theme is saved, you might want to check the user's system preference
    if (savedTheme) {
      return savedTheme;
    }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Listen for changes in system preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      // Only change if the user hasn't manually set a theme
      if (!localStorage.getItem('theme')) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  return (
    <button 
      onClick={toggleTheme} 
      className="theme-switcher" 
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      <Sun size={20} className="sun" />
      <Moon size={20} className="moon" />
    </button>
  );
};

export default ThemeSwitcher;