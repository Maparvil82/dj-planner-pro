import { Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from '../../i18n/useTranslation';
import { useCommunityColors } from '../community/CommunityUI';
import { PosterThumbnail } from './PosterThumbnail';

export function SessionPosterPreview({
    uri,
    color,
    onRemove,
}: {
    uri: string;
    color?: string | null;
    onRemove: () => void;
}) {
    const { t } = useTranslation();
    const c = useCommunityColors();
    return (
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
            <PosterThumbnail uri={uri} color={color || undefined} width={108} />
            <View style={{ flex: 1, minWidth: 0, gap: 12 }}>
                <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
                    {t('posterFrame.fullPreview')}
                </Text>
                <TouchableOpacity
                    accessibilityRole="button"
                    onPress={onRemove}
                    style={{ alignSelf: 'flex-start', paddingVertical: 10 }}
                >
                    <Text
                        style={{
                            color: c.accent,
                            fontSize: 13,
                            fontWeight: '600',
                        }}
                    >
                        {t('posterFrame.remove')}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
