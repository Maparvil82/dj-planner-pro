import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useTranslation } from '../../i18n/useTranslation';
import { useCommunityColors } from '../community/CommunityUI';
import {
    canonicalGenre,
    parseMusicGenres,
    serializeMusicGenres,
    suggestMusicGenres,
} from '../../utils/musicGenres';

export function MusicGenrePicker({
    value,
    onChange,
    disabled,
}: {
    value: string;
    onChange: (value: string) => void;
    disabled: boolean;
}) {
    const c = useCommunityColors();
    const { t } = useTranslation();
    const [query, setQuery] = useState('');
    const selected = parseMusicGenres(value);
    const options = suggestMusicGenres(query, selected);
    const add = (name: string) => {
        const next = serializeMusicGenres([...selected, name]);
        if (next.length <= 120) {
            onChange(next);
            setQuery('');
        }
    };
    return (
        <View style={{ gap: 10 }}>
            <Text style={{ color: c.muted, fontSize: 12, fontWeight: '600' }}>
                {t('community.genres')}
            </Text>
            <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
                {t('profileUX.genreHint')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {selected.map((name) => (
                    <TouchableOpacity
                        key={name}
                        disabled={disabled}
                        accessibilityRole="button"
                        accessibilityLabel={t('profileUX.removeGenre', {
                            name,
                        })}
                        onPress={() =>
                            onChange(
                                serializeMusicGenres(
                                    selected.filter((item) => item !== name),
                                ),
                            )
                        }
                        style={{
                            paddingHorizontal: 12,
                            paddingVertical: 9,
                            borderRadius: 20,
                            backgroundColor: c.tint,
                        }}
                    >
                        <Text
                            style={{
                                color: c.accent,
                                fontSize: 12,
                                fontWeight: '600',
                            }}
                        >
                            {name} ×
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
            {selected.some((name) => !canonicalGenre(name)) && (
                <Text style={{ color: c.muted, fontSize: 12 }}>
                    {t('profileUX.legacyGenres')}
                </Text>
            )}
            <TextInput
                accessibilityLabel={t('community.genres')}
                placeholder={t('profileUX.genreSearch')}
                placeholderTextColor={c.muted}
                value={query}
                onChangeText={setQuery}
                editable={!disabled}
                autoCorrect={false}
                style={{
                    minHeight: 48,
                    padding: 14,
                    borderRadius: 14,
                    backgroundColor: c.field,
                    borderWidth: 1,
                    borderColor: c.border,
                    color: c.fg,
                }}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {options.map((name) => (
                    <TouchableOpacity
                        key={name}
                        disabled={
                            disabled ||
                            serializeMusicGenres([...selected, name]).length >
                                120
                        }
                        accessibilityRole="button"
                        accessibilityLabel={t('profileUX.addGenre', { name })}
                        onPress={() => add(name)}
                        style={{
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: c.border,
                        }}
                    >
                        <Text style={{ color: c.fg, fontSize: 13 }}>
                            {name}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
            {!!query && !options.length && (
                <Text style={{ color: c.muted, fontSize: 12 }}>
                    {t('profileUX.noGenres')}
                </Text>
            )}
        </View>
    );
}
