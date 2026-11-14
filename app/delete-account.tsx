import { useRef, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TextInput,
    Pressable,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from '../src/i18n/useTranslation';
import { useAuthStore } from '../src/store/useAuthStore';
import { supabase } from '../src/lib/supabase';
import { accountDeletion } from '../src/services/accountDeletion';
import {
    CommunityButton,
    useCommunityColors,
} from '../src/components/community/CommunityUI';
export default function DeleteAccountScreen() {
    const { t } = useTranslation(),
        c = useCommunityColors(),
        router = useRouter(),
        client = useQueryClient();
    const session = useAuthStore((s) => s.session);
    const [email, setEmail] = useState(''),
        [password, setPassword] = useState(''),
        [checked, setChecked] = useState(false);
    const [busy, setBusy] = useState(false),
        [error, setError] = useState(''),
        [done, setDone] = useState(false),
        [removed, setRemoved] = useState(0);
    const lock = useRef(false);
    const pending = useQuery({
        queryKey: ['account-deletion', session?.user.id],
        queryFn: accountDeletion.pending,
        enabled: !!session?.user.id,
    });
    const run = async () => {
        if (lock.current) return;
        lock.current = true;
        setBusy(true);
        setError('');
        try {
            if (!session) {
                const { error } = await supabase.auth.signInWithPassword({
                    email: email.trim(),
                    password,
                });
                if (error) throw new Error('accountDeletion.loginError');
                setPassword('');
                return;
            }
            await accountDeletion.remove(session.user.id, setRemoved);
            // Clear local credentials even if the server session no longer exists.
            try {
                await supabase.auth.signOut({ scope: 'local' });
            } catch {
                /* The deleted Auth session may no longer exist. */
            }
            useAuthStore.setState({
                session: null,
                user: null,
                profile: null,
                hasSeenOnboarding: false,
            });
            client.clear();
            setDone(true);
        } catch (e) {
            setError(
                t(
                    e instanceof Error &&
                        e.message === 'accountDeletion.loginError'
                        ? e.message
                        : 'accountDeletion.error',
                ),
            );
            void client.invalidateQueries({ queryKey: ['account-deletion'] });
        } finally {
            lock.current = false;
            setBusy(false);
        }
    };
    const field = {
        color: c.fg,
        backgroundColor: c.field,
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: 16,
        padding: 16,
        minHeight: 52,
    };
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                <ScrollView
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{
                        padding: 24,
                        gap: 24,
                        maxWidth: 600,
                        width: '100%',
                        alignSelf: 'center',
                        paddingBottom: 40,
                    }}
                >
                    <Text style={{ color: c.accent, fontWeight: '700' }}>
                        DJ Planner
                    </Text>
                    <Text
                        style={{ color: c.fg, fontSize: 30, fontWeight: '800' }}
                    >
                        {t(done ? 'delete_account_success' : 'delete_account')}
                    </Text>
                    {!done && (
                        <>
                            <Text
                                style={{
                                    color: c.muted,
                                    fontSize: 16,
                                    lineHeight: 24,
                                }}
                            >
                                {t(
                                    pending.data
                                        ? 'accountDeletion.pending'
                                        : 'accountDeletion.description',
                                )}
                            </Text>
                            <Text style={{ color: c.muted, lineHeight: 22 }}>
                                {t('accountDeletion.subscription')}
                            </Text>
                            {!session ? (
                                <View style={{ gap: 14 }}>
                                    <Text style={{ color: c.fg }}>
                                        {t(
                                            Platform.OS === 'web'
                                                ? 'accountDeletion.login'
                                                : 'login',
                                        )}
                                    </Text>
                                    <TextInput
                                        accessibilityLabel={t(
                                            'email_placeholder',
                                        )}
                                        placeholder={t('email_placeholder')}
                                        placeholderTextColor={c.muted}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        value={email}
                                        onChangeText={setEmail}
                                        editable={!busy}
                                        style={field}
                                    />
                                    <TextInput
                                        accessibilityLabel={t(
                                            'password_placeholder',
                                        )}
                                        placeholder={t('password_placeholder')}
                                        placeholderTextColor={c.muted}
                                        secureTextEntry
                                        value={password}
                                        onChangeText={setPassword}
                                        editable={!busy}
                                        style={field}
                                    />
                                    <CommunityButton
                                        label={t('login')}
                                        busy={busy}
                                        disabled={!email.trim() || !password}
                                        onPress={() => void run()}
                                    />
                                    <CommunityButton
                                        label={t(
                                            'authExperience.forgotPassword',
                                        )}
                                        secondary
                                        disabled={busy}
                                        onPress={() =>
                                            router.push(
                                                '/(auth)/forgot-password',
                                            )
                                        }
                                    />
                                </View>
                            ) : (
                                <>
                                    <Text
                                        style={{
                                            color: c.fg,
                                            fontWeight: '600',
                                        }}
                                    >
                                        {session.user.email}
                                    </Text>
                                    {!pending.data && (
                                        <Pressable
                                            accessibilityRole="checkbox"
                                            accessibilityState={{ checked }}
                                            disabled={busy}
                                            onPress={() => setChecked(!checked)}
                                            style={{
                                                flexDirection: 'row',
                                                gap: 12,
                                                alignItems: 'center',
                                                minHeight: 48,
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    color: c.accent,
                                                    fontSize: 24,
                                                }}
                                            >
                                                {checked ? '☑' : '☐'}
                                            </Text>
                                            <Text
                                                style={{
                                                    color: c.fg,
                                                    flex: 1,
                                                    lineHeight: 22,
                                                }}
                                            >
                                                {t('accountDeletion.confirm')}
                                            </Text>
                                        </Pressable>
                                    )}
                                    {busy && (
                                        <Text
                                            accessibilityLiveRegion="polite"
                                            style={{ color: c.muted }}
                                        >
                                            {t('accountDeletion.progress', {
                                                count: removed,
                                            })}
                                        </Text>
                                    )}
                                    <CommunityButton
                                        label={t(
                                            pending.data
                                                ? 'accountDeletion.resume'
                                                : 'delete_permanently',
                                        )}
                                        busy={busy}
                                        disabled={
                                            (!checked && !pending.data) ||
                                            pending.isLoading
                                        }
                                        onPress={() => void run()}
                                    />
                                </>
                            )}
                            {!!error && (
                                <Text
                                    accessibilityRole="alert"
                                    style={{ color: '#c44960', lineHeight: 22 }}
                                >
                                    {error}
                                </Text>
                            )}
                        </>
                    )}
                    <CommunityButton
                        label={t(
                            done
                                ? 'accountDeletion.finish'
                                : pending.data
                                  ? 'logout'
                                  : 'cancel',
                        )}
                        secondary
                        disabled={busy}
                        onPress={() => {
                            if (pending.data) {
                                void useAuthStore.getState().signOut()
                                    .then(() => router.replace('/(auth)/login'))
                                    .catch(() => setError(t('authExperience.connectionError')));
                            } else if (done) router.replace('/(auth)/welcome');
                            else if (router.canGoBack()) router.back();
                            else router.replace('/');
                        }}
                    />
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
