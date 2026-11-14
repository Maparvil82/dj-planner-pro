import { useState, type ComponentProps } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { PageHeaderBody } from './PageHeaderBody';
import { useCommunityColors } from '../community/communityColors';

type Props = ComponentProps<typeof PageHeaderBody> & { progress: SharedValue<number>; variant: 'compact' | 'hide' };
/** The UI runtime animates layout without waiting for calendar/list rendering. */
export function ScrollPageHeader({ progress, variant: _variant, ...header }: Props) {
    const c = useCommunityColors();
    const [height, setHeight] = useState(100);
    const container = useAnimatedStyle(() => ({ height: height * (1 - progress.value) }));
    const body = useAnimatedStyle(() => ({
        // Keep the title readable through most of the motion instead of moving
        // it out of the clipping window at the start of the animation.
        opacity: 1 - 0.35 * progress.value,
        transform: [{ translateY: -12 * progress.value }],
    }));
    return <Animated.View testID="scroll-header-hide" style={[{ overflow: 'hidden', backgroundColor: c.bg, zIndex: 1 }, container]}>
        <Animated.View testID="scroll-header-expanded" style={[{ position: 'absolute', top: 0, left: 0, right: 0 }, body]}>
            <View collapsable={false} onLayout={event => { const next = event.nativeEvent.layout.height; if (next > 0 && next !== height) setHeight(next); }}>
                <PageHeaderBody {...header} />
            </View>
        </Animated.View>
    </Animated.View>;
}
