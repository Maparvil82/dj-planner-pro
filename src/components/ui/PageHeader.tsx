import type { ReactNode } from 'react';
import { Text, View, Pressable } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from '../../i18n/useTranslation';
import { useTheme } from '../../contexts/ThemeContext';

export function PageHeader({
    title,
    subtitle,
    children,
    leading,
    action,
    showPlaces = false,
}: {
    title: string;
    subtitle: string;
    children?: ReactNode;
    leading?: ReactNode;
    action?: ReactNode;
    showPlaces?: boolean;
}) {
    const { activeTheme } = useTheme();
    const dark = activeTheme === 'dark';
    const router = useRouter();
    const { t } = useTranslation();
    return (
        <View
            style={{
                paddingHorizontal: 24,
                paddingTop: 18,
                paddingBottom: 24,
                backgroundColor: dark ? '#0d1220' : '#f5f6fa',
            }}
        >
            <View
                style={{
                    minHeight: 58,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                }}
            >
                {leading}
                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.7}
                        style={{
                            fontSize: 29,
                            lineHeight: 36,
                            fontWeight: '800',
                            letterSpacing: -0.9,
                            color: dark ? '#f3f4f8' : '#202538',
                        }}
                    >
                        {title}
                    </Text>
                    <Text
                        numberOfLines={1}
                        style={{
                            fontSize: 12,
                            lineHeight: 18,
                            marginTop: 4,
                            color: dark ? '#a8b2c6' : '#6d7588',
                        }}
                    >
                        {subtitle}
                    </Text>
                </View>
                {children}
                {action}
                {showPlaces && (
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('venues_title')}
                        onPress={() => router.push('/venues')}
                        style={{
                            width: 46,
                            height: 46,
                            borderRadius: 16,
                            backgroundColor: dark ? '#20273b' : '#e9eaf3',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <MapPin
                            size={20}
                            color={dark ? '#f3f4f8' : '#202538'}
                        />
                    </Pressable>
                )}
            </View>
        </View>
    );
}
