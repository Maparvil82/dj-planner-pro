import { mixEmbedUrl, MixSource } from '../../utils/profileMixes';
export function MixPlayer({
    source,
    title,
}: {
    source: MixSource;
    title: string;
}) {
    return (
        <iframe
            title={title}
            src={mixEmbedUrl(source)}
            width="100%"
            height="180"
            style={{
                border: 0,
                display: 'block',
                background: '#fff',
                borderRadius: 14,
            }}
            allow="encrypted-media; fullscreen; autoplay"
            loading="lazy"
        />
    );
}
