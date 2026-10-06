import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useTranslation } from '../../i18n/useTranslation';
import { useCommunityColors } from '../community/CommunityUI';

export function SessionTimezoneField({
    value,
    onChange,
    date,
}: {
    value: string;
    onChange: (zone: string) => void;
    date: string;
}) {
    const [editing, setEditing] = useState(false);
    const { t, currentLanguage } = useTranslation();
    const c = useCommunityColors();
    const city = value.split('/').pop()?.replace(/_/g, ' ') || value;
    let offset = '';
    try {
        offset =
            new Intl.DateTimeFormat(currentLanguage, {
                timeZone: value,
                timeZoneName: 'shortOffset',
            })
                .formatToParts(new Date(`${date}T12:00:00Z`))
                .find((part) => part.type === 'timeZoneName')?.value || '';
    } catch {
        /* Validation also runs before saving. */
    }
    return (
        <View style={{ gap: 8, marginTop: 12 }}>
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                }}
            >
                <View style={{ flex: 1 }}>
                    <Text style={{ color: c.muted, fontSize: 12 }}>
                        {t('location.timezone')}
                    </Text>
                    <Text
                        style={{
                            color: c.fg,
                            fontWeight: '600',
                            fontSize: 14,
                            marginTop: 4,
                        }}
                    >
                        {[city, offset].filter(Boolean).join(' · ')}
                    </Text>
                </View>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('simpleForm.changeTimezone')}
                    onPress={() => setEditing(!editing)}
                    style={{
                        minHeight: 44,
                        justifyContent: 'center',
                        paddingHorizontal: 10,
                    }}
                >
                    <Text
                        style={{
                            color: c.accent,
                            fontWeight: '600',
                            fontSize: 13,
                        }}
                    >
                        {t(editing ? 'simpleForm.done' : 'simpleForm.change')}
                    </Text>
                </Pressable>
            </View>
            <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
                {t('simpleForm.timezoneHelp')}
            </Text>
            {editing && (
                <>
                    <TextInput
                        value={value}
                        onChangeText={onChange}
                        autoCapitalize="none"
                        autoCorrect={false}
                        maxLength={80}
                        accessibilityLabel={t('location.timezone')}
                        style={{
                            color: c.fg,
                            backgroundColor: c.field,
                            borderRadius: 14,
                            padding: 14,
                            borderWidth: 1,
                            borderColor: c.border,
                        }}
                    />
                    <Text
                        style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}
                    >
                        {t('simpleForm.timezoneFormat')}
                    </Text>
                </>
            )}
        </View>
    );
}
