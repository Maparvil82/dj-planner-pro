import type { TFunction } from 'i18next';
import type { ConditionalAgreement } from './feeAgreement';
export type ConditionalModel = 'ticket' | 'boxOffice' | 'bar' | 'combined';
export type AgreementExtra =
    | 'fixed'
    | 'minimum'
    | 'maximum'
    | 'bonus'
    | 'expenses'
    | 'deductions'
    | 'notes';
export const agreementExtras: AgreementExtra[] = [
    'fixed',
    'minimum',
    'maximum',
    'bonus',
    'expenses',
    'deductions',
    'notes',
];
export function conditionalModel(a: ConditionalAgreement): ConditionalModel {
    if (a.ticketMode === 'none') return 'bar';
    if (a.barPercent > 0) return 'combined';
    return a.ticketMode === 'percent' ? 'boxOffice' : 'ticket';
}
export function activeAgreementExtras(
    a: ConditionalAgreement,
): AgreementExtra[] {
    return agreementExtras.filter(
        (key) =>
            (Array.isArray(a.enabledExtras) && a.enabledExtras.includes(key)) ||
            {
                fixed: a.fixed > 0,
                minimum: a.minimum > 0,
                maximum: a.maximum > 0,
                bonus: a.bonusThreshold > 0 || a.bonusAmount > 0,
                expenses:
                    a.estimate.expenses > 0 ||
                    a.actual.expenses > 0 ||
                    !!a.expenseItems?.length,
                deductions: a.ticketBasis === 'net' || a.barBasis === 'net',
                notes: !!a.notes,
            }[key],
    );
}
export function conditionalSummary(
    a: ConditionalAgreement,
    t: TFunction,
    money: (n: number) => string,
) {
    const lines: string[] = [];
    const who = t(
        a.participants.length > 1
            ? 'conditionalFlow.we'
            : 'conditionalFlow.you',
    );
    if (a.ticketMode === 'venue_fixed') {
        const ticket = a.tickets[0];
        lines.push(
            a.tickets.length === 1 &&
                ticket?.price > 0 &&
                a.ticketBasis === 'gross'
                ? t('conditionalFlow.summaryTicket', {
                      price: money(ticket.price),
                      venue: money(a.ticketValue),
                      dj: money(Math.max(0, ticket.price - a.ticketValue)),
                      who,
                  })
                : t('conditionalFlow.summaryVenue', {
                      amount: money(a.ticketValue),
                      who,
                  }),
        );
    } else if (a.ticketMode === 'dj_fixed')
        lines.push(
            t('conditionalFlow.summaryPerTicket', {
                amount: money(a.ticketValue),
                who,
            }),
        );
    else if (a.ticketMode === 'percent')
        lines.push(
            t('conditionalFlow.summaryPercent', {
                percent: a.ticketValue,
                who,
            }),
        );
    if (a.barPercent > 0)
        lines.push(
            t('conditionalFlow.summaryBar', { percent: a.barPercent, who }),
        );
    if (a.fixed > 0)
        lines.push(
            t(
                a.fixedMode === 'add'
                    ? 'conditionalFlow.summaryFixed'
                    : 'conditionalFlow.summaryVersus',
                { amount: money(a.fixed) },
            ),
        );
    if (a.minimum > 0)
        lines.push(
            t('conditionalFlow.summaryMinimum', { amount: money(a.minimum) }),
        );
    if (a.maximum > 0)
        lines.push(
            t('conditionalFlow.summaryMaximum', { amount: money(a.maximum) }),
        );
    if (a.bonusAmount > 0)
        lines.push(
            t('conditionalFlow.summaryBonus', {
                amount: money(a.bonusAmount),
                count: a.bonusThreshold,
            }),
        );
    if (a.ticketBasis === 'net' || a.barBasis === 'net')
        lines.push(t('conditionalFlow.summaryDeductions'));
    if (activeAgreementExtras(a).includes('expenses'))
        lines.push(t('conditionalFlow.summaryExpenses'));
    if (a.participants.length > 1)
        lines.push(
            t('conditionalFlow.summarySplit', { count: a.participants.length }),
        );
    return lines.join(' ');
}
