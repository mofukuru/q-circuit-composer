import React from 'react';
import { useTranslation } from 'react-i18next';
import './LanguageSwitcher.css';

const LanguageSwitcher: React.FC = () => {
  const { t, i18n } = useTranslation();

  return (
    <div className="language-switcher">
      <button onClick={() => i18n.changeLanguage('en')} disabled={i18n.language.startsWith('en')} className="lang-btn">
        {t('english')}
      </button>
      <button onClick={() => i18n.changeLanguage('ja')} disabled={i18n.language.startsWith('ja')} className="lang-btn">
        {t('japanese')}
      </button>
    </div>
  );
};

export default LanguageSwitcher;
