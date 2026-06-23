import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { ChevronLeft, Search, UserPlus, MapPin } from 'lucide-react-native';
import { searchCHWCandidates, choDirectlyAddMember } from '@/services/choGroup.api';
import { IStudentSearchResult } from '@/types';
import { useTheme } from '@/contexts/ThemeContext';

const PLACEHOLDER_AVATAR =
  'https://img.freepik.com/premium-vector/user-profile-icon-flat-style-member-avatar-vector-illustration-isolated-background-human-permission-sign-business-concept_157943-15752.jpg';

export default function InviteScreen() {
  const router = useRouter();
  const { isDark, themeColors } = useTheme();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['chw-candidates', search],
    queryFn: () => searchCHWCandidates(search),
    enabled: true,
  });

  const { mutate: addMember, isPending } = useMutation({
    mutationFn: (studentId: string) => choDirectlyAddMember(studentId),
    onSuccess: (_, studentId) => {
      setInvitedIds((prev) => new Set([...prev, studentId]));
      queryClient.invalidateQueries({ queryKey: ['cho-group-members'] });
      queryClient.invalidateQueries({ queryKey: ['cho-chw-candidates'] });
      Toast.show({ type: 'success', text1: 'Byongewe mu itsinda' });
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message ?? 'Habaye ikosa mu kongera umunyamuryango.';
      Toast.show({ type: 'error', text1: msg });
    },
  });

  const handleAdd = (student: IStudentSearchResult) => {
    if (invitedIds.has(student.id) || student.groupMembership) return;
    addMember(student.id);
  };

  const cardBg = isDark ? '#1f2937' : '#ffffff';
  const textPrimary = isDark ? '#f9fafb' : '#1f2937';
  const textMuted = isDark ? '#9ca3af' : '#6b7280';
  const bgColor = isDark ? '#111827' : '#f8fafc';
  const inputBg = isDark ? '#374151' : '#f3f4f6';

  const renderStudent = ({ item }: { item: IStudentSearchResult }) => {
    const alreadyInGroup = !!item.groupMembership;
    const alreadyAdded = invitedIds.has(item.id);
    const disabled = alreadyInGroup || alreadyAdded || isPending;

    return (
      <View style={[styles.studentCard, { backgroundColor: cardBg }]}>
        <Image
          source={{ uri: item.user.photo ?? PLACEHOLDER_AVATAR }}
          style={styles.avatar}
        />
        <View style={styles.studentInfo}>
          <Text style={[styles.studentName, { color: textPrimary }]}>{item.user.fullNames}</Text>
          {item.user.phoneNumber && (
            <Text style={[styles.phone, { color: textMuted }]}>{item.user.phoneNumber}</Text>
          )}
          {(item.user.district || item.user.sector) && (
            <View style={styles.locationRow}>
              <MapPin size={11} color={textMuted} />
              <Text style={[styles.locationText, { color: textMuted }]}>
                {[item.user.district, item.user.sector].filter(Boolean).join(', ')}
              </Text>
            </View>
          )}
          {alreadyInGroup && (
            <View style={[styles.statusBadge, { backgroundColor: '#FEE2E2' }]}>
              <Text style={[styles.statusText, { color: '#DC2626' }]}>Afite itsinda</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={[
            styles.inviteBtn,
            {
              backgroundColor: alreadyAdded
                ? '#D1FAE5'
                : disabled
                ? '#e5e7eb'
                : themeColors.primary,
            },
          ]}
          onPress={() => handleAdd(item)}
          disabled={disabled}
          activeOpacity={0.8}
        >
          {isPending ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : alreadyAdded ? (
            <Text style={[styles.inviteBtnText, { color: '#059669' }]}>Wongewe</Text>
          ) : alreadyInGroup ? (
            <Text style={[styles.inviteBtnText, { color: '#9ca3af' }]}>Afite itsinda</Text>
          ) : (
            <>
              <UserPlus size={14} color="#ffffff" />
              <Text style={[styles.inviteBtnText, { color: '#ffffff' }]}>Ongeramo</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.primary }]} edges={['top']}>
      <View style={[styles.container, { backgroundColor: bgColor }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: themeColors.primary }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Ongeramo CHW mu itsinda</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Search */}
        <View style={[styles.searchWrapper, { backgroundColor: bgColor }]}>
          <View style={[styles.searchBar, { backgroundColor: inputBg }]}>
            <Search size={16} color={textMuted} />
            <TextInput
              style={[styles.searchInput, { color: textPrimary }]}
              placeholder="Shakisha amazina cyangwa telefone..."
              placeholderTextColor={textMuted}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
          </View>
          <Text style={[styles.hintText, { color: textMuted }]}>
            Shakisha CHW utarimo itsinda mu karere kawe, hanyuma umwongere.
          </Text>
        </View>

        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={themeColors.primary} />
          </View>
        ) : (
          <FlatList
            data={students}
            keyExtractor={(item) => item.id}
            renderItem={renderStudent}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.centered}>
                <Text style={[styles.emptyText, { color: textMuted }]}>
                  {search ? 'Nta muturage uhuye n\'ubushakashatsi' : 'Andika izina cg telefone kugira ngo ushakishe'}
                </Text>
              </View>
            }
          />
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
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  searchWrapper: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14 },
  hintText: { fontSize: 11, marginTop: 6, marginBottom: 4, paddingHorizontal: 4 },
  list: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8 },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  phone: { fontSize: 12, marginBottom: 2 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  locationText: { fontSize: 11 },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  statusText: { fontSize: 10, fontWeight: '600' },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 70,
    justifyContent: 'center',
  },
  inviteBtnText: { fontSize: 12, fontWeight: '600' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },
});
