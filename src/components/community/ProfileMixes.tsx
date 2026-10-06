import { useCallback, useState } from 'react';
import { View, Text } from 'react-native';
import {
    useInfiniteQuery,
    useMutation,
    useQueryClient,
} from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';
import { useTranslation } from '../../i18n/useTranslation';
import {
    MIX_PAGE_SIZE,
    ProfileMix,
    profileMixesService,
} from '../../services/profileMixes';
import { parseMixSource } from '../../utils/profileMixes';
import {
    CommunityButton,
    CommunityMessage,
    useCommunityColors,
} from './CommunityUI';
import { MixSourceFields } from './MixSourceFields';
import { MixPlayer } from './MixPlayer';
import { MixListItem } from './MixListItem';
import { useSavedMixFlags } from '../../hooks/useSavedMixes';

export function ProfileMixes({
    userId,
    editable = false,
    canAdd = false,
    bare = false,
    previewLimit,
    onViewAll,
    hideWhenEmpty = false,
}: {
    userId: string;
    editable?: boolean;
    canAdd?: boolean;
    bare?: boolean;
    previewLimit?: number;
    onViewAll?: () => void;
    hideWhenEmpty?: boolean;
}) {
    const { t } = useTranslation(),
        c = useCommunityColors(),
        client = useQueryClient();
    const viewer = useAuthStore((state) => state.session?.user.id);
    const [focused, setFocused] = useState(false);
    useFocusEffect(
        useCallback(() => {
            setFocused(true);
            return () => setFocused(false);
        }, []),
    );
    const owner = editable && viewer === userId;
    const [draft, setDraft] = useState<{
        id?: string;
        title: string;
        url: string;
    } | null>(null);
    const [active, setActive] = useState<string | null>(null);
    const [preview, setPreview] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const queryKey = ['community', 'mixes', viewer, userId];
    const mixes = useInfiniteQuery({
        queryKey,
        enabled: !!viewer && !!userId,
        initialPageParam: 0,
        queryFn: ({ pageParam }) => profileMixesService.list(userId, pageParam),
        getNextPageParam: (last, pages) =>
            last.length === MIX_PAGE_SIZE
                ? pages.length * MIX_PAGE_SIZE
                : undefined,
    });
    const mutation = useMutation({
        mutationFn: async (
            action: { kind: 'save' } | { kind: 'remove'; id: string },
        ) => {
            if (!owner) throw new Error('Unauthenticated');
            if (action.kind === 'remove')
                return profileMixesService.remove(userId, action.id);
            if (!draft || !canAdd) throw new Error('Profile incomplete');
            return profileMixesService.save(
                userId,
                draft.title,
                draft.url,
                draft.id,
            );
        },
        onSuccess: async () => {
            setDraft(null);
            setPreview(false);
            setConfirmDelete(null);
            setActive(null);
            await Promise.all([
                client.invalidateQueries({ queryKey }),
                client.invalidateQueries({
                    queryKey: ['community', 'activity'],
                }),
            ]);
        },
    });
    let source;
    try {
        if (draft?.url) source = parseMixSource(draft.url);
    } catch {
        /* Inline validation. */
    }
    const allRows = mixes.data?.pages.flat() || [];
    const rows = previewLimit ? allRows.slice(0, previewLimit) : allRows;
    const saved = useSavedMixFlags(rows.map((mix) => mix.id));
    const hasMore =
        !!previewLimit && (allRows.length > previewLimit || mixes.hasNextPage);
    const start = (mix?: ProfileMix) => {
        mutation.reset();
        setActive(null);
        setPreview(false);
        setConfirmDelete(null);
        setDraft(
            mix
                ? { id: mix.id, title: mix.title, url: mix.source_url }
                : { title: '', url: '' },
        );
    };
    if (hideWhenEmpty && !owner && mixes.isSuccess && !allRows.length)
        return null;
    return (
        <View
            style={{
                gap: 14,
                padding: bare ? 0 : 20,
                backgroundColor: bare ? 'transparent' : c.card,
                borderWidth: bare ? 0 : 1,
                borderColor: c.border,
                borderRadius: 24,
            }}
        >
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                }}
            >
                <Text style={{ color: c.fg, fontSize: 21, fontWeight: '800' }}>
                    {t('profileMixes.title')}
                </Text>
                {hasMore && onViewAll && (
                    <CommunityButton
                        compact
                        secondary
                        label={t('profileMixes.viewAll')}
                        onPress={onViewAll}
                    />
                )}
            </View>
            <Text style={{ color: c.muted, fontSize: 13, lineHeight: 20 }}>
                {t(
                    owner
                        ? 'profileMixes.ownerHint'
                        : 'profileMixes.listenerHint',
                )}
            </Text>
            {owner && !draft && (
                <CommunityButton
                    label={t('profileMixes.add')}
                    secondary
                    disabled={!canAdd || mutation.isPending || mixes.isError}
                    onPress={() => start()}
                />
            )}
            {owner && !canAdd && (
                <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
                    {t('socialProfile.completeHint')}
                </Text>
            )}
            {draft && (
                <View
                    style={{
                        gap: 12,
                        padding: 16,
                        borderRadius: 18,
                        backgroundColor: c.tint,
                    }}
                >
                    <Text
                        style={{ color: c.fg, fontWeight: '700', fontSize: 16 }}
                    >
                        {t(draft.id ? 'profileMixes.edit' : 'profileMixes.add')}
                    </Text>
                    <MixSourceFields
                        key={draft.id || 'new'}
                        title={draft.title}
                        url={draft.url}
                        editing={!!draft.id}
                        busy={mutation.isPending}
                        onChange={(value) => {
                            setDraft({ ...draft, ...value });
                            setPreview(false);
                        }}
                    />
                    {preview && source && focused && (
                        <MixPlayer
                            key={source.source_url}
                            source={source}
                            title={draft.title || t('profileMixes.preview')}
                        />
                    )}
                    <CommunityButton
                        label={t('profileMixes.preview')}
                        secondary
                        disabled={!source || mutation.isPending}
                        onPress={() => setPreview((value) => !value)}
                    />
                    <CommunityButton
                        label={t('profileMixes.save')}
                        disabled={!source || !draft.title.trim() || !canAdd}
                        busy={mutation.isPending}
                        onPress={() => mutation.mutate({ kind: 'save' })}
                    />
                    <CommunityButton
                        label={t('cancel')}
                        secondary
                        disabled={mutation.isPending}
                        onPress={() => {
                            setDraft(null);
                            setPreview(false);
                            mutation.reset();
                        }}
                    />
                </View>
            )}
            {mutation.isError && (
                <CommunityMessage
                    title={t('community.saveError')}
                    hint={t(
                        (mutation.error as { code?: string }).code === '23505'
                            ? 'profileMixes.duplicate'
                            : 'profileMixes.saveError',
                    )}
                />
            )}
            {mixes.isPending ? (
                <CommunityMessage title={t('community.loading')} loading />
            ) : mixes.isError ? (
                <CommunityMessage
                    title={t('community.error')}
                    retry={() => {
                        void mixes.refetch();
                    }}
                />
            ) : !rows.length && !draft ? (
                <View style={{ paddingVertical: 18, gap: 7 }}>
                    <Text style={{ color: c.fg, fontWeight: '700' }}>
                        {t('profileMixes.empty')}
                    </Text>
                    <Text
                        style={{ color: c.muted, fontSize: 13, lineHeight: 20 }}
                    >
                        {t(
                            owner
                                ? 'profileMixes.emptyOwner'
                                : 'profileMixes.emptyListener',
                        )}
                    </Text>
                </View>
            ) : null}
            {rows.map((mix) => (
                <View
                    key={mix.id}
                    style={{
                        gap: 12,
                        paddingTop: 16,
                        borderTopWidth: 1,
                        borderColor: c.border,
                    }}
                >
                    <MixListItem
                        mix={mix}
                        saveState={{
                            saved: !!saved.data?.[mix.id],
                            loading: saved.isPending,
                            error: saved.isError,
                            retry: () => {
                                void saved.refetch();
                            },
                        }}
                        active={active === mix.id && focused}
                        focused={focused}
                        onPress={() => {
                            setActive(active === mix.id ? null : mix.id);
                            setPreview(false);
                        }}
                    />
                    {active === mix.id && focused && (
                        <MixPlayer
                            key={mix.id}
                            autoPlay
                            source={mix}
                            title={mix.title}
                        />
                    )}
                    {owner && (
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <View style={{ flex: 1 }}>
                                <CommunityButton
                                    label={t('profileMixes.edit')}
                                    secondary
                                    disabled={
                                        !!draft || mutation.isPending || !canAdd
                                    }
                                    onPress={() => start(mix)}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <CommunityButton
                                    label={t('delete')}
                                    secondary
                                    disabled={!!draft || mutation.isPending}
                                    onPress={() => {
                                        setConfirmDelete(mix.id);
                                        mutation.reset();
                                    }}
                                />
                            </View>
                        </View>
                    )}
                    {owner && confirmDelete === mix.id && (
                        <View style={{ gap: 10 }}>
                            <Text style={{ color: c.fg, fontSize: 13 }}>
                                {t('profileMixes.deleteHint')}
                            </Text>
                            <CommunityButton
                                label={t('profileMixes.deleteConfirm')}
                                busy={mutation.isPending}
                                onPress={() =>
                                    mutation.mutate({
                                        kind: 'remove',
                                        id: mix.id,
                                    })
                                }
                            />
                            <CommunityButton
                                label={t('cancel')}
                                secondary
                                disabled={mutation.isPending}
                                onPress={() => setConfirmDelete(null)}
                            />
                        </View>
                    )}
                </View>
            ))}
            {!previewLimit && mixes.hasNextPage && (
                <CommunityButton
                    label={t('community.loadMore')}
                    secondary
                    busy={mixes.isFetchingNextPage}
                    onPress={() => {
                        void mixes.fetchNextPage();
                    }}
                />
            )}
        </View>
    );
}
