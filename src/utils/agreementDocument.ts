import type { TFunction } from 'i18next';
import type { Session } from '../types/session';
import { conditionalBreakdown } from './conditionalBreakdown';
import { conditionalSummary } from './conditionalPresentation';
import { sessionDisplayTitle } from './sessionNaming';
import { validateConditionalAgreement } from './feeAgreement';

export function buildAgreementHtml(
    session: Session,
    owner: string,
    language: string,
    t: TFunction,
) {
    const a = session.fee_agreement;
    if (a?.version !== 2) throw new Error('agreement.invalid');
    validateConditionalAgreement(a);
    const escape = (value: unknown) =>
        String(value ?? '').replace(
            /[&<>"']/g,
            (c) =>
                ({
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    '"': '&quot;',
                    "'": '&#39;',
                })[c]!,
        );
    const money = (n: number) =>
        `${new Intl.NumberFormat(language, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} ${session.currency}`;
    const label = (key: string) => escape(t(`agreementPdf.${key}`));
    const row = (key: string, value: unknown) =>
        `<tr><td>${escape(key)}</td><td>${escape(value)}</td></tr>`;
    const heading = (key: string) => `<h2>${label(key)}</h2>`;
    const ticketRows = a.tickets
        .map((ticket) => row(ticket.name, money(ticket.price)))
        .join('');
    const names = a.participants.map((p, i) =>
        i === 0 ? owner || p.name || t('agreement.you') : p.name,
    );
    const splitRows = a.participants
        .map((p, i) =>
            row(
                names[i],
                a.split === 'equal'
                    ? t('conditional.split_equal')
                    : a.split === 'percent'
                      ? `${p.share}%`
                      : i === 0
                        ? t('conditional.split_fixed')
                        : money(p.share),
            ),
        )
        .join('');
    const basisRows =
        (a.ticketMode !== 'none'
            ? row(
                  t('conditional.tickets'),
                  t(`conditional.basis_${a.ticketBasis}`),
              )
            : '') +
        (a.barPercent > 0
            ? row(t('conditional.bar'), t(`conditional.basis_${a.barBasis}`))
            : '');
    const costs = (a.expenseItems || [])
        .map((item) =>
            row(
                item.concept,
                item.type === 'percent' ? `${item.value}%` : money(item.value),
            ),
        )
        .join('');
    const scope = escape(t('conditionalCosts.basis'));
    // Forecast quantities and results are deliberately excluded from a contract.
    let settlement = '';
    if (a.settled) {
        const b = conditionalBreakdown(a, true);
        const lines = [...b.boxOffice, ...b.pool]
            .map((item) =>
                row(
                    item.concept || t(`conditionalLedger.${item.key}`),
                    money(item.amount),
                ),
            )
            .join('');
        const sales = a.tickets
            .map((ticket) =>
                row(
                    ticket.name,
                    `${ticket.sold} / ${ticket.refunded} / ${ticket.invited}`,
                ),
            )
            .join('');
        settlement = `${heading('settlement')}<p class="muted">${escape(t('conditional.sold'))} / ${escape(t('conditional.refunded'))} / ${escape(t('conditional.invited'))}</p><table>${sales}</table><table>${lines}</table><table>${b.result.shares.map((share, i) => row(names[i], money(share))).join('')}</table>`;
    }
    return `<!doctype html><html lang="${escape(language)}"><head><meta charset="UTF-8"><title>${label('title')}</title><style>
    @page { size: A4; margin: 16mm; }
    *{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#23243b;margin:0;font-size:10.5px;line-height:1.4}header{border-bottom:3px solid #6851e8;padding-bottom:10px;margin-bottom:10px}.brand{color:#6851e8;font-size:12px;font-weight:bold;letter-spacing:1px}h1{font-size:23px;line-height:1.2;margin:12px 0}h2{font-size:14px;margin:10px 0 5px;break-after:avoid}.badge{display:inline-block;background:#efecfd;color:#6851e8;border-radius:5px;padding:5px 9px;font-weight:bold}p{margin:6px 0}.muted{color:#656b7a;font-size:10px}table{width:100%;border-collapse:collapse;margin:5px 0 7px;table-layout:fixed}td{padding:5px 10px;border-bottom:1px solid #e4e5ed;vertical-align:top;overflow-wrap:anywhere}td:first-child{width:66%}td:last-child{text-align:right;font-weight:bold}tr{break-inside:avoid}.party{border:1px solid #e4e5ed;padding:9px;margin:6px 0;break-inside:avoid}.line{margin-top:8px;border-bottom:1px solid #b9bdcb;height:15px}.signatures{break-inside:avoid;margin-top:16px}.signature{display:inline-block;width:47%;margin-right:2%;vertical-align:top}.signature .line{height:40px}footer{border-top:1px solid #e4e5ed;margin-top:16px;padding-top:8px;color:#656b7a;font-size:9px}.notes{white-space:pre-wrap;overflow-wrap:anywhere}
    </style></head><body><header><div class="brand">DJ PLANNER · PRO</div><h1>${label('title')}</h1><span class="badge">${label('pending')}</span></header>
    ${heading('event')}<p><strong>${escape(sessionDisplayTitle(session, t))}</strong><br>${escape(session.venue)}${session.venue_city ? ' · ' + escape(session.venue_city) : ''}${session.venue_address ? '<br>' + escape(session.venue_address) : ''}<br>${escape(session.date)} · ${escape(session.start_time)} - ${escape(session.end_time)} · ${escape(a.timezone)}</p>
    <p class="muted">${label('reference')}: ${escape(session.id)}<br>${label('revision')}: ${escape(session.updated_at)}</p>
    ${heading('parties')}<div class="party"><strong>${label('dj')}: ${escape(names[0])}</strong><div class="muted">${label('identity')}</div><div class="line"></div></div><div class="party"><strong>${label('promoter')}: ${escape(session.venue)}</strong><div class="muted">${label('identity')}</div><div class="line"></div></div>
    ${heading('terms')}<p>${escape(conditionalSummary(a, t, money))}</p><table>${basisRows}</table>
    ${a.ticketMode !== 'none' ? heading('ticketTypes') + '<table>' + ticketRows + '</table>' : ''}
    ${heading('split')}<table>${splitRows}</table>
    ${costs ? `<h2>${escape(t('conditional.expenses'))}</h2><table>${costs}</table>${a.expenseItems?.some((item) => item.type === 'percent') ? `<p class="muted">${scope}</p>` : ''}` : ''}
    ${heading('notes')}<p class="notes">${escape(a.notes || t('agreementPdf.noNotes'))}</p>
    ${settlement}
    <div class="signatures">${heading('signatures')}<div class="signature"><strong>${label('dj')}</strong><div class="line"></div><p>${label('signature')}<br>${label('date')}: ____________________</p></div><div class="signature"><strong>${label('promoter')}</strong><div class="line"></div><p>${label('signature')}<br>${label('date')}: ____________________</p></div></div>
    <footer>${label('scope')}<br>${label('reference')}: ${escape(session.id)} · ${label('revision')}: ${escape(session.updated_at)}</footer></body></html>`;
}
