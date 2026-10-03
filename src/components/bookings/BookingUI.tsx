import { ReactNode, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import { useRouter } from 'expo-router';
import { SessionFormHeader } from '../sessions/SessionFormLayout';
import { CommunityButton, useCommunityColors } from '../community/CommunityUI';
import { useTranslation } from '../../i18n/useTranslation';
export function BookingPage({
    title,
    subtitle,
    children,
    guest = false,
}: {
    title: string;
    subtitle: string;
    children: ReactNode;
    guest?: boolean;
}) {
    const c = useCommunityColors();
    const router = useRouter();
    return (
        <SafeAreaView
            edges={['top', 'bottom']}
            style={{ flex: 1, backgroundColor: c.bg }}
        >
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                {guest ? (
                    <View style={{ padding: 24, gap: 10 }}>
                        <Text
                            style={{
                                color: c.accent,
                                fontSize: 12,
                                fontWeight: '800',
                                letterSpacing: 2,
                            }}
                        >
                            DJ PLANNER PRO
                        </Text>
                        <Text
                            accessibilityRole="header"
                            style={{
                                color: c.fg,
                                fontSize: 30,
                                fontWeight: '900',
                                letterSpacing: -1,
                            }}
                        >
                            {title}
                        </Text>
                        <Text style={{ color: c.muted, lineHeight: 21 }}>
                            {subtitle}
                        </Text>
                    </View>
                ) : (
                    <SessionFormHeader
                        title={title}
                        subtitle={subtitle}
                        onClose={() =>
                            router.canGoBack()
                                ? router.back()
                                : router.replace('/profile')
                        }
                    />
                )}
                <ScrollView
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{
                        paddingHorizontal: 20,
                        paddingBottom: 36,
                        width: '100%',
                        maxWidth: 800,
                        alignSelf: 'center',
                        gap: 18,
                    }}
                >
                    {children}
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
export function BookingCard({ children }: { children: ReactNode }) {
    const c = useCommunityColors();
    return (
        <View
            style={{
                padding: 20,
                gap: 14,
                borderRadius: 24,
                borderWidth: 1,
                borderColor: c.border,
                backgroundColor: c.card,
            }}
        >
            {children}
        </View>
    );
}
export function BookingText({
    children,
    muted = false,
    large = false,
}: {
    children: ReactNode;
    muted?: boolean;
    large?: boolean;
}) {
    const c = useCommunityColors();
    return (
        <Text
            style={{
                color: muted ? c.muted : c.fg,
                fontSize: large ? 22 : 14,
                fontWeight: large ? '800' : '400',
                lineHeight: large ? 29 : 22,
            }}
        >
            {children}
        </Text>
    );
}
export function BookingField({
    label,
    value,
    onChange,
    placeholder,
    multiline = false,
    number = false,
    email = false,
    autoFocus = false,
    maxLength = 3000,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    multiline?: boolean;
    number?: boolean;
    email?: boolean;
    autoFocus?: boolean;
    maxLength?: number;
}) {
    const c = useCommunityColors();
    return (
        <View style={{ gap: 8 }}>
            <Text style={{ color: c.fg, fontSize: 13, fontWeight: '700' }}>
                {label}
            </Text>
            <TextInput
                accessibilityLabel={label}
                value={value}
                onChangeText={onChange}
                placeholder={placeholder}
                multiline={multiline}
                maxLength={maxLength}
                keyboardType={
                    email ? 'email-address' : number ? 'decimal-pad' : 'default'
                }
                autoComplete={email ? 'email' : 'off'}
                autoCorrect={false}
                autoFocus={autoFocus}
                placeholderTextColor={c.muted}
                autoCapitalize="none"
                style={{
                    color: c.fg,
                    backgroundColor: c.field,
                    borderColor: c.border,
                    borderWidth: 1,
                    borderRadius: 14,
                    minHeight: multiline ? 94 : 50,
                    padding: 14,
                    fontSize: 15,
                    textAlignVertical: multiline ? 'top' : 'center',
                    outlineWidth: Platform.OS === 'web' ? 0 : undefined,
                }}
            />
        </View>
    );
}
export function BookingDate({
    value,
    onChange,
}: {
    value: string;
    onChange: (v: string) => void;
}) {
    const c = useCommunityColors();
    const { t, currentLanguage } = useTranslation();
    const [open, setOpen] = useState(false);
    return (
        <View style={{ gap: 10 }}>
            <Text style={{ color: c.fg, fontSize: 13, fontWeight: '700' }}>
                {t('bookings.date')}
            </Text>
            <CommunityButton
                secondary
                label={
                    value
                        ? new Date(value + 'T12:00:00').toLocaleDateString(
                              currentLanguage,
                              {
                                  weekday: 'short',
                                  day: 'numeric',
                                  month: 'long',
                                  year: 'numeric',
                              },
                          )
                        : t('bookings.chooseDate')
                }
                onPress={() => setOpen((v) => !v)}
            />
            {open && (
                <Calendar
                    key={c.dark ? 'dark' : 'light'}
                    current={value || undefined}
                    onDayPress={(d) => {
                        onChange(d.dateString);
                        setOpen(false);
                    }}
                    markedDates={
                        value
                            ? {
                                  [value]: {
                                      selected: true,
                                      selectedColor: '#6554df',
                                  },
                              }
                            : {}
                    }
                    theme={{
                        calendarBackground: c.card,
                        dayTextColor: c.fg,
                        monthTextColor: c.fg,
                        textDisabledColor: c.muted,
                        todayTextColor: c.accent,
                        arrowColor: c.accent,
                    }}
                />
            )}
        </View>
    );
}
export function BookingCurrency({
    value,
    onChange,
}: {
    value: string;
    onChange: (v: string) => void;
}) {
    const c = useCommunityColors();
    const { t } = useTranslation();
    return (
        <View style={{ gap: 8 }}>
            <Text style={{ color: c.fg, fontSize: 13, fontWeight: '700' }}>
                {t('bookings.currency')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
                {['EUR', 'USD', 'GBP'].map((v) => (
                    <TouchableOpacity
                        key={v}
                        accessibilityRole="button"
                        accessibilityState={{ selected: v === value }}
                        accessibilityLabel={v}
                        onPress={() => onChange(v)}
                        style={{
                            padding: 12,
                            borderRadius: 12,
                            backgroundColor: v === value ? c.tint : c.field,
                            borderWidth: 1,
                            borderColor: v === value ? c.accent : c.border,
                        }}
                    >
                        <Text style={{ color: c.fg, fontWeight: '700' }}>
                            {v}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
}
export function BookingError({ error }: { error: unknown }) {
    const { t } = useTranslation();
    return (
        <BookingCard>
            <Text
                accessibilityRole="alert"
                style={{ color: '#b54759', lineHeight: 21 }}
            >
                {t(
                    error instanceof Error &&
                        error.message.startsWith('bookings.errors.') &&
                        !error.message.includes('violates')
                        ? error.message
                        : 'bookings.errors.temporarily_unavailable',
                )}
            </Text>
        </BookingCard>
    );
}
