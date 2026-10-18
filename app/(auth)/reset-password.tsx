import { useEffect, useRef, useState } from 'react';
import { View, TextInput, Platform, ActivityIndicator } from 'react-native';
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
import { authErrorKey } from '../../src/utils/authExperience';
import { recoveryCredentials } from '../../src/utils/recoveryLink';
import { sharedDJDestination } from '../../src/utils/communityNavigation';

export default function ResetPasswordScreen() {
    const { t } = useTranslation();
    const c = AUTH_COLORS;
    const router = useRouter();
    const link = Linking.useLinkingURL();
    const params = useLocalSearchParams<{
        access_token?: string;
        refresh_token?: string;
        type?: string;
        error?: string;
        error_code?: string;
        dj?: string;
    }>();
    // Keep only the validated destination when recovery credentials are scrubbed.
    const dj = useRef(sharedDJDestination(params.dj) ? params.dj : undefined).current;
    const loginRoute = dj
        ? { pathname: '/(auth)/login' as const, params: { dj } }
        : '/(auth)/login' as const;
    const submitting = useRef(false);
    const consumed = useRef(false);
    const confirmRef = useRef<TextInput>(null);
    const [state, setState] = useState<
        'checking' | 'invalid' | 'ready' | 'done'
    >('checking');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [busy, setBusy] = useState(false);
    const [errorKey, setErrorKey] = useState('');
    const [touched, setTouched] = useState(false);
    useEffect(() => {
        if (consumed.current) return;
        let active = true;
        void (async () => {
            try {
                const url =
                    Platform.OS === 'web'
                        ? window.location.href
                        : link || (await Linking.getInitialURL());
                if (!active) return;
                const credentials = recoveryCredentials(
                    url ||
                        `djplannerpro://reset-password?${new URLSearchParams(params as Record<string, string>)}`,
                );
                if (!credentials) {
                    if (active) setState('invalid');
                    return;
                }
                const { data, error } =
                    await supabase.auth.setSession(credentials);
                if (!active) return;
                consumed.current = true;
                setState(!error && data.session ? 'ready' : 'invalid');
                // Remove credentials from browser history once consumed.
                if (Platform.OS === 'web')
                    window.history.replaceState(
                        window.history.state,
                        '',
                        window.location.pathname + (dj ? `?dj=${encodeURIComponent(dj)}` : ''),
                    );
            } catch {
                if (active) setState('invalid');
            }
        })();
        return () => {
            active = false;
        };
    }, [
        link,
        params.access_token,
        params.refresh_token,
        params.type,
        params.error,
        params.error_code,
    ]);
    const back = async () => {
        if (state === 'ready') await supabase.auth.signOut({ scope: 'local' });
        router.replace(loginRoute);
    };
    const save = async () => {
        if (
            state !== 'ready' ||
            password.length < 8 ||
            password !== confirm ||
            submitting.current
        )
            return;
        submitting.current = true;
        setBusy(true);
        setErrorKey('');
        try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) {
                if (error.code === 'same_password')
                    setErrorKey('authExperience.samePassword');
                else if (
                    error.status === 401 ||
                    error.code === 'session_not_found'
                )
                    setState('invalid');
                else setErrorKey(authErrorKey(error));
                return;
            }
            setPassword('');
            setConfirm('');
            await supabase.auth.signOut({ scope: 'local' });
            setState('done');
        } catch {
            setErrorKey('authExperience.connectionError');
        } finally {
            submitting.current = false;
            setBusy(false);
        }
    };
    return (
        <AuthShell
            image={AUTH_SCREEN_IMAGES.recovery}
            title={t(
                state === 'done'
                    ? 'authExperience.passwordUpdated'
                    : 'authExperience.newPasswordTitle',
            )}
            subtitle={t(
                state === 'done'
                    ? 'authExperience.passwordUpdatedHint'
                    : 'authExperience.newPasswordHint',
            )}
            onBack={() => void back()}
            compact
        >
            {state === 'checking' && <ActivityIndicator color={c.accent} />}
            {state === 'invalid' && (
                <>
                    <AuthMessage>
                        {t('authExperience.recoveryExpired')}
                    </AuthMessage>
                    <AuthButton
                        label={t('authExperience.sendNewLink')}
                        onPress={() =>
                            router.replace(dj ? { pathname: '/(auth)/forgot-password', params: { dj } } : '/(auth)/forgot-password')
                        }
                    />
                </>
            )}
            {state === 'done' && (
                <AuthButton
                    label={t('authExperience.returnLogin')}
                    onPress={() => router.replace(loginRoute)}
                />
            )}
            {state === 'ready' && (
                <>
                    {!!errorKey && <AuthMessage>{t(errorKey)}</AuthMessage>}
                    <View style={{ gap: 18 }}>
                        <AuthField
                            label={t('authExperience.newPassword')}
                            placeholder={t('authExperience.passwordHint')}
                            password
                            value={password}
                            onChangeText={setPassword}
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoComplete="new-password"
                            textContentType="newPassword"
                            editable={!busy}
                            returnKeyType="next"
                            onSubmitEditing={() => confirmRef.current?.focus()}
                        />
                        <AuthField
                            ref={confirmRef}
                            label={t('authExperience.confirmPassword')}
                            password
                            value={confirm}
                            onChangeText={setConfirm}
                            onBlur={() => setTouched(true)}
                            error={
                                touched &&
                                confirm.length > 0 &&
                                password !== confirm
                                    ? t('authExperience.passwordMismatch')
                                    : undefined
                            }
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoComplete="new-password"
                            textContentType="newPassword"
                            editable={!busy}
                            returnKeyType="done"
                            onSubmitEditing={() => void save()}
                        />
                    </View>
                    <AuthButton
                        label={t('authExperience.savePassword')}
                        onPress={() => void save()}
                        busy={busy}
                        disabled={password.length < 8 || password !== confirm}
                    />
                </>
            )}
        </AuthShell>
    );
}
