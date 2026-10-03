import { useState } from 'react';
import {
    Modal,
    View,
    Text,
    TextInput,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useTranslation } from '../../i18n/useTranslation';
import { CommunityButton, useCommunityColors } from '../community/CommunityUI';
import { SessionFormHeader } from '../sessions/SessionFormLayout';

export function AccountEditor({
    currentEmail,
    onClose,
    onSaved,
}: {
    currentEmail: string;
    onClose: () => void;
    onSaved: (notice: string) => void;
}) {
    const c = useCommunityColors();
    const { t } = useTranslation();
    const [email, setEmail] = useState(currentEmail);
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const save = async () => {
        if (busy) return;
        const input: { email?: string; password?: string } = {};
        if (email.trim() !== currentEmail) input.email = email.trim();
        if (password) input.password = password;
        setBusy(true);
        setError('');
        try {
            const { error } = await supabase.auth.updateUser(input);
            if (error) throw error;
            onSaved(
                t(
                    input.email
                        ? 'unifiedProfile.emailSent'
                        : 'profileUX.accountSaved',
                ),
            );
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : t('profileUX.accountError'),
            );
        } finally {
            setBusy(false);
        }
    };
    return (
        <Modal
            visible
            animationType="slide"
            onRequestClose={() => {
                if (!busy) onClose();
            }}
        >
            <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
                <SessionFormHeader
                    title={t('profileUX.manageAccount')}
                    subtitle={t('unifiedProfile.accountHint')}
                    onClose={() => {
                        if (!busy) onClose();
                    }}
                />
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <ScrollView
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={{ padding: 20 }}
                    >
                        <View
                            style={{
                                width: '100%',
                                maxWidth: 900,
                                alignSelf: 'center',
                                gap: 16,
                            }}
                        >
                            <Text style={{ color: c.muted, lineHeight: 21 }}>
                                {t('profileUX.accountScope')}
                            </Text>
                            <Text style={{ color: c.fg, fontWeight: '600' }}>
                                {t('email_placeholder')}
                            </Text>
                            <TextInput
                                accessibilityLabel={t('email_placeholder')}
                                value={email}
                                onChangeText={setEmail}
                                editable={!busy}
                                autoCapitalize="none"
                                autoCorrect={false}
                                keyboardType="email-address"
                                autoComplete="email"
                                style={{
                                    padding: 14,
                                    minHeight: 48,
                                    color: c.fg,
                                    backgroundColor: c.card,
                                    borderRadius: 14,
                                }}
                            />
                            <Text style={{ color: c.fg, fontWeight: '600' }}>
                                {t('password_placeholder')}
                            </Text>
                            <TextInput
                                accessibilityLabel={t('password_placeholder')}
                                value={password}
                                onChangeText={setPassword}
                                editable={!busy}
                                secureTextEntry
                                autoCapitalize="none"
                                autoCorrect={false}
                                autoComplete="new-password"
                                placeholder={t('profileUX.passwordHint')}
                                placeholderTextColor={c.muted}
                                style={{
                                    padding: 14,
                                    minHeight: 48,
                                    color: c.fg,
                                    backgroundColor: c.card,
                                    borderRadius: 14,
                                }}
                            />
                            {!!error && (
                                <Text
                                    accessibilityRole="alert"
                                    style={{ color: '#d76f7d' }}
                                >
                                    {error}
                                </Text>
                            )}
                        </View>
                    </ScrollView>
                    <View
                        style={{
                            padding: 20,
                            gap: 10,
                            borderTopWidth: 1,
                            borderColor: c.border,
                        }}
                    >
                        <CommunityButton
                            label={t('profileUX.saveAccount')}
                            busy={busy}
                            disabled={
                                !email.trim() ||
                                (email.trim() === currentEmail && !password)
                            }
                            onPress={() => {
                                void save();
                            }}
                        />
                        <CommunityButton
                            label={t('cancel')}
                            secondary
                            disabled={busy}
                            onPress={onClose}
                        />
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    );
}
