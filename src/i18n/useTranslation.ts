import { useTranslation as useI18nextTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUAGE_KEY = '@app_language';

export function useTranslation() {
    const { t, i18n } = useI18nextTranslation();

    const changeLanguage = async (lng: string) => {
        try {
            await i18n.changeLanguage(lng);
            await AsyncStorage.setItem(LANGUAGE_KEY, lng);
        } catch (e) {
            console.error('Failed to change language', e);
        }
    };

    return { t, changeLanguage, currentLanguage: i18n.language };
}
