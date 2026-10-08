import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { Calendar } from 'react-native-calendars';
import { useAllSessionsQuery } from '../src/hooks/useSessionsQuery';
import { useAllExpensesQuery } from '../src/hooks/useExpensesQuery';
import { useAuthStore } from '../src/store/useAuthStore';
import { expenseService } from '../src/services/expenses';
import { expenseReceipts } from '../src/services/expenseReceipts';
import type { Expense } from '../src/types/expense';
import { currencyCode } from '../src/utils/dashboardMetrics';
import { localDateString } from '../src/utils/sessionPlanning';
import { sessionDisplayTitle } from '../src/utils/sessionNaming';
import {
    ToolsLayout,
    SessionChooser,
    ToolField,
} from '../src/components/sessionTools/ToolsLayout';
import {
    CommunityButton,
    useCommunityColors,
} from '../src/components/community/CommunityUI';
import { useTranslation } from '../src/i18n/useTranslation';
import { confirmAction } from '../src/utils/confirmAction';
interface Form {
    id: string;
    description: string;
    amount: string;
    date: string;
    receipt: string | null;
    original: string | null;
    included: boolean;
}
export default function Expenses() {
    const { sessionId } = useLocalSearchParams<{ sessionId?: string }>(),
        [selected, setSelected] = useState(sessionId || ''),
        [form, setForm] = useState<Form | null>(null),
        [busy, setBusy] = useState(false),
        [error, setError] = useState(''),
        [photo, setPhoto] = useState<{
            uri: string;
            width: number;
            height: number;
        } | null>(null),
        [receiptUrl, setReceiptUrl] = useState(''),
        [showDate, setShowDate] = useState(false),
        lock = useRef(false);
    const c = useCommunityColors(),
        { t, i18n } = useTranslation(),
        client = useQueryClient(),
        user = useAuthStore((s) => s.session?.user.id),
        sessions = useAllSessionsQuery(),
        expenses = useAllExpensesQuery();
    const current = sessions.data?.find(
        (s) => s.id === selected && s.user_id === user && !s.is_guest,
    );
    const choices = useMemo(
        () =>
            (sessions.data || [])
                .filter((s) => s.user_id === user && !s.is_guest)
                .sort((a, b) => b.date.localeCompare(a.date)),
        [sessions.data, user],
    );
    const existingExpense = form
        ? expenses.data?.find((e) => e.id === form.id)
        : undefined;
    const currency = currencyCode(
        current?.currency || existingExpense?.currency || 'EUR',
    );
    const rows = (expenses.data || []).filter(
        (e) => selected === 'all' || e.session_id === selected,
    );
    const money = (n: number, code = currency) =>
        new Intl.NumberFormat(i18n.language, {
            style: 'currency',
            currency: code,
        }).format(n);
    const refresh = () => client.invalidateQueries({ queryKey: ['expenses'] });
    const start = (e?: Expense) => {
        setError('');
        setShowDate(false);
        setPhoto(null);
        setForm(
            e
                ? {
                      included: !!e.included_in_agreement,
                      id: e.id,
                      description: e.description || '',
                      amount: String(e.amount),
                      date: e.date,
                      receipt: e.receipt_path || null,
                      original: e.receipt_path || null,
                  }
                : {
                      included: false,
                      id: randomUUID(),
                      description: '',
                      amount: '',
                      date: localDateString(),
                      receipt: null,
                      original: null,
                  },
        );
    };
    const pick = async (camera: boolean) => {
        if (lock.current) return;
        lock.current = true;
        setBusy(true);
        setError('');
        try {
            if (form?.receipt && form.receipt !== form.original && user) {
                const saved = await expenseService.getExpense(form.id, user);
                if (saved?.receipt_path === form.receipt)
                    setForm((f) => (f ? { ...f, original: f.receipt } : f));
            }
            const picker = await import('expo-image-picker');
            const permission = camera
                ? await picker.requestCameraPermissionsAsync()
                : await picker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) throw Error('tools.photoPermission');
            const result = await (camera
                ? picker.launchCameraAsync({
                      mediaTypes: ['images'],
                      quality: 1,
                  })
                : picker.launchImageLibraryAsync({
                      mediaTypes: ['images'],
                      quality: 1,
                  }));
            if (!result.canceled) {
                const asset = result.assets[0];
                setPhoto({
                    uri: asset.uri,
                    width: asset.width,
                    height: asset.height,
                });
            }
        } catch (e) {
            setError(
                t(
                    e instanceof Error && e.message.startsWith('tools.')
                        ? e.message
                        : 'tools.photoError',
                ),
            );
        } finally {
            lock.current = false;
            setBusy(false);
        }
    };
    const save = async () => {
        if (!form || (!current && !existingExpense) || !user || lock.current)
            return;
        const amount = Number(form.amount.replace(',', '.').trim());
        if (
            !form.description.trim() ||
            !Number.isFinite(amount) ||
            amount <= 0 ||
            amount >= 100000000 ||
            !/^\d{4}-\d{2}-\d{2}$/.test(form.date)
        ) {
            setError(t('tools.invalidExpense'));
            return;
        }
        lock.current = true;
        setBusy(true);
        setError('');
        let receipt = form.receipt;
        try {
            if (photo) {
                const uploaded = await expenseReceipts.upload(
                    user,
                    photo.uri,
                    photo.width,
                    photo.height,
                );
                if (receipt && receipt !== form.original)
                    await expenseReceipts.remove(receipt);
                receipt = uploaded;
                setForm((f) => (f ? { ...f, receipt: uploaded } : null));
                setPhoto(null);
            }
            await expenseService.createExpense(
                {
                    id: form.id,
                    session_id:
                        current?.id || existingExpense?.session_id || null,
                    amount: Math.round(amount * 100) / 100,
                    description: form.description.trim(),
                    date: form.date,
                    currency,
                    receipt_path: receipt,
                    included_in_agreement: form.included,
                },
                user,
            );
            if (form.original && form.original !== receipt)
                await expenseReceipts
                    .remove(form.original)
                    .catch(() => setError(t('tools.receiptCleanup')));
            setForm(null);
            setPhoto(null);
            await refresh();
        } catch (e) {
            setError(
                t(
                    e instanceof Error && e.message.startsWith('tools.')
                        ? e.message
                        : 'tools.saveError',
                ),
            );
        } finally {
            lock.current = false;
            setBusy(false);
        }
    };
    const cancel = async () => {
        if (!form || lock.current) return;
        lock.current = true;
        setBusy(true);
        try {
            if (form.receipt && form.receipt !== form.original && user) {
                // A timed-out save may already have committed. Never delete its invoice.
                const saved = await expenseService.getExpense(form.id, user);
                if (saved?.receipt_path !== form.receipt)
                    await expenseReceipts.remove(form.receipt);
            }
            setForm(null);
            setPhoto(null);
            setError('');
            await refresh();
        } catch {
            setError(t('tools.saveError'));
        } finally {
            lock.current = false;
            setBusy(false);
        }
    };
    const remove = async (e: Expense) => {
        if (
            lock.current ||
            !(await confirmAction(
                t('tools.removeExpense'),
                e.description || '',
                t('cancel'),
                t('delete'),
            ))
        )
            return;
        lock.current = true;
        setBusy(true);
        setError('');
        try {
            await expenseService.deleteExpense(e.id);
            if (e.receipt_path)
                await expenseReceipts
                    .remove(e.receipt_path)
                    .catch(() => setError(t('tools.receiptCleanup')));
            await refresh();
        } catch {
            setError(t('tools.saveError'));
        } finally {
            lock.current = false;
            setBusy(false);
        }
    };
    const openReceipt = async (path: string) => {
        if (lock.current) return;
        lock.current = true;
        setBusy(true);
        setError('');
        try {
            setReceiptUrl(await expenseReceipts.url(path));
        } catch {
            setError(t('tools.photoError'));
        } finally {
            lock.current = false;
            setBusy(false);
        }
    };
    if (receiptUrl)
        return (
            <ToolsLayout
                title={t('tools.receipt')}
                onBack={() => setReceiptUrl('')}
            >
                <Image
                    source={{ uri: receiptUrl }}
                    resizeMode="contain"
                    style={{ width: '100%', height: 600 }}
                />
            </ToolsLayout>
        );
    return (
        <ToolsLayout
            title={form ? t('tools.expense') : t('tools.expenses')}
            onBack={form ? () => void cancel() : undefined}
        >
            {error ? (
                <Text accessibilityRole="alert" style={{ color: '#d44455' }}>
                    {error}
                </Text>
            ) : null}
            {sessions.isLoading || expenses.isLoading ? (
                <ActivityIndicator color={c.accent} />
            ) : sessions.isError || expenses.isError ? (
                <CommunityButton
                    label={t('insights.retry')}
                    onPress={() => {
                        void sessions.refetch();
                        void expenses.refetch();
                    }}
                />
            ) : !selected ? (
                <>
                    <CommunityButton
                        label={t('tools.allExpenses')}
                        secondary
                        onPress={() => setSelected('all')}
                    />
                    <SessionChooser
                        sessions={choices}
                        onSelect={(s) => setSelected(s.id)}
                        empty={t('tools.noSessions')}
                    />
                </>
            ) : selected !== 'all' && !current ? (
                <Text style={{ color: c.muted }}>
                    {t('tools.invalidSession')}
                </Text>
            ) : form ? (
                <>
                    <Text
                        style={{ fontSize: 18, color: c.fg, fontWeight: '700' }}
                    >
                        {current
                            ? sessionDisplayTitle(current, t)
                            : t('tools.unlinkedExpense')}
                    </Text>
                    <ToolField
                        label={t('tools.concept')}
                        value={form.description}
                        onChangeText={(v) =>
                            setForm({ ...form, description: v })
                        }
                    />
                    <ToolField
                        label={`${t('tools.amount')} · ${currency}`}
                        value={form.amount}
                        onChangeText={(v) => setForm({ ...form, amount: v })}
                        keyboardType="decimal-pad"
                        maxLength={16}
                    />
                    <Pressable
                        accessibilityRole="button"
                        onPress={() => setShowDate(!showDate)}
                        style={{
                            backgroundColor: c.card,
                            borderRadius: 16,
                            padding: 16,
                            gap: 8,
                        }}
                    >
                        <Text style={{ color: c.muted }}>
                            {t('tools.expenseDate')}
                        </Text>
                        <Text style={{ color: c.fg, fontWeight: '700' }}>
                            {form.date}
                        </Text>
                    </Pressable>
                    {showDate ? (
                        <Calendar
                            current={form.date}
                            markedDates={{
                                [form.date]: {
                                    selected: true,
                                    selectedColor: '#6554df',
                                },
                            }}
                            onDayPress={(d) => {
                                setForm({ ...form, date: d.dateString });
                                setShowDate(false);
                            }}
                        />
                    ) : null}
                    <View style={{ gap: 12 }}>
                        <Text style={{ color: c.muted, fontWeight: '700' }}>
                            {t('tools.receiptOptional')}
                        </Text>
                        {photo ? (
                            <Image
                                source={{ uri: photo.uri }}
                                resizeMode="contain"
                                style={{
                                    height: 170,
                                    width: '100%',
                                    borderRadius: 16,
                                }}
                            />
                        ) : form.receipt ? (
                            <CommunityButton
                                secondary
                                label={t('tools.viewReceipt')}
                                onPress={() => void openReceipt(form.receipt!)}
                            />
                        ) : null}
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <View style={{ flex: 1 }}>
                                <CommunityButton
                                    secondary
                                    label={t('tools.camera')}
                                    disabled={busy}
                                    onPress={() => void pick(true)}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <CommunityButton
                                    secondary
                                    label={t('tools.gallery')}
                                    disabled={busy}
                                    onPress={() => void pick(false)}
                                />
                            </View>
                        </View>
                        {photo || form.receipt ? (
                            <CommunityButton
                                secondary
                                label={t('tools.removePhoto')}
                                disabled={busy}
                                onPress={async () => {
                                    if (lock.current) return;
                                    lock.current = true;
                                    setBusy(true);
                                    try {
                                        let original = form.original;
                                        if (
                                            form.receipt &&
                                            form.receipt !== form.original &&
                                            user
                                        ) {
                                            const saved =
                                                await expenseService.getExpense(
                                                    form.id,
                                                    user,
                                                );
                                            if (
                                                saved?.receipt_path ===
                                                form.receipt
                                            )
                                                original = form.receipt;
                                            else
                                                await expenseReceipts.remove(
                                                    form.receipt,
                                                );
                                        }
                                        setPhoto(null);
                                        setForm({
                                            ...form,
                                            receipt: null,
                                            original,
                                        });
                                    } catch {
                                        setError(t('tools.saveError'));
                                    } finally {
                                        lock.current = false;
                                        setBusy(false);
                                    }
                                }}
                            />
                        ) : null}
                    </View>
                    {(current?.earning_type === 'agreement' ||
                        form.included) && (
                        <Pressable
                            accessibilityRole="checkbox"
                            accessibilityLabel={t('tools.alreadyDeducted')}
                            accessibilityState={{
                                checked: form.included,
                                disabled: busy,
                            }}
                            disabled={busy}
                            onPress={() =>
                                setForm({ ...form, included: !form.included })
                            }
                            style={{
                                padding: 16,
                                backgroundColor: c.card,
                                borderRadius: 16,
                                flexDirection: 'row',
                                gap: 12,
                                alignItems: 'center',
                            }}
                        >
                            <View
                                style={{
                                    width: 22,
                                    height: 22,
                                    borderRadius: 6,
                                    backgroundColor: form.included
                                        ? c.accent
                                        : c.border,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                {form.included ? (
                                    <Text style={{ color: '#fff' }}>✓</Text>
                                ) : null}
                            </View>
                            <Text style={{ color: c.fg, flex: 1 }}>
                                {t('tools.alreadyDeducted')}
                            </Text>
                        </Pressable>
                    )}
                    <Text
                        style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}
                    >
                        {t('tools.personalExpenseHint')}
                    </Text>
                    <CommunityButton
                        label={t('tools.saveExpense')}
                        busy={busy}
                        onPress={() => void save()}
                    />
                    <CommunityButton
                        secondary
                        label={t('cancel')}
                        disabled={busy}
                        onPress={() => void cancel()}
                    />
                </>
            ) : (
                <>
                    <Pressable
                        accessibilityRole="button"
                        disabled={busy}
                        onPress={() => setSelected('')}
                    >
                        <Text style={{ color: c.accent }}>
                            {t('tools.changeSession')}
                        </Text>
                    </Pressable>
                    {current ? (
                        <>
                            <Text
                                style={{
                                    fontSize: 20,
                                    fontWeight: '800',
                                    color: c.fg,
                                }}
                            >
                                {sessionDisplayTitle(current, t)}
                            </Text>
                            <Text style={{ color: c.muted }}>
                                {current.date} · {current.venue}
                            </Text>
                            <View
                                style={{
                                    padding: 22,
                                    backgroundColor: c.tint,
                                    borderRadius: 24,
                                    gap: 8,
                                }}
                            >
                                <Text style={{ color: c.muted }}>
                                    {t('tools.expenseTotal')}
                                </Text>
                                <Text
                                    style={{
                                        color: c.accent,
                                        fontSize: 30,
                                        fontWeight: '900',
                                    }}
                                >
                                    {money(
                                        rows
                                            .filter(
                                                (e) =>
                                                    currencyCode(
                                                        e.currency || 'EUR',
                                                    ) === currency,
                                            )
                                            .reduce(
                                                (sum, e) =>
                                                    sum + Number(e.amount),
                                                0,
                                            ),
                                    )}
                                </Text>
                            </View>
                            <CommunityButton
                                label={t('tools.addExpense')}
                                disabled={busy}
                                onPress={() => start()}
                            />
                        </>
                    ) : null}
                    {!rows.length ? (
                        <Text style={{ color: c.muted }}>
                            {t('tools.noExpenses')}
                        </Text>
                    ) : (
                        rows.map((e) => (
                            <View
                                key={e.id}
                                style={{
                                    padding: 18,
                                    backgroundColor: c.card,
                                    borderRadius: 20,
                                    gap: 12,
                                }}
                            >
                                <View style={{ flexDirection: 'row', gap: 12 }}>
                                    <View style={{ flex: 1, gap: 5 }}>
                                        <Text
                                            style={{
                                                color: c.fg,
                                                fontWeight: '700',
                                                fontSize: 16,
                                            }}
                                        >
                                            {e.description}
                                        </Text>
                                        <Text
                                            style={{
                                                color: c.muted,
                                                fontSize: 12,
                                            }}
                                        >
                                            {e.date}
                                        </Text>
                                    </View>
                                    <Text
                                        style={{
                                            color: c.fg,
                                            fontWeight: '800',
                                            fontSize: 17,
                                        }}
                                    >
                                        {money(
                                            Number(e.amount),
                                            currencyCode(e.currency || 'EUR'),
                                        )}
                                    </Text>
                                </View>
                                {e.included_in_agreement ? (
                                    <Text
                                        style={{ color: c.muted, fontSize: 12 }}
                                    >
                                        {t('tools.alreadyDeducted')}
                                    </Text>
                                ) : null}
                                {e.receipt_path ? (
                                    <CommunityButton
                                        compact
                                        secondary
                                        disabled={busy}
                                        label={t('tools.viewReceipt')}
                                        onPress={() =>
                                            void openReceipt(e.receipt_path!)
                                        }
                                    />
                                ) : null}
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <View style={{ flex: 1 }}>
                                        <CommunityButton
                                            compact
                                            secondary
                                            disabled={busy}
                                            label={t('tools.editExpense')}
                                            onPress={() => {
                                                setSelected(
                                                    e.session_id &&
                                                        choices.some(
                                                            (s) =>
                                                                s.id ===
                                                                e.session_id,
                                                        )
                                                        ? e.session_id
                                                        : 'all',
                                                );
                                                start(e);
                                            }}
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <CommunityButton
                                            compact
                                            secondary
                                            disabled={busy}
                                            label={t('delete')}
                                            onPress={() => void remove(e)}
                                        />
                                    </View>
                                </View>
                            </View>
                        ))
                    )}
                </>
            )}
        </ToolsLayout>
    );
}
