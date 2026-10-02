import { TouchableOpacity } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from '../../i18n/useTranslation';
export function AddSessionButton() {
    const router = useRouter();
    const { t } = useTranslation();
    return (
        <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('insights.add')}
            onPress={() => router.push('/add-session')}
            style={{
                height: 46,
                width: 46,
                borderRadius: 16,
                backgroundColor: '#6554df',
                justifyContent: 'center',
                alignItems: 'center',
            }}
        >
            <Plus size={24} color="#fff" />
        </TouchableOpacity>
    );
}
