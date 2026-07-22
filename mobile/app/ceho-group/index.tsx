import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, UserPlus, MapPin, Info, Users } from 'lucide-react-native';
import { getMyGroup } from '@/services/cehoGroup.api';
import { useTheme } from '@/contexts/ThemeContext';

export default function CEHOGroupScreen() {
  const router = useRouter();
  const { isDark, themeColors } = useTheme();

  const { data: group, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['ceho-group-mine'],
    queryFn: getMyGroup,
  });

  const cardBg = isDark ? '#1f2937' : '#ffffff';
  const textPrimary = isDark ? '#f9fafb' : '#1f2937';
  const textMuted = isDark ? '#9ca3af' : '#6b7280';
  const bgColor = isDark ? '#111827' : '#f8fafc';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.primary }]} edges={['top']}>
      <View style={[styles.container, { backgroundColor: bgColor }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: themeColors.primary }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Itsinda ryanjye</Text>
          <View style={{ width: 40 }} />
        </View>

        {isLoading ? (
          <LoadingSpinner message="Gufungura amakuru..." />
        ) : isError ? (
          <View style={styles.centered}>
            <Info size={48} color="#ef4444" />
            <Text style={[styles.errorText, { color: textPrimary }]}>Nta tsinda ufite ubu</Text>
            <Text style={[styles.errorSub, { color: textMuted }]}>Uhuzwe na Administrateur ubone itsinda.</Text>
            <TouchableOpacity style={[styles.retryBtn, { backgroundColor: themeColors.primary }]} onPress={() => refetch()}>
              <Text style={styles.retryBtnText}>Ongera ugerageze</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetch}
                tintColor={themeColors.primary}
              />
            }
          >
            {/* Group Info Card */}
            <View style={[styles.groupCard, { backgroundColor: themeColors.primary }]}>
              <View style={styles.groupIconWrapper}>
                <Users size={36} color="#ffffff" />
              </View>
              <Text style={styles.groupName}>{group?.name}</Text>
              {(group?.sectors?.length ?? 0) > 0 && (
                <View style={styles.groupMeta}>
                  <MapPin size={14} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.groupMetaText}>{group!.sectors!.join(', ')}</Text>
                </View>
              )}
              {group?.description && (
                <Text style={styles.groupDesc}>{group.description}</Text>
              )}
              <View style={styles.memberCountBadge}>
                <Text style={styles.memberCountText}>
                  {group?._count?.members ?? 0} abagize itsinda
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsGrid}>
              <TouchableOpacity
                style={[styles.actionCard, { backgroundColor: cardBg }]}
                onPress={() => router.push('/ceho-group/invite')}
                activeOpacity={0.8}
              >
                <View style={[styles.actionIconWrapper, { backgroundColor: '#D1FAE5' }]}>
                  <UserPlus size={24} color="#059669" />
                </View>
                <Text style={[styles.actionTitle, { color: textPrimary }]}>Ongeramo CHW</Text>
                <Text style={[styles.actionSub, { color: textMuted }]}>Ongeramo umunyamuryango</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  scroll: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  loadingText: { fontSize: 14, marginTop: 8 },
  errorText: { fontSize: 18, fontWeight: '600', textAlign: 'center', marginTop: 12 },
  errorSub: { fontSize: 14, textAlign: 'center' },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryBtnText: { color: '#ffffff', fontWeight: '600', fontSize: 14 },
  groupCard: {
    margin: 16,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  groupIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  groupName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 6,
  },
  groupMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  groupMetaText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
  },
  groupDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
    lineHeight: 18,
  },
  memberCountBadge: {
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  memberCountText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 12,
    marginBottom: 24,
  },
  actionCard: {
    flex: 1,
    minWidth: '28%',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  actionIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 2,
  },
  actionSub: {
    fontSize: 11,
    textAlign: 'center',
  },
});
