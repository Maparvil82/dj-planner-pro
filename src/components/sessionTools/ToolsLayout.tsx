import { useSessionToolBack } from '../../hooks/useSessionToolBack';
import { useScrollHeader } from '../../hooks/useScrollHeader';
import { SessionFormHeader } from '../sessions/SessionFormLayout';
import { formatRegionalDate } from '../../i18n/regionalDates';
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
import { useTranslation } from '../../i18n/useTranslation';
import { useCommunityColors } from '../community/CommunityUI';
import type { Session } from '../../types/session';
import { sessionDisplayTitle } from '../../utils/sessionNaming';
import { SessionSelectionEmpty, type SessionSelectionPurpose } from './SessionSelectionEmpty';
export function ToolsLayout({
    title,
    children,
    onBack,
}: {
    title: string;
    children: ReactNode;
    onBack?: () => void;
}) {
    const { progress: headerProgress, onScroll: onHeaderScroll, onScrollBeginDrag: onHeaderScrollBeginDrag } = useScrollHeader('compact');
    const c = useCommunityColors();
    const goBack = useSessionToolBack();
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
            <SessionFormHeader navigationBack title={title} subtitle="" progress={headerProgress}
                onClose={onBack || goBack} />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                <ScrollView onScrollBeginDrag={onHeaderScrollBeginDrag} onTouchStart={onHeaderScrollBeginDrag} onScroll={onHeaderScroll} scrollEventThrottle={16}
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
                    borderWidth: c.dark ? 0 : 1,
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
    purpose,
}: {
    sessions: Session[];
    onSelect: (s: Session) => void;
    purpose: SessionSelectionPurpose;
}) {
    const c = useCommunityColors(),
        { t, dateLocale } = useTranslation(),
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
    if (!sessions.length) return <SessionSelectionEmpty purpose={purpose} />;
    return (
        <>
            <Text style={{ color: c.muted }}>{t('tools.chooseSession')}</Text>
            <ToolField
                label={t('search_placeholder')}
                value={search}
                onChangeText={setSearch}
            />
            {!matches.length && <Text style={{ color: c.muted }}>{t('sessionSelection.noResults')}</Text>}
            {matches.map((s) => (
                    <Pressable
                        key={s.id}
                        accessibilityRole="button"
                        onPress={() => onSelect(s)}
                        style={{
                            backgroundColor: c.card,
                            borderWidth: c.dark ? 0 : 1,
                            borderColor: c.border,
                            padding: 18,
                            borderRadius: 20,
                            gap: 6,
                        }}
                    >
                        <Text
                            style={[{
                                fontSize: 17,
                                color: c.fg,
                                fontWeight: '700',
                            }, c.dark && { color: c.cardText }]}
                        >
                            {sessionDisplayTitle(s, t)}
                        </Text>
                        <Text style={[{ color: c.muted }, c.dark && { color: c.cardText }]}>
                            {formatRegionalDate(s.date, dateLocale)} · {s.start_time.slice(0, 5)} · {s.venue}
                        </Text>
                    </Pressable>
                ))
            }
        </>
    );
}
