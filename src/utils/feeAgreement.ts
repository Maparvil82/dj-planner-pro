export type FeeAgreement = {
    version: 1;
    timezone: string;
    fixed: number;
    perTicket: number;
    entryPercent: number;
    barPercent: number;
    minimum: number;
    expenses: number;
    split: 'equal' | 'percent' | 'fixed';
    participants: { name: string; share: number }[];
    estimate: FeeResults;
    actual: FeeResults;
    settled: boolean;
};
export type FeeResults = { tickets: number; entries: number; bar: number };
export const emptyFeeAgreement = (): FeeAgreement => ({
    version: 1,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    fixed: 0,
    perTicket: 0,
    entryPercent: 0,
    barPercent: 0,
    minimum: 0,
    expenses: 0,
    split: 'equal',
    participants: [{ name: '', share: 0 }],
    estimate: { tickets: 0, entries: 0, bar: 0 },
    actual: { tickets: 0, entries: 0, bar: 0 },
    settled: false,
});
const cents = (n: number) => Math.round(n * 100);
const roundedRatio = (a: number, b: number, denominator: number) =>
    Number(
        (BigInt(a) * BigInt(b) + BigInt(denominator / 2)) / BigInt(denominator),
    );
export function validateFeeAgreement(a: FeeAgreement) {
    if (
        !a ||
        a.version !== 1 ||
        typeof a.settled !== 'boolean' ||
        typeof a.timezone !== 'string' ||
        !['equal', 'percent', 'fixed'].includes(a.split)
    )
        throw new Error('agreement.invalid');
    if (
        !a.estimate ||
        !a.actual ||
        !Array.isArray(a.participants) ||
        !['tickets', 'entries', 'bar'].every(
            (k) => k in a.estimate && k in a.actual,
        )
    )
        throw new Error('agreement.invalid');
    try {
        new Intl.DateTimeFormat('en', { timeZone: a.timezone }).format();
    } catch {
        throw new Error('agreement.invalid');
    }
    for (const n of [
        a.fixed,
        a.perTicket,
        a.entryPercent,
        a.barPercent,
        a.minimum,
        a.expenses,
        ...Object.values(a.estimate),
        ...Object.values(a.actual),
        ...a.participants.map((p) => p.share),
    ])
        if (
            typeof n !== 'number' ||
            !Number.isFinite(n) ||
            n < 0 ||
            n > 999999999 ||
            Math.abs(cents(n) / 100 - n) > 0.000001
        )
            throw new Error('agreement.invalid');
    if (
        !Number.isInteger(a.estimate.tickets) ||
        !Number.isInteger(a.actual.tickets) ||
        a.entryPercent > 100 ||
        a.barPercent > 100 ||
        !a.participants.length ||
        a.participants.length > 20 ||
        a.participants.some(
            (p) => typeof p.name !== 'string' || p.name.length > 100,
        )
    )
        throw new Error('agreement.invalid');
    if (!(
        a.fixed ||
        a.perTicket ||
        a.entryPercent ||
        a.barPercent ||
        a.minimum
    ))
        throw new Error('agreement.noTerms');
    if (
        a.split === 'percent' &&
        Math.abs(a.participants.reduce((s, p) => s + p.share, 0) - 100) >
            0.000001
    )
        throw new Error('agreement.invalidSplit');
    return a;
}
export function calculateFeeAgreement(a: FeeAgreement, actual = false) {
    validateFeeAgreement(a);
    const r = actual ? a.actual : a.estimate;
    const fixed = cents(a.fixed),
        tickets = cents(a.perTicket) * r.tickets,
        entries = roundedRatio(cents(r.entries), cents(a.entryPercent), 10000),
        bar = roundedRatio(cents(r.bar), cents(a.barPercent), 10000);
    const beforeMinimum = fixed + tickets + entries + bar;
    if (!Number.isSafeInteger(beforeMinimum) || beforeMinimum > 99999999900)
        throw new Error('agreement.invalid');
    const total = Math.max(beforeMinimum, cents(a.minimum));
    const remainder = Math.max(0, total - cents(a.expenses));
    if (cents(a.expenses) > total) throw new Error('agreement.expensesTooHigh');
    let shares: number[];
    if (a.split === 'fixed') {
        shares = a.participants.map((p) => cents(p.share));
        if (shares.reduce((s, n) => s + n, 0) !== remainder)
            throw new Error('agreement.invalidSplit');
    } else {
        shares = a.participants.map((p) =>
            a.split === 'equal'
                ? Math.floor(remainder / a.participants.length)
                : Number((BigInt(remainder) * BigInt(cents(p.share))) / 10000n),
        );
        let left = remainder - shares.reduce((s, n) => s + n, 0);
        for (let i = 0; left > 0; i = (i + 1) % shares.length, left--)
            shares[i]++;
    }
    return {
        total: total / 100,
        fixed: fixed / 100,
        tickets: tickets / 100,
        entries: entries / 100,
        bar: bar / 100,
        minimumAdjustment: (total - beforeMinimum) / 100,
        distributable: remainder / 100,
        shares: shares.map((n) => n / 100),
        owner: shares[0] / 100,
    };
}
export function agreementAmount(a?: FeeAgreement | null) {
    return a?.settled ? calculateFeeAgreement(a, true).owner : 0;
}
