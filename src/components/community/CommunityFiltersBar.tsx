import { useMemo, useState } from 'react';
import {
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
    ActivityIndicator,
    Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    X,
    Search,
    SlidersHorizontal,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react-native';
import { useTranslation } from '../../i18n/useTranslation';
import { MUSIC_GENRES, canonicalGenre } from '../../utils/musicGenres';
import type {
    CommunityFilters,
    CommunityFilterOptions,
} from '../../services/community';
import { CommunityButton, useCommunityColors } from './CommunityUI';
const fold = (s: string) =>
    s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
export function CommunityFiltersBar({
    value,
    onChange,
    mode,
    options,
    loading,
    error,
    retry,
    search,
    onSearch,
    placeholder,
}: {
    value: CommunityFilters;
    onChange: (v: CommunityFilters) => void;
    mode: 'sessions' | 'djs' | 'activity';
    options?: CommunityFilterOptions;
    loading: boolean;
    error: boolean;
    retry: () => void;
    search: string;
    onSearch: (value: string) => void;
    placeholder: string;
}) {
    const { t } = useTranslation();
    const c = useCommunityColors();
    const [panel, setPanel] = useState<'filters' | 'city' | 'genre' | null>(
        null,
    );
    const [draft, setDraft] = useState(value);
    const [query, setQuery] = useState('');
    const count = Number(!!value.city) + Number(!!value.genre);
    const genres = useMemo(
        () =>
            Array.from(
                new Set([
                    ...MUSIC_GENRES,
                    ...(options?.genres || []).map(
                        (g) => canonicalGenre(g) || g,
                    ),
                ]),
            ).sort((a, b) => a.localeCompare(b)),
        [options?.genres],
    );
    const choices = (panel === 'city' ? options?.cities || [] : genres).filter(
        (s) => fold(s).includes(fold(query)),
    );
    const close = () => {
        Keyboard.dismiss();
        setPanel(null);
        setQuery('');
    };
    const select = (choice: string) => {
        if (panel === 'city' || panel === 'genre')
            setDraft({ ...draft, [panel]: choice });
        Keyboard.dismiss();
        setPanel('filters');
        setQuery('');
    };
    return (
        <View style={{ gap: 10 }}>
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    minHeight: 52,
                    backgroundColor: c.card,
                    borderWidth: 1,
                    borderColor: c.border,
                    borderRadius: 17,
                    paddingLeft: 14,
                }}
            >
                <Search size={18} color={c.muted} />
                <TextInput
                    value={search}
                    onChangeText={onSearch}
                    accessibilityLabel={placeholder}
                    placeholder={placeholder}
                    placeholderTextColor={c.muted}
                    style={{
                        flex: 1,
                        minWidth: 0,
                        padding: 12,
                        color: c.fg,
                        fontSize: 14,
                        minHeight: 52,
                    }}
                />
                {!!search && (
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('communityFilters.clearSearch')}
                        onPress={() => onSearch('')}
                        style={{ padding: 9 }}
                    >
                        <X size={17} color={c.muted} />
                    </Pressable>
                )}
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('communityFilters.title')}
                    accessibilityState={{ expanded: !!panel }}
                    onPress={() => {
                        Keyboard.dismiss();
                        setDraft(value);
                        setQuery('');
                        setPanel('filters');
                    }}
                    style={{
                        minWidth: 52,
                        minHeight: 52,
                        paddingHorizontal: 12,
                        borderLeftWidth: 1,
                        borderColor: c.border,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 5,
                    }}
                >
                    <SlidersHorizontal
                        size={20}
                        color={count ? c.accent : c.muted}
                    />
                    {!!count && (
                        <Text
                            style={{
                                color: c.accent,
                                fontWeight: '800',
                                fontSize: 12,
                            }}
                        >
                            {count}
                        </Text>
                    )}
                </Pressable>
            </View>
            {!!count && (
                <View
                    style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}
                >
                    {(['city', 'genre'] as const)
                        .filter((kind) => value[kind])
                        .map((kind) => (
                            <Pressable
                                key={kind}
                                accessibilityRole="button"
                                accessibilityLabel={t(
                                    'communityFilters.removeFilter',
                                    { name: value[kind] },
                                )}
                                onPress={() =>
                                    onChange({ ...value, [kind]: '' })
                                }
                                style={{
                                    maxWidth: '100%',
                                    flexDirection: 'row',
                                    gap: 7,
                                    alignItems: 'center',
                                    backgroundColor: c.tint,
                                    paddingVertical: 8,
                                    paddingHorizontal: 11,
                                    borderRadius: 20,
                                }}
                            >
                                <Text
                                    numberOfLines={1}
                                    style={{
                                        color: c.accent,
                                        fontSize: 12,
                                        flexShrink: 1,
                                    }}
                                >
                                    {value[kind]}
                                </Text>
                                <X size={13} color={c.accent} />
                            </Pressable>
                        ))}
                </View>
            )}
            <Modal
                visible={!!panel}
                transparent
                animationType="slide"
                onRequestClose={close}
            >
                <View
                    style={{
                        flex: 1,
                        justifyContent: 'flex-end',
                        backgroundColor: '#09061680',
                    }}
                >
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('cancel')}
                        style={{ flex: 1 }}
                        onPress={close}
                    />
                    <SafeAreaView
                        edges={['bottom']}
                        style={{
                            height: '68%',
                            maxHeight: 600,
                            backgroundColor: c.card,
                            borderTopLeftRadius: 28,
                            borderTopRightRadius: 28,
                        }}
                    >
                        <View
                            style={{
                                alignSelf: 'center',
                                height: 4,
                                width: 36,
                                backgroundColor: c.border,
                                borderRadius: 2,
                                marginTop: 10,
                            }}
                        />
                        <View style={{ padding: 20, gap: 12 }}>
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 10,
                                }}
                            >
                                {panel !== 'filters' && (
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel={t(
                                            'communityFilters.back',
                                        )}
                                        onPress={() => {
                                            Keyboard.dismiss();
                                            setPanel('filters');
                                            setQuery('');
                                        }}
                                        style={{ padding: 8 }}
                                    >
                                        <ChevronLeft size={22} color={c.fg} />
                                    </Pressable>
                                )}
                                <Text
                                    style={{
                                        flex: 1,
                                        fontSize: 24,
                                        fontWeight: '800',
                                        color: c.fg,
                                    }}
                                >
                                    {t(
                                        panel === 'filters'
                                            ? 'communityFilters.title'
                                            : panel === 'city'
                                              ? 'communityFilters.city'
                                              : mode !== 'djs'
                                                ? 'location.djStyles'
                                                : 'communityFilters.genre',
                                    )}
                                </Text>
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={t('cancel')}
                                    onPress={close}
                                    style={{
                                        padding: 10,
                                        backgroundColor: c.bg,
                                        borderRadius: 14,
                                    }}
                                >
                                    <X size={22} color={c.fg} />
                                </Pressable>
                            </View>
                            {panel !== 'filters' && (
                                <>
                                    <Text
                                        style={{
                                            color: c.muted,
                                            fontSize: 13,
                                            lineHeight: 19,
                                        }}
                                    >
                                        {t(
                                            panel === 'city'
                                                ? mode === 'activity'
                                                    ? 'location.activityCityHint'
                                                    : mode === 'sessions'
                                                      ? 'communityFilters.sessionCityHint'
                                                      : 'communityFilters.djCityHint'
                                                : 'communityFilters.genreHint',
                                        )}
                                    </Text>
                                    <TextInput
                                        value={query}
                                        onChangeText={setQuery}
                                        accessibilityLabel={t(
                                            panel === 'city'
                                                ? 'communityFilters.searchCity'
                                                : 'communityFilters.searchGenre',
                                        )}
                                        placeholder={t(
                                            panel === 'city'
                                                ? 'communityFilters.searchCity'
                                                : 'communityFilters.searchGenre',
                                        )}
                                        placeholderTextColor={c.muted}
                                        style={{
                                            padding: 14,
                                            borderRadius: 14,
                                            backgroundColor: c.bg,
                                            color: c.fg,
                                            minHeight: 50,
                                        }}
                                    />
                                </>
                            )}
                        </View>
                        {panel === 'filters' ? (
                            <View
                                style={{
                                    flex: 1,
                                    paddingHorizontal: 20,
                                    gap: 12,
                                }}
                            >
                                {(['city', 'genre'] as const).map((kind) => (
                                    <Pressable
                                        key={kind}
                                        accessibilityRole="button"
                                        accessibilityLabel={t(
                                            kind === 'genre' && mode !== 'djs'
                                                ? 'location.djStyles'
                                                : 'communityFilters.' + kind,
                                        )}
                                        onPress={() => {
                                            setQuery('');
                                            setPanel(kind);
                                        }}
                                        style={{
                                            padding: 17,
                                            borderWidth: 1,
                                            borderColor: c.border,
                                            borderRadius: 17,
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            gap: 10,
                                        }}
                                    >
                                        <View style={{ flex: 1, gap: 5 }}>
                                            <Text
                                                style={{
                                                    color: c.muted,
                                                    fontSize: 12,
                                                }}
                                            >
                                                {t(
                                                    kind === 'genre' &&
                                                        mode !== 'djs'
                                                        ? 'location.djStyles'
                                                        : 'communityFilters.' +
                                                              kind,
                                                )}
                                            </Text>
                                            <Text
                                                numberOfLines={2}
                                                style={{
                                                    color: draft[kind]
                                                        ? c.accent
                                                        : c.fg,
                                                    fontWeight: '600',
                                                    fontSize: 15,
                                                }}
                                            >
                                                {draft[kind] ||
                                                    t(
                                                        kind === 'city'
                                                            ? 'communityFilters.allCities'
                                                            : 'communityFilters.allGenres',
                                                    )}
                                            </Text>
                                        </View>
                                        <ChevronRight
                                            size={18}
                                            color={c.muted}
                                        />
                                    </Pressable>
                                ))}
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={t(
                                        'communityFilters.clear',
                                    )}
                                    onPress={() =>
                                        setDraft({ city: '', genre: '' })
                                    }
                                    style={{
                                        paddingVertical: 10,
                                        alignSelf: 'flex-start',
                                    }}
                                >
                                    <Text
                                        style={{
                                            color: c.accent,
                                            fontWeight: '600',
                                            fontSize: 13,
                                        }}
                                    >
                                        {t('communityFilters.clear')}
                                    </Text>
                                </Pressable>
                            </View>
                        ) : (
                            <ScrollView
                                automaticallyAdjustKeyboardInsets={
                                    Platform.OS === 'ios'
                                }
                                keyboardShouldPersistTaps="handled"
                                keyboardDismissMode="on-drag"
                                contentContainerStyle={{
                                    paddingHorizontal: 20,
                                    paddingBottom: 24,
                                    gap: 6,
                                }}
                            >
                                <CommunityButton
                                    secondary
                                    label={t(
                                        panel === 'city'
                                            ? 'communityFilters.allCities'
                                            : 'communityFilters.allGenres',
                                    )}
                                    onPress={() => select('')}
                                />
                                {panel === 'city' && loading ? (
                                    <ActivityIndicator
                                        color={c.accent}
                                        style={{ margin: 20 }}
                                    />
                                ) : panel === 'city' && error ? (
                                    <CommunityButton
                                        secondary
                                        label={t('insights.retry')}
                                        onPress={retry}
                                    />
                                ) : (
                                    choices.map((choice) => (
                                        <Pressable
                                            key={choice}
                                            accessibilityRole="button"
                                            accessibilityLabel={choice}
                                            accessibilityState={{
                                                selected:
                                                    !!panel &&
                                                    fold(draft[panel]) ===
                                                        fold(choice),
                                            }}
                                            onPress={() => select(choice)}
                                            style={{
                                                padding: 15,
                                                minHeight: 50,
                                                borderRadius: 14,
                                                backgroundColor:
                                                    panel &&
                                                    fold(draft[panel]) ===
                                                        fold(choice)
                                                        ? c.tint
                                                        : c.card,
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    color: c.fg,
                                                    fontSize: 15,
                                                    fontWeight: '600',
                                                }}
                                            >
                                                {choice}
                                            </Text>
                                        </Pressable>
                                    ))
                                )}
                                {!loading && !error && !choices.length && (
                                    <Text
                                        style={{ color: c.muted, padding: 15 }}
                                    >
                                        {t('communityFilters.noOptions')}
                                    </Text>
                                )}
                            </ScrollView>
                        )}
                        {panel === 'filters' && (
                            <View style={{ padding: 20, paddingTop: 12 }}>
                                <CommunityButton
                                    label={t('communityFilters.apply')}
                                    onPress={() => {
                                        onChange(draft);
                                        close();
                                    }}
                                />
                            </View>
                        )}
                    </SafeAreaView>
                </View>
            </Modal>
        </View>
    );
}
