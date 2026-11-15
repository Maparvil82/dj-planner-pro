import { Image } from 'react-native';

const LOGO = require('../../../assets/brand/logo.png');

export function AppLogo({ size = 40, decorative = false }: {
    size?: number;
    decorative?: boolean;
}) {
    return (
        <Image
            source={LOGO}
            resizeMode="contain"
            accessible={!decorative}
            accessibilityLabel={decorative ? undefined : 'DJ Planner'}
            style={{ width: size, height: size, borderRadius: size * 0.22 }}
        />
    );
}
