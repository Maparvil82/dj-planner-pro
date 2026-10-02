import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from '../../src/i18n/useTranslation';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/store/useAuthStore';
import {
    AuthShell,
    AuthField,
    AuthMessage,
} from '../../src/components/auth/AuthUI';
import {
    CommunityButton,
    useCommunityColors,
} from '../../src/components/community/CommunityUI';
import { authErrorKey, validAuthEmail } from '../../src/utils/authExperience';
export default function LoginScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const c = useCommunityColors();
    const passwordRef = useRef<TextInput>(null);
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
            router.replace('/(tabs)/home');
        } catch {
            setError(t('authExperience.connectionError'));
        } finally {
            submitting.current = false;
            setLoading(false);
        }
    };
    return (
        <AuthShell
            title={t('authExperience.loginTitle')}
            subtitle={t('authExperience.loginHint')}
            onBack={() => router.replace('/(auth)/welcome')}
        >
            {!!error && <AuthMessage>{error}</AuthMessage>}
            <View style={{ gap: 18 }}>
                <AuthField
                    label={t('email_placeholder')}
                    placeholder="you@example.com"
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
                    placeholder={t('authExperience.passwordPlaceholder')}
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
                <Link href="/(auth)/forgot-password" asChild>
                    <TouchableOpacity
                        accessibilityRole="link"
                        disabled={loading}
                        style={{
                            alignSelf: 'flex-end',
                            minHeight: 40,
                            justifyContent: 'center',
                        }}
                    >
                        <Text
                            style={{
                                color: c.accent,
                                fontSize: 13,
                                fontWeight: '700',
                            }}
                        >
                            {t('authExperience.forgotPassword')}
                        </Text>
                    </TouchableOpacity>
                </Link>
            </View>
            <CommunityButton
                label={t('login')}
                onPress={() => void handleLogin()}
                disabled={!canSubmit}
                busy={loading}
            />
            <View style={{ gap: 8, alignItems: 'center', paddingVertical: 8 }}>
                <Text style={{ color: c.muted, fontSize: 14 }}>
                    {t('no_account')}
                </Text>
                <Link href="/(auth)/register" asChild>
                    <TouchableOpacity
                        accessibilityRole="link"
                        disabled={loading}
                        style={{ minHeight: 44, justifyContent: 'center' }}
                    >
                        <Text
                            style={{
                                color: c.accent,
                                fontSize: 15,
                                fontWeight: '800',
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
