import { Redirect, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../../src/store/useAuthStore';
import { BookingThreadScreen } from '../../src/components/bookings/BookingThread';
export default function BookingDetail() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const user = useAuthStore((s) => s.user);
    if (!user) return <Redirect href="/(auth)/login" />;
    return <BookingThreadScreen id={id} ownerId={user.id} />;
}
