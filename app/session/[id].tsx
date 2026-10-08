import { CommunityButton } from '../../src/components/community/CommunityUI';
import { cityLabel } from '../../src/utils/cities';
import { FeeAgreementCard } from '../../src/components/sessions/FeeAgreementCard';
import { useUpdateSessionMutation } from '../../src/hooks/useSessionsQuery';
import { agreementAmount } from '../../src/utils/feeAgreement';
import { sessionPhase } from '../../src/utils/sessionWorkflow';
import { sessionDisplayTitle } from '../../src/utils/sessionNaming';
import { useSessionDeletion } from '../../src/hooks/useSessionDeletion';
import { SessionPayments } from '../../src/components/sessions/SessionPayments';
import { SessionCollaborationDetails } from '../../src/components/sessions/SessionCollaborationDetails';
import { SessionCommunitySharing } from '../../src/components/community/SessionCommunitySharing';
import { sessionDuration } from '../../src/utils/sessionPlanning';
import { SessionStatusBadge } from '../../src/components/sessions/SessionStatusBadge';
import { FEATURES } from '../../src/config/features';
import React, { useContext, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    ActivityIndicator,
    TouchableOpacity,
    Alert,
    Share,
    Image,
    Modal,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter, Redirect } from 'expo-router';
import {
    useSessionByIdQuery,
    useUpdateSessionColorMutation,
} from '../../src/hooks/useSessionsQuery';
import {
    Calendar,
    Trash2,
    Share2,
    ChevronLeft,
    Palette,
    X,
    Pencil,
    ArrowRight,
    Folder,
    Plus,
} from 'lucide-react-native';
import {
    useVaultFoldersByAssociationQuery,
    useCreateFolderMutation,
} from '../../src/hooks/useVaultQuery';
import { useAuthStore } from '../../src/store/useAuthStore';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from '../../src/i18n/useTranslation';
import { exportSessionCalendar } from '../../src/services/calendarExport';
import { ThemeContext } from '../../src/contexts/ThemeContext';

