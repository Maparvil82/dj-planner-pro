import { View, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from '../../i18n/useTranslation';
import type { BookingStatus } from '../../utils/sessionWorkflow';
export function SessionStatusControl({
    value,
    onChange,
    allowCancelled = false,
    showHeading = true,
}: {
    value: BookingStatus;
    onChange: (status: BookingStatus) => void;
    allowCancelled?: boolean;
    showHeading?: boolean;
}) {
    const { t } = useTranslation();
    const { activeTheme } = useTheme();
    const dark = activeTheme === 'dark';
    const states: BookingStatus[] = allowCancelled
        ? ['pending', 'confirmed', 'cancelled']
        : ['pending', 'confirmed'];
    return (
        <View style={{}}>
            {showHeading ? (
                <Text
                    style={{
                        color: dark ? '#d1d5db' : '#374151',
                        fontWeight: '700',
                        fontSize: 13,
                        marginBottom: 12,
                    }}
                >
                    {t('workflow.bookingState')}
                </Text>
            ) : null}
            <View style={{ gap: 8 }}>
                {states.map((status) => (
                    <TouchableOpacity
                        key={status}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: status === value }}
                        aria-checked={status === value}
                        onPress={() => onChange(status)}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            borderWidth: 1,
                            borderColor:
                                status === value
                                    ? '#8270e4'
                                    : dark
                                      ? '#374151'
                                      : '#e5e7eb',
                            backgroundColor:
                                status === value
                                    ? dark
                                        ? '#2b2645'
                                        : '#f2effc'
                                    : dark
                                      ? '#111827'
                                      : '#fff',
                            borderRadius: 15,
                            padding: 14,
                        }}
                    >
                        <View
                            style={{
                                width: 17,
                                height: 17,
                                borderRadius: 9,
                                borderWidth: status === value ? 5 : 1,
                                borderColor:
                                    status === value ? '#8270e4' : '#9ca3af',
                                marginRight: 12,
                            }}
                        />
                        <View style={{ flex: 1 }}>
                            <Text
                                style={{
                                    fontWeight: '700',
                                    color: dark ? '#f3f4f6' : '#27233c',
                                    fontSize: 13,
                                }}
                            >
                                {t(`workflow.${status}`)}
                            </Text>
                            <Text
                                style={{
                                    color: dark ? '#a8b2c6' : '#6d7588',
                                    fontSize: 11,
                                    lineHeight: 17,
                                    marginTop: 3,
                                }}
                            >
                                {t(`workflow.${status}Hint`)}
                            </Text>
                        </View>
                    </TouchableOpacity>
                ))}
            </View>
            <Text
                style={{
                    color: dark ? '#a8b2c6' : '#6d7588',
                    fontSize: 11,
                    lineHeight: 17,
                    marginTop: 10,
                }}
            >
                {t('workflow.phaseHint')}
            </Text>
        </View>
    );
}
