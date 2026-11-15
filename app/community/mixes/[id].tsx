import { useScrollHeader } from '../../../src/hooks/useScrollHeader';
import { PageHeader } from '../../../src/components/ui/PageHeader';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { ProfileMixes } from '../../../src/components/community/ProfileMixes';
import {
    CommunityMessage,
    useCommunityColors,
} from '../../../src/components/community/CommunityUI';
import { useCommunityProfile } from '../../../src/hooks/useCommunityQuery';
import { useAuthStore } from '../../../src/store/useAuthStore';
import { useTranslation } from '../../../src/i18n/useTranslation';
export default function AllProfileMixes() {
    const { progress: headerProgress, onScroll: onHeaderScroll, onScrollBeginDrag: onHeaderScrollBeginDrag } = useScrollHeader('compact');
    const params = useLocalSearchParams<{ id: string }>();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const viewer = useAuthStore((state) => state.session?.user.id);
    const hydrated = useAuthStore(
        (state) => state.hasHydrated && state.initialized,
    );
    const person = useCommunityProfile(id);
    const c = useCommunityColors();
    const { t } = useTranslation();
    const router = useRouter();
    if (!hydrated) return null;
    if (!viewer)
        return (
            <Redirect
                href={{ pathname: '/(auth)/login', params: { dj: id } }}
            />
        );
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
            <PageHeader progress={headerProgress} title={t('profileMixes.allTitle')} subtitle={person.data?.artist_name || ''} leading={<TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={t('go_back')}
                    onPress={() =>
                        router.canGoBack()
                            ? router.back()
                            : router.replace(`/community/${id}`)
                    }
                    style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: c.card,
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <ArrowLeft size={21} color={c.fg} />
                </TouchableOpacity>} />
            <ScrollView scrollEventThrottle={16} onScrollBeginDrag={onHeaderScrollBeginDrag} onTouchStart={onHeaderScrollBeginDrag} onScroll={onHeaderScroll}
                contentContainerStyle={{
                    padding: 20,
                    paddingTop: 0,
                    paddingBottom: 40,
                }}
            >
                {person.isPending ? (
                    <CommunityMessage loading title={t('community.loading')} />
                ) : person.isError ? (
                    <CommunityMessage
                        title={t('community.error')}
                        retry={() => {
                            void person.refetch();
                        }}
                    />
                ) : !person.data ? (
                    <CommunityMessage title={t('community.unavailable')} />
                ) : (
                    <ProfileMixes userId={id} bare />
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
