import { useTranslation } from '../../i18n/useTranslation';
import {
    sessionDisplayTitle,
    sessionDisplaySubtitle,
} from '../../utils/sessionNaming';
import { PosterFrameImage } from './PosterFrameImage';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Session } from '../../types/session';

export function SessionArtwork({ session }: { session: Session }) {
    const { t } = useTranslation();
    const subtitle = sessionDisplaySubtitle(session);
    const [failedUrl, setFailedUrl] = useState<string | null>(null);
    const onError = useCallback(
        () => setFailedUrl(session.poster_url || null),
        [session.poster_url],
    );
    const hasPoster = !!session.poster_url && failedUrl !== session.poster_url;
    return (
        <LinearGradient
            colors={[session.color || '#433b65', '#151c30']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
                aspectRatio: 1.55,
                overflow: 'hidden',
                justifyContent: 'center',
            }}
        >
            {hasPoster ? (
                <PosterFrameImage
                    uri={session.poster_url!}
                    x={session.poster_focus_x}
                    y={session.poster_focus_y}
                    onError={onError}
                />
            ) : (
                <View
                    style={{
                        flex: 1,
                        padding: 24,
                        justifyContent: 'flex-end',
                        gap: 8,
                    }}
                >
                    <View
                        style={{
                            position: 'absolute',
                            width: 250,
                            height: 250,
                            borderRadius: 125,
                            borderWidth: 1,
                            borderColor: '#ffffff20',
                            right: -60,
                            top: -110,
                        }}
                    />
                    <View
                        style={{
                            position: 'absolute',
                            width: 180,
                            height: 180,
                            borderRadius: 90,
                            borderWidth: 1,
                            borderColor: '#ffffff15',
                            right: -25,
                            top: -75,
                        }}
                    />
                    <Text
                        numberOfLines={3}
                        style={{
                            color: '#fff',
                            fontSize: 28,
                            lineHeight: 31,
                            fontWeight: '800',
                            letterSpacing: -0.7,
                        }}
                    >
                        {sessionDisplayTitle(session, t)}
                    </Text>
                    {!!subtitle && (
                        <Text
                            numberOfLines={1}
                            style={{
                                color: '#d3d8e7',
                                fontSize: 12,
                                fontWeight: '500',
                            }}
                        >
                            {subtitle}
                        </Text>
                    )}
                </View>
            )}
        </LinearGradient>
    );
}
