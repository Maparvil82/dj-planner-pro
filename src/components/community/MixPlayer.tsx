import { useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Linking from 'expo-linking';
import { useTranslation } from '../../i18n/useTranslation';
import {
    mixEmbedUrl,
    mixPlayerDocument,
    isMixPlayerNavigation,
    MixSource,
} from '../../utils/profileMixes';
import { CommunityButton, CommunityMessage } from './CommunityUI';
export function MixPlayer({
    source,
    title,
    autoPlay = false,
}: {
    source: MixSource;
    title: string;
    autoPlay?: boolean;
}) {
    const { t } = useTranslation();
    const [failed, setFailed] = useState(false);
    const uri = mixEmbedUrl(source, autoPlay);
    const compact = source.platform === 'mixcloud';
    return (
        <View
            style={{
                height: failed ? undefined : compact ? 60 : 180,
                borderRadius: 14,
                overflow: 'hidden',
                backgroundColor: '#fff',
            }}
        >
            {failed ? (
                <>
                    <CommunityMessage title={t('profileMixes.playerError')} />
                    <CommunityButton
                        label={t('profileMixes.openSource')}
                        secondary
                        onPress={() => {
                            void Linking.openURL(source.source_url).catch(
                                () => {},
                            );
                        }}
                    />
                </>
            ) : (
                <WebView
                    accessibilityLabel={title}
                    source={
                        compact
                            ? { html: mixPlayerDocument(source, autoPlay) }
                            : { uri }
                    }
                    scrollEnabled={false}
                    allowsInlineMediaPlayback
                    mediaPlaybackRequiresUserAction={!autoPlay}
                    javaScriptEnabled
                    originWhitelist={['*']}
                    setSupportMultipleWindows={false}
                    onError={() => setFailed(true)}
                    onHttpError={(event) => {
                        if (
                            isMixPlayerNavigation(event.nativeEvent.url, source)
                        )
                            setFailed(true);
                    }}
                    onShouldStartLoadWithRequest={(request) => {
                        if (
                            isMixPlayerNavigation(request.url, source) ||
                            request.url === 'about:blank'
                        )
                            return true;
                        // Embedded provider frames may load their own media origins.
                        if (request.isTopFrame === false)
                            return request.url.startsWith('https://');
                        if (request.url.startsWith('https://'))
                            void Linking.openURL(request.url).catch(() => {});
                        return false;
                    }}
                />
            )}
        </View>
    );
}
