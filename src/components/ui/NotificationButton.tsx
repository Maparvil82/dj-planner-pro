import darkPalette from '../../theme/darkPalette.json';
import { Text, TouchableOpacity, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
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
                padding: 18,
                borderRadius: 24,
                borderWidth: dark ? 0 : 1,
                borderColor: dark ? darkPalette.border : '#e6e9f2',
                backgroundColor: dark ? darkPalette.surface : '#fff',
                flexDirection: 'row',
                gap: 12,
                alignItems: 'center',
            }}
        >
            <View style={{ flex: 1, gap: 5 }}>
                <Text
                    style={[{
                        color: dark ? darkPalette.text : '#202538',
                        fontSize: 15,
                        fontWeight: '700',
                    }, dark && { color: darkPalette.onSurface }]}
                >
                    {t('notifications.title')}
                </Text>
                <Text
                    style={[{
                        color: dark ? darkPalette.muted : '#6d7588',
                        fontSize: 12,
                        lineHeight: 18,
                    }, dark && { color: darkPalette.onSurface }]}
                >
                    {t('notifications.intro')}
                </Text>
            </View>
            {count > 0 && (
                <View
                    style={{
                        minWidth: 24,
                        height: 24,
                        paddingHorizontal: 6,
                        borderRadius: 12,
                        backgroundColor: '#6554df',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Text
                        style={{
                            color: '#fff',
                            fontSize: 11,
                            fontWeight: '700',
                        }}
                    >
                        {count > 99 ? '99+' : count}
                    </Text>
                </View>
            )}
            <ChevronRight size={17} color={dark ? darkPalette.muted : '#6d7588'} />
        </TouchableOpacity>
    );
}
