import { Image, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ImageIcon, Palette, Users } from 'lucide-react-native';
import { CommunityButton, useCommunityColors } from '../community/CommunityUI';
import { useTranslation } from '../../i18n/useTranslation';

const samples = [
    require('../../../assets/posters/thumbnails/cabina-analogica-v1.jpg'),
    require('../../../assets/posters/thumbnails/pulso-v2.jpg'),
    require('../../../assets/posters/thumbnails/pop-club-v1.jpg'),
];

export function PosterWelcome({ onEnter, busy, error }: {
    onEnter: () => void; busy: boolean; error: boolean;
}) {
    const c = useCommunityColors(), { t } = useTranslation();
    const { height } = useWindowDimensions();
    const features = [
        { icon: Palette, title: 'styleTitle', body: 'styleBody' },
        { icon: ImageIcon, title: 'photosTitle', body: 'photosBody' },
        { icon: Users, title: 'exploreTitle', body: 'exploreBody' },
    ];
    return <ScrollView testID="poster-welcome" contentContainerStyle={{
        flexGrow: 1, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 114, justifyContent: 'center',
    }}>
        <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', gap: 24 }}>
            <View accessible={false} importantForAccessibility="no-hide-descendants" style={{
                height: Math.min(285, Math.max(180, height * 0.27)), borderRadius: 30,
                overflow: 'hidden', backgroundColor: '#171717', justifyContent: 'center',
            }}>
                <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, padding: 22 }}>
                    {samples.map((source, index) => <Image key={index} source={source} resizeMode="contain" style={{
                        width: '28%', aspectRatio: 2 / 3, borderRadius: 8,
                        transform: [{ rotate: index === 0 ? '-9deg' : index === 2 ? '9deg' : '0deg' }],
                    }} />)}
                </View>
                <LinearGradient colors={['transparent', 'rgba(0,0,0,.75)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 90 }} />
                <Text style={{ position: 'absolute', bottom: 20, left: 24, color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 2 }}>
                    {t('accountMenu.posters').toUpperCase()}
                </Text>
            </View>
            <View style={{ gap: 12 }}>
                <Text accessibilityRole="header" style={{ color: c.fg, fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -1 }}>{t('posterIntro.title')}</Text>
                <Text style={{ color: c.muted, fontSize: 15, lineHeight: 23 }}>{t('posterIntro.intro')}</Text>
            </View>
            <View style={{ gap: 20 }}>
                {features.map(({ icon: Icon, title, body }) => <View key={title} style={{ flexDirection: 'row', gap: 14 }}>
                    <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: c.tint, alignItems: 'center', justifyContent: 'center' }}><Icon size={21} color={c.accent} /></View>
                    <View style={{ flex: 1, gap: 4 }}>
                        <Text style={{ color: c.fg, fontSize: 15, fontWeight: '700' }}>{t(`posterIntro.${title}`)}</Text>
                        <Text style={{ color: c.muted, fontSize: 13, lineHeight: 20 }}>{t(`posterIntro.${body}`)}</Text>
                    </View>
                </View>)}
            </View>
            <View style={{ gap: 12 }}>
                {error && <Text accessibilityRole="alert" style={{ color: c.dark ? '#f19ab1' : '#c35671', fontSize: 13, lineHeight: 20 }}>{t('posterIntro.error')}</Text>}
                <CommunityButton label={t('posterIntro.enter')} busy={busy} onPress={onEnter} />
                <Text style={{ color: c.muted, textAlign: 'center', fontSize: 12, lineHeight: 18 }}>{t('posterIntro.credits')}</Text>
            </View>
        </View>
    </ScrollView>;
}
