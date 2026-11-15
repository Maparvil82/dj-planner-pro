import { useCallback, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from '../../i18n/useTranslation';
import { useCommunityColors } from '../community/CommunityUI';
import { PosterFrameImage } from './PosterFrameImage';
import type { PosterPosition } from '../../utils/posterFrame';

export function PosterFrameEditor({
    uri,
    position,
    onChange,
    onDragChange,
    onRemove,
}: {
    uri: string;
    position: PosterPosition;
    onChange: (position: PosterPosition) => void;
    onDragChange: (dragging: boolean) => void;
    onRemove: () => void;
}) {
    const { t } = useTranslation();
    const c = useCommunityColors();
    const [failedUri, setFailedUri] = useState<string | null>(null);
    const onError = useCallback(() => setFailedUri(uri), [uri]);
    return (
        <View style={{ gap: 12 }}>
            <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
                <Text
                    style={{
                        flex: 1,
                        color: c.fg,
                        fontSize: 14,
                        fontWeight: '700',
                    }}
                >
                    {t('posterFrame.title')}
                </Text>
                <TouchableOpacity
                    accessibilityRole="button"
                    onPress={onRemove}
                    style={{ paddingVertical: 8 }}
                >
                    <Text
                        style={{
                            color: c.accent,
                            fontSize: 12,
                            fontWeight: '600',
                        }}
                    >
                        {t('posterFrame.remove')}
                    </Text>
                </TouchableOpacity>
            </View>
            <View style={{ borderRadius: 18, overflow: 'hidden' }}>
                <PosterFrameImage
                    uri={uri}
                    x={position.x}
                    y={position.y}
                    onChange={onChange}
                    onDragChange={onDragChange}
                    onError={onError}
                />
            </View>
            <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
                {t(
                    failedUri === uri
                        ? 'posterFrame.error'
                        : 'posterFrame.dragHint',
                )}
            </Text>
            <TouchableOpacity
                accessibilityRole="button"
                onPress={() => onChange({ x: 0.5, y: 0.5 })}
                style={{ alignSelf: 'flex-start', paddingVertical: 8 }}
            >
                <Text
                    style={{ color: c.accent, fontSize: 13, fontWeight: '600' }}
                >
                    {t('posterFrame.center')}
                </Text>
            </TouchableOpacity>
            <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
                {t('posterFrame.scope')}
            </Text>
        </View>
    );
}
