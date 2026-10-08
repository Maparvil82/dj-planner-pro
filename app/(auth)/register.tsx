import { sharedDJDestination } from '../../src/utils/communityNavigation';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Link, useRouter, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from '../../src/i18n/useTranslation';
import { supabase } from '../../src/lib/supabase';
import { profileService } from '../../src/services/profile';
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
export default function RegisterScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const { dj } = useLocalSearchParams<{ dj?: string }>();
    const destination = sharedDJDestination(dj);
    const c = useCommunityColors();
    const emailRef = useRef<TextInput>(null),
        passwordRef = useRef<TextInput>(null);
    const submitting = useRef(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [confirmed, setConfirmed] = useState(false);
    const [emailTouched, setEmailTouched] = useState(false);
    const [passwordTouched, setPasswordTouched] = useState(false);
    const canSubmit =
        validAuthEmail(email) &&
        password.length >= 8 &&
        name.trim().length > 0 &&
        !loading;
    const handleRegister = async () => {
        if (!canSubmit || submitting.current) return;
        submitting.current = true;
        setLoading(true);
        setError('');
        try {
            const { data, error: failure } = await supabase.auth.signUp({
                email: email.trim().toLowerCase(),
                password,
                options: { data: { artist_name: name.trim() } },
            });
            if (failure) {
                setError(t(authErrorKey(failure)));
                return;
            }
            if (!data.session) {
                // Email confirmation: there is no authenticated session for a profile write.
                setPassword('');
                setConfirmed(true);
                return;
            }
            useAuthStore.getState().setSession(data.session);
            // The artist name is also kept in signup metadata for profile creation.
            await profileService.updateProfile(data.session.user.id, {
                artist_name: name.trim(),
            });
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
            compact
            title={t(
                confirmed
                    ? 'authExperience.confirmTitle'
                    : 'authExperience.registerTitle',
            )}
            subtitle={t(
                confirmed
                    ? 'authExperience.confirmHint'
                    : 'authExperience.registerHint',
            )}
            onBack={() =>
                router.replace(
                    destination
                        ? { pathname: '/(auth)/login', params: { dj } }
                        : '/(auth)/login',
                )
            }
        >
            {confirmed ? (
                <>
                    <View
                        style={{
                            padding: 20,
                            backgroundColor: c.card,
                            borderWidth: 1,
                            borderColor: c.border,
                            borderRadius: 20,
                            gap: 12,
                        }}
                    >
                        <Text
                            selectable
                            style={{
                                color: c.fg,
                                fontWeight: '800',
                                fontSize: 16,
                            }}
                        >
                            {email.trim()}
                        </Text>
                        <Text
                            style={{
                                color: c.muted,
                                lineHeight: 22,
                                fontSize: 14,
                            }}
                        >
                            {t('authExperience.checkInbox')}
                        </Text>
                    </View>
                    <CommunityButton
                        label={t('authExperience.returnLogin')}
                        onPress={() =>
                            router.replace(
                                destination
                                    ? {
                                          pathname: '/(auth)/login',
                                          params: { dj },
                                      }
                                    : '/(auth)/login',
                            )
                        }
                    />
                    <CommunityButton
                        secondary
                        label={t('authExperience.changeEmail')}
                        onPress={() => {
                            setConfirmed(false);
                            setError('');
                        }}
                    />
                </>
            ) : (
                <>
                    {!!error && <AuthMessage>{error}</AuthMessage>}
                    <View style={{ gap: 16 }}>
                        <AuthField
                            label={t('artist_name')}
                            placeholder={t('authExperience.namePlaceholder')}
                            value={name}
                            maxLength={80}
                            autoCapitalize="words"
                            autoCorrect={false}
                            autoComplete="nickname"
                            returnKeyType="next"
                            editable={!loading}
                            onChangeText={(v) => {
                                setName(v);
                                setError('');
                            }}
                            onSubmitEditing={() => emailRef.current?.focus()}
                        />
                        <AuthField
                            ref={emailRef}
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
                            onChangeText={(v) => {
                                setEmail(v);
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
                            placeholder={t('authExperience.passwordHint')}
                            password
                            value={password}
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoComplete="new-password"
                            textContentType="newPassword"
                            returnKeyType="go"
                            editable={!loading}
                            onChangeText={(v) => {
                                setPassword(v);
                                setError('');
                            }}
                            onBlur={() => setPasswordTouched(true)}
                            error={
                                passwordTouched &&
                                password.length > 0 &&
                                password.length < 8
                                    ? t('authExperience.passwordHint')
                                    : undefined
                            }
                            onSubmitEditing={() => void handleRegister()}
                        />
                    </View>
                    <CommunityButton
                        label={t('authExperience.createAccount')}
                        onPress={() => void handleRegister()}
                        disabled={!canSubmit}
                        busy={loading}
                    />
                    <View
                        style={{
                            gap: 8,
                            alignItems: 'center',
                            paddingVertical: 4,
                        }}
                    >
                        <Text style={{ color: c.muted, fontSize: 14 }}>
                            {t('already_have_account')}
                        </Text>
                        <Link
                            href={
                                destination
                                    ? {
                                          pathname: '/(auth)/login',
                                          params: { dj },
                                      }
                                    : '/(auth)/login'
                            }
                            asChild
                        >
                            <TouchableOpacity
                                accessibilityRole="link"
                                disabled={loading}
                                style={{
                                    minHeight: 44,
                                    justifyContent: 'center',
                                }}
                            >
                                <Text
                                    style={{
                                        color: c.accent,
                                        fontSize: 15,
                                        fontWeight: '800',
                                    }}
                                >
                                    {t('login')}
                                </Text>
                            </TouchableOpacity>
                        </Link>
                    </View>
                </>
            )}
        </AuthShell>
    );
}
