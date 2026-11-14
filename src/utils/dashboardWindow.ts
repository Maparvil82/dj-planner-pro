import { localDateString } from './sessionPlanning';
import { periodBounds, type DashboardPeriod } from './dashboardMetrics';
export function dashboardWindow(anchor: Date, period: DashboardPeriod, now: Date) {
    const previous = periodBounds(anchor, period, -1), current = periodBounds(anchor, period);
    const trend = periodBounds(new Date(anchor.getFullYear(), period === 'year' ? 0 : anchor.getMonth() - 11, 1), 'month');
    const main = { from: previous.start < trend.start ? previous.start : trend.start, to: current.end };
    const start = new Date(now);
    start.setDate(start.getDate() - 2);
    const end = new Date(now);
    end.setDate(end.getDate() + 32);
    const upcoming = { from: localDateString(start), to: localDateString(end) };
    return { main, upcoming };
}
