import React, { forwardRef, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TextInputProps,
    ImageSourcePropType,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    ImageBackground,
    useWindowDimensions,
    ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft } from 'lucide-react-native';
import { useTranslation } from '../../i18n/useTranslation';
import { AppLogo } from '../ui/AppLogo';
import defaultPalette from '../../theme/darkPalette.json';
export const AUTH_IMAGE = require('../../../assets/paywall_header_new.png');
export const AUTH_SCREEN_IMAGES = {
    login: require('../../../assets/auth/login-honey-v1.jpg'),
    register: require('../../../assets/auth/register-honey-v1.jpg'),
    recovery: require('../../../assets/auth/recovery-honey-v1.jpg'),
};
export const AUTH_COLORS = {
    dark: true,
    bg: defaultPalette.background,
    card: defaultPalette.surface,
    cardText: defaultPalette.onSurface,
    fg: defaultPalette.text,
    muted: defaultPalette.muted,
    accent: defaultPalette.primary,
    border: defaultPalette.border,
    tint: defaultPalette.tint,
};
export function AuthBrand({ light = false }: { light?: boolean }) {
    const c = AUTH_COLORS;
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
            <AppLogo size={40} decorative />
            <Text
                style={{
                    color: light ? '#fff' : c.fg,
                    fontSize: 10,
                    fontWeight: '600',
                    letterSpacing: 1.6,
                    flexShrink: 1,
                }}
            >
                DJ PLANNER
            </Text>
        </View>
    );
}
export function AuthShell({
    children,
    title,
    subtitle,
    onBack,
    compact = false,
    image = AUTH_IMAGE,
}: {
    children: React.ReactNode;
    title: string;
    subtitle: string;
    onBack: () => void;
    compact?: boolean;
    image?: ImageSourcePropType;
}) {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { width, height } = useWindowDimensions();
    const small = height < 700;
    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: AUTH_COLORS.bg }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <StatusBar style="light" />
            <ScrollView
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                    flexGrow: 1,
                    paddingTop: insets.top + 12,
                    paddingBottom: Math.max(insets.bottom, 12),
                    paddingHorizontal: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <ImageBackground
                    source={image}
                    resizeMode="cover"
                    imageStyle={{ width: '100%', height: '100%', borderRadius: 28 }}
                    style={{
                        width: '100%',
                        maxWidth: 480,
                        minHeight: Math.min(width >= 700 ? 900 : Infinity, Math.max(500, height - insets.top - Math.max(insets.bottom, 12) - 12)),
                        backgroundColor: AUTH_COLORS.card,
                        borderRadius: 28,
                        overflow: 'hidden',
                        flexGrow: width >= 700 ? 0 : 1,
                    }}
                >
                    <LinearGradient
                        pointerEvents="none"
                        colors={['rgba(0,0,0,0.4)', 'transparent']}
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 150 }}
                    />
                    <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={t('authExperience.back')}
                            onPress={onBack}
                            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(23,23,23,0.5)', borderRadius: 22 }}
                        >
                            <ArrowLeft size={20} color={AUTH_COLORS.fg} />
                        </TouchableOpacity>
                        <AuthBrand light />
                    </View>
                    <View style={{ flex: 1, minHeight: small ? 50 : compact ? 80 : 120 }} />
                    <LinearGradient
                        colors={['rgba(35,35,35,0.9)', 'rgba(43,48,32,0.98)', '#232323']}
                        style={{ padding: width < 360 ? 20 : 24, paddingTop: 28, gap: 18, borderTopLeftRadius: 26, borderTopRightRadius: 26 }}
                    >
                        <View style={{ gap: 10 }}>
                            <Text accessibilityRole="header" style={{ color: AUTH_COLORS.fg, fontSize: small ? 28 : 30, lineHeight: small ? 32 : 35, fontWeight: '500', letterSpacing: -0.8 }}>
                                {title}
                            </Text>
                            <Text style={{ color: AUTH_COLORS.muted, fontSize: 13, lineHeight: 20 }}>
                                {subtitle}
                            </Text>
                        </View>
                        {children}
                    </LinearGradient>
                </ImageBackground>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

