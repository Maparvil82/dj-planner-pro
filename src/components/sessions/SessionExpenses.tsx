import { useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Receipt, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import {useSessionCardSummary,useSessionExpensesQuery} from '../../hooks/useSessionScreens';
import { useAuthStore } from '../../store/useAuthStore';
import { useTranslation } from '../../i18n/useTranslation';
import { formatRegionalDate } from '../../i18n/regionalDates';
import { sessionExpenseTotals } from '../../utils/sessionExpenseTotals';
import { useCommunityColors } from '../community/communityColors';
import type { Session } from '../../types/session';

function useSessionExpenses(session: Session) {
    const userId = useAuthStore(s => s.session?.user.id);
    // The detail loads only expenses linked to this session.
    const query = useSessionExpensesQuery(session);
    const own = !session.is_guest && session.user_id === userId;
    const rows = useMemo(() => own ? (query.data || []).filter(e => e.session_id === session.id && e.user_id === userId) : [], [query.data, own, session.id, userId]);
    const totals = useMemo(() => sessionExpenseTotals(rows), [rows]);
    const { formatMoney: money } = useTranslation();
    return { rows, money, total: Object.entries(totals).map(([currency, amount]) => money(amount, currency)).join(' · '), available: own && !query.isError && rows.length > 0 };
}

export function SessionExpenseBadge({ session }: { session: Session }) {
    const summary=useSessionCardSummary(session);
    const {formatMoney:money}=useTranslation();
    const expense={available:!summary.isError && Boolean(summary.data?.expenseCount),total:Object.entries(summary.data?.expenses||{}).map(([currency,amount])=>money(amount,currency)).join(' · ')};
    const c = useCommunityColors();
    const { t } = useTranslation();
    if (!expense.available) return null;
    return <View testID="session-expense-badge" style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: c.field, maxWidth: '100%' }}>
        <Receipt size={15} color={c.accent} />
        <Text style={{ color: c.cardText, fontSize: 11, fontWeight: '700', lineHeight: 16, flexShrink: 1 }}>{t('tools.expenses')} · {expense.total}</Text>
    </View>;
}

export function SessionExpensesCard({ session }: { session: Session }) {
    const expense = useSessionExpenses(session);
    const c = useCommunityColors();
    const { t, dateLocale } = useTranslation();
    const router = useRouter();
    if (!expense.available) return null;
    return <View testID="session-detail-expenses" style={{ backgroundColor: c.card, borderRadius: 26, padding: 20, gap: 18, borderWidth: c.dark ? 0 : 1, borderColor: c.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Receipt size={19} color={c.accent} />
            <Text accessibilityRole="header" style={{ color: c.cardText, fontSize: 19, fontWeight: '800', letterSpacing: -0.4 }}>{t('tools.expenses')}</Text>
        </View>
        <View style={{ gap: 5 }}>
            <Text style={{ color: c.dark ? c.cardText : c.muted, fontSize: 12 }}>{t('tools.expenseTotal')}</Text>
            <Text testID="session-expense-total" style={{ color: c.accent, fontSize: 26, lineHeight: 34, fontWeight: '800' }}>{expense.total}</Text>
        </View>
        {expense.rows.map(row => <View key={row.id} testID="session-expense-row" style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 14 }}>
            <View style={{ flex: 1, gap: 5 }}>
                <Text style={{ color: c.cardText, fontSize: 14, lineHeight: 20, fontWeight: '700' }}>{row.description || t('tools.expense')}</Text>
                <Text style={{ color: c.dark ? c.cardText : c.muted, fontSize: 12, lineHeight: 18 }}>{formatRegionalDate(row.date, dateLocale)}</Text>
            </View>
            <Text style={{ color: c.cardText, fontSize: 15, lineHeight: 20, fontWeight: '800', flexShrink: 1 }}>{expense.money(Number(row.amount), row.currency || 'EUR')}</Text>
        </View>)}
        <TouchableOpacity accessibilityRole="button" onPress={() => router.push({ pathname: '/expenses', params: { sessionId: session.id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 }}>
            <Text style={{ flex: 1, color: c.accent, fontSize: 13, fontWeight: '700' }}>{t('tools.manageExpenses')}</Text>
            <ChevronRight size={17} color={c.accent} />
        </TouchableOpacity>
    </View>;
}
