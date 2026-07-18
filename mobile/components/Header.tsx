import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { SquarePen, LayoutGrid } from 'lucide-react-native';
import { useMeetingRouter } from '@/hooks/useMeetingRouter';
import { BellIcon, CalendarDaysIcon } from 'react-native-heroicons/outline';
import { useQuery } from '@tanstack/react-query';
import { getMe } from '@/services/auth';
import { useNotificationsSocket } from '@/hooks/useNotificationsSocket';
import { useModuleSwitcher } from '@/contexts/ModuleSwitcherContext';
import { useAuth } from '@/hooks/useAuth';
import { CopilotStep } from 'react-native-copilot';
import { useTourStepAdvance } from '@/hooks/useTourStepAdvance';
import { WalkthroughableTouchable } from '@/components/onboarding/walkthroughable';

type Props = {
  title?: string;
  // Only set true on screens that mount this Header inside a CopilotProvider
  // (currently just the home tab) — CopilotStep internally calls useCopilot(),
  // which throws if there's no provider ancestor, so this must stay false on
  // every other screen that renders Header (community, training, certificate,
  // course-content).
  tourEnabled?: boolean;
};

export default function Header({ title, tourEnabled = false }: Props) {
  const router = useMeetingRouter();
  const { isDark, themeColors } = useTheme();
  const { open: openModuleSwitcher } = useModuleSwitcher();
  const { user: cachedUser } = useAuth();
  const previousUserIdRef = useRef<string | null>(null);
  const advanceProfile = useTourStepAdvance('header-profile');
  const advanceModuleSwitcher = useTourStepAdvance('header-module-switcher');
  const advanceStudyPlan = useTourStepAdvance('header-study-plan');
  const advanceNotifications = useTourStepAdvance('header-notifications');

  // fetch current user info for display
  const { data: userData } = useQuery<any>({
    queryKey: ['USER_INFO'],
    queryFn: getMe,
    gcTime: 0,
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  });

  // Detect user changes
  useEffect(() => {
    if (userData?.id) {
      if (
        previousUserIdRef.current &&
        previousUserIdRef.current !== userData.id
      ) {
        console.log(
          'User changed from',
          previousUserIdRef.current,
          'to',
          userData.id,
        );
      }
      previousUserIdRef.current = userData.id;
    }
  }, [userData?.id]);

  // fetch notifications via Socket (real-time) - only need unread count for badge
  const { unreadCount } = useNotificationsSocket();
  const { width: screenWidth } = useWindowDimensions();

  const isCompact = screenWidth < 360;
  const isVeryCompact = screenWidth < 340;
  const avatarSize = isVeryCompact ? 44 : isCompact ? 48 : 60;
  const iconSize = isVeryCompact ? 22 : isCompact ? 24 : 28;
  const bellSize = isVeryCompact ? 24 : isCompact ? 28 : 32;
  const actionGap = isCompact ? 4 : 8;
  const headerPadding = isCompact ? 8 : 4;

  // Prefer fresh API data, fall back to session cache (important on web right after login).
  const profile = userData ?? cachedUser;
  const fullName = profile?.fullNames || '';

  let displayName = fullName || 'User';
  if (isCompact && fullName) {
    const nameParts = fullName.trim().split(/\s+/);
    displayName =
      nameParts.length > 0 ? nameParts[nameParts.length - 1] : 'User';
  }

  const userRole = profile?.role ?? profile?.roles?.[0];
  const displayRole = ['TRAINEE', 'TESTER'].includes(String(userRole))
    ? 'Umujyanama'
    : userRole || 'CHW';
  const district = profile?.district ?? 'Kayonza';
  const subtitle = isVeryCompact ? displayRole : `${displayRole} | ${district}`;

  const dynamicStyles = {
    avatarContainer: {
      width: avatarSize,
      height: avatarSize,
      borderRadius: avatarSize / 2,
    },
    avatarImageWrapper: {
      width: avatarSize,
      height: avatarSize,
      borderRadius: avatarSize / 2,
    },
    avatarImage: {
      borderRadius: avatarSize / 2,
    },
    editButton: {
      width: Math.max(16, avatarSize * 0.33),
      height: Math.max(16, avatarSize * 0.33),
      borderRadius: Math.max(8, avatarSize * 0.17),
    },
    editIconSize: Math.max(12, avatarSize * 0.27),
    userName: {
      fontSize: isVeryCompact ? 12 : isCompact ? 12 : 14,
    },
    location: {
      fontSize: isVeryCompact ? 10 : isCompact ? 10 : 12,
    },
    notificationButton: {
      width: isCompact ? 34 : 40,
      height: isCompact ? 34 : 40,
      borderRadius: isCompact ? 17 : 20,
    },
  };

  return (
    <SafeAreaView
      edges={['top']}
      style={{ backgroundColor: isDark ? '#312e81' : themeColors.primary }}
    >
      <LinearGradient
        colors={
          isDark
            ? ['#312e81', '#1e1b4b']
            : [themeColors.primary, themeColors.primary]
        }
        style={[styles.header, { paddingHorizontal: headerPadding }]}
      >
        <View style={styles.profileSection}>
          <View style={styles.profileInfo}>
            <View style={[styles.avatarContainer, dynamicStyles.avatarContainer]}>
              {tourEnabled ? (
                <CopilotStep
                  text="Iyi ni ifoto yawe. Kanda hano kugira ngo urebe cyangwa uhindure umwirondoro wawe."
                  order={1}
                  name="header-profile"
                >
                  <WalkthroughableTouchable
                    style={[styles.avatarImageWrapper, dynamicStyles.avatarImageWrapper]}
                    onPress={advanceProfile(() => router.push('/profile'))}
                    accessibilityLabel="View profile"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Image
                      source={{
                        uri:
                          profile?.photo ??
                          'https://img.freepik.com/premium-vector/user-profile-icon-flat-style-member-avatar-vector-illustration-isolated-background-human-permission-sign-business-concept_157943-15752.jpg',
                      }}
                      style={[styles.avatarImage, dynamicStyles.avatarImage]}
                    />
                  </WalkthroughableTouchable>
                </CopilotStep>
              ) : (
                <TouchableOpacity
                  style={[styles.avatarImageWrapper, dynamicStyles.avatarImageWrapper]}
                  onPress={() => router.push('/profile')}
                  accessibilityLabel="View profile"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Image
                    source={{
                      uri:
                        profile?.photo ??
                        'https://img.freepik.com/premium-vector/user-profile-icon-flat-style-member-avatar-vector-illustration-isolated-background-human-permission-sign-business-concept_157943-15752.jpg',
                    }}
                    style={[styles.avatarImage, dynamicStyles.avatarImage]}
                  />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.editButton,
                  dynamicStyles.editButton,
                  {
                    borderColor: themeColors.primary,
                    backgroundColor: '#ffffff',
                  },
                ]}
                onPress={() => router.push('/profile')}
                accessibilityLabel="Edit profile"
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <SquarePen
                  size={dynamicStyles.editIconSize}
                  color={isDark ? '#111827' : themeColors.primary}
                />
              </TouchableOpacity>
            </View>
            <View style={styles.profileText}>
              <Text
                style={[styles.userName, dynamicStyles.userName, { fontFamily: 'Inter-SemiBold' }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {displayName}
              </Text>
              <Text
                style={[styles.location, dynamicStyles.location, { fontFamily: 'Inter-Regular' }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {subtitle}
              </Text>
            </View>
          </View>
          <View style={[styles.rightActions, { gap: actionGap }]}>
            {tourEnabled ? (
              <CopilotStep
                text="Koresha iyi buto kugira ngo uhindukirire izindi porogaramu zikorera kuri sisitemu imwe."
                order={2}
                name="header-module-switcher"
              >
                <WalkthroughableTouchable
                  style={styles.actionButton}
                  onPress={advanceModuleSwitcher(openModuleSwitcher)}
                  accessibilityLabel="Switch application"
                >
                  <LayoutGrid size={iconSize} color="white" />
                </WalkthroughableTouchable>
              </CopilotStep>
            ) : (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={openModuleSwitcher}
                accessibilityLabel="Switch application"
              >
                <LayoutGrid size={iconSize} color="white" />
              </TouchableOpacity>
            )}
            {tourEnabled ? (
              <CopilotStep
                text="Kanda hano kugira ngo urebe gahunda yawe y'amasomo."
                order={3}
                name="header-study-plan"
              >
                <WalkthroughableTouchable
                  style={styles.actionButton}
                  onPress={advanceStudyPlan(() => {
                    router.push('/auth/study-plan');
                  })}
                >
                  <CalendarDaysIcon size={bellSize} color="white" />
                </WalkthroughableTouchable>
              </CopilotStep>
            ) : (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  router.push('/auth/study-plan');
                }}
              >
                <CalendarDaysIcon size={bellSize} color="white" />
              </TouchableOpacity>
            )}
            {tourEnabled ? (
              <CopilotStep
                text="Hano ni ho uzabona amatangazo n'ubutumwa bushya. Umubare ugaragara ku ipima ugaragaza ubutumwa utarasoma."
                order={4}
                name="header-notifications"
              >
                <WalkthroughableTouchable
                  style={[styles.notificationButton, dynamicStyles.notificationButton]}
                  onPress={advanceNotifications(() => router.push('/notifications'))}
                >
                  <BellIcon size={bellSize} color="white" />
                  {unreadCount > 0 && (
                    <View
                      style={[
                        styles.badge,
                        {
                          borderColor: isDark ? '#312e81' : themeColors.primary,
                        },
                      ]}
                    >
                      <Text style={styles.badgeText}>
                        {unreadCount > 9 ? '9+' : unreadCount.toString()}
                      </Text>
                    </View>
                  )}
                </WalkthroughableTouchable>
              </CopilotStep>
            ) : (
              <TouchableOpacity
                style={[styles.notificationButton, dynamicStyles.notificationButton]}
                onPress={() => router.push('/notifications')}
              >
                <BellIcon size={bellSize} color="white" />
                {unreadCount > 0 && (
                  <View
                    style={[
                      styles.badge,
                      {
                        borderColor: isDark ? '#312e81' : themeColors.primary,
                      },
                    ]}
                  >
                    <Text style={styles.badgeText}>
                      {unreadCount > 9 ? '9+' : unreadCount.toString()}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {title ? (
          <Text style={[styles.headerTitle, { fontFamily: 'Inter-SemiBold' }]}>
            {title}
          </Text>
        ) : null}
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    width: '100%',
    minHeight: 88,
    paddingBottom: 2,
    justifyContent: 'flex-end',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 4,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  profileText: {
    flex: 1,
    minWidth: 0,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  actionButton: {
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 12,
    color: '#ffffff',
    marginTop: 6,
    textAlign: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
  },
  avatarContainer: {
    overflow: 'visible',
    position: 'relative',
    flexShrink: 0,
  },
  avatarImageWrapper: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  editIcon: {
    fontSize: 14,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  location: {
    color: 'rgba(255,255,255,0.8)',
  },
  right: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
  },
  userName: {
    color: 'white',
  },
  notificationButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 14,
    color: 'white',
    marginTop: 0,
    textAlign: 'center',
  },
});
