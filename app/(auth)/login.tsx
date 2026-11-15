import type { ComponentRef } from 'react';
import { sharedDJDestination } from '../../src/utils/communityNavigation';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Link, useRouter, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from '../../src/i18n/useTranslation';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/store/useAuthStore';
import {
    AuthShell,
    AuthField,
    AuthMessage,
    AuthButton,
    AUTH_COLORS,
    AUTH_SCREEN_IMAGES,
} from '../../src/components/auth/AuthUI';
import { authErrorKey, validAuthEmail } from '../../src/utils/authExperience';
export default function LoginScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const { dj } = useLocalSearchParams<{ dj?: string }>();
    const destination = sharedDJDestination(dj);
    const c = AUTH_COLORS;
    const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
    const submitting = useRef(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [emailTouched, setEmailTouched] = useState(false);
    const canSubmit = validAuthEmail(email) && password.length > 0 && !loading;
    const handleLogin = async () => {
        if (!canSubmit || submitting.current) return;
        submitting.current = true;
        setLoading(true);
        setError('');
        try {
            const { data, error: failure } =
                await supabase.auth.signInWithPassword({
                    email: email.trim().toLowerCase(),
                    password,
                });
            if (failure) {
                setError(t(authErrorKey(failure)));
                return;
            }
            if (!data.session) {
                setError(t('authExperience.connectionError'));
                return;
            }
            useAuthStore.getState().setSession(data.session);
            router.replace(destination || '/(tabs)/home');
        } catch {
            setError(t('authExperience.connectionError'));
        } finally {
            submitting.current = false;
            setLoading(false);
        }
    };
    return (
        <AuthShell
            immersive
            image={AUTH_SCREEN_IMAGES.login}
            title={t('authExperience.loginTitle')}
            onBack={() => router.replace('/(auth)/welcome')}
        >
            {!!error && <AuthMessage>{error}</AuthMessage>}
            <View style={{ gap: 18, marginTop: 6 }}>
                <AuthField
                    label={t('email_placeholder')}
                    hideLabel
                    placeholder={t('email_placeholder')}
                    value={email}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    returnKeyType="next"
                    editable={!loading}
                    onChangeText={(value) => {
                        setEmail(value);
                        setError('');
                    }}
                    onBlur={() => setEmailTouched(true)}
                    error={
                        emailTouched &&
                        email.length > 0 &&
                        !validAuthEmail(email)
                            ? t('invalid_email')
                            : undefined
                    }
                    onSubmitEditing={() => passwordRef.current?.focus()}
                />
                <AuthField
                    ref={passwordRef}
                    label={t('password_placeholder')}
                    hideLabel
                    placeholder={t('password_placeholder')}
                    password
                    value={password}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="current-password"
                    textContentType="password"
                    returnKeyType="go"
                    editable={!loading}
                    onChangeText={(value) => {
                        setPassword(value);
                        setError('');
                    }}
                    onSubmitEditing={() => void handleLogin()}
                />
                <Link href={destination
                    ? { pathname: '/(auth)/forgot-password', params: { dj } }
                    : '/(auth)/forgot-password'} asChild>
                    <TouchableOpacity
                        accessibilityRole="link"
                        disabled={loading}
                        style={{
                            alignSelf: 'flex-end',
                            minHeight: 44,
                            justifyContent: 'center',
                        }}
                    >
                        <Text
                            style={{
                                color: c.accent,
                                fontSize: 13,
                                fontWeight: '500',
                            }}
                        >
                            {t('authExperience.forgotPassword')}
                        </Text>
                    </TouchableOpacity>
                </Link>
            </View>
            <AuthButton
                label={t('login')}
                onPress={() => void handleLogin()}
                disabled={!canSubmit}
                busy={loading}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, alignItems: 'center', paddingVertical: 0 }}>
                <Text style={{ color: c.muted, fontSize: 14 }}>
                    {t('authExperience.noAccountCompact')}
                </Text>
                <Link
                    href={
                        destination
                            ? { pathname: '/(auth)/register', params: { dj } }
                            : '/(auth)/register'
                    }
                    asChild
                >
                    <TouchableOpacity
                        accessibilityRole="link"
                        disabled={loading}
                        style={{ minHeight: 44, justifyContent: 'center' }}
                    >
                        <Text
                            style={{
                                color: c.accent,
                                fontSize: 15,
                                fontWeight: '600',
                            }}
                        >
                            {t('authExperience.createAccount')}
                        </Text>
                    </TouchableOpacity>
                </Link>
            </View>
        </AuthShell>
    );
}
