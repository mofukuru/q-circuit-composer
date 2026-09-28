import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en';
import ja from './locales/ja';

const LANGUAGE_KEY = 'qcc:language';

function initialLanguage(): string {
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    if (saved) return saved;
  } catch {
    // storage unavailable
  }
  return navigator.language.toLowerCase().startsWith('ja') ? 'ja' : 'en';
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ja: { translation: ja } },
  lng: initialLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
  try {
    localStorage.setItem(LANGUAGE_KEY, lng);
  } catch {
    // storage unavailable
  }
});
document.documentElement.lang = i18n.language;

export default i18n;
