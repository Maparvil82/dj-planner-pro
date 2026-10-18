import { currencyCode } from './dashboardMetrics';
import type { Expense } from '../types/expense';

export function sessionExpenseTotals(expenses: Expense[]): Record<string, number> {
    const cents: Record<string, number> = {};
    for (const expense of expenses) {
        const amount = Number(expense.amount);
        if (!Number.isFinite(amount)) continue;
        const currency = currencyCode(expense.currency || 'EUR');
        cents[currency] = (cents[currency] || 0) + Math.round(amount * 100);
    }
    return Object.fromEntries(Object.entries(cents).map(([currency, value]) => [currency, value / 100]));
}
