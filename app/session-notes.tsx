import { ActivityIndicator, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { ToolsLayout } from '../src/components/sessionTools/ToolsLayout';
import { SessionNotesCard } from '../src/components/sessions/SessionNotesCard';
import { useCommunityColors } from '../src/components/community/communityColors';
import { useSessionByIdQuery } from '../src/hooks/useSessionsQuery';
import { useAuthStore } from '../src/store/useAuthStore';
import { useTranslation } from '../src/i18n/useTranslation';

export default function SessionNotesScreen() {
    const params = useLocalSearchParams<{ sessionId?: string | string[] }>();
    const sessionId = Array.isArray(params.sessionId) ? params.sessionId[0] : params.sessionId;
    const userId = useAuthStore(state => state.session?.user.id);
    const query = useSessionByIdQuery(sessionId);
    const { t, dateLocale } = useTranslation();
    const c = useCommunityColors();
    if (!userId) return <Redirect href="/(auth)/login" />;
    if (!sessionId) return <Redirect href="/home" />;
    const session = query.data;
    if (session && (session.is_guest || session.user_id !== userId))
        return <Redirect href={{ pathname: '/session/[id]', params: { id: sessionId } }} />;
    return <ToolsLayout title={t('sessionNotes.title')}>
        {query.isPending ? <ActivityIndicator color={c.accent} /> : !session || query.isError ?
            <Text style={{ color: c.fg }} onPress={() => void query.refetch()}>{t('error_loading_session')}</Text> : <>
                <View style={{ gap: 6, paddingVertical: 8 }}>
                    <Text style={{ color: c.fg, fontSize: 20, fontWeight: '800' }}>{session.venue}</Text>
                    <Text style={{ color: c.muted }}>{new Date(`${session.date}T12:00:00`).toLocaleDateString(dateLocale)} · {session.start_time} — {session.end_time}</Text>
                </View>
                <SessionNotesCard key={session.id} sessionId={session.id} notes={session.notes} />
            </>}
    </ToolsLayout>;
}
