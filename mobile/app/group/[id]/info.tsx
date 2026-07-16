import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Edit2, Check, UserPlus, UserMinus, Search, Users, LogOut, Trash2, FileText, Camera } from 'lucide-react-native';
import * as MessagingAPI from '@/services/messaging.api';
import * as ImagePicker from 'expo-image-picker';
import { getAllUsersNopagination } from '@/services/users.api';
import { useAuth } from '@/hooks/useAuth';
import { IUser } from '@/types';

export default function GroupInfoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [isEditingName, setIsEditingName] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [isEditingPhoto, setIsEditingPhoto] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [addingUserId, setAddingUserId] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const { data: fetchedGroup, isLoading } = useQuery({
    queryKey: ['group', id],
    queryFn: () => MessagingAPI.getGroupById(id || ''),
    enabled: !!id,
  });

  const { data: usersResponse } = useQuery({
    queryKey: ['users'],
    queryFn: () => getAllUsersNopagination(),
  });

  const group = (fetchedGroup as any)?.group || (fetchedGroup as any)?.data || (fetchedGroup as any);
  const allUsers: IUser[] = usersResponse?.data || [];

  const participantIds: string[] = group?.participants?.map((p: any) => p.userId) || [];
  const isCreator = group?.creator?.id === user?.id || group?.createdById === user?.id;
  const isAdmin = group?.participants?.some(
    (p: any) => p.userId === user?.id && p.role === 'admin'
  ) ?? false;
  const canManageParticipants = isAdmin;
  const canRename = isCreator;
  const availableUsers = allUsers.filter(
    (u) => !participantIds.includes(u.id)
  );
  const filteredAvailable = availableUsers.filter((u) =>
    u.fullNames.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStartEditName = () => {
    setGroupName(group?.name || group?.displayName || '');
    setIsEditingName(true);
  };

  const handleSaveName = async () => {
    if (!id) return;
    if (!groupName.trim()) {
      Alert.alert('Ikosa', 'Izina ntirishobora kuba ubusa');
      return;
    }
    setIsSavingName(true);
    try {
      await MessagingAPI.updateGroup(id, { name: groupName.trim() });
      queryClient.invalidateQueries({ queryKey: ['group', id] });
      setIsEditingName(false);
    } catch {
      Alert.alert('Ikosa', 'Kubika izina ryanze');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleChangePhoto = async () => {
    if (!id || !canRename) return;
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    setIsEditingPhoto(true);
    try {
      // Upload photo to Cloudinary using React Native FormData
      const formData = new FormData();
      const asset = result.assets[0];
      
      // React Native FormData expects this format
      formData.append('image', {
        uri: asset.uri,
        type: 'image/jpeg',
        name: 'group-photo.jpg',
      } as any);
      
      const httpClient = await import('@/services/httpClient');
      const uploadResponse = await httpClient.default.post<any>('/upload/image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      const photoUrl = uploadResponse.data?.data?.url || uploadResponse.data?.url;
      
      if (photoUrl) {
        // Update group with new photo URL
        await MessagingAPI.updateGroup(id, { photo: photoUrl });
        
        // Invalidate queries to refresh UI
        await queryClient.invalidateQueries({ queryKey: ['group', id] });
        await queryClient.invalidateQueries({ queryKey: ['groupChats'] });
        
        Alert.alert('Byakunze', 'Ifoto yahindutse neza');
      }
    } catch (error: any) {
      console.error('Photo update failed:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Guhindura ifoto byanze';
      Alert.alert('Ikosa', errorMessage);
    } finally {
      setIsEditingPhoto(false);
    }
  };

  const handleAddParticipant = async (userId: string) => {
    if (!id) return;
    setAddingUserId(userId);
    try {
      await MessagingAPI.addParticipantToGroup(id, { userId });
      queryClient.invalidateQueries({ queryKey: ['group', id] });
    } catch {
      Alert.alert('Ikosa', 'Kongeraho umunyamuryango byanze');
    } finally {
      setAddingUserId(null);
    }
  };

  const handleRemoveParticipant = async (userId: string, name: string) => {
    Alert.alert(
      'Gukuraho',
      `Urashaka gukuraho ${name}?`,
      [
        { text: 'Oya', style: 'cancel' },
        {
          text: 'Yego',
          style: 'destructive',
          onPress: async () => {
            setRemovingUserId(userId);
            try {
              await MessagingAPI.removeParticipantFromGroup(id!, userId);
              queryClient.invalidateQueries({ queryKey: ['group', id] });
            } catch {
              Alert.alert('Ikosa', 'Gukuraho umunyamuryango byanze');
            } finally {
              setRemovingUserId(null);
            }
          },
        },
      ]
    );
  };

  const handleLeaveGroup = () => {
    Alert.alert(
      'Sohoka',
      `Urashaka gusohoka muri ${group?.name || group?.displayName}?`,
      [
        { text: 'Oya', style: 'cancel' },
        {
          text: 'Yego',
          style: 'destructive',
          onPress: async () => {
            try {
              await MessagingAPI.removeParticipantFromGroup(id!, user!.id);
              queryClient.invalidateQueries({ queryKey: ['groups'] });
              router.replace('/(tabs)');
            } catch {
              Alert.alert('Ikosa', 'Gusohoka byanze');
            }
          },
        },
      ]
    );
  };

  const handleDeleteGroup = () => {
    Alert.alert(
      "Siba itsinda",
      `Ibi bizasiba itsinda ryose hamwe n'ubutumwa bwaryo. Ntibizasubizwa.`,
      [
        { text: 'Oya', style: 'cancel' },
        {
          text: 'Siba',
          style: 'destructive',
          onPress: async () => {
            try {
              await MessagingAPI.deleteGroup(id!);
              queryClient.invalidateQueries({ queryKey: ['groups'] });
              router.replace('/(tabs)');
            } catch {
              Alert.alert('Ikosa', "Gusiba itsinda byanze");
            }
          },
        },
      ]
    );
  };

  if (isLoading || !group) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  const groupDisplayName = group?.displayName || group?.name || '----';
  const participantCount = group?.participants?.length || 0;
  const messageCount = group?.messages?.length || group?._count?.messages || 0;
  const createdAt = group?.createdAt ? new Date(group.createdAt).toLocaleDateString('rw-RW', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
  const creatorName = group?.creator?.fullNames || 'Unknown';

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={22} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{"Amakuru y'itsinda"}</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Group Avatar + Name */}
        <View style={styles.groupHero}>
          <TouchableOpacity 
            style={styles.groupAvatar}
            onPress={canRename ? handleChangePhoto : undefined}
            activeOpacity={canRename ? 0.7 : 1}
            disabled={isEditingPhoto}>
            {group?.photo ? (
              <Image source={{ uri: group.photo }} style={styles.groupAvatarImage} />
            ) : (
              <Users size={40} color="#ffffff" />
            )}
            {canRename && (
              <View style={styles.photoEditOverlay}>
                {isEditingPhoto ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Camera size={20} color="#ffffff" />
                )}
              </View>
            )}
          </TouchableOpacity>

          {isEditingName ? (
            <View style={styles.nameEditRow}>
              <TextInput
                value={groupName}
                onChangeText={setGroupName}
                style={styles.nameInput}
                autoFocus
                placeholder="Izina ry'itsinda"
                placeholderTextColor="#9ca3af"
              />
              <TouchableOpacity
                style={styles.saveNameButton}
                onPress={handleSaveName}
                disabled={isSavingName}>
                {isSavingName ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Check size={18} color="#ffffff" />
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.nameRow}
              onPress={canRename ? handleStartEditName : undefined}
              activeOpacity={canRename ? 0.7 : 1}>
              <Text style={styles.groupName}>{groupDisplayName}</Text>
              {canRename && (
                <Edit2 size={16} color="#6b7280" style={{ marginLeft: 8 }} />
              )}
            </TouchableOpacity>
          )}

          <Text style={styles.memberCount}>
            {participantCount} {participantCount === 1 ? 'umunyamuryango' : 'abanyamuryango'}
          </Text>
        </View>

        {/* About Section */}
        {group?.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ibyerekeye</Text>
            <Text style={styles.descriptionText}>{group.description}</Text>
          </View>
        )}

        {/* Creator & Date */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Amakuru</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Yashyizweho na:</Text>
            <Text style={styles.infoValue}>{creatorName}</Text>
          </View>
          {createdAt && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Itariki:</Text>
              <Text style={styles.infoValue}>{createdAt}</Text>
            </View>
          )}
        </View>

        {/* Statistics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Imibare</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Users size={24} color="#4D81D2" />
              <Text style={styles.statValue}>{participantCount}</Text>
              <Text style={styles.statLabel}>Abanyamuryango</Text>
            </View>
            <View style={styles.statItem}>
              <FileText size={24} color="#4D81D2" />
              <Text style={styles.statValue}>{messageCount}</Text>
              <Text style={styles.statLabel}>Ubutumwa</Text>
            </View>
          </View>
        </View>

        {/* Current Members */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Abanyamuryango ({participantCount})
          </Text>
          {group?.participants?.map((p: any) => (
            <View key={p.userId} style={styles.memberRow}>
              {p.user?.photo ? (
                <Image source={{ uri: p.user.photo }} style={styles.memberAvatar} />
              ) : (
                <View style={[styles.memberAvatar, styles.avatarFallback]}>
                  <Text style={styles.avatarInitial}>
                    {(p.user?.fullNames || 'U')[0].toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>
                  {p.user?.fullNames || 'Unknown'}
                </Text>
                <View style={styles.badgeRow}>
                  {p.userId === user?.id && (
                    <Text style={styles.youBadge}>Wowe</Text>
                  )}
                  {p.role === 'admin' && (
                    <Text style={styles.adminBadge}>Admin</Text>
                  )}
                  {group?.creator?.id === p.userId && (
                    <Text style={styles.creatorBadge}>Washinze</Text>
                  )}
                </View>
              </View>
              {p.userId !== user?.id && canManageParticipants && (
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => handleRemoveParticipant(p.userId, p.user?.fullNames || 'umunyamuryango')}
                  disabled={removingUserId === p.userId}>
                  {removingUserId === p.userId ? (
                    <ActivityIndicator size="small" color="#ef4444" />
                  ) : (
                    <UserMinus size={18} color="#ef4444" />
                  )}
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {/* Add Members — admins only */}
        {canManageParticipants && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ongeraho abanyamuryango</Text>
          <View style={styles.searchContainer}>
            <Search size={16} color="#6b7280" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
              placeholder="Shakisha..."
              placeholderTextColor="#9ca3af"
            />
          </View>
          {filteredAvailable.length === 0 ? (
            <Text style={styles.emptyText}>Nta banyamuryango bashobora kongerwa</Text>
          ) : (
            filteredAvailable.map((u) => (
              <View key={u.id} style={styles.memberRow}>
                {u.photo ? (
                  <Image source={{ uri: u.photo }} style={styles.memberAvatar} />
                ) : (
                  <View style={[styles.memberAvatar, styles.avatarFallback]}>
                    <Text style={styles.avatarInitial}>
                      {(u.fullNames || 'U')[0].toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{u.fullNames}</Text>
                </View>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => handleAddParticipant(u.id)}
                  disabled={addingUserId === u.id}>
                  {addingUserId === u.id ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <UserPlus size={16} color="#ffffff" />
                  )}
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
        )}

        {/* Actions - only show leave button for non-creators */}
        {!isCreator && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ibikorwa</Text>
            <TouchableOpacity
              style={styles.leaveButton}
              onPress={handleLeaveGroup}>
              <LogOut size={18} color="#6b7280" />
              <Text style={styles.leaveButtonText}>Sohoka mu itsinda</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Danger Zone — creator only */}
        {isCreator && (
          <View style={styles.dangerZone}>
            <Text style={styles.dangerZoneTitle}>⚠️ Danger Zone</Text>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDeleteGroup}>
              <Trash2 size={18} color="#ef4444" />
              <Text style={styles.deleteButtonText}>Siba itsinda</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#4D81D2',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  backButton: { padding: 6 },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#ffffff' },
  scroll: { flex: 1 },
  groupHero: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    marginBottom: 8,
  },
  groupAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4D81D2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    position: 'relative',
  },
  groupAvatarImage: { width: 80, height: 80, borderRadius: 40 },
  photoEditOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  groupName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    width: '80%',
  },
  nameInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    borderBottomWidth: 2,
    borderBottomColor: '#4D81D2',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  saveNameButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#4D81D2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberCount: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  section: {
    backgroundColor: '#ffffff',
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  avatarFallback: {
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 16, fontWeight: '600', color: '#4b5563' },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 14, fontWeight: '500', color: '#111827' },
  badgeRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  youBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4D81D2',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  adminBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: '#059669',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  creatorBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  removeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#fee2e2',
  },
  addButton: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#4D81D2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  emptyText: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 16,
  },
  descriptionText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  infoLabel: { fontSize: 14, color: '#6b7280' },
  infoValue: { fontSize: 14, fontWeight: '500', color: '#111827' },
  statsGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    paddingVertical: 16,
    borderRadius: 8,
  },
  statValue: { fontSize: 20, fontWeight: '700', color: '#111827', marginTop: 4 },
  statLabel: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  leaveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  dangerZone: {
    backgroundColor: '#ffffff',
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  dangerZoneTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ef4444',
    marginBottom: 12,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fee2e2',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
});
