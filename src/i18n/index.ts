import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './languages/en.json';
import es from './languages/es.json';
import de from './languages/de.json';
import fr from './languages/fr.json';
import it from './languages/it.json';
import pt from './languages/pt.json';
import ja from './languages/ja.json';

const LANGUAGE_KEY = '@app_language';

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
    let savedLanguage = null;
    try {
        savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
    } catch (e) {
        console.error('Failed to fetch preferred language from storage', e);
    }

    // Get device language, slice only the first 2 characters ('en-US' -> 'en')
    const deviceLanguageCode = Localization.getLocales()[0]?.languageCode || 'en';
    const deviceLanguage = resources[deviceLanguageCode as keyof typeof resources] ? deviceLanguageCode : 'en';

    const defaultLanguage = savedLanguage || deviceLanguage;

    i18n
        .use(initReactI18next)
        .init({
            resources,
            lng: defaultLanguage,
            fallbackLng: 'en',
            interpolation: {
                escapeValue: false, // React already does escaping
            },
        });
};

// Initial synchronous call fallback in case we need it, though AppProviders normally waits
initI18n();

export default i18n;
