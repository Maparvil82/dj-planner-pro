export const TICKET_QR_PREFIX = 'djplanner:ticket:v1:';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function ticketQrValue(token: string) {
    return TICKET_QR_PREFIX + token;
}
export function parseTicketQr(value: string): string | null {
    if (!value.startsWith(TICKET_QR_PREFIX)) return null;
    const token = value.slice(TICKET_QR_PREFIX.length);
    return UUID.test(token) ? token.toLowerCase() : null;
}
export function ticketPrice(value: string): number | null {
    if (!/^\d{1,7}([.,]\d{1,2})?$/.test(value.trim())) return null;
    const price = Number(value.trim().replace(',', '.'));
    return Number.isFinite(price) && price <= 1000000 ? price : null;
}
export function ticketQuantity(value: string): number | null {
    if (!/^\d{1,3}$/.test(value)) return null;
    const amount = Number(value);
    return amount >= 1 && amount <= 100 ? amount : null;
}
