import { useRef, useState, useMemo, useEffect } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { Check, Trash2 } from 'lucide-react-native';
import { useAllSessionsQuery } from '../src/hooks/useSessionsQuery';
import { useAuthStore } from '../src/store/useAuthStore';
import { sessionTools } from '../src/services/sessionTools';
import { sessionRange } from '../src/utils/sessionPlanning';
import { sessionDisplayTitle } from '../src/utils/sessionNaming';
import {
    ToolsLayout,
    SessionChooser,
    ToolField,
} from '../src/components/sessionTools/ToolsLayout';
import {
    CommunityButton,
    useCommunityColors,
} from '../src/components/community/CommunityUI';
import { useTranslation } from '../src/i18n/useTranslation';
import { confirmAction } from '../src/utils/confirmAction';
export default function Preparation() {
    const { sessionId } = useLocalSearchParams<{ sessionId?: string }>(),
        [selected, setSelected] = useState(sessionId || ''),
        [title, setTitle] = useState(''),
        [busy, setBusy] = useState(false),
        [error, setError] = useState('');
    const lock = useRef(false),
        pendingId = useRef<{ title: string; id: string } | null>(null),
        c = useCommunityColors(),
        { t } = useTranslation(),
        client = useQueryClient(),
        user = useAuthStore((s) => s.session?.user.id),
        sessions = useAllSessionsQuery();
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);
    const current = sessions.data?.find(
        (s) => s.id === selected && s.user_id === user && !s.is_guest,
    );
    const choices = useMemo(
        () =>
            (sessions.data || [])
                .filter(
                    (s) =>
                        s.user_id === user &&
                        !s.is_guest &&
                        s.status !== 'cancelled' &&
                        sessionRange(s).end > now,
                )
                .sort((a, b) => a.date.localeCompare(b.date)),
        [sessions.data, user, now],
    );
    const tasks = useQuery({
        queryKey: ['session-tasks', user, selected],
        queryFn: () => sessionTools.tasks(selected),
        enabled: !!current,
    });
    const readonly =
        !current ||
        current.status === 'cancelled' ||
        sessionRange(current).end <= now;
    const act = async (fn: () => Promise<unknown>) => {
        if (lock.current || readonly) return;
        lock.current = true;
        setBusy(true);
        setError('');
        try {
            await fn();
            await client.invalidateQueries({ queryKey: ['session-tasks'] });
        } catch {
            setError(t('tools.saveError'));
        } finally {
            lock.current = false;
            setBusy(false);
        }
    };
    const add = () =>
        act(async () => {
            if (!title.trim() || !user) return;
            if (pendingId.current?.title !== title.trim())
                pendingId.current = { title: title.trim(), id: randomUUID() };
            await sessionTools.addTask(
                pendingId.current.id,
                selected,
                user,
                title,
            );
            pendingId.current = null;
            setTitle('');
        });
    const done = (tasks.data || []).filter((r) => r.completed).length,
        total = tasks.data?.length || 0;
    return (
        <ToolsLayout title={t('tools.preparation')}>
            {sessions.isLoading ? (
                <ActivityIndicator color={c.accent} />
            ) : sessions.isError ? (
                <CommunityButton
                    label={t('insights.retry')}
                    onPress={() => void sessions.refetch()}
                />
            ) : !selected ? (
                <SessionChooser
                    sessions={choices}
                    onSelect={(s) => setSelected(s.id)}
                    empty={t('tools.noFuture')}
                />
            ) : !current ? (
                <Text style={{ color: c.muted }}>
                    {t('tools.invalidSession')}
                </Text>
            ) : (
                <>
                    <Pressable
                        accessibilityRole="button"
                        onPress={() => setSelected('')}
                    >
                        <Text style={{ color: c.accent }}>
                            {t('tools.changeSession')}
                        </Text>
                    </Pressable>
                    <Text
                        style={{ fontSize: 20, fontWeight: '800', color: c.fg }}
                    >
                        {sessionDisplayTitle(current, t)}
                    </Text>
                    <Text style={{ color: c.muted }}>
                        {current.date} · {current.venue}
                    </Text>
                    <View
                        style={{
                            padding: 20,
                            borderRadius: 24,
                            backgroundColor: c.tint,
                            gap: 12,
                        }}
                    >
                        <Text
                            style={{
                                color: c.accent,
                                fontSize: 28,
                                fontWeight: '900',
                            }}
                        >
                            {done} / {total}
                        </Text>
                        <View
                            style={{
                                height: 5,
                                borderRadius: 3,
                                backgroundColor: c.border,
                                overflow: 'hidden',
                            }}
                        >
                            <View
                                style={{
                                    height: 5,
                                    width: `${total ? (done / total) * 100 : 0}%`,
                                    backgroundColor: c.accent,
                                }}
                            />
                        </View>
                        <Text style={{ color: c.muted }}>
                            {t('tools.tasksDone')}
                        </Text>
                    </View>
                    {readonly ? (
                        <Text style={{ color: c.muted }}>
                            {t('tools.readOnly')}
                        </Text>
                    ) : (
                        <>
                            <ToolField
                                label={t('tools.task')}
                                value={title}
                                onChangeText={setTitle}
                            />
                            <CommunityButton
                                label={t('tools.addTask')}
                                disabled={!title.trim()}
                                busy={busy}
                                onPress={add}
                            />
                        </>
                    )}
                    {error ? (
                        <Text
                            accessibilityRole="alert"
                            style={{ color: '#d44455' }}
                        >
                            {error}
                        </Text>
                    ) : null}
                    {tasks.isLoading ? (
                        <ActivityIndicator color={c.accent} />
                    ) : tasks.isError ? (
                        <CommunityButton
                            label={t('insights.retry')}
                            onPress={() => void tasks.refetch()}
                        />
                    ) : !total ? (
                        <Text style={{ color: c.muted }}>
                            {t('tools.noTasks')}
                        </Text>
                    ) : (
                        tasks.data?.map((task) => (
                            <View
                                key={task.id}
                                style={{
                                    padding: 14,
                                    backgroundColor: c.card,
                                    borderRadius: 18,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 12,
                                }}
                            >
                                <Pressable
                                    accessibilityRole="checkbox"
                                    accessibilityLabel={task.title}
                                    accessibilityState={{
                                        checked: task.completed,
                                        disabled: readonly || busy,
                                    }}
                                    disabled={readonly || busy}
                                    onPress={() =>
                                        void act(() =>
                                            sessionTools.task(task.id, {
                                                completed: !task.completed,
                                            }),
                                        )
                                    }
                                    style={{
                                        flex: 1,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 12,
                                        minHeight: 44,
                                    }}
                                >
                                    <View
                                        style={{
                                            width: 24,
                                            height: 24,
                                            borderRadius: 7,
                                            borderWidth: 1,
                                            borderColor: c.accent,
                                            backgroundColor: task.completed
                                                ? c.accent
                                                : 'transparent',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        {task.completed ? (
                                            <Check size={16} color="#fff" />
                                        ) : null}
                                    </View>
                                    <Text
                                        style={{
                                            flex: 1,
                                            color: task.completed
                                                ? c.muted
                                                : c.fg,
                                            textDecorationLine: task.completed
                                                ? 'line-through'
                                                : 'none',
                                        }}
                                    >
                                        {task.title}
                                    </Text>
                                </Pressable>
                                {!readonly ? (
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel={t(
                                            'tools.removeTask',
                                        )}
                                        disabled={busy}
                                        onPress={async () => {
                                            if (
                                                await confirmAction(
                                                    t('tools.removeTask'),
                                                    task.title,
                                                    t('cancel'),
                                                    t('delete'),
                                                )
                                            )
                                                void act(() =>
                                                    sessionTools.removeTask(
                                                        task.id,
                                                    ),
                                                );
                                        }}
                                        style={{ padding: 12 }}
                                    >
                                        <Trash2 color={c.muted} size={18} />
                                    </Pressable>
                                ) : null}
                            </View>
                        ))
                    )}
                </>
            )}
        </ToolsLayout>
    );
}
