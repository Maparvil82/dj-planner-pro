import { StorageImage as Image } from '../ui/StorageImage';
import { View, Text, ScrollView, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTranslation } from '../../i18n/useTranslation';
import { CommunityButton, useCommunityColors } from './CommunityUI';

export function CommunityWelcome() {
    const c = useCommunityColors(),
        { t } = useTranslation(),
        router = useRouter();
    const { height } = useWindowDimensions();
    return (
        <ScrollView
            contentContainerStyle={{
                flexGrow: 1,
                paddingHorizontal: 24,
                paddingTop: 18,
                paddingBottom: 114,
                justifyContent: 'center',
            }}
        >
            <View
                style={{
                    width: '100%',
                    maxWidth: 560,
                    alignSelf: 'center',
                    gap: 26,
                }}
            >
                <View
                    style={{
                        height: Math.min(310, Math.max(185, height * 0.31)),
                        borderRadius: 30,
                        overflow: 'hidden',
                        backgroundColor: '#171717',
                    }}
                >
                    <Image
                        source={require('../../../assets/community/community-booth-photo.jpg')}
                        resizeMode="cover"
                        style={{ width: '100%', height: '100%' }}
                    />
                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,.65)']}
                        style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: 100,
                        }}
                    />
                    <Text
                        style={{
                            position: 'absolute',
                            bottom: 22,
                            left: 24,
                            color: '#fff',
                            fontSize: 12,
                            fontWeight: '700',
                            letterSpacing: 2,
                        }}
                    >
                        {t('community.title').toUpperCase()}
                    </Text>
                </View>
                <View style={{ gap: 14 }}>
                    <Text
                        accessibilityRole="header"
                        style={{
                            color: c.fg,
                            fontSize: 32,
                            lineHeight: 37,
                            fontWeight: '800',
                            letterSpacing: -1,
                        }}
                    >
                        {t('communityEntry.title')}
                    </Text>
                    <Text
                        style={{ color: c.muted, fontSize: 15, lineHeight: 23 }}
                    >
                        {t('communityEntry.hint')}
                    </Text>
                </View>
                <View style={{ gap: 12 }}>
                    <CommunityButton
                        label={t('socialProfile.completeAction')}
                        onPress={() =>
                            router.push('/edit-dj-profile?edit=1&setup=1')
                        }
                    />
                    <Text
                        style={{
                            color: c.muted,
                            textAlign: 'center',
                            fontSize: 12,
                            lineHeight: 18,
                        }}
                    >
                        {t('communityEntry.privateAgenda')}
                    </Text>
                </View>
            </View>
        </ScrollView>
    );
}
