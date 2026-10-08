import { useState, type ReactNode } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Text,
    TextInput,
    View,
    Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { useTranslation } from '../../i18n/useTranslation';
import { useCommunityColors } from '../community/CommunityUI';
import type { Session } from '../../types/session';
import { sessionDisplayTitle } from '../../utils/sessionNaming';
export function ToolsLayout({
    title,
    children,
    onBack,
}: {
    title: string;
    children: ReactNode;
    onBack?: () => void;
}) {
    const c = useCommunityColors(),
        router = useRouter(),
        { t } = useTranslation();
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
            <View
                style={{
                    padding: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                }}
            >
                <Text
                    style={{
                        flex: 1,
                        fontSize: 28,
                        fontWeight: '900',
                        color: c.fg,
                    }}
                >
                    {title}
                </Text>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('back')}
                    onPress={
                        onBack ||
                        (() =>
                            router.canGoBack()
                                ? router.back()
                                : router.replace('/home'))
                    }
                    style={{
                        width: 44,
                        height: 44,
                        borderRadius: 16,
                        backgroundColor: c.border,
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <X color={c.fg} size={22} />
                </Pressable>
            </View>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                <ScrollView
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{
                        padding: 20,
                        paddingTop: 0,
                        paddingBottom: 32,
                        gap: 16,
                    }}
                >
                    {children}
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
export function ToolField({
    label,
    value,
    onChangeText,
    keyboardType = 'default',
    maxLength = 180,
}: {
    label: string;
    value: string;
    onChangeText: (v: string) => void;
    keyboardType?: 'default' | 'decimal-pad';
    maxLength?: number;
}) {
    const c = useCommunityColors();
    return (
        <View style={{ gap: 8 }}>
            <Text style={{ color: c.muted, fontSize: 13, fontWeight: '700' }}>
                {label}
            </Text>
            <TextInput
                accessibilityLabel={label}
                value={value}
                onChangeText={onChangeText}
                maxLength={maxLength}
                keyboardType={keyboardType}
                style={{
                    backgroundColor: c.card,
                    borderWidth: 1,
                    borderColor: c.border,
                    borderRadius: 16,
                    padding: 16,
                    color: c.fg,
                    fontSize: 16,
                    minHeight: 52,
                }}
            />
        </View>
    );
}
export function SessionChooser({
    sessions,
    onSelect,
    empty,
}: {
    sessions: Session[];
    onSelect: (s: Session) => void;
    empty: string;
}) {
    const c = useCommunityColors(),
        { t } = useTranslation(),
        [search, setSearch] = useState('');
    const normal = (v: string) =>
        v
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
    const matches = sessions.filter((s) =>
        normal(`${sessionDisplayTitle(s, t)} ${s.venue} ${s.date}`).includes(
            normal(search),
        ),
    );
    return (
        <>
            <Text style={{ color: c.muted }}>{t('tools.chooseSession')}</Text>
            <ToolField
                label={t('search_placeholder')}
                value={search}
                onChangeText={setSearch}
            />
            {!sessions.length ? (
                <>
                    <Text style={{ color: c.fg }}>{empty}</Text>
                </>
            ) : (
                matches.map((s) => (
                    <Pressable
                        key={s.id}
                        accessibilityRole="button"
                        onPress={() => onSelect(s)}
                        style={{
                            backgroundColor: c.card,
                            borderWidth: 1,
                            borderColor: c.border,
                            padding: 18,
                            borderRadius: 20,
                            gap: 6,
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 17,
                                color: c.fg,
                                fontWeight: '700',
                            }}
                        >
                            {sessionDisplayTitle(s, t)}
                        </Text>
                        <Text style={{ color: c.muted }}>
                            {s.date} · {s.start_time.slice(0, 5)} · {s.venue}
                        </Text>
                    </Pressable>
                ))
            )}
        </>
    );
}
