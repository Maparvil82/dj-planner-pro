import { useRef, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import {
    AuthShell,
    AuthField,
    AuthMessage,
    AuthButton,
    AUTH_COLORS,
    AUTH_SCREEN_IMAGES,
} from '../../src/components/auth/AuthUI';
import { useTranslation } from '../../src/i18n/useTranslation';
import { supabase } from '../../src/lib/supabase';
import { authErrorKey, validAuthEmail } from '../../src/utils/authExperience';
import { sharedDJDestination } from '../../src/utils/communityNavigation';

export default function ForgotPasswordScreen() {
    const { t } = useTranslation();
    const c = AUTH_COLORS;
    const router = useRouter();
    const params = useLocalSearchParams<{ dj?: string }>();
    const dj = sharedDJDestination(params.dj) ? params.dj : undefined;
    const loginRoute = dj
        ? { pathname: '/(auth)/login' as const, params: { dj } }
        : '/(auth)/login' as const;
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const submitting = useRef(false);
    const send = async () => {
        if (!validAuthEmail(email) || submitting.current) return;
        submitting.current = true;
        setBusy(true);
        setError('');
        try {
            const { error: failure } =
                await supabase.auth.resetPasswordForEmail(
                    email.trim().toLowerCase(),
                    {
                        redirectTo: Linking.createURL('reset-password', dj ? { queryParams: { dj } } : undefined),
                    },
                );
            if (failure) setError(t(authErrorKey(failure)));
            else setSent(true);
        } catch {
            setError(t('authExperience.connectionError'));
        } finally {
            submitting.current = false;
            setBusy(false);
        }
    };
    return (
        <AuthShell
            image={AUTH_SCREEN_IMAGES.recovery}
            title={t(
                sent
                    ? 'authExperience.recoverySentTitle'
                    : 'authExperience.recoveryTitle',
            )}
            subtitle={t(
                sent
                    ? 'authExperience.recoverySentHint'
                    : 'authExperience.recoveryHint',
            )}
            onBack={() => router.replace(loginRoute)}
            compact
        >
            {!!error && <AuthMessage>{error}</AuthMessage>}
            {sent ? (
                <View style={{ gap: 20 }}>
                    <Text
                        style={{ color: c.muted, fontSize: 14, lineHeight: 22 }}
                    >
                        {t('authExperience.checkInbox')}
                    </Text>
                    <AuthButton
                        label={t('authExperience.returnLogin')}
                        onPress={() => router.replace(loginRoute)}
                    />
                    <TouchableOpacity
                        accessibilityRole="button"
                        onPress={() => setSent(false)}
                        style={{
                            minHeight: 44,
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}
                    >
                        <Text style={{ color: c.accent, fontWeight: '700' }}>
                            {t('authExperience.changeEmail')}
                        </Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <>
                    <AuthField
                        label={t('email_placeholder')}
                        placeholder="you@example.com"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="email"
                        textContentType="emailAddress"
                        editable={!busy}
                        returnKeyType="send"
                        onSubmitEditing={() => void send()}
                    />
                    <AuthButton
                        label={t('authExperience.sendRecovery')}
                        onPress={() => void send()}
                        busy={busy}
                        disabled={!validAuthEmail(email)}
                    />
                </>
            )}
        </AuthShell>
    );
}
