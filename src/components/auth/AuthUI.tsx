import React, { forwardRef, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TextInputProps,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    ImageBackground,
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft } from 'lucide-react-native';
import { useCommunityColors } from '../community/CommunityUI';
import { useTranslation } from '../../i18n/useTranslation';
export const AUTH_IMAGE = require('../../../assets/auth/welcome-dj-booth.jpg');
export function AuthBrand({ light = false }: { light?: boolean }) {
    const c = useCommunityColors();
    return (
        <Text
            style={{
                color: light ? '#fff' : c.fg,
                fontSize: 13,
                fontWeight: '900',
                letterSpacing: 2.2,
            }}
        >
            DJ PLANNER PRO
        </Text>
    );
}
export function AuthShell({
    children,
    title,
    subtitle,
    onBack,
    compact = false,
}: {
    children: React.ReactNode;
    title: string;
    subtitle: string;
    onBack: () => void;
    compact?: boolean;
}) {
    const c = useCommunityColors();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { width, height } = useWindowDimensions();
    const desktop = width >= 900;
    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: c.bg }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <StatusBar style="light" />
            <ScrollView
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                    flexGrow: 1,
                    paddingBottom: Math.max(insets.bottom, 24),
                    justifyContent: desktop ? 'center' : undefined,
                }}
            >
                <View
                    style={{
                        width: '100%',
                        maxWidth: 1120,
                        alignSelf: 'center',
                        flexDirection: desktop ? 'row' : 'column',
                        alignItems: desktop ? 'center' : 'stretch',
                        gap: desktop ? 64 : 0,
                        padding: desktop ? 40 : 0,
                    }}
                >
                    <ImageBackground
                        source={AUTH_IMAGE}
                        resizeMode="cover"
                        imageStyle={{ opacity: desktop ? 0.9 : 0.75 }}
                        style={{
                            backgroundColor: '#0b0815',
                            overflow: 'hidden',
                            borderRadius: desktop ? 28 : 0,
                            width: desktop
                                ? Math.min(width, 1120) - 564
                                : '100%',
                            height: desktop
                                ? 640
                                : Math.max(
                                      compact ? 200 : 260,
                                      height * (compact ? 0.27 : 0.34),
                                  ) + insets.top,
                            justifyContent: 'space-between',
                        }}
                    >
                        <LinearGradient
                            pointerEvents="none"
                            colors={[
                                'rgba(9,7,17,0.35)',
                                'rgba(9,7,17,0.1)',
                                'rgba(9,7,17,0.92)',
                            ]}
                            style={{
                                position: 'absolute',
                                top: 0,
                                right: 0,
                                bottom: 0,
                                left: 0,
                            }}
                        />
                        <View
                            style={{
                                paddingTop: desktop ? 24 : insets.top + 16,
                                paddingHorizontal: 24,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                            }}
                        >
                            <TouchableOpacity
                                accessibilityRole="button"
                                accessibilityLabel={t('authExperience.back')}
                                onPress={onBack}
                                style={{
                                    width: 44,
                                    height: 44,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: 'rgba(255,255,255,0.12)',
                                    borderRadius: 16,
                                }}
                            >
                                <ArrowLeft size={21} color="#fff" />
                            </TouchableOpacity>
                            <AuthBrand light />
                        </View>
                        {desktop && (
                            <View style={{ padding: 30, gap: 12 }}>
                                <Text
                                    style={{
                                        color: '#fff',
                                        fontSize: 38,
                                        lineHeight: 43,
                                        fontWeight: '900',
                                        letterSpacing: -1.2,
                                    }}
                                >
                                    {t('authExperience.welcomeTitle')}
                                </Text>
                                <Text
                                    style={{
                                        color: '#d0c8e2',
                                        fontSize: 15,
                                        lineHeight: 23,
                                    }}
                                >
                                    {t('authExperience.welcomeHint')}
                                </Text>
                            </View>
                        )}
                    </ImageBackground>
                    <View
                        style={{
                            width: desktop ? 420 : '100%',
                            minWidth: 0,
                            paddingHorizontal: desktop ? 0 : 24,
                            paddingTop: desktop ? 0 : 24,
                            gap: 24,
                        }}
                    >
                        <View style={{ gap: 10 }}>
                            <Text
                                accessibilityRole="header"
                                style={{
                                    color: c.fg,
                                    fontSize: 34,
                                    fontWeight: '900',
                                    letterSpacing: -1.2,
                                }}
                            >
                                {title}
                            </Text>
                            <Text
                                style={{
                                    color: c.muted,
                                    fontSize: 14,
                                    lineHeight: 22,
                                }}
                            >
                                {subtitle}
                            </Text>
                        </View>
                        {children}
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
interface AuthFieldProps extends TextInputProps {
    label: string;
    error?: string;
    password?: boolean;
}
export const AuthField = forwardRef<TextInput, AuthFieldProps>(
    function AuthField({ label, error, password, ...props }, ref) {
        const c = useCommunityColors();
        const { t } = useTranslation();
        const [focused, setFocused] = useState(false);
        const [visible, setVisible] = useState(false);
        return (
            <View style={{ gap: 8 }}>
                <Text style={{ color: c.fg, fontSize: 13, fontWeight: '700' }}>
                    {label}
                </Text>
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: c.card,
                        borderWidth: 1.5,
                        borderColor: error
                            ? '#d76f7d'
                            : focused
                              ? c.accent
                              : c.border,
                        borderRadius: 16,
                        minHeight: 56,
                    }}
                >
                    <TextInput
                        {...props}
                        ref={ref}
                        accessibilityLabel={label}
                        placeholderTextColor={c.muted}
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
                            paddingVertical: 16,
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
                                style={{
                                    color: c.accent,
                                    fontWeight: '700',
                                    fontSize: 12,
                                }}
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
    const c = useCommunityColors();
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
