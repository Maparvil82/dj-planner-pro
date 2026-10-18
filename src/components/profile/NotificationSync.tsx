import { useUnreadNotifications } from '../../hooks/useNotifications';
export function NotificationSync() {
    useUnreadNotifications(true);
    return null;
}
