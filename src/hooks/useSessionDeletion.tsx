import { useState } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import type { Session } from '../types/session';
import {
    useAllSessionsQuery,
    useDeleteSessionMutation,
} from './useSessionsQuery';
import { useTranslation } from '../i18n/useTranslation';
import { useTheme } from '../contexts/ThemeContext';

// One confirmation flow for the detail page and every Home long-press entry point.
export function useSessionDeletion(onDeleted?: () => void) {
    const [target, setTarget] = useState<Session | null>(null);
    const [failed, setFailed] = useState(false);
    const mutation = useDeleteSessionMutation();
    const {
        data: sessions = [],
        isPending: loading,
        isError: loadFailed,
    } = useAllSessionsQuery();
    const { t, currentLanguage } = useTranslation();
    const { activeTheme } = useTheme();
    const dark = activeTheme === 'dark';
    const fg = dark ? '#f5f5fa' : '#222438';
    const muted = dark ? '#a6afc1' : '#737b8d';
    const rootId = target?.parent_session_id || target?.id;
    const series = sessions.filter(
        (s) =>
            !s.is_guest && (s.id === rootId || s.parent_session_id === rootId),
    );
    const hasSeries =
        !!target?.parent_session_id ||
        (!!target?.recurrence_type && target.recurrence_type !== 'none') ||
        series.length > 1;
    const close = () => {
        if (!mutation.isPending) setTarget(null);
    };
    const remove = async (scope: 'single' | 'series') => {
        if (!target || mutation.isPending) return;
        setFailed(false);
        try {
            await mutation.mutateAsync({ sessionId: target.id, scope });
            setTarget(null);
            onDeleted?.();
        } catch {
            setFailed(true);
        }
    };
    const actionStyle = {
        borderRadius: 14,
        padding: 16,
        alignItems: 'center' as const,
        opacity: mutation.isPending ? 0.5 : 1,
    };
    const dialog = (
        <Modal
            transparent
            visible={!!target}
            animationType="fade"
            onRequestClose={close}
        >
            <View
                style={{
                    flex: 1,
                    backgroundColor: 'rgba(16,18,35,0.55)',
                    justifyContent: 'center',
                    padding: 22,
                }}
            >
                <View
                    accessibilityViewIsModal
                    role="dialog"
                    aria-label={t('delete_session_title')}
                    style={{
                        width: '100%',
                        maxWidth: 440,
                        alignSelf: 'center',
                        borderRadius: 24,
                        backgroundColor: dark ? '#171c2b' : '#fff',
                        padding: 24,
                        gap: 16,
                    }}
                >
                    <Text
                        style={{ color: fg, fontSize: 22, fontWeight: '800' }}
                    >
                        {t('delete_session_title')}
                    </Text>
                    <View style={{ gap: 5 }}>
                        <Text
                            style={{
                                color: fg,
                                fontSize: 16,
                                fontWeight: '700',
                            }}
                        >
                            {target?.title}
                        </Text>
                        {target && (
                            <Text style={{ color: muted, fontSize: 13 }}>
                                {new Intl.DateTimeFormat(currentLanguage, {
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric',
                                }).format(new Date(`${target.date}T12:00:00`))}
                            </Text>
                        )}
                    </View>
                    <Text
                        style={{ color: muted, fontSize: 14, lineHeight: 21 }}
                    >
                        {t(
                            hasSeries
                                ? 'sessionDeletion.seriesMessage'
                                : 'delete_session_message',
                        )}
                    </Text>
                    {failed && (
                        <Text
                            accessibilityRole="alert"
                            style={{ color: '#c35671', fontSize: 13 }}
                        >
                            {t('sessionDeletion.error')}
                        </Text>
                    )}
                    <TouchableOpacity
                        accessibilityRole="button"
                        disabled={mutation.isPending}
                        onPress={() => remove('single')}
                        style={{
                            ...actionStyle,
                            backgroundColor: dark ? '#302a4e' : '#f0edff',
                        }}
                    >
                        <Text
                            style={{
                                color: dark ? '#b9abff' : '#6954df',
                                fontWeight: '700',
                            }}
                        >
                            {t(hasSeries ? 'sessionDeletion.single' : 'delete')}
                        </Text>
                    </TouchableOpacity>
                    {hasSeries && (
                        <>
                            <TouchableOpacity
                                accessibilityRole="button"
                                disabled={mutation.isPending}
                                onPress={() => remove('series')}
                                style={{
                                    ...actionStyle,
                                    backgroundColor: dark
                                        ? '#3a2330'
                                        : '#fff0f2',
                                }}
                            >
                                <Text
                                    style={{
                                        color: dark ? '#f19ab1' : '#c35671',
                                        fontWeight: '700',
                                    }}
                                >
                                    {t('sessionDeletion.series')}
                                </Text>
                            </TouchableOpacity>
                            <Text
                                style={{
                                    color: muted,
                                    fontSize: 12,
                                    lineHeight: 18,
                                }}
                            >
                                {t('sessionDeletion.allDates')}
                            </Text>
                        </>
                    )}
                    {!hasSeries && loading && (
                        <ActivityIndicator color="#6954df" />
                    )}
                    {!hasSeries && loadFailed && (
                        <Text style={{ color: muted, fontSize: 12 }}>
                            {t('sessionDeletion.singleSafe')}
                        </Text>
                    )}
                    {mutation.isPending && (
                        <ActivityIndicator
                            accessibilityLabel={t('sessionDeletion.deleting')}
                            color="#6954df"
                        />
                    )}
                    <TouchableOpacity
                        accessibilityRole="button"
                        disabled={mutation.isPending}
                        onPress={close}
                        style={actionStyle}
                    >
                        <Text style={{ color: muted, fontWeight: '700' }}>
                            {t('cancel')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
    return {
        requestDelete: (session: Session) => {
            if (!session.is_guest && !mutation.isPending) {
                setFailed(false);
                setTarget(session);
            }
        },
        dialog,
        isDeleting: mutation.isPending,
    };
}
