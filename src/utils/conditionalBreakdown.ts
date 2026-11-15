import {
    calculateConditionalAgreement,
    type ConditionalAgreement,
} from './feeAgreement';

/** A reconciliation of the DJ pool, distinct from the event's overall profit. */
export function conditionalBreakdown(a: ConditionalAgreement, actual: boolean) {
    const r = calculateConditionalAgreement(a, actual);
    const d = actual ? a.actual : a.estimate;
    type Row = { key: string; amount: number; concept?: string };
    const boxOffice: Row[] = [];
    if (a.ticketMode !== 'none') {
        boxOffice.push({ key: 'gross', amount: r.ticketGross });
        if (a.ticketBasis === 'net')
            boxOffice.push({
                key: 'ticketDeductions',
                amount: d.ticketDeductions,
            });
        const base = a.ticketBasis === 'net' ? r.ticketNet : r.ticketGross;
        const remainder = Math.round((base - r.tickets) * 100) / 100;
        boxOffice.push({
            key: remainder < 0 ? 'ticketTopUp' : 'remainder',
            amount: Math.abs(remainder),
        });
        boxOffice.push({ key: 'ticketShare', amount: r.tickets });
    }
    if (a.barPercent > 0) {
        boxOffice.push({ key: 'barGross', amount: d.bar });
        if (a.barBasis === 'net')
            boxOffice.push({ key: 'barDeductions', amount: d.barDeductions });
        boxOffice.push({
            key: 'barRemainder',
            amount:
                Math.round(
                    ((a.barBasis === 'net' ? d.bar - d.barDeductions : d.bar) -
                        r.bar) *
                        100,
                ) / 100,
        });
        boxOffice.push({ key: 'barShare', amount: r.bar });
    }
    const pool: Row[] = [];
    if (
        r.expenses ||
        a.fixed ||
        r.minimumAdjustment ||
        r.capAdjustment ||
        r.bonus ||
        a.barPercent > 0
    ) {
        pool.push({
            key: 'variable',
            amount: Math.round((r.tickets + r.bar + r.bonus) * 100) / 100,
        });
    }
    if (r.bonus) pool.unshift({ key: 'bonus', amount: r.bonus });
    if (d.expenses) pool.push({ key: 'otherExpenses', amount: -d.expenses });
    for (const item of r.expenseBreakdown)
        pool.push({
            key: 'expense',
            concept: item.concept,
            amount: -item.amount,
        });
    if (!r.expenses) pool.push({ key: 'expenses', amount: 0 });
    const variable = Math.max(0, r.tickets + r.bar + r.bonus - r.expenses);
    if (r.expenses > r.tickets + r.bar + r.bonus)
        pool.push({
            key: 'uncoveredExpenses',
            amount: r.expenses - r.tickets - r.bar - r.bonus,
        });
    const fixedAdded =
        a.fixedMode === 'versus' ? Math.max(0, a.fixed - variable) : a.fixed;
    if (a.fixed)
        pool.push({
            key: a.fixedMode === 'versus' ? 'fixedTopUp' : 'fixed',
            amount: fixedAdded,
        });
    if (r.minimumAdjustment)
        pool.push({ key: 'minimum', amount: r.minimumAdjustment });
    if (r.capAdjustment) pool.push({ key: 'cap', amount: -r.capAdjustment });
    pool.push({ key: 'pool', amount: r.total });
    return { result: r, boxOffice, pool };
}
