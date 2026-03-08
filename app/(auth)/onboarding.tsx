import React, { useState, useRef, useContext } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Dimensions,
    TouchableOpacity,
    Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from '../../src/i18n/useTranslation';
import { useAuthStore } from '../../src/store/useAuthStore';
import { ThemeContext } from '../../src/contexts/ThemeContext';
import { Calendar, Shield, TrendingUp } from 'lucide-react-native';

const { width, height } = Dimensions.get('window');

interface OnboardingSlide {
    id: string;
    titleKey: string;
    subtitleKey: string;
    Icon: any;
    color: string;
}

const slides: OnboardingSlide[] = [
    {
        id: '1',
        titleKey: 'onboarding_title_1',
        subtitleKey: 'onboarding_subtitle_1',
        Icon: Calendar,
        color: '#2563EB',
    },
    {
        id: '2',
        titleKey: 'onboarding_title_2',
        subtitleKey: 'onboarding_subtitle_2',
        Icon: Shield,
        color: '#10B981',
    },
    {
        id: '3',
        titleKey: 'onboarding_title_3',
        subtitleKey: 'onboarding_subtitle_3',
        Icon: TrendingUp,
        color: '#8B5CF6',
    },
];

export default function OnboardingScreen() {
    const { t } = useTranslation();
    const router = useRouter();
    const setHasSeenOnboarding = useAuthStore((state) => state.setHasSeenOnboarding);
    const themeCtx = useContext(ThemeContext);
    const isDark = themeCtx?.activeTheme === 'dark';

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
                <View
                    style={{ backgroundColor: item.color + '20' }}
                    className="w-40 h-40 rounded-full items-center justify-center mb-10"
                >
                    <item.Icon size={80} color={item.color} />
                </View>
                <Text className="text-3xl font-black text-gray-900 dark:text-white text-center mb-4">
                    {t(item.titleKey)}
                </Text>
                <Text className="text-lg text-gray-500 dark:text-gray-400 text-center leading-6">
                    {t(item.subtitleKey)}
                </Text>
            </View>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-gray-950">
            <View className="flex-row justify-end px-6 pt-4">
                <TouchableOpacity onPress={handleSkip}>
                    <Text className="text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest text-xs">
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

            <View className="items-center pb-20">
                {/* DOTS PAGINATION */}
                <View className="flex-row h-10 items-center justify-center mb-10">
                    {slides.map((_, i) => {
                        const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
                        const dotWidth = scrollX.interpolate({
                            inputRange,
                            outputRange: [10, 24, 10],
                            extrapolate: 'clamp',
                        });
                        const opacity = scrollX.interpolate({
                            inputRange,
                            outputRange: [0.3, 1, 0.3],
                            extrapolate: 'clamp',
                        });

                        return (
                            <Animated.View
                                key={i.toString()}
                                style={{
                                    width: dotWidth,
                                    height: 10,
                                    borderRadius: 5,
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
                    activeOpacity={0.8}
                    style={{ backgroundColor: slides[currentIndex].color }}
                    className="px-12 py-4 rounded-2xl shadow-lg shadow-black/10"
                >
                    <Text className="text-white font-bold text-lg">
                        {currentIndex === slides.length - 1 ? t('get_started') : t('next')}
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}
