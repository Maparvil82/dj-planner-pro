import React, { useState, useRef } from 'react';
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
import { ArrowRight } from 'lucide-react-native';

const { width } = Dimensions.get('window');

interface OnboardingSlide {
    id: string;
    titleKey: string;
    subtitleKey: string;
    image: any;
}

const slides: OnboardingSlide[] = [
    {
        id: '1',
        titleKey: 'onboarding_title_1',
        subtitleKey: 'onboarding_subtitle_1',
        image: require('../../assets/onboarding/onboarding_1_new.png'),
    },
    {
        id: '2',
        titleKey: 'onboarding_title_2',
        subtitleKey: 'onboarding_subtitle_2',
        image: require('../../assets/onboarding/onboarding_2_new.png'),
    },
    {
        id: '3',
        titleKey: 'onboarding_title_3',
        subtitleKey: 'onboarding_subtitle_3',
        image: require('../../assets/onboarding/onboarding_3_new.png'),
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
                <View className="w-full aspect-square max-w-[340px] items-center justify-center mb-12">
                    <Image
                        source={item.image}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="contain"
                    />
                </View>
                <View className="items-center">
                    <Text className="text-4xl font-semibold text-black text-center mb-4 tracking-tight">
                        {t(item.titleKey).replace(/\|/g, '')}
                    </Text>
                    <Text className="text-lg text-gray-500 text-center leading-7 px-4">
                        {t(item.subtitleKey)}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <View className="flex-1 bg-white">
            <SafeAreaView className="flex-1">
                <View className="flex-row justify-between items-center px-8 pt-6">
                    <View style={{ width: 40 }} />
                    <TouchableOpacity onPress={handleSkip}>
                        <Text className="text-gray-400 font-medium tracking-tight">
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

                <View className="items-center pb-12">
                    {/* DOTS PAGINATION */}
                    <View className="flex-row h-10 items-center justify-center mb-10">
                        {slides.map((_, i) => {
                            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
                            const opacity = scrollX.interpolate({
                                inputRange,
                                outputRange: [0.2, 1, 0.2],
                                extrapolate: 'clamp',
                            });

                            return (
                                <Animated.View
                                    key={i.toString()}
                                    style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: 4,
                                        backgroundColor: '#000',
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
                        activeOpacity={0.8}
                        className="w-[85%] bg-black py-5 rounded-full flex-row items-center justify-center shadow-lg"
                    >
                        <Text className="text-white font-semibold text-lg mr-2">
                            {currentIndex === slides.length - 1 ? t('get_started') : t('next')}
                        </Text>
                        <ArrowRight size={20} color="white" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => router.push('/login')}
                        className="mt-6"
                    >
                        <Text className="text-gray-500 font-medium">
                            {t('already_have_account')} <Text className="text-black font-bold">{t('login')}</Text>
                        </Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
    );
}
