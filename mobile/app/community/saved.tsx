import { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image,
} from 'react-native';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Bookmark, Globe, Heart, MessageCircle } from 'lucide-react-native';
import * as MessagingAPI from '@/services/messaging.api';

export default function SavedPostsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data: savedData, isLoading, refetch } = useQuery({
    queryKey: ['savedPosts'],
    queryFn: () => MessagingAPI.getSavedPosts(),
  });

  const savedPosts: any[] = (savedData as any)?.data || [];

  const handleUnsave = async (communityId: string, postId: string) => {
    try {
      await MessagingAPI.toggleSaveCommunityPost(communityId, postId);
      refetch();
    } catch {}
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={22} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ibibitso byanjye</Text>
        <View style={{ width: 38 }} />
      </View>

      {isLoading ? (
        <LoadingSpinner />
      ) : savedPosts.length === 0 ? (
        <View style={styles.centered}>
          <Bookmark size={48} color="#d1d5db" />
          <Text style={styles.emptyTitle}>Nta bibitso</Text>
          <Text style={styles.emptyText}>Ubutumwa ubika buzagaragara hano</Text>
        </View>
      ) : (
        <FlatList
          data={savedPosts}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={{ padding: 12, gap: 10 }}
          renderItem={({ item }: { item: any }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/community/${item.communityId}`)}
              activeOpacity={0.8}>
              <View style={styles.communityBadge}>
                <Globe size={10} color="#4D81D2" />
                <Text style={styles.communityBadgeText} numberOfLines={1}>
                  {item.community?.name || 'Kominote'}
                </Text>
              </View>
              <View style={styles.authorRow}>
                {item.author?.photo ? (
                  <Image source={{ uri: item.author.photo }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarInitial}>
                      {(item.author?.fullNames?.[0] || 'U').toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.authorName}>{item.author?.fullNames || 'Unknown'}</Text>
                  <Text style={styles.postTime}>
                    {item.timestamp ? new Date(item.timestamp).toLocaleDateString() : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleUnsave(item.communityId, item.id)}
                  style={styles.unsaveButton}>
                  <Bookmark size={16} color="#4D81D2" fill="#4D81D2" />
                </TouchableOpacity>
              </View>
              {item.title && <Text style={styles.postTitle} numberOfLines={2}>{item.title}</Text>}
              <Text style={styles.postContent} numberOfLines={3}>{item.content}</Text>
              {item.photo && (
                <Image source={{ uri: item.photo }} style={styles.postImage} resizeMode="cover" />
              )}
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Heart size={12} color="#9ca3af" />
                  <Text style={styles.statText}>{item.likeCount ?? 0}</Text>
                </View>
                <View style={styles.statItem}>
                  <MessageCircle size={12} color="#9ca3af" />
                  <Text style={styles.statText}>{item.commentCount ?? 0}</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#4D81D2', paddingHorizontal: 12, paddingBottom: 12,
  },
  backButton: { padding: 6 },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#ffffff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 8 },
  emptyText: { fontSize: 13, color: '#9ca3af', textAlign: 'center', paddingHorizontal: 32 },
  card: {
    backgroundColor: '#ffffff', borderRadius: 12, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  communityBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  communityBadgeText: { fontSize: 11, color: '#4D81D2', fontWeight: '600' },
  authorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  avatarFallback: { backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 13, fontWeight: '600', color: '#4b5563' },
  authorName: { fontSize: 13, fontWeight: '600', color: '#111827' },
  postTime: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  unsaveButton: { padding: 6 },
  postTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 4 },
  postContent: { fontSize: 13, color: '#374151', lineHeight: 19, marginBottom: 8 },
  postImage: { width: '100%', height: 140, borderRadius: 8, marginBottom: 8 },
  statsRow: { flexDirection: 'row', gap: 12, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 12, color: '#9ca3af' },
});
