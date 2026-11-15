import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './languages/en.json';
import es from './languages/es.json';
import de from './languages/de.json';
import fr from './languages/fr.json';
import it from './languages/it.json';
import pt from './languages/pt.json';
import ja from './languages/ja.json';

const resources = {
    en: { translation: en },
    es: { translation: es },
    de: { translation: de },
    fr: { translation: fr },
    it: { translation: it },
    pt: { translation: pt },
    ja: { translation: ja },
};

export const initI18n = async () => {
    if (i18n.isInitialized) {
        // Fast Refresh retains the singleton. Replace its bundled resources
        // without resetting a language the user may already have selected.
        for (const [language, namespaces] of Object.entries(resources)) {
            i18n.addResourceBundle(
                language,
                'translation',
                namespaces.translation,
                true,
                true,
            );
        }
        i18n.emit('languageChanged', i18n.language);
        return;
    }
    const deviceLanguageCode =
        Localization.getLocales()[0]?.languageCode || 'en';
    const deviceLanguage = resources[
        deviceLanguageCode as keyof typeof resources
    ]
        ? deviceLanguageCode
        : 'en';
    await i18n.use(initReactI18next).init({
        resources,
        lng: deviceLanguage,
        fallbackLng: 'en',
        initAsync: false,
        interpolation: { escapeValue: false },
        react: {
            bindI18n: 'languageChanged loaded',
            bindI18nStore: 'added removed',
        },
    });
};

void initI18n();
export default i18n;
