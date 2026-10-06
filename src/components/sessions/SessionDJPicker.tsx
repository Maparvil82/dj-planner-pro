import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { useAuthStore } from '../../store/useAuthStore';
import { useTranslation } from '../../i18n/useTranslation';
import { communityService } from '../../services/community';
import { useCommunityColors } from '../community/CommunityUI';
import { Avatar } from '../ui/Avatar';

export function SessionDJPicker({
    names,
    linked,
    onChange,
    query,
    onQueryChange,
    suggestions,
    recentSuggestions,
    disabled = false,
}: {
    names: string[];
    linked: Record<string, string>;
    onChange: (names: string[], linked: Record<string, string>) => void;
    query: string;
    onQueryChange: (value: string) => void;
    suggestions: { name: string }[];
    recentSuggestions?: { name: string; id?: string }[];
    disabled?: boolean;
}) {
    const c = useCommunityColors();
    const { t } = useTranslation();
    const userId = useAuthStore((state) => state.session?.user.id);
    const [search, setSearch] = useState('');
    useEffect(() => {
        const timer = setTimeout(() => setSearch(query.trim()), 250);
        return () => clearTimeout(timer);
    }, [query]);
    const results = useQuery({
        queryKey: ['community', 'session-dj-search', userId, search],
        enabled: !!userId && search.length >= 2,
        queryFn: () => communityService.discover(search, 0),
    });
    const add = (name: string, id?: string) => {
        if (disabled) return;
        const existing = names.find(
            (value) => value.toLowerCase() === name.toLowerCase(),
        );
        const next = existing
            ? names.map((value) => (value === existing ? name : value))
            : [...names, name];
        const refs = { ...linked };
        if (existing && existing !== name) delete refs[existing];
        if (id) refs[name] = id;
        onChange(next, refs);
        onQueryChange('');
    };
    const profiles =
        search === query.trim()
            ? (results.data || []).filter(
                  (person) =>
                      person.user_id !== userId &&
                      !Object.values(linked).includes(person.user_id),
              )
            : [];
    const recent = (recentSuggestions || [])
        .filter(
            (person) =>
                !names.some(
                    (name) =>
                        name.toLocaleLowerCase() ===
                        person.name.toLocaleLowerCase(),
                ) &&
                (!person.id || !Object.values(linked).includes(person.id)),
        )
        .slice(0, 3);
    return (
        <View style={{ gap: 12 }}>
            <Text style={{ color: c.muted, fontSize: 13, lineHeight: 20 }}>
                {t('collaboration.pickerHint')}
            </Text>
            <TextInput
                accessibilityLabel={t('collaboration.search')}
                placeholder={t('collaboration.search')}
                placeholderTextColor={c.muted}
                value={query}
                onChangeText={onQueryChange}
                editable={!disabled}
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={() => {
                    if (query.trim()) add(query.trim());
                }}
                style={{
                    padding: 14,
                    minHeight: 48,
                    color: c.fg,
                    backgroundColor: c.field,
                    borderWidth: 1,
                    borderColor: c.border,
                    borderRadius: 14,
                }}
            />
            {!query.trim() && recent.length > 0 && (
                <View style={{ gap: 8 }}>
                    <Text style={{ color: c.muted, fontSize: 12 }}>
                        {t('simpleForm.recentDjs')}
                    </Text>
                    <View
                        style={{
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            gap: 8,
                        }}
                    >
                        {recent.map((person) => (
                            <TouchableOpacity
                                key={person.id || person.name}
                                accessibilityRole="button"
                                accessibilityLabel={t(
                                    'simpleForm.addRecentDJ',
                                    { name: person.name },
                                )}
                                disabled={
                                    disabled ||
                                    (!!person.id &&
                                        Object.keys(linked).length >= 20)
                                }
                                onPress={() => add(person.name, person.id)}
                                style={{
                                    minHeight: 44,
                                    justifyContent: 'center',
                                    paddingHorizontal: 14,
                                    backgroundColor: c.tint,
                                    borderRadius: 14,
                                }}
                            >
                                <Text
                                    style={{
                                        color: c.accent,
                                        fontSize: 13,
                                        fontWeight: '600',
                                    }}
                                >
                                    {person.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            )}
            {query.trim().length >= 2 && results.isFetching && (
                <ActivityIndicator color={c.accent} />
            )}
            {query.trim().length >= 2 && results.isError && (
                <View style={{ gap: 8 }}>
                    <Text style={{ color: c.muted, fontSize: 12 }}>
                        {t('collaboration.searchError')}
                    </Text>
                    <TouchableOpacity
                        accessibilityRole="button"
                        onPress={() => {
                            void results.refetch();
                        }}
                    >
                        <Text style={{ color: c.accent }}>
                            {t('insights.retry')}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}
            {profiles.map((person) => (
                <TouchableOpacity
                    key={person.user_id}
                    disabled={disabled || Object.keys(linked).length >= 20}
                    accessibilityRole="button"
                    accessibilityLabel={t('collaboration.inviteDJ', {
                        name: person.artist_name,
                    })}
                    onPress={() => add(person.artist_name, person.user_id)}
                    style={{
                        padding: 12,
                        backgroundColor: c.field,
                        borderRadius: 16,
                        flexDirection: 'row',
                        gap: 12,
                        alignItems: 'center',
                    }}
                >
                    <Avatar url={person.avatar_url} name={person.artist_name} />
                    <View style={{ flex: 1, gap: 4 }}>
                        <Text
                            style={{
                                color: c.fg,
                                fontWeight: '700',
                                fontSize: 14,
                            }}
                        >
                            {person.artist_name}
                        </Text>
                        <Text style={{ color: c.muted, fontSize: 11 }}>
                            {[person.city, t('collaboration.publicDJ')]
                                .filter(Boolean)
                                .join(' · ')}
                        </Text>
                    </View>
                    <Text
                        style={{
                            color: c.accent,
                            fontWeight: '600',
                            fontSize: 12,
                        }}
                    >
                        {t('collaboration.invite')}
                    </Text>
                </TouchableOpacity>
            ))}
            {!!query.trim() && (
                <TouchableOpacity
                    disabled={disabled}
                    accessibilityRole="button"
                    accessibilityLabel={t('collaboration.addManual', {
                        name: query.trim(),
                    })}
                    onPress={() => add(query.trim())}
                    style={{ paddingVertical: 10 }}
                >
                    <Text style={{ color: c.accent, fontSize: 13 }}>
                        {t('collaboration.addManual', { name: query.trim() })}
                    </Text>
                </TouchableOpacity>
            )}
            {!query.trim() &&
                recentSuggestions === undefined &&
                suggestions
                    .filter(
                        (item) =>
                            !names.some(
                                (name) =>
                                    name.toLowerCase() ===
                                    item.name.toLowerCase(),
                            ),
                    )
                    .slice(0, 5)
                    .map((item) => (
                        <TouchableOpacity
                            key={item.name}
                            disabled={disabled}
                            onPress={() => add(item.name)}
                        >
                            <Text
                                style={{
                                    color: c.muted,
                                    paddingVertical: 5,
                                    fontSize: 13,
                                }}
                            >
                                {item.name}
                            </Text>
                        </TouchableOpacity>
                    ))}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {names.map((name) => (
                    <TouchableOpacity
                        key={name}
                        disabled={disabled}
                        accessibilityRole="button"
                        accessibilityLabel={t('collaboration.removeDJ', {
                            name,
                        })}
                        onPress={() => {
                            const refs = { ...linked };
                            delete refs[name];
                            onChange(
                                names.filter((value) => value !== name),
                                refs,
                            );
                        }}
                        style={{
                            padding: 12,
                            borderRadius: 16,
                            backgroundColor: c.tint,
                        }}
                    >
                        <Text
                            style={{
                                color: c.accent,
                                fontSize: 13,
                                fontWeight: '600',
                            }}
                        >
                            {name} ×
                        </Text>
                        <Text
                            style={{
                                color: c.muted,
                                fontSize: 10,
                                marginTop: 4,
                            }}
                        >
                            {t(
                                linked[name]
                                    ? 'collaboration.inviteOnSave'
                                    : 'collaboration.manualDJ',
                            )}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
}
