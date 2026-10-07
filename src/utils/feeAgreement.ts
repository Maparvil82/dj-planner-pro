export type LegacyFeeAgreement = {
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
export const emptyFeeAgreement = (): LegacyFeeAgreement => ({
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
export type FeeAgreement = LegacyFeeAgreement | ConditionalAgreement;
export function validateFeeAgreement(a: FeeAgreement) {
    if (a?.version === 2) return validateConditionalAgreement(a);
    return validateLegacyFeeAgreement(a);
}
function validateLegacyFeeAgreement(a: LegacyFeeAgreement) {
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
    if (a?.version === 2) return calculateConditionalAgreement(a, actual);
    validateLegacyFeeAgreement(a);
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

/** Versioned private agreement. Money is rounded in cents, never in display units. */
export type ConditionalResults = {
    ticketDeductions: number;
    bar: number;
    barDeductions: number;
    expenses: number;
};
export type ConditionalAgreement = {
    version: 2;
    enabledExtras?: import('./conditionalPresentation').AgreementExtra[];
    timezone: string;
    settled: boolean;
    fixed: number;
    fixedMode: 'add' | 'versus';
    minimum: number;
    maximum: number; // zero means no ceiling
    ticketMode: 'none' | 'dj_fixed' | 'venue_fixed' | 'percent';
    ticketValue: number;
    ticketBasis: 'gross' | 'net';
    barPercent: number;
    barBasis: 'gross' | 'net';
    bonusThreshold: number;
    bonusAmount: number;
    tickets: {
        name: string;
        price: number;
        estimate: number;
        sold: number;
        refunded: number;
        invited: number;
    }[];
    split: 'equal' | 'percent' | 'fixed';
    participants: { name: string; share: number }[]; // owner is always index zero
    estimate: ConditionalResults;
    actual: ConditionalResults;
    notes: string;
};
export const emptyConditionalAgreement = (): ConditionalAgreement => ({
    version: 2,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    settled: false,
    fixed: 0,
    fixedMode: 'add',
    minimum: 0,
    maximum: 0,
    ticketMode: 'venue_fixed',
    ticketValue: 3,
    ticketBasis: 'gross',
    barPercent: 0,
    barBasis: 'gross',
    bonusThreshold: 0,
    bonusAmount: 0,
    tickets: [
        { name: '', price: 10, estimate: 0, sold: 0, refunded: 0, invited: 0 },
    ],
    split: 'equal',
    participants: [{ name: '', share: 0 }],
    estimate: { ticketDeductions: 0, bar: 0, barDeductions: 0, expenses: 0 },
    actual: { ticketDeductions: 0, bar: 0, barDeductions: 0, expenses: 0 },
    notes: '',
});
export function validateConditionalAgreement(a: ConditionalAgreement) {
    const fail = (key = 'agreement.invalid'): never => {
        throw new Error(key);
    };
    const numeric = (n: unknown, integer = false) => {
        if (
            typeof n !== 'number' ||
            !Number.isFinite(n) ||
            n < 0 ||
            n > (integer ? 1000000 : 999999999) ||
            (integer
                ? !Number.isInteger(n)
                : Math.abs(cents(n) / 100 - n) > 0.000001)
        )
            fail();
    };
    if (
        !a ||
        a.version !== 2 ||
        typeof a.settled !== 'boolean' ||
        typeof a.timezone !== 'string' ||
        !['add', 'versus'].includes(a.fixedMode) ||
        !['none', 'dj_fixed', 'venue_fixed', 'percent'].includes(
            a.ticketMode,
        ) ||
        !['gross', 'net'].includes(a.ticketBasis) ||
        !['gross', 'net'].includes(a.barBasis) ||
        !['equal', 'percent', 'fixed'].includes(a.split) ||
        typeof a.notes !== 'string' ||
        a.notes.length > 2000 ||
        !Array.isArray(a.tickets) ||
        a.tickets.length > 30 ||
        !Array.isArray(a.participants) ||
        a.participants.length < 1 ||
        a.participants.length > 20
    )
        fail();
    try {
        new Intl.DateTimeFormat('en', { timeZone: a.timezone }).format();
    } catch {
        fail();
    }
    for (const n of [
        a.fixed,
        a.minimum,
        a.maximum,
        a.ticketValue,
        a.barPercent,
        a.bonusAmount,
    ])
        numeric(n);
    numeric(a.bonusThreshold, true);
    if (
        a.barPercent > 100 ||
        (a.ticketMode === 'percent' && a.ticketValue > 100) ||
        (a.maximum > 0 && a.maximum < a.minimum) ||
        (a.bonusAmount > 0 && !a.bonusThreshold)
    )
        fail();
    if (
        !a.fixed &&
        !a.minimum &&
        !(a.ticketMode !== 'none' && a.ticketValue > 0) &&
        a.ticketMode !== 'venue_fixed' &&
        !a.barPercent &&
        !a.bonusAmount
    )
        fail('agreement.noTerms');
    if (a.ticketMode !== 'none' && !a.tickets.length) fail();
    for (const row of a.tickets) {
        if (
            !row ||
            typeof row.name !== 'string' ||
            !row.name.trim() ||
            row.name.length > 80
        )
            fail();
        numeric(row.price);
        for (const n of [row.estimate, row.sold, row.refunded, row.invited])
            numeric(n, true);
        if (
            row.refunded > row.sold ||
            (a.ticketMode === 'venue_fixed' &&
                row.price > 0 &&
                a.ticketValue > row.price)
        )
            fail('conditional.invalidTickets');
    }
    for (const data of [a.estimate, a.actual]) {
        if (!data || typeof data !== 'object' || Array.isArray(data)) fail();
        for (const key of [
            'ticketDeductions',
            'bar',
            'barDeductions',
            'expenses',
        ] as const)
            numeric(data[key]);
    }
    for (const [i, p] of a.participants.entries()) {
        if (
            !p ||
            typeof p.name !== 'string' ||
            p.name.length > 100 ||
            (i > 0 && !p.name.trim())
        )
            fail();
        numeric(p.share);
    }
    if (
        a.split === 'percent' &&
        cents(a.participants.reduce((sum, p) => sum + p.share, 0)) !== 10000
    )
        fail('agreement.invalidSplit');
    return a;
}
export function calculateConditionalAgreement(
    a: ConditionalAgreement,
    actual = false,
) {
    validateConditionalAgreement(a);
    const data = actual ? a.actual : a.estimate;
    let count = 0,
        gross = 0;
    for (const row of a.tickets) {
        const quantity = actual ? row.sold - row.refunded : row.estimate;
        if (row.price > 0) count += quantity; // guests and free tickets never generate a fee
        gross += cents(row.price) * quantity;
    }
    const check = (n: number) => {
        if (!Number.isSafeInteger(n) || n > 99999999900 || n < 0)
            throw new Error('agreement.invalid');
        return n;
    };
    check(gross);
    const net = gross - cents(data.ticketDeductions);
    const barNet = cents(data.bar) - cents(data.barDeductions);
    if (net < 0 || barNet < 0) throw new Error('conditional.deductionsTooHigh');
    const ticketBase = a.ticketBasis === 'net' ? net : gross;
    let ticketFee = 0;
    if (a.ticketMode === 'dj_fixed')
        ticketFee = check(cents(a.ticketValue) * count);
    if (a.ticketMode === 'venue_fixed') {
        ticketFee = ticketBase - check(cents(a.ticketValue) * count);
        if (ticketFee < 0) throw new Error('conditional.deductionsTooHigh');
    }
    if (a.ticketMode === 'percent')
        ticketFee = roundedRatio(ticketBase, cents(a.ticketValue), 10000);
    const barFee = roundedRatio(
        a.barBasis === 'net' ? barNet : cents(data.bar),
        cents(a.barPercent),
        10000,
    );
    const bonus =
        a.bonusThreshold > 0 && count >= a.bonusThreshold
            ? cents(a.bonusAmount)
            : 0;
    const variable = Math.max(
        0,
        check(ticketFee + barFee + bonus) - cents(data.expenses),
    );
    const fixed = cents(a.fixed);
    const beforeMinimum =
        a.fixedMode === 'versus'
            ? Math.max(fixed, variable)
            : check(fixed + variable);
    const withMinimum = Math.max(beforeMinimum, cents(a.minimum));
    const total = check(
        a.maximum > 0 ? Math.min(withMinimum, cents(a.maximum)) : withMinimum,
    );
    let shares: number[];
    if (a.split === 'fixed') {
        shares = a.participants.map((p, i) => (i === 0 ? 0 : cents(p.share)));
        shares[0] = total - shares.reduce((sum, n) => sum + n, 0);
        if (shares[0] < 0) throw new Error('agreement.invalidSplit');
    } else {
        const weights = a.participants.map((p) =>
            a.split === 'equal' ? 1 : cents(p.share),
        );
        const denominator = a.split === 'equal' ? weights.length : 10000;
        const fractions = weights.map((weight, i) => ({
            i,
            remainder: (BigInt(total) * BigInt(weight)) % BigInt(denominator),
        }));
        shares = weights.map((weight) =>
            Number((BigInt(total) * BigInt(weight)) / BigInt(denominator)),
        );
        fractions.sort((x, y) =>
            x.remainder === y.remainder
                ? x.i - y.i
                : x.remainder > y.remainder
                  ? -1
                  : 1,
        );
        const left = total - shares.reduce((sum, n) => sum + n, 0);
        for (let i = 0; i < left; i++) shares[fractions[i].i]++;
    }
    return {
        total: total / 100,
        distributable: total / 100,
        owner: shares[0] / 100,
        shares: shares.map((n) => n / 100),
        fixed: fixed / 100,
        tickets: ticketFee / 100,
        entries: 0,
        bar: barFee / 100,
        minimumAdjustment: (withMinimum - beforeMinimum) / 100,
        paidTickets: count,
        ticketGross: gross / 100,
        ticketNet: net / 100,
        bonus: bonus / 100,
        expenses: data.expenses,
        venueRetention:
            a.ticketMode === 'venue_fixed' || a.ticketMode === 'percent'
                ? (ticketBase - ticketFee) / 100
                : 0,
        capAdjustment: (withMinimum - total) / 100,
    };
}
