import { useState } from 'react';
import {
    Modal,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MoreHorizontal, X } from 'lucide-react-native';
import { useAuthStore } from '../../store/useAuthStore';
import { useTranslation } from '../../i18n/useTranslation';
import { useCommunityColors } from './communityColors';
import {
    safetyService,
    REPORT_REASONS,
    type ReportReason,
    type SafetyTarget,
} from '../../services/communitySafety';
import { useInvalidateCommunitySafety } from '../../hooks/useCommunitySafety';
export function CommunitySafetyMenu({
    target,
    light = false,
    onHidden,
}: {
    target: SafetyTarget;
    light?: boolean;
    onHidden?: () => void;
}) {
    const viewer = useAuthStore((s) => s.session?.user.id),
        c = useCommunityColors(),
        { t } = useTranslation(),
        insets = useSafeAreaInsets();
    const invalidate = useInvalidateCommunitySafety();
    const [screen, setScreen] = useState<
            'menu' | 'report' | 'block' | 'done' | null
        >(null),
        [reason, setReason] = useState<ReportReason | null>(null),
        [details, setDetails] = useState(''),
        [busy, setBusy] = useState(false),
        [error, setError] = useState('');
    if (!viewer || viewer === target.authorId) return null;
    const close = () => {
        if (!busy) setScreen(null);
    };
    const run = async (block: boolean) => {
        setBusy(true);
        setError('');
        try {
            if (block) await safetyService.block(target.authorId);
            else if (reason)
                await safetyService.report(target, reason, details.trim());
            if (block) {
                setScreen(null);
                await invalidate();
                onHidden?.();
            } else setScreen('done');
        } catch (e) {
            setError(
                t(
                    String((e as { message?: string }).message).includes(
                        'REPORT_LIMIT',
                    )
                        ? 'safety.reportLimit'
                        : 'safety.error',
                ),
            );
        } finally {
            setBusy(false);
        }
    };
    const button = (
        label: string,
        action: () => void,
        primary = false,
        disabled = false,
    ) => (
        <Pressable
            accessibilityRole="button"
            disabled={busy || disabled}
            onPress={action}
            style={{
                minHeight: 48,
                padding: 15,
                borderRadius: 14,
                backgroundColor: primary ? c.accent : c.field,
                opacity: busy || disabled ? 0.5 : 1,
            }}
        >
            <Text
                style={{
                    color: primary ? c.onAccent : c.fg,
                    fontWeight: '700',
                    textAlign: 'center',
                }}
            >
                {label}
            </Text>
        </Pressable>
    );
    return (
        <>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('safety.options')}
                onPress={() => {
                    setReason(null);
                    setDetails('');
                    setError('');
                    setScreen('menu');
                }}
                style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: light
                        ? 'rgba(13,18,32,.45)'
                        : 'transparent',
                }}
            >
                <MoreHorizontal size={22} color={light ? '#fff' : c.muted} />
            </Pressable>
            <Modal
                visible={!!screen}
                transparent
                animationType="slide"
                onRequestClose={close}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={{
                        flex: 1,
                        justifyContent: 'flex-end',
                        backgroundColor: '#00000066',
                    }}
                >
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('cancel')}
                        onPress={close}
                        style={{ position: 'absolute', inset: 0 }}
                    />
                    <View
                        accessibilityViewIsModal
                        style={{
                            maxHeight: '90%',
                            backgroundColor: c.bg,
                            borderTopLeftRadius: 28,
                            borderTopRightRadius: 28,
                        }}
                    >
                        <ScrollView
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={{
                                padding: 24,
                                paddingBottom: Math.max(24, insets.bottom),
                                gap: 16,
                            }}
                        >
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 12,
                                }}
                            >
                                <Text
                                    style={{
                                        color: c.fg,
                                        fontSize: 23,
                                        fontWeight: '800',
                                        flex: 1,
                                    }}
                                >
                                    {t(
                                        `safety.${screen === 'menu' ? 'options' : screen === 'done' ? 'reportSent' : screen}`,
                                    )}
                                </Text>
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={t('cancel')}
                                    disabled={busy}
                                    onPress={close}
                                    style={{
                                        width: 44,
                                        height: 44,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <X color={c.fg} size={22} />
                                </Pressable>
                            </View>
                            {screen === 'menu' && (
                                <>
                                    {button(t('safety.report'), () =>
                                        setScreen('report'),
                                    )}
                                    {button(t('safety.block'), () =>
                                        setScreen('block'),
                                    )}
                                </>
                            )}
                            {screen === 'report' && (
                                <>
                                    <Text
                                        style={{
                                            color: c.muted,
                                            lineHeight: 21,
                                        }}
                                    >
                                        {t('safety.reportHint')}
                                    </Text>
                                    {REPORT_REASONS.map((value) => (
                                        <Pressable
                                            key={value}
                                            accessibilityRole="radio"
                                            accessibilityState={{
                                                checked: reason === value,
                                            }}
                                            disabled={busy}
                                            onPress={() => setReason(value)}
                                            style={{
                                                padding: 14,
                                                borderRadius: 14,
                                                backgroundColor:
                                                    reason === value
                                                        ? c.tint
                                                        : c.card,
                                                borderWidth: 1,
                                                borderColor:
                                                    reason === value
                                                        ? c.accent
                                                        : c.border,
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    color:
                                                        reason === value
                                                            ? c.accent
                                                            : c.fg,
                                                }}
                                            >
                                                {t(`safety.reasons.${value}`)}
                                            </Text>
                                        </Pressable>
                                    ))}
                                    <TextInput
                                        accessibilityLabel={t('safety.details')}
                                        placeholder={t('safety.details')}
                                        placeholderTextColor={c.muted}
                                        value={details}
                                        onChangeText={setDetails}
                                        multiline
                                        maxLength={1000}
                                        editable={!busy}
                                        style={{
                                            color: c.fg,
                                            backgroundColor: c.field,
                                            minHeight: 90,
                                            padding: 15,
                                            borderRadius: 14,
                                            textAlignVertical: 'top',
                                        }}
                                    />
                                    {button(
                                        t(
                                            busy
                                                ? 'safety.saving'
                                                : 'safety.send',
                                        ),
                                        () => void run(false),
                                        true,
                                        !reason ||
                                            (reason === 'other' &&
                                                details.trim().length < 3),
                                    )}
                                </>
                            )}
                            {screen === 'block' && (
                                <>
                                    <Text
                                        style={{
                                            color: c.muted,
                                            lineHeight: 22,
                                        }}
                                    >
                                        {t('safety.blockHint', {
                                            name: target.name,
                                        })}
                                    </Text>
                                    {button(
                                        t('safety.block'),
                                        () => void run(true),
                                        true,
                                    )}
                                    {button(t('cancel'), close)}
                                </>
                            )}
                            {screen === 'done' && (
                                <>
                                    <Text
                                        style={{
                                            color: c.muted,
                                            lineHeight: 22,
                                        }}
                                    >
                                        {t('safety.sentHint')}
                                    </Text>
                                    {button(
                                        t('safety.done'),
                                        () => {
                                            setScreen(null);
                                            void invalidate().then(() =>
                                                onHidden?.(),
                                            );
                                        },
                                        true,
                                    )}
                                </>
                            )}
                            {!!error && (
                                <Text
                                    accessibilityLiveRegion="polite"
                                    style={{ color: '#c44960' }}
                                >
                                    {error}
                                </Text>
                            )}
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </>
    );
}