export default function SessionDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { t, currentLanguage } = useTranslation();
    const themeCtx = useContext(ThemeContext);
    const { session: authSession } = useAuthStore();

    const isDark = themeCtx?.activeTheme === 'dark';

    const {
        data: session,
        isLoading,
        error,
    } = useSessionByIdQuery(id as string);
    const agreementUpdate = useUpdateSessionMutation();
    const deletion = useSessionDeletion(() => router.replace('/(tabs)/home'));
    const updateColorMutation = useUpdateSessionColorMutation();

    const { data: associatedFolders = [], isLoading: isLoadingFolders } =
        useVaultFoldersByAssociationQuery('session', id as string);
    const createFolderMutation = useCreateFolderMutation();

    const [isExporting, setIsExporting] = useState(false);
    const [isColorModalVisible, setIsColorModalVisible] = useState(false);

    const handleDelete = () => {
        if (session) deletion.requestDelete(session);
    };

    const handleShare = async () => {
        if (!session) return;
        try {
            const message = `${sessionDisplayTitle(session, t)}\n📍 ${session.venue}\n📅 ${capitalizedDate}\n⏰ ${session.start_time} - ${session.end_time}`;
            await Share.share({ message });
        } catch (error) {
            console.error('Error sharing session:', error);
        }
    };

    const handleCalendarExport = async () => {
        if (!session || isExporting) return;
        setIsExporting(true);
        try {
            await exportSessionCalendar(session);
        } catch {
            Alert.alert(t('error'), t('calendar_export_error'));
        } finally {
            setIsExporting(false);
        }
    };

    if (!authSession) return <Redirect href="/(auth)/login" />;

    if (isLoading) {
        return (
            <View className="flex-1 bg-white dark:bg-gray-950 items-center justify-center">
                <ActivityIndicator
                    size="large"
                    color={isDark ? '#60A5FA' : '#3B82F6'}
                />
            </View>
        );
    }

    if (error || !session) {
        return (
            <SafeAreaView className="flex-1 bg-white dark:bg-gray-950 items-center justify-center p-6">
                <Text className="text-xl font-bold text-red-500 mb-2">
                    Error
                </Text>
                <Text className="text-gray-500 dark:text-gray-400 mb-6 text-center">
                    {t('error_loading_session') ||
                        'No pudimos cargar la información de esta sesión.'}
                </Text>
                <TouchableOpacity
                    className="bg-black dark:bg-blue-600 px-8 py-4 rounded-2xl shadow-lg"
                    onPress={() => router.back()}
                >
                    <Text className="text-white font-bold">
                        {t('go_back') || 'Volver atrás'}
                    </Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    const [y, m, d] = session.date.split('-');
    const sessionDateObj = new Date(Number(y), Number(m) - 1, Number(d));
    const formattedDate = sessionDateObj.toLocaleDateString(currentLanguage, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
    const capitalizedDate =
        formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

    const duration = sessionDuration(session);

    return (
        <SafeAreaView
            className="flex-1 bg-white dark:bg-gray-950"
            edges={['top', 'bottom']}
        >
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View className="flex-row items-center justify-between px-6 py-4">
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="w-10 h-10 items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-full"
                >
                    <ChevronLeft
                        size={24}
                        color={isDark ? '#FFFFFF' : '#111827'}
                    />
                </TouchableOpacity>
                <View className="flex-row items-center space-x-3">
                    {!session.is_guest && (
                        <TouchableOpacity
                            onPress={() => router.push(`/edit-session/${id}`)}
                            className="p-2"
                            activeOpacity={0.7}
                        >
                            <Pencil
                                size={22}
                                color={isDark ? '#D1D5DB' : '#4B5563'}
                                strokeWidth={1.5}
                            />
                        </TouchableOpacity>
                    )}

                    {!session.is_guest && (
                        <TouchableOpacity
                            onPress={() => setIsColorModalVisible(true)}
                            className="p-2"
                            activeOpacity={0.7}
                        >
                            <Palette
                                size={22}
                                color={
                                    session.color ||
                                    (isDark ? '#D1D5DB' : '#4B5563')
                                }
                                strokeWidth={1.5}
                            />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        onPress={handleShare}
                        className="p-2"
                        activeOpacity={0.7}
                    >
                        <Share2
                            size={20}
                            color={isDark ? '#D1D5DB' : '#4B5563'}
                            strokeWidth={1.5}
                        />
                    </TouchableOpacity>
                    {!session.is_guest && (
                        <TouchableOpacity
                            onPress={handleDelete}
                            disabled={deletion.isDeleting}
                            accessibilityRole="button"
                            accessibilityLabel={t('delete_session_title')}
                            className="w-10 h-10 items-center justify-center bg-red-50 dark:bg-red-900/20 rounded-full"
                        >
                            <Trash2 size={20} color="#EF4444" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <ScrollView
                className="flex-1"
                contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
            >
                {(FEATURES.feeAgreements ||
                    session.fee_agreement?.version === 2) &&
                    !session.is_guest &&
                    session.fee_agreement && (
                        <View style={{ marginTop: 24 }}>
                            <FeeAgreementCard
                                value={session.fee_agreement}
                                documentSession={session}
                                names={session.djs || []}
                                currency={session.currency}
                                canSettle={sessionPhase(session) === 'finished'}
                                onChange={(a) =>
                                    agreementUpdate.mutateAsync({
                                        sessionId: session.id,
                                        input: {
                                            fee_agreement: a,
                                            earning_amount: agreementAmount(a),
                                        },
                                        updateAll: false,
                                    })
                                }
                            />
                        </View>
                    )}
                {!session.is_guest &&
                    session.user_id === authSession.user.id && (
                        <View style={{ marginBottom: 20, gap: 10 }}>
                            <CommunityButton
                                secondary
                                label={t('tickets.manage')}
                                onPress={() =>
                                    router.push({
                                        pathname: '/tickets',
                                        params: { sessionId: session.id },
                                    })
                                }
                            />
                            <CommunityButton
                                secondary
                                label={t('guests.manage')}
                                onPress={() =>
                                    router.push({
                                        pathname: '/guests',
                                        params: { sessionId: session.id },
                                    })
                                }
                            />
                        </View>
                    )}
                {!session.is_guest &&
                    session.user_id === authSession.user.id && (
                        <View
                            style={{
                                gap: 10,
                                marginBottom: 20,
                                flexDirection: 'row',
                            }}
                        >
                            <View style={{ flex: 1 }}>
                                <CommunityButton
                                    secondary
                                    label={t('tools.expenses')}
                                    onPress={() =>
                                        router.push({
                                            pathname: '/expenses',
                                            params: { sessionId: session.id },
                                        })
                                    }
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <CommunityButton
                                    secondary
                                    label={t('tools.preparation')}
                                    onPress={() =>
                                        router.push({
                                            pathname: '/preparation',
                                            params: { sessionId: session.id },
                                        })
                                    }
                                />
                            </View>
                        </View>
                    )}
                {/* Title Section */}
                <View className="mb-6">
                    <View className="flex-row items-center justify-between mb-2">
                        <Text className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                            {t('session_summary_label') ||
                                'Resumen de la sesión'}
                        </Text>
                        <SessionStatusBadge session={session} />
                    </View>
                    <Text className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">
                        {sessionDisplayTitle(session, t)}
                    </Text>
                </View>

                <TouchableOpacity
                    onPress={handleCalendarExport}
                    disabled={isExporting}
                    accessibilityRole="button"
                    className="mb-6 py-4 px-5 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex-row items-center gap-3"
                >
                    <Calendar
                        size={22}
                        color={isDark ? '#60A5FA' : '#2563EB'}
                    />
                    <View className="flex-1">
                        <Text className="font-bold text-blue-700 dark:text-blue-300">
                            {t('calendar_export')}
                        </Text>
                        <Text className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                            {t('calendar_export_hint')}
                        </Text>
                    </View>
                    {isExporting && <ActivityIndicator />}
                </TouchableOpacity>

                {/* Poster Display */}
                {session.poster_url && (
                    <View className="mb-6 rounded-3xl overflow-hidden border border-gray-100 dark:border-gray-800 shadow-sm">
                        <Image
                            source={{ uri: session.poster_url }}
                            className="w-full aspect-[3/4]"
                            resizeMode="contain"
                        />
                    </View>
                )}

                {!session.is_guest && <SessionPayments session={session} />}
                {/* Venue Section */}
                <TouchableOpacity
                    onPress={() => {
                        if (session.venue_id) {
                            router.push(`/venue/${session.venue_id}`);
                        }
                    }}
                    disabled={!session.venue_id || session.is_guest}
                    className="bg-gray-50 dark:bg-gray-900 rounded-3xl p-6 flex-row items-center mb-6"
                    activeOpacity={session.venue_id ? 0.7 : 1}
                >
                    <View className="flex-1">
                        <Text className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">
                            {t('venue') || 'Ubicación'}
                        </Text>
                        <Text className="text-lg font-bold text-gray-900 dark:text-white">
                            {session.venue}
                        </Text>
                        {!!session.venue_city && (
                            <Text
                                style={{
                                    color: isDark ? '#a8b2c6' : '#6d7588',
                                    marginTop: 6,
                                }}
                            >
                                {cityLabel(
                                    session.venue_city,
                                    session.venue_city_location,
                                )}
                            </Text>
                        )}
                        {!!session.venue_address && (
                            <Text
                                style={{
                                    color: isDark ? '#a8b2c6' : '#6d7588',
                                    marginTop: 4,
                                }}
                            >
                                {session.venue_address}
                            </Text>
                        )}
                    </View>
                    {session.venue_id && (
                        <ArrowRight
                            size={20}
                            color={isDark ? '#4B5563' : '#D1D5DB'}
                        />
                    )}
                </TouchableOpacity>

                {/* Details Section */}
                <View className="bg-gray-50 dark:bg-gray-900 rounded-3xl p-8">
                    <Text className="text-xl font-black text-gray-900 dark:text-white mb-10">
                        {t('session_detail_header') || 'Detalle de la sesión'}
                    </Text>

                    <View className="space-y-12">
                        <View className="flex-row justify-between items-center">
                            <Text className="text-base text-gray-500 dark:text-gray-400 font-medium">
                                {t('date') || 'Fecha'}
                            </Text>
                            <Text className="text-base text-gray-900 dark:text-white font-bold">
                                {capitalizedDate}
                            </Text>
                        </View>

                        <View className="flex-row justify-between items-center">
                            <Text className="text-base text-gray-500 dark:text-gray-400 font-medium">
                                {t('time_label') || 'Horario'}
                            </Text>
                            <Text className="text-base text-gray-900 dark:text-white font-bold">
                                {session.start_time} — {session.end_time}
                                {session.booking_timezone
                                    ? ` · ${session.booking_timezone}`
                                    : ''}
                            </Text>
                        </View>

                        <View className="flex-row justify-between items-center">
                            <Text className="text-base text-gray-500 dark:text-gray-400 font-medium">
                                {t('duration') || 'Duración'}
                            </Text>
                            <Text className="text-base text-gray-900 dark:text-white font-bold">
                                {duration.toFixed(1)} h
                            </Text>
                        </View>

                        <View className="flex-row justify-between items-center">
                            <Text className="text-base text-gray-500 dark:text-gray-400 font-medium">
                                {t('djs_label') || 'DJs'}
                            </Text>
                            <Text
                                className="text-base text-gray-900 dark:text-white font-bold text-right flex-1 ml-4"
                                numberOfLines={2}
                            >
                                {session.is_collective &&
                                session.djs &&
                                session.djs.length > 0
                                    ? (t('shared_with_prefix') || 'Junto a ') +
                                      session.djs.join(', ')
                                    : t('solo_me') || 'Solo yo'}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* VAULT SECTION (MOVED TO BOTTOM) */}
                {FEATURES.documents && (
                    <>
                        <View className="mt-8 px-2">
                            <View className="flex-row items-center justify-between mb-4">
                                <View className="flex-row items-center">
                                    <View className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/20 items-center justify-center mr-3">
                                        <Folder size={18} color="#2563EB" />
                                    </View>
                                    <Text className="text-lg font-bold text-gray-900 dark:text-white">
                                        {t('session_vault') ||
                                            'Documentos y Carpetas'}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => {
                                        Alert.prompt(
                                            t('new_folder') || 'Nueva Carpeta',
                                            t('folder_name_placeholder') ||
                                                'Ejem: Contratos, Riders...',
                                            [
                                                {
                                                    text: t('cancel'),
                                                    style: 'cancel',
                                                },
                                                {
                                                    text: t('create'),
                                                    onPress: (
                                                        name?: string,
                                                    ) => {
                                                        if (name)
                                                            createFolderMutation.mutate(
                                                                {
                                                                    name,
                                                                    type: 'session',
                                                                    associatedId:
                                                                        id as string,
                                                                },
                                                            );
                                                    },
                                                },
                                            ],
                                        );
                                    }}
                                    className="flex-row items-center bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg"
                                >
                                    <Plus
                                        size={14}
                                        color="#2563EB"
                                        className="mr-1"
                                    />
                                    <Text className="text-xs font-bold text-blue-600 dark:text-blue-400">
                                        {t('add_folder') || 'Añadir'}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {isLoadingFolders ? (
                                <ActivityIndicator
                                    size="small"
                                    color="#2563EB"
                                />
                            ) : associatedFolders.length > 0 ? (
                                <View className="gap-2">
                                    {associatedFolders.map((folder) => (
                                        <TouchableOpacity
                                            key={folder.id}
                                            onPress={() =>
                                                router.push(
                                                    `/vault/${folder.id}?name=${encodeURIComponent(folder.name)}` as any,
                                                )
                                            }
                                            className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4 rounded-xl flex-row items-center justify-between shadow-sm shadow-black/5"
                                        >
                                            <View className="flex-row items-center">
                                                <Folder
                                                    size={20}
                                                    color="#2563EB"
                                                    fill="#2563EB"
                                                    fillOpacity={0.1}
                                                />
                                                <Text className="text-sm font-bold text-gray-900 dark:text-white ml-3">
                                                    {folder.name}
                                                </Text>
                                            </View>
                                            <ChevronLeft
                                                size={16}
                                                color={
                                                    isDark
                                                        ? '#4B5563'
                                                        : '#9CA3AF'
                                                }
                                                style={{
                                                    transform: [
                                                        { rotate: '180deg' },
                                                    ],
                                                }}
                                            />
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            ) : (
                                <TouchableOpacity
                                    onPress={() => {
                                        Alert.prompt(
                                            t('new_folder') || 'Nueva Carpeta',
                                            t('folder_name_placeholder') ||
                                                'Ejem: Contratos, Riders...',
                                            [
                                                {
                                                    text: t('cancel'),
                                                    style: 'cancel',
                                                },
                                                {
                                                    text: t('create'),
                                                    onPress: (
                                                        name?: string,
                                                    ) => {
                                                        if (name)
                                                            createFolderMutation.mutate(
                                                                {
                                                                    name,
                                                                    type: 'session',
                                                                    associatedId:
                                                                        id as string,
                                                                },
                                                            );
                                                    },
                                                },
                                            ],
                                        );
                                    }}
                                    className="bg-gray-50 dark:bg-gray-950/50 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl p-8 items-center"
                                >
                                    <Text className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-3 text-center">
                                        {t('no_associated_folders') ||
                                            'No hay carpetas para esta sesión.\nCrea una para guardar contratos o riders.'}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </>
                )}
                <SessionCollaborationDetails session={session} />
                {!session.is_guest && (
                    <SessionCommunitySharing session={session} />
                )}
            </ScrollView>

            {/* Color Modal */}
            <Modal
                visible={isColorModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setIsColorModalVisible(false)}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-white dark:bg-gray-900 rounded-t-[40px] px-6 pt-8 pb-12">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-2xl font-black text-gray-900 dark:text-white">
                                {t('choose_color') || 'Elige un color'}
                            </Text>
                            <TouchableOpacity
                                onPress={() => setIsColorModalVisible(false)}
                                className="w-10 h-10 items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-full"
                            >
                                <X
                                    size={20}
                                    color={isDark ? '#F9FAFB' : '#111827'}
                                />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View className="flex-row flex-wrap justify-between gap-y-4">
                                {[
                                    {
                                        color: '#262626',
                                        name:
                                            t('color_default') ||
                                            'Color predeterminado',
                                    },
                                    {
                                        color: '#EF4444',
                                        name: t('color_tomato'),
                                    },
                                    {
                                        color: '#F97316',
                                        name: t('color_tangerine'),
                                    },
                                    {
                                        color: '#FBBF24',
                                        name: t('color_banana'),
                                    },
                                    {
                                        color: '#10B981',
                                        name: t('color_basil'),
                                    },
                                    { color: '#34D399', name: t('color_sage') },
                                    {
                                        color: '#0EA5E9',
                                        name: t('color_peacock'),
                                    },
                                    {
                                        color: '#3B82F6',
                                        name: t('color_blueberry'),
                                    },
                                    {
                                        color: '#8B5CF6',
                                        name: t('color_lavender'),
                                    },
                                    {
                                        color: '#9333EA',
                                        name: t('color_grape'),
                                    },
                                    {
                                        color: '#F43F5E',
                                        name: t('color_flamingo'),
                                    },
                                    {
                                        color: '#6B7280',
                                        name: t('color_graphite'),
                                    },
                                ].map((item) => {
                                    const isSelected =
                                        (session.color || '#262626') ===
                                        item.color;
                                    return (
                                        <TouchableOpacity
                                            key={item.color}
                                            activeOpacity={0.7}
                                            onPress={() => {
                                                if (
                                                    !session.parent_session_id &&
                                                    (!session.recurrence_type ||
                                                        session.recurrence_type ===
                                                            'none')
                                                ) {
                                                    updateColorMutation.mutate({
                                                        sessionId: id as string,
                                                        color: item.color,
                                                        updateAll: false,
                                                    });
                                                    setIsColorModalVisible(
                                                        false,
                                                    );
                                                    return;
                                                }
                                                Alert.alert(
                                                    t('workflow.seriesTitle'),
                                                    t('workflow.seriesChoice'),
                                                    [
                                                        {
                                                            text: t('cancel'),
                                                            style: 'cancel',
                                                        },
                                                        {
                                                            text: t(
                                                                'apply_only_this',
                                                            ),
                                                            onPress: () => {
                                                                updateColorMutation.mutate(
                                                                    {
                                                                        sessionId:
                                                                            id as string,
                                                                        color: item.color,
                                                                        updateAll: false,
                                                                    },
                                                                );
                                                                setIsColorModalVisible(
                                                                    false,
                                                                );
                                                            },
                                                        },
                                                        {
                                                            text: t(
                                                                'workflow.following',
                                                            ),
                                                            onPress: () => {
                                                                updateColorMutation.mutate(
                                                                    {
                                                                        sessionId:
                                                                            id as string,
                                                                        color: item.color,
                                                                        updateAll: true,
                                                                    },
                                                                );
                                                                setIsColorModalVisible(
                                                                    false,
                                                                );
                                                            },
                                                        },
                                                    ],
                                                );
                                            }}
                                            className={`w-[48%] flex-row items-center p-3 rounded-2xl border ${
                                                isSelected
                                                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                                                    : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-800'
                                            }`}
                                        >
                                            <View
                                                className="w-5 h-5 rounded-full mr-3 border border-black/5"
                                                style={{
                                                    backgroundColor: item.color,
                                                }}
                                            />
                                            <Text
                                                className={`text-sm flex-1 ${isSelected ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-900 dark:text-white font-medium'}`}
                                                numberOfLines={1}
                                            >
                                                {item.name}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
            {deletion.dialog}
        </SafeAreaView>
    );
}
