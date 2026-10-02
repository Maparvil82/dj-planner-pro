import { Text, TouchableOpacity, View } from 'react-native';
import { Bell } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from '../../i18n/useTranslation';
import { useUnreadNotifications } from '../../hooks/useNotifications';
export function NotificationButton() {
    const router = useRouter();
    const { t } = useTranslation();
    const { activeTheme } = useTheme();
    const unread = useUnreadNotifications();
    const count = unread.data || 0;
    const dark = activeTheme === 'dark';
    return (
        <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t(
                count ? 'notifications.openUnread' : 'notifications.title',
                { count },
            )}
            onPress={() => router.push('/notifications')}
            style={{
                width: 46,
                height: 46,
                borderRadius: 16,
                backgroundColor: dark ? '#20273b' : '#e9eaf3',
                justifyContent: 'center',
                alignItems: 'center',
            }}
        >
            <Bell size={21} color={dark ? '#f3f4f8' : '#202538'} />
            {!!count && (
                <View
                    style={{
                        position: 'absolute',
                        top: -4,
                        right: -3,
                        minWidth: 18,
                        height: 18,
                        paddingHorizontal: 4,
                        borderRadius: 9,
                        backgroundColor: '#6554df',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Text
                        style={{
                            color: '#fff',
                            fontSize: 10,
                            fontWeight: '700',
                        }}
                    >
                        {count > 99 ? '99+' : count}
                    </Text>
                </View>
            )}
        </TouchableOpacity>
    );
}
