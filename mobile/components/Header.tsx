import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
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

type Props = {
  title?: string;
};

export default function Header({ title }: Props) {
  const router = useMeetingRouter();
  const { isDark, themeColors } = useTheme();
  const { open: openModuleSwitcher } = useModuleSwitcher();
  const previousUserIdRef = useRef<string | null>(null);

  // fetch current user info for display
  const { data: userData } = useQuery<any>({
    queryKey: ['USER_INFO'],
    queryFn: getMe,
    gcTime: 0,
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

  // Split name and get last part for small devices
  const fullName = userData?.fullNames || '';

  let displayName;
  const screenWidth = Dimensions.get('window').width;
  const isSmallDevice = screenWidth < 350;

  if (isSmallDevice && fullName) {
    const nameParts = fullName.trim().split(/\s+/);
    displayName =
      nameParts.length > 0 ? nameParts[nameParts.length - 1] : 'User';
  } else {
    displayName = fullName || 'User';
  }

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
        style={styles.header}
      >
        <View style={styles.profileSection}>
          <View style={styles.profileInfo}>
            <View style={styles.avatarContainer}>
              <TouchableOpacity
                style={styles.avatarImageWrapper}
                onPress={() => router.push('/profile')}
                accessibilityLabel="View profile"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Image
                  source={{
                    uri:
                      userData?.photo ??
                      'https://img.freepik.com/premium-vector/user-profile-icon-flat-style-member-avatar-vector-illustration-isolated-background-human-permission-sign-business-concept_157943-15752.jpg',
                  }}
                  style={styles.avatarImage}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.editButton,
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
                  size={16}
                  color={isDark ? '#111827' : themeColors.primary}
                />
              </TouchableOpacity>
            </View>
            <View>
              <Text style={[styles.userName, { fontFamily: 'Inter-SemiBold' }]}>
                {displayName}
              </Text>
              <Text style={[styles.location, { fontFamily: 'Inter-Regular' }]}>
                {(() => {
                  const userRole = userData?.role ?? userData?.roles?.[0];
                  const displayRole = ['TRAINEE', 'TESTER'].includes(
                    String(userRole),
                  )
                    ? 'Umujyanama'
                    : userRole || 'CHW';
                  return `${displayRole} | ${userData?.district ?? 'Kayonza'}`;
                })()}
              </Text>
            </View>
          </View>

          <View style={styles.rightActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={openModuleSwitcher}
              accessibilityLabel="Switch application"
            >
              <LayoutGrid size={28} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                router.push('/auth/study-plan');
              }}
            >
              <CalendarDaysIcon size={32} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.notificationButton}
              onPress={() => router.push('/notifications')}
            >
              <BellIcon size={32} color="white" />
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
    minHeight: 96,
    paddingHorizontal: 4,
    paddingBottom: 2,
    justifyContent: 'flex-end',
  },
  profileSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 7,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 3,
    justifyContent: 'flex-end',
  },
  actionButton: {
    minWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 1,
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
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'visible',
    position: 'relative',
  },
  avatarImageWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
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
    borderRadius: 30,
  },
  location: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  right: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
  },
  userName: {
    fontSize: 14,
    color: 'white',
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
