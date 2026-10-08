import type { ReactNode } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { X, ArrowRight } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from '../../i18n/useTranslation';

export function SessionFormHeader({
    title,
    subtitle,
    onClose,
    badge,
}: {
    title: string;
    subtitle: string;
    onClose: () => void;
    badge?: string;
}) {
    const { activeTheme } = useTheme();
    const { t } = useTranslation();
    const dark = activeTheme === 'dark';
    return (
        <View
            style={{
                paddingHorizontal: 24,
                paddingTop: 18,
                paddingBottom: 24,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
            }}
        >
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                    numberOfLines={badge ? 2 : 1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                    style={{
                        color: dark ? '#f3f4f8' : '#202538',
                        fontSize: badge ? 25 : 29,
                        lineHeight: 36,
                        fontWeight: '800',
                        letterSpacing: -0.9,
                    }}
                >
                    {title}
                </Text>
                {badge && (
                    <Text
                        style={{
                            color: dark ? '#c7baff' : '#6554df',
                            fontSize: 10,
                            fontWeight: '800',
                            marginTop: 3,
                        }}
                    >
                        {badge}
                    </Text>
                )}
                <Text
                    numberOfLines={1}
                    style={{
                        color: dark ? '#a8b2c6' : '#6d7588',
                        fontSize: 12,
                        lineHeight: 18,
                        marginTop: 4,
                    }}
                >
                    {subtitle}
                </Text>
            </View>
            <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t('back')}
                onPress={onClose}
                style={{
                    width: 46,
                    height: 46,
                    borderRadius: 16,
                    backgroundColor: dark ? '#20273b' : '#e9eaf3',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <X size={22} color={dark ? '#f3f4f8' : '#202538'} />
            </TouchableOpacity>
        </View>
    );
}
type SectionKind =
    | 'event'
    | 'location'
    | 'schedule'
    | 'fee'
    | 'booking'
    | 'participants'
    | 'poster'
    | 'equipment'
    | 'rating'
    | 'notes'
    | 'settings'
    | 'account';
export function SessionFormSection({
    title,
    children,
}: {
    title: string;
    kind: SectionKind;
    children: ReactNode;
}) {
    const { activeTheme } = useTheme();
    const dark = activeTheme === 'dark';
    return (
        <View
            style={{
                backgroundColor: dark ? '#171d2c' : '#fff',
                borderColor: dark ? '#252d40' : '#e9ecf3',
                borderWidth: 1,
                borderRadius: 24,
                padding: 18,
                gap: 18,
            }}
        >
            <View
                style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}
            >
                <Text
                    style={{
                        flex: 1,
                        color: dark ? '#f3f4f8' : '#202538',
                        fontSize: 16,
                        fontWeight: '700',
                    }}
                >
                    {title}
                </Text>
            </View>
            {children}
        </View>
    );
}
export function SessionFormFooter({
    disabled,
    busy,
    onSave,
    label,
}: {
    disabled: boolean;
    busy: boolean;
    onSave: () => void;
    label?: string;
}) {
    const { activeTheme } = useTheme();
    const { t } = useTranslation();
    const dark = activeTheme === 'dark';
    return (
        <View
            style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                paddingHorizontal: 20,
                paddingTop: 14,
                paddingBottom: 20,
                backgroundColor: dark ? '#0d1220' : '#f5f6fa',
                borderTopWidth: 1,
                borderTopColor: dark ? '#252d40' : '#e9ecf3',
            }}
        >
            <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ disabled, busy }}
                activeOpacity={0.8}
                onPress={onSave}
                disabled={disabled}
                style={{
                    width: '100%',
                    maxWidth: 900,
                    alignSelf: 'center',
                    minHeight: 54,
                    padding: 16,
                    borderRadius: 18,
                    backgroundColor: disabled
                        ? dark
                            ? '#39315c'
                            : '#c5bdee'
                        : '#6554df',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                }}
            >
                {busy ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <>
                        <Text
                            style={{
                                color: '#fff',
                                fontWeight: '700',
                                fontSize: 16,
                            }}
                        >
                            {label ?? t('save_session')}
                        </Text>
                        <ArrowRight size={18} color="#fff" />
                    </>
                )}
            </TouchableOpacity>
        </View>
    );
}
