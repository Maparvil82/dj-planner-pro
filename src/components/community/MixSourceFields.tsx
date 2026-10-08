import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { fetchMixMetadata } from '../../services/mixMetadata';
import { parseMixSource } from '../../utils/profileMixes';
import { useTranslation } from '../../i18n/useTranslation';
import { CommunityButton, useCommunityColors } from './CommunityUI';

/** Shared URL-first form for both the creation menu and the DJ profile. */
export function MixSourceFields({
    title,
    url,
    editing = false,
    busy = false,
    onChange,
}: {
    title: string;
    url: string;
    editing?: boolean;
    busy?: boolean;
    onChange: (value: { title: string; url: string }) => void;
}) {
    const { t } = useTranslation();
    const c = useCommunityColors();
    const [manual, setManual] = useState(editing);
    const [lookup, setLookup] = useState(!editing);
    const [settledUrl, setSettledUrl] = useState('');
    let source;
    try {
        source = parseMixSource(url);
    } catch {
        /* Inline guidance. */
    }
    const canonicalUrl = source?.source_url || '';
    useEffect(() => {
        const timer = setTimeout(() => setSettledUrl(canonicalUrl), 350);
        return () => clearTimeout(timer);
    }, [canonicalUrl]);
    const metadata = useQuery({
        queryKey: ['mix-metadata', source?.platform, canonicalUrl],
        queryFn: ({ signal }) => fetchMixMetadata(source!, signal),
        enabled: lookup && !!source && settledUrl === canonicalUrl,
        staleTime: 60 * 60 * 1000,
        retry: false,
    });
    const resolved = metadata.data?.title;
    const unavailable =
        lookup &&
        !!source &&
        (metadata.isError ||
            (metadata.isSuccess && (!resolved || resolved.length > 100)));
    useEffect(() => {
        if (
            !manual &&
            lookup &&
            resolved &&
            resolved.length <= 100 &&
            title !== resolved
        )
            onChange({ title: resolved, url });
    }, [manual, lookup, resolved, title, url, onChange]);
    const field = {
        color: c.fg,
        backgroundColor: c.field,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: c.border,
        padding: 16,
        fontSize: 16,
        minHeight: 48,
    };
    return (
        <View style={{ gap: 12 }}>
            <Text style={{ color: c.fg, fontWeight: '600' }}>
                {t('profileMixes.url')}
            </Text>
            <TextInput
                accessibilityLabel={t('profileMixes.url')}
                style={field}
                placeholder="https://www.mixcloud.com/dj/mix/"
                placeholderTextColor={c.muted}
                value={url}
                onChangeText={(next) => {
                    setManual(false);
                    setLookup(true);
                    onChange({ url: next, title: '' });
                }}
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={500}
                editable={!busy}
            />
            <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19 }}>
                {t('profileMixes.autoHint')}
            </Text>
            {!!url.trim() && !source && (
                <Text accessibilityRole="alert" style={{ color: c.fg }}>
                    {t('profileMixes.invalidLink')}
                </Text>
            )}
            {!!source && lookup && !manual && !unavailable && !resolved && (
                <View
                    style={{
                        flexDirection: 'row',
                        gap: 8,
                        alignItems: 'center',
                    }}
                >
                    <ActivityIndicator size="small" color={c.accent} />
                    <Text style={{ color: c.muted }}>
                        {t('profileMixes.findingTitle')}
                    </Text>
                </View>
            )}
            {unavailable && (
                <Text
                    accessibilityRole="alert"
                    style={{ color: c.muted, lineHeight: 20 }}
                >
                    {t('profileMixes.manualFallback')}
                </Text>
            )}
            {manual || unavailable ? (
                <>
                    <Text style={{ color: c.fg, fontWeight: '600' }}>
                        {t('profileMixes.name')}
                    </Text>
                    <TextInput
                        accessibilityLabel={t('profileMixes.name')}
                        value={title}
                        onChangeText={(next) => {
                            setManual(true);
                            onChange({ title: next, url });
                        }}
                        maxLength={100}
                        editable={!busy}
                        style={field}
                    />
                </>
            ) : (
                !!title && (
                    <View
                        style={{
                            padding: 16,
                            borderRadius: 16,
                            backgroundColor: c.tint,
                            gap: 6,
                        }}
                    >
                        <Text style={{ color: c.muted, fontSize: 12 }}>
                            {t('profileMixes.name')}
                        </Text>
                        <Text
                            style={{
                                color: c.fg,
                                fontWeight: '700',
                                fontSize: 17,
                            }}
                        >
                            {title}
                        </Text>
                    </View>
                )
            )}
            {!manual && !unavailable && !!source && (
                <CommunityButton
                    compact
                    secondary
                    label={t('profileMixes.editTitle')}
                    disabled={busy}
                    onPress={() => setManual(true)}
                />
            )}
            {unavailable && (
                <CommunityButton
                    compact
                    secondary
                    label={t('insights.retry')}
                    disabled={busy || metadata.isFetching}
                    onPress={() => void metadata.refetch()}
                />
            )}
        </View>
    );
}
