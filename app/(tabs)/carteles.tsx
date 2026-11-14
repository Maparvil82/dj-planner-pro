import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePosterPreviewAccess } from '../../src/hooks/usePosterPreviewAccess';
import { usePosterIntro } from '../../src/hooks/usePosterIntro';
import { useAuthStore } from '../../src/store/useAuthStore';
import { PosterWelcome } from '../../src/components/posters/PosterWelcome';
import { CommunityMessage, useCommunityColors } from '../../src/components/community/CommunityUI';
import { useTranslation } from '../../src/i18n/useTranslation';
// @ts-ignore
import PosterLab from '../../src/postersLab/PosterLab';

export default function Carteles() {
    const userId = useAuthStore(state => state.session?.user.id);
    return <PosterEntry key={userId} />;
}

function PosterEntry() {
    const access = usePosterPreviewAccess();
    const userId = useAuthStore(state => state.session?.user.id);
    const intro = usePosterIntro();
    const c = useCommunityColors(), { t } = useTranslation();
    if (intro.query.data === true) {
        return <PosterLab key={userId} generationEnabled={access.data === true} accessLoading={access.isFetching} />;
    }
    return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'left', 'right']}>
        {intro.query.isError ? <CommunityMessage title={t('insights.loadingError')} retry={() => { void intro.query.refetch(); }} /> :
            !intro.query.isSuccess ? <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator accessibilityLabel={t('loading')} color={c.accent} /></View> :
                <PosterWelcome key={userId} busy={intro.complete.isPending} error={intro.complete.isError} onEnter={() => {
                    if (!intro.complete.isPending) intro.complete.mutate();
                }} />}
    </SafeAreaView>;
}
