import { useDarkPalette } from '../../contexts/ThemeContext';
import type { ReactNode } from 'react';
import { Text, View, Pressable } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from '../../i18n/useTranslation';
import { useTheme } from '../../contexts/ThemeContext';
import { AccountAvatarButton } from '../navigation/AccountDrawer';

export function PageHeaderBody({
    title,
    subtitle,
    badge,
    children,
    leading,
    action,
    showPlaces = false,
    showAccount = false,
}: {
    title: string;
    subtitle: string;
    badge?: string;
    children?: ReactNode;
    leading?: ReactNode;
    action?: ReactNode;
    showPlaces?: boolean;
    showAccount?: boolean;
}) {
    const darkPalette = useDarkPalette();
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
                backgroundColor: dark ? darkPalette.background : '#f5f6fa',
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
                {!!leading && <View style={{ transform: [{ translateY: -((subtitle ? 22 : 0) + (badge ? 15 : 0)) / 2 }] }}>{leading}</View>}
                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                        numberOfLines={badge ? 2 : 1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.7}
                        style={{
                            fontSize: badge ? 25 : 29,
                            lineHeight: 36,
                            fontWeight: '800',
                            letterSpacing: -0.9,
                            color: dark ? darkPalette.text : '#202538',
                        }}
                    >
                        {title}
                    </Text>
                    {badge && <Text style={{ color: dark ? darkPalette.primary : '#6554df', fontSize: 10, fontWeight: '800', marginTop: 3 }}>{badge}</Text>}
                    {!!subtitle && <Text
                        numberOfLines={1}
                        style={{
                            fontSize: 12,
                            lineHeight: 18,
                            marginTop: 4,
                            color: dark ? darkPalette.muted : '#6d7588',
                        }}
                    >
                        {subtitle}
                    </Text>}
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
                            backgroundColor: dark ? darkPalette.raised : '#e9eaf3',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <MapPin
                            size={20}
                            color={dark ? darkPalette.text : '#202538'}
                        />
                    </Pressable>
                )}
                {showAccount && <AccountAvatarButton />}
            </View>
        </View>
    );
}
