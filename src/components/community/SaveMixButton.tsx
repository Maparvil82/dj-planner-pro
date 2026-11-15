import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { Bookmark } from 'lucide-react-native';
import { useSaveMix } from '../../hooks/useSavedMixes';
import { useTranslation } from '../../i18n/useTranslation';
import { useCommunityColors } from './CommunityUI';
export type MixSaveState = {
    saved: boolean;
    loading?: boolean;
    error?: boolean;
    retry?: () => void;
};
export function SaveMixButton({
    id,
    state,
}: {
    id: string;
    state: MixSaveState;
}) {
    const mutation = useSaveMix();
    const { t } = useTranslation(),
        c = useCommunityColors();
    const busy = state.loading || mutation.isPending;
    return (
        <View>
            <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t(
                    state.error
                        ? 'insights.retry'
                        : state.saved
                          ? 'savedMixes.remove'
                          : 'savedMixes.save',
                )}
                accessibilityState={{
                    selected: state.saved,
                    disabled: !!busy,
                    busy: !!busy,
                }}
                disabled={busy}
                onPress={() =>
                    state.error
                        ? state.retry?.()
                        : mutation.mutate({ id, saved: !state.saved })
                }
                style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: state.saved ? c.tint : c.field,
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                {busy ? (
                    <ActivityIndicator size="small" color={c.accent} />
                ) : (
                    <Bookmark
                        size={18}
                        color={state.error ? '#d76f7d' : c.accent}
                        fill={state.saved ? c.accent : 'transparent'}
                    />
                )}
            </TouchableOpacity>
            {mutation.isError && (
                <Text
                    accessibilityLiveRegion="polite"
                    style={{ color: '#d76f7d', fontSize: 10, maxWidth: 90 }}
                >
                    {t('savedMixes.error')}
                </Text>
            )}
        </View>
    );
}
