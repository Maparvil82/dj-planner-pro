import { useEffect, useRef } from 'react';
import { mixEmbedUrl, type MixSource } from '../../utils/profileMixes';
type Widget = { ready: Promise<void>; play: () => Promise<unknown> };
type WidgetApi = { PlayerWidget: (frame: HTMLIFrameElement) => Widget };
let apiPromise: Promise<WidgetApi> | null = null;
function widgetApi(): Promise<WidgetApi> {
    const globals = window as Window & { Mixcloud?: WidgetApi };
    if (globals.Mixcloud) return Promise.resolve(globals.Mixcloud);
    if (!apiPromise) {
        apiPromise = new Promise<WidgetApi>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://widget.mixcloud.com/media/js/widgetApi.js';
            script.async = true;
            script.onload = () =>
                globals.Mixcloud
                    ? resolve(globals.Mixcloud)
                    : reject(new Error('Widget unavailable'));
            script.onerror = () => reject(new Error('Widget unavailable'));
            document.head.appendChild(script);
        }).catch((error) => {
            apiPromise = null;
            throw error;
        });
    }
    return apiPromise;
}
export function MixPlayer({
    source,
    title,
    autoPlay = false,
}: {
    source: MixSource;
    title: string;
    autoPlay?: boolean;
}) {
    const frame = useRef<HTMLIFrameElement>(null);
    const uri = mixEmbedUrl(source, autoPlay);
    useEffect(() => {
        if (!autoPlay || source.platform !== 'mixcloud') return;
        let disposed = false;
        const currentFrame = frame.current;
        void widgetApi()
            .then(async (api) => {
                if (disposed || !currentFrame) return;
                const widget = api.PlayerWidget(currentFrame);
                await widget.ready;
                if (!disposed) await widget.play();
            })
            .catch(() => {
                /* Keep official controls available if browser playback is blocked. */
            });
        return () => {
            disposed = true;
        };
    }, [autoPlay, uri, source.platform]);
    return (
        <iframe
            ref={frame}
            title={title}
            src={uri}
            width="100%"
            height={source.platform === 'mixcloud' ? '60' : '180'}
            style={{
                border: 0,
                display: 'block',
                background: '#fff',
                borderRadius: 14,
            }}
            allow="encrypted-media; fullscreen; autoplay"
            loading={autoPlay ? 'eager' : 'lazy'}
        />
    );
}
