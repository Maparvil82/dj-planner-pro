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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
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
}: {
    value: CommunityFilters;
    onChange: (v: CommunityFilters) => void;
    mode: 'sessions' | 'djs';
    options?: CommunityFilterOptions;
    loading: boolean;
    error: boolean;
    retry: () => void;
}) {
    const { t } = useTranslation();
    const c = useCommunityColors();
    const [picker, setPicker] = useState<'city' | 'genre' | null>(null);
    const [search, setSearch] = useState('');
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
    const all = picker === 'city' ? options?.cities || [] : genres;
    const choices = all.filter((s) => fold(s).includes(fold(search)));
    const label =
        picker === 'city' ? 'communityFilters.city' : 'communityFilters.genre';
    const select = (choice: string) => {
        if (picker) onChange({ ...value, [picker]: choice });
        setPicker(null);
        setSearch('');
    };
    return (
        <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['city', 'genre'] as const).map((kind) => (
                    <Pressable
                        key={kind}
                        accessibilityRole="button"
                        accessibilityLabel={`${t('communityFilters.' + kind)}: ${value[kind] || t(kind === 'city' ? 'communityFilters.allCities' : 'communityFilters.allGenres')}`}
                        onPress={() => {
                            setSearch('');
                            setPicker(kind);
                        }}
                        style={{
                            flex: 1,
                            minHeight: 46,
                            paddingHorizontal: 14,
                            paddingVertical: 12,
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: value[kind] ? c.accent : c.border,
                            backgroundColor: value[kind] ? c.tint : c.card,
                            justifyContent: 'center',
                        }}
                    >
                        <Text
                            numberOfLines={1}
                            style={{
                                color: value[kind] ? c.accent : c.muted,
                                fontSize: 13,
                                fontWeight: '700',
                            }}
                        >
                            {value[kind] || t('communityFilters.' + kind)}
                        </Text>
                    </Pressable>
                ))}
            </View>
            {!!(value.city || value.genre) && (
                <Pressable
                    accessibilityRole="button"
                    onPress={() => onChange({ city: '', genre: '' })}
                    style={{
                        alignSelf: 'flex-end',
                        paddingVertical: 8,
                        paddingHorizontal: 4,
                    }}
                >
                    <Text
                        style={{
                            fontSize: 12,
                            color: c.accent,
                            fontWeight: '700',
                        }}
                    >
                        {t('communityFilters.clear')}
                    </Text>
                </Pressable>
            )}
            <Modal
                visible={!!picker}
                transparent
                animationType="slide"
                onRequestClose={() => setPicker(null)}
            >
                <View
                    style={{
                        flex: 1,
                        justifyContent: 'flex-end',
                        backgroundColor: '#00000066',
                    }}
                >
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('cancel')}
                        style={{ flex: 1 }}
                        onPress={() => setPicker(null)}
                    />
                    <SafeAreaView
                        edges={['bottom']}
                        style={{
                            height: '72%',
                            maxHeight: 620,
                            backgroundColor: c.card,
                            borderTopLeftRadius: 28,
                            borderTopRightRadius: 28,
                        }}
                    >
                        <View
                            style={{ padding: 20, paddingBottom: 14, gap: 14 }}
                        >
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 23,
                                        fontWeight: '800',
                                        color: c.fg,
                                    }}
                                >
                                    {t(label)}
                                </Text>
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={t('cancel')}
                                    onPress={() => setPicker(null)}
                                    style={{
                                        width: 44,
                                        height: 44,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderRadius: 15,
                                        backgroundColor: c.bg,
                                    }}
                                >
                                    <X size={22} color={c.fg} />
                                </Pressable>
                            </View>
                            <Text
                                style={{
                                    fontSize: 13,
                                    lineHeight: 20,
                                    color: c.muted,
                                }}
                            >
                                {t(
                                    picker === 'city'
                                        ? mode === 'sessions'
                                            ? 'communityFilters.sessionCityHint'
                                            : 'communityFilters.djCityHint'
                                        : 'communityFilters.genreHint',
                                )}
                            </Text>
                            <TextInput
                                value={search}
                                onChangeText={setSearch}
                                accessibilityLabel={t(
                                    picker === 'city'
                                        ? 'communityFilters.searchCity'
                                        : 'communityFilters.searchGenre',
                                )}
                                placeholder={t(
                                    picker === 'city'
                                        ? 'communityFilters.searchCity'
                                        : 'communityFilters.searchGenre',
                                )}
                                placeholderTextColor={c.muted}
                                style={{
                                    minHeight: 50,
                                    backgroundColor: c.bg,
                                    color: c.fg,
                                    padding: 14,
                                    borderRadius: 14,
                                }}
                            />
                        </View>
                        <ScrollView
                            automaticallyAdjustKeyboardInsets={
                                Platform.OS === 'ios'
                            }
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode="on-drag"
                            contentContainerStyle={{
                                paddingHorizontal: 20,
                                paddingBottom: 28,
                                gap: 6,
                            }}
                        >
                            <CommunityButton
                                secondary
                                label={t(
                                    picker === 'city'
                                        ? 'communityFilters.allCities'
                                        : 'communityFilters.allGenres',
                                )}
                                onPress={() => select('')}
                            />
                            {picker === 'city' && loading ? (
                                <ActivityIndicator
                                    color={c.accent}
                                    style={{ margin: 20 }}
                                />
                            ) : picker === 'city' && error ? (
                                <CommunityButton
                                    label={t('insights.retry')}
                                    onPress={retry}
                                />
                            ) : (
                                choices.map((choice) => (
                                    <Pressable
                                        key={choice}
                                        accessibilityRole="button"
                                        accessibilityState={{
                                            selected:
                                                !!picker &&
                                                fold(value[picker]) ===
                                                    fold(choice),
                                        }}
                                        onPress={() => select(choice)}
                                        style={{
                                            paddingVertical: 16,
                                            paddingHorizontal: 14,
                                            minHeight: 50,
                                            borderRadius: 14,
                                            backgroundColor:
                                                picker &&
                                                fold(value[picker]) ===
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
                                    style={{
                                        color: c.muted,
                                        paddingVertical: 20,
                                    }}
                                >
                                    {t('communityFilters.noOptions')}
                                </Text>
                            )}
                        </ScrollView>
                    </SafeAreaView>
                </View>
            </Modal>
        </View>
    );
}
