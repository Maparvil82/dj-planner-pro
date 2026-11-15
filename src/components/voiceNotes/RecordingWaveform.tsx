import { useEffect, useState } from 'react';
import { View } from 'react-native';

const BAR_COUNT = 48;
const MAX_HEIGHT = 88;

export function RecordingWaveform({ metering, durationMillis, maxDurationMillis, color, inactiveColor, label }: {
    metering?: number; durationMillis: number; maxDurationMillis: number;
    color: string; inactiveColor: string; label: string;
}) {
    const [levels, setLevels] = useState(() => Array<number>(BAR_COUNT).fill(0));
    const index = Math.min(BAR_COUNT - 1, Math.max(0, Math.floor(durationMillis / maxDurationMillis * BAR_COUNT)));
    useEffect(() => {
        // Native metering is in decibels. Silence or unavailable levels stay flat.
        const level = typeof metering === 'number' && Number.isFinite(metering)
            ? Math.min(1, Math.max(0, (metering + 60) / 60)) : 0;
        setLevels(previous => {
            if (previous[index] >= level) return previous;
            const next = previous.slice();
            next[index] = level;
            return next;
        });
    }, [index, metering]);
    return <View testID="voice-recording-waveform" accessibilityRole="image" accessibilityLabel={label}
        style={{ width: '100%', height: MAX_HEIGHT + 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {levels.map((level, i) => <View key={i} testID="voice-waveform-bar" accessible={false}
            style={{ width: 3, borderRadius: 2, height: i <= index ? Math.max(3, level * MAX_HEIGHT) : 3,
                backgroundColor: i <= index ? color : inactiveColor }} />)}
    </View>;
}