export function AuthButton({ label, onPress, disabled = false, busy = false, secondary = false }: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    busy?: boolean;
    secondary?: boolean;
}) {
    const foreground = secondary ? AUTH_COLORS.accent : AUTH_COLORS.card;
    return (
        <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ disabled: disabled || busy, busy }}
            disabled={disabled || busy}
            onPress={onPress}
            style={{ minHeight: 52, borderRadius: 16, padding: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: secondary ? AUTH_COLORS.tint : AUTH_COLORS.accent, opacity: disabled || busy ? 0.5 : 1 }}
        >
            {busy ? <ActivityIndicator color={foreground} /> : <Text style={{ color: foreground, fontSize: 15, fontWeight: '600', textAlign: 'center' }}>{label}</Text>}
        </TouchableOpacity>
    );
}

interface AuthFieldProps extends TextInputProps {
    label: string;
    error?: string;
    password?: boolean;
}
export const AuthField = forwardRef<TextInput, AuthFieldProps>(
    function AuthField({ label, error, password, ...props }, ref) {
        const c = AUTH_COLORS;
        const { t } = useTranslation();
        const [focused, setFocused] = useState(false);
        const [visible, setVisible] = useState(false);
        return (
            <View style={{ gap: 8 }}>
                <Text style={{ color: c.fg, fontSize: 12, fontWeight: '500' }}>
                    {label}
                </Text>
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: 'rgba(23,23,23,0.72)',
                        borderWidth: 1,
                        borderColor: error
                            ? '#d76f7d'
                            : focused
                              ? c.accent
                              : c.border,
                        borderRadius: 16,
                        minHeight: 52,
                    }}
                >
                    <TextInput
                        {...props}
                        ref={ref}
                        accessibilityLabel={label}
                        placeholderTextColor={c.muted}
                        keyboardAppearance="dark"
                        selectionColor={c.accent}
                        secureTextEntry={password && !visible}
                        onFocus={(e) => {
                            setFocused(true);
                            props.onFocus?.(e);
                        }}
                        onBlur={(e) => {
                            setFocused(false);
                            props.onBlur?.(e);
                        }}
                        style={{
                            flex: 1,
                            minWidth: 0,
                            outlineWidth: Platform.OS === 'web' ? 0 : undefined,
                            color: c.fg,
                            paddingHorizontal: 16,
                            paddingVertical: 14,
                            fontSize: 16,
                        }}
                    />
                    {password && (
                        <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={t(
                                visible
                                    ? 'authExperience.hidePassword'
                                    : 'authExperience.showPassword',
                            )}
                            accessibilityState={{ selected: visible }}
                            onPress={() => setVisible((v) => !v)}
                            style={{ padding: 14 }}
                        >
                            <Text
                                style={[{
                                    color: c.accent,
                                    fontWeight: '500',
                                    fontSize: 12,
                                }]}
                            >
                                {t(
                                    visible
                                        ? 'authExperience.hide'
                                        : 'authExperience.show',
                                )}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
                {!!error && (
                    <Text
                        accessibilityRole="alert"
                        style={{
                            color: '#d76f7d',
                            fontSize: 12,
                            lineHeight: 18,
                        }}
                    >
                        {error}
                    </Text>
                )}
            </View>
        );
    },
);
export function AuthMessage({ children }: { children: React.ReactNode }) {
    const c = AUTH_COLORS;
    return (
        <View
            style={{
                backgroundColor: c.dark ? '#341f2b' : '#fff0f2',
                borderRadius: 16,
                padding: 16,
            }}
        >
            <Text
                accessibilityRole="alert"
                style={{
                    color: c.dark ? '#f0a0ae' : '#a53d53',
                    fontSize: 13,
                    lineHeight: 20,
                }}
            >
                {children}
            </Text>
        </View>
    );
}
