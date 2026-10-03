import { FEATURES } from '../../src/config/features';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../../src/store/useAuthStore';
import { BookingThreadScreen } from '../../src/components/bookings/BookingThread';
export default function BookingDetail() {
    return FEATURES.bookings ? (
        <BookingDetailContent />
    ) : (
        <Redirect href="/(tabs)/home" />
    );
}

function BookingDetailContent() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const user = useAuthStore((s) => s.user);
    if (!user) return <Redirect href="/(auth)/login" />;
    return <BookingThreadScreen id={id} ownerId={user.id} />;
}
