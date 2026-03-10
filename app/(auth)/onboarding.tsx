import React, { useState, useRef, useContext } from 'react';
import {
    View,
    Text,
    FlatList,
    Dimensions,
    TouchableOpacity,
    Animated,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from '../../src/i18n/useTranslation';
import { useAuthStore } from '../../src/store/useAuthStore';
import { ThemeContext } from '../../src/contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

interface OnboardingSlide {
    id: string;
    titleKey: string;
    subtitleKey: string;
    image: any;
    color: string;
}

const slides: OnboardingSlide[] = [
    {
        id: '1',
        titleKey: 'onboarding_title_1',
        subtitleKey: 'onboarding_subtitle_1',
        image: require('../../assets/onboarding/onboarding_1.png'),
        color: '#FFC2AD', // Matching Paywall coral for consistency
    },
    {
        id: '2',
        titleKey: 'onboarding_title_2',
        subtitleKey: 'onboarding_subtitle_2',
        image: require('../../assets/onboarding/onboarding_2.png'),
        color: '#4FD1C5', // Fresh teal
    },
    {
        id: '3',
        titleKey: 'onboarding_title_3',
        subtitleKey: 'onboarding_subtitle_3',
        image: require('../../assets/onboarding/onboarding_3.png'),
        color: '#8B5CF6', // Vibrant purple
    },
];

export default function OnboardingScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const setHasSeenOnboarding = useAuthStore((state) => state.setHasSeenOnboarding);

    const [currentIndex, setCurrentIndex] = useState(0);
    const scrollX = useRef(new Animated.Value(0)).current;
    const slidesRef = useRef<FlatList>(null);

    const viewableItemsChanged = useRef(({ viewableItems }: any) => {
        if (viewableItems && viewableItems.length > 0) {
            setCurrentIndex(viewableItems[0].index);
        }
    }).current;

    const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

    const handleNext = () => {
        if (currentIndex < slides.length - 1) {
            slidesRef.current?.scrollToIndex({ index: currentIndex + 1 });
        } else {
            setHasSeenOnboarding(true);
            router.replace('/paywall');
        }
    };

    const handleSkip = () => {
        setHasSeenOnboarding(true);
        router.replace('/paywall');
    };

    const renderSlide = ({ item }: { item: OnboardingSlide }) => {
        return (
            <View style={{ width }} className="items-center justify-center px-10">
                <View className="w-full aspect-square max-w-[340px] rounded-[50px] overflow-hidden mb-16 shadow-2xl shadow-black">
                    <Image
                        source={item.image}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                    />
                </View>
                <Text className="text-5xl font-black text-white text-center mb-6 tracking-tighter leading-none">
                    {t(item.titleKey).split('|').map((part, index) => (
                        <Text key={index} style={index % 2 === 1 ? { color: item.color } : undefined}>
                            {part}
                        </Text>
                    ))}
                </Text>
                <Text className="text-xl text-white/50 text-center leading-8 px-2 font-medium">
                    {t(item.subtitleKey)}
                </Text>
            </View>
        );
    };

    return (
        <View className="flex-1 bg-black">
            <LinearGradient
                colors={['rgba(255,194,173,0.05)', 'transparent', 'transparent']}
                style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '40%' }}
            />

            <SafeAreaView className="flex-1">
                <View className="flex-row justify-end px-8 pt-6">
                    <TouchableOpacity onPress={handleSkip}>
                        <Text className="text-white/30 font-black uppercase tracking-widest text-[10px]">
                            {t('skip') || 'Skip'}
                        </Text>
                    </TouchableOpacity>
                </View>

                <FlatList
                    data={slides}
                    renderItem={renderSlide}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    pagingEnabled
                    bounces={false}
                    keyExtractor={(item) => item.id}
                    onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
                        useNativeDriver: false,
                    })}
                    scrollEventThrottle={32}
                    onViewableItemsChanged={viewableItemsChanged}
                    viewabilityConfig={viewConfig}
                    ref={slidesRef}
                />

                <View className="items-center pb-16">
                    {/* DOTS PAGINATION */}
                    <View className="flex-row h-10 items-center justify-center mb-12">
                        {slides.map((_, i) => {
                            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
                            const dotWidth = scrollX.interpolate({
                                inputRange,
                                outputRange: [8, 28, 8],
                                extrapolate: 'clamp',
                            });
                            const opacity = scrollX.interpolate({
                                inputRange,
                                outputRange: [0.2, 1, 0.2],
                                extrapolate: 'clamp',
                            });

                            return (
                                <Animated.View
                                    key={i.toString()}
                                    style={{
                                        width: dotWidth,
                                        height: 8,
                                        borderRadius: 4,
                                        backgroundColor: slides[i].color,
                                        opacity,
                                        marginHorizontal: 4,
                                    }}
                                />
                            );
                        })}
                    </View>

                    {/* NEXT BUTTON */}
                    <TouchableOpacity
                        onPress={handleNext}
                        activeOpacity={0.9}
                        className="w-[80%] bg-[#FFC2AD] py-6 rounded-[22px] items-center shadow-2xl shadow-[#FFC2AD]/20"
                    >
                        <Text className="text-black font-black text-xl uppercase tracking-widest">
                            {currentIndex === slides.length - 1 ? t('get_started') : t('next')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
    );
}
