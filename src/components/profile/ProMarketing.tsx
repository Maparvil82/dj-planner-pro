import { ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { ArrowUpRight } from 'lucide-react-native';
import { useCommunityColors } from '../community/communityColors';
export function useProMarketingColors() {
    const c = useCommunityColors();
    return {
        dark: c.dark, background: c.bg, surface: c.card, ink: c.fg, muted: c.muted, accent: c.accent, onAccent: c.onAccent,
        secondary: c.dark ? '#ffffff0b' : c.tint,
        nav: c.dark ? '#17171799' : '#f5f6faee',
        panel: c.dark ? '#232323f5' : '#fffffffa',
        tile: c.dark ? '#ffffff06' : c.field,
        border: c.dark ? '#ffffff35' : c.border,
        planTint: c.tint,
        paywallGradient: [c.bg + (c.dark ? '88' : 'ef'), c.bg + (c.dark ? '15' : '88'), c.bg + 'ed', c.bg, c.bg] as const,
        heroGradient: [c.bg + '18', c.bg + '00', c.bg + '55', c.bg] as const,
    };
}
export function ProMarketingButton({ label, onPress, disabled = false, busy = false, secondary = false }: { label: string; onPress: () => void; disabled?: boolean; busy?: boolean; secondary?: boolean }) {
    const p = useProMarketingColors();
    return <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} onPress={onPress} style={{ minHeight: 50, borderRadius: 15, paddingVertical: 13, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: secondary ? p.secondary : p.accent, opacity: disabled || busy ? 0.5 : 1 }}>
        {busy ? <ActivityIndicator color={secondary ? p.ink : p.onAccent} /> : <><Text style={{ color: secondary ? p.ink : p.onAccent, fontSize: 15, fontWeight: '800', flexShrink: 1, textAlign: 'center' }}>{label}</Text>{!secondary && !disabled && <ArrowUpRight size={18} color={p.onAccent} />}</>}
    </TouchableOpacity>;
}
