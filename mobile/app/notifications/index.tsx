/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
} from 'react-native';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useNotificationsSocket } from '@/hooks/useNotificationsSocket';
import { ArrowLeft, Search, Filter } from 'lucide-react-native';
import NotificationCard from '@/components/notifications/NotificationCard';
import NotificationFilters from '@/components/notifications/NotificationFilters';
import NotificationEmpty from '@/components/notifications/NotificationEmpty';
import BulkActionsBar from '@/components/notifications/BulkActionsBar';
import FilterBottomSheet from '@/components/notifications/FilterBottomSheet';
import { INotification } from '@/types';
import { useNotificationFilters } from '@/hooks/useNotificationFilters';
import { useNotificationSearch } from '@/hooks/useNotificationSearch';
import { isValidMeetingUrl, extractMeetingId } from '@/utils/deepLinking';

type FilterType = 'all' | 'unread' | 'read';
type NotificationType = 'all' | 'calendar' | 'course' | 'message' | 'alert' | 'system';

export default function NotificationsPage() {
  const router = useRouter();
  const { isDark, themeColors } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [activeType, setActiveType] = useState<NotificationType>('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Get notifications from socket
  const {
    notifications,
    unreadCount,
    connected,
    markAsRead,
    deleteNotification,
    markAllAsRead,
  } = useNotificationsSocket();

  // Apply filters and search
  const { filteredNotifications } = useNotificationFilters(
    notifications,
    activeFilter,
    activeType
  );

  const { searchedNotifications } = useNotificationSearch(
    filteredNotifications,
    searchQuery
  );

  // Group notifications by date
  const groupedNotifications = useMemo(() => {
    const groups: { [key: string]: INotification[] } = {
      today: [],
      yesterday: [],
      thisWeek: [],
      thisMonth: [],
      older: [],
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    searchedNotifications.forEach((notification) => {
      const notifDate = new Date(notification.createdAt);
      const notifDay = new Date(
        notifDate.getFullYear(),
        notifDate.getMonth(),
        notifDate.getDate()
      );

      if (notifDay.getTime() === today.getTime()) {
        groups.today.push(notification);
      } else if (notifDay.getTime() === yesterday.getTime()) {
        groups.yesterday.push(notification);
      } else if (notifDate >= weekAgo) {
        groups.thisWeek.push(notification);
      } else if (notifDate >= monthAgo) {
        groups.thisMonth.push(notification);
      } else {
        groups.older.push(notification);
      }
    });

    return groups;
  }, [searchedNotifications]);

  // Flatten grouped notifications for FlatList
  const flattenedData = useMemo(() => {
    const data: Array<{ type: 'header' | 'item'; key: string; data?: INotification }> = [];

    const addGroup = (groupKey: string, label: string, items: INotification[]) => {
      if (items.length > 0) {
        data.push({ type: 'header', key: groupKey });
        items.forEach((item) => {
          data.push({ type: 'item', key: item.id, data: item });
        });
      }
    };

    addGroup('today', 'Uyu munsi', groupedNotifications.today);
    addGroup('yesterday', 'Ejo', groupedNotifications.yesterday);
    addGroup('thisWeek', 'Iki cyumweru', groupedNotifications.thisWeek);
    addGroup('thisMonth', 'Uku kwezi', groupedNotifications.thisMonth);
    addGroup('older', 'Byashize', groupedNotifications.older);

    return data;
  }, [groupedNotifications]);

  // Handlers
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // Notifications are already real-time via socket
    // Just simulate refresh delay
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  const handleNotificationPress = useCallback(
    (notification: INotification) => {
      if (isSelectionMode) {
        toggleSelection(notification.id);
      } else {
        markAsRead(notification.id);
        
        // Navigate based on actionUrl — skip entirely if no valid link
        const actionUrl = (notification.actionUrl || '').trim();
        if (actionUrl) {
          if (isValidMeetingUrl(actionUrl)) {
            const meetingId = extractMeetingId(actionUrl);
            if (meetingId) {
              router.push(`/meeting/${meetingId}`);
            }
          } else if (actionUrl === '/certificate') {
            router.push('/certificate');
          } else {
            const match = actionUrl.match(/^\/([a-z_]+)\/(.+?)(?:\?|$)/i);
            if (match) {
              const [, resourceType, resourceId] = match;
              switch (resourceType.toLowerCase()) {
                case 'calendar': case 'event':
                  router.push(`/calendar/${resourceId}`); break;
                case 'chat': case 'conversation':
                  router.push(`/chat/${resourceId}`); break;
                case 'group':
                  router.push(`/group/${resourceId}`); break;
                case 'course': case 'courses':
                  router.push(`/courses/${resourceId}`); break;
                case 'chapter': case 'attempt':
                  router.push(`/courses/${resourceId}`); break;
                case 'community':
                  router.push(`/community/${resourceId}`); break;
                case 'announcement':
                  router.push(`/announcements/${resourceId}`); break;
                // Unknown route type — just mark-as-read, no navigation
              }
            }
          }
        }
      }
    },
    [isSelectionMode, markAsRead, router]
  );

  const handleNotificationLongPress = useCallback((notificationId: string) => {
    setIsSelectionMode(true);
    setSelectedIds([notificationId]);
  }, []);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.length === searchedNotifications.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(searchedNotifications.map((n) => n.id));
    }
  }, [selectedIds, searchedNotifications]);

  const handleBulkMarkAsRead = useCallback(() => {
    selectedIds.forEach((id) => markAsRead(id));
    setSelectedIds([]);
    setIsSelectionMode(false);
  }, [selectedIds, markAsRead]);

  const handleBulkDelete = useCallback(() => {
    selectedIds.forEach((id) => deleteNotification(id));
    setSelectedIds([]);
    setIsSelectionMode(false);
  }, [selectedIds, deleteNotification]);

  const handleCancelSelection = useCallback(() => {
    setSelectedIds([]);
    setIsSelectionMode(false);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: { type: 'header' | 'item'; key: string; data?: INotification } }) => {
      if (item.type === 'header') {
        const labels: { [key: string]: string } = {
          today: 'Uyu munsi',
          yesterday: 'Ejo',
          thisWeek: 'Iki cyumweru',
          thisMonth: 'Uku kwezi',
          older: 'Byashize',
        };
        return (
          <View
            style={[
              styles.sectionHeader,
              { backgroundColor: isDark ? '#1f2937' : '#f9fafb' },
            ]}
          >
            <Text style={[styles.sectionHeaderText, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
              {labels[item.key]}
            </Text>
          </View>
        );
      }

      if (item.data) {
        return (
          <NotificationCard
            notification={item.data}
            onPress={handleNotificationPress}
            onLongPress={handleNotificationLongPress}
            onDelete={deleteNotification}
            isSelected={selectedIds.includes(item.data.id)}
            isSelectionMode={isSelectionMode}
          />
        );
      }

      return null;
    },
    [
      isDark,
      handleNotificationPress,
      handleNotificationLongPress,
      deleteNotification,
      selectedIds,
      isSelectionMode,
    ]
  );

  const getEmptyStateType = (): 'all' | 'unread' | 'search' => {
    if (searchQuery) return 'search';
    if (activeFilter === 'unread') return 'unread';
    return 'all';
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: isDark ? '#111827' : '#ffffff' }]}
      edges={['top']}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: isDark ? '#1f2937' : '#ffffff',
            borderBottomColor: isDark ? '#374151' : '#e5e7eb',
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={isDark ? '#e5e7eb' : '#111827'} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: isDark ? '#e5e7eb' : '#111827' }]}>
            Amatangazo
          </Text>
        </View>
        <View style={styles.headerRight}>
          {unreadCount > 0 && !isSelectionMode && (
            <TouchableOpacity
              style={styles.markAllButton}
              onPress={() => markAllAsRead()}
            >
              <Text style={[styles.markAllText, { color: themeColors.primary }]}>
                Emeza byose
              </Text>
            </TouchableOpacity>
          )}
          {isSelectionMode && (
            <TouchableOpacity onPress={handleSelectAll} style={styles.selectAllButton}>
              <Text style={[styles.selectAllText, { color: themeColors.primary }]}>
                {selectedIds.length === searchedNotifications.length
                  ? 'Kuraho byose'
                  : 'Hitamo byose'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Search Bar */}
      <View
        style={[
          styles.searchContainer,
          {
            backgroundColor: isDark ? '#1f2937' : '#ffffff',
            borderBottomColor: isDark ? '#374151' : '#e5e7eb',
          },
        ]}
      >
        <View
          style={[
            styles.searchInputContainer,
            {
              backgroundColor: isDark ? '#374151' : '#f3f4f6',
            },
          ]}
        >
          <Search size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
          <TextInput
            style={[styles.searchInput, { color: isDark ? '#e5e7eb' : '#111827' }]}
            placeholder="Shakisha amatangazo..."
            placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowAdvancedFilters(true)}
        >
          <Filter size={18} color={isDark ? '#9ca3af' : '#6b7280'} />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <NotificationFilters
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        unreadCount={unreadCount}
      />

      {/* Notification List */}
      <FlatList
        data={flattenedData}
        renderItem={renderItem}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={themeColors.primary}
          />
        }
        ListEmptyComponent={
          connected ? (
            <NotificationEmpty type={getEmptyStateType()} searchQuery={searchQuery} />
          ) : (
            <LoadingSpinner message="Shakisha amatangazo..." isDark={isDark} />
          )
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Bulk Actions Bar */}
      {isSelectionMode && (
        <BulkActionsBar
          selectedCount={selectedIds.length}
          onMarkAsRead={handleBulkMarkAsRead}
          onDelete={handleBulkDelete}
          onCancel={handleCancelSelection}
        />
      )}

      {/* Advanced Filters Bottom Sheet */}
      <FilterBottomSheet
        visible={showAdvancedFilters}
        onClose={() => setShowAdvancedFilters(false)}
        activeType={activeType}
        onTypeChange={setActiveType}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  markAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  selectAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  selectAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    borderBottomWidth: 1,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  filterButton: {
    padding: 8,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listContent: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
});
