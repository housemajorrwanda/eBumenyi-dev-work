import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
} from 'react-native';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { searchMessages } from '@/services/messaging.api';
import { IMessage } from '@/types';
import { X, Trash2 } from 'lucide-react-native';

interface MessageSearchProps {
  chatId: string;
  isVisible: boolean;
  onClose: () => void;
  onSelectMessage?: (message: IMessage) => void;
  chatType: 'direct' | 'group' | 'community';
}

/**
 * MessageSearch Component with History
 * 
 * Features:
 * - Real-time message search
 * - Search within current chat or all chats
 * - Debounced search queries
 * - Displays search results in scrollable list
 * - Click to jump to message
 * - Search history with recent searches
 */
export function MessageSearch({
  chatId,
  isVisible,
  onClose,
  onSelectMessage,
  chatType,
}: MessageSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const SEARCH_HISTORY_KEY = 'messageSearchHistory';
  const MAX_HISTORY = 10;

  // Load search history
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const history = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
        if (history) {
          setSearchHistory(JSON.parse(history));
        }
      } catch (err) {
        console.log('Failed to load search history:', err);
      }
    };
    if (isVisible) {
      loadHistory();
    }
  }, [isVisible]);

  // Save to search history
  const saveToHistory = useCallback(async (query: string) => {
    try {
      const updated = [query, ...searchHistory.filter(h => h !== query)].slice(0, MAX_HISTORY);
      setSearchHistory(updated);
      await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
    } catch (err) {
      console.log('Failed to save search history:', err);
    }
  }, [searchHistory]);

  // Clear search history
  const clearHistory = async () => {
    try {
      setSearchHistory([]);
      await AsyncStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch (err) {
      console.log('Failed to clear search history:', err);
    }
  };

  // Debounce search query (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim() && searchQuery.length > 2) {
        saveToHistory(searchQuery);
      }
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, saveToHistory]);

  const {
    data: searchResults,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['searchMessages', debouncedQuery, chatId],
    queryFn: async () => {
      if (!debouncedQuery.trim()) return null;
      try {
        const response = await searchMessages(
          debouncedQuery,
          chatId,
          20,
          0
        );
        return response.data;
      } catch (err) {
        console.log('❌ [MessageSearch] Search failed:', err);
        return null;
      }
    },
    enabled: isVisible && debouncedQuery.length > 0,
  });

  const handleSelectMessage = (message: IMessage) => {
    onSelectMessage?.(message);
    setSearchQuery('');
    onClose();
  };

  const renderSearchResult = ({ item }: { item: IMessage }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => handleSelectMessage(item)}
    >
      <View style={styles.resultContent}>
        <Text style={styles.senderName} numberOfLines={1}>
          {item.sender?.fullNames || 'Unknown'}
        </Text>
        <Text style={styles.resultText} numberOfLines={2}>
          {item.content}
        </Text>
        <Text style={styles.resultTime}>
          {new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (!isVisible) return null;

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search messages..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color="#111827" />
          </TouchableOpacity>
        </View>

        {/* Results */}
        {searchQuery.trim() === '' ? (
          <View style={styles.emptyState}>
            {searchHistory.length > 0 ? (
              <>
                <View style={styles.historyHeader}>
                  <Text style={styles.historyTitle}>Recent Searches</Text>
                  <TouchableOpacity onPress={clearHistory} style={styles.clearButton}>
                    <Trash2 size={16} color="#9ca3af" />
                    <Text style={styles.clearButtonText}>Clear</Text>
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={searchHistory}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.historyItem}
                      onPress={() => setSearchQuery(item)}
                    >
                      <Text style={styles.historyText}>{item}</Text>
                    </TouchableOpacity>
                  )}
                  keyExtractor={(item, index) => `${item}-${index}`}
                  scrollEnabled={false}
                />
              </>
            ) : (
              <Text style={styles.emptyText}>Start typing to search messages</Text>
            )}
          </View>
        ) : isLoading ? (
          <LoadingSpinner message="Searching..." />
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Failed to search messages</Text>
          </View>
        ) : !searchResults?.messages || searchResults.messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No messages found</Text>
            <Text style={styles.emptySubtext}>Try a different search term</Text>
          </View>
        ) : (
          <>
            <Text style={styles.resultCount}>
              Found {searchResults.total} result{searchResults.total !== 1 ? 's' : ''}
            </Text>
            <FlatList
              data={searchResults.messages}
              renderItem={renderSearchResult}
              keyExtractor={(item) => item.id}
              scrollEnabled
              contentContainerStyle={styles.resultsList}
            />
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingTop: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
    marginRight: 12,
  },
  closeButton: {
    padding: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#d1d5db',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#4D81D2',
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
  },
  resultCount: {
    fontSize: 12,
    color: '#9ca3af',
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontWeight: '600',
  },
  resultsList: {
    paddingHorizontal: 12,
    paddingBottom: 20,
  },
  resultItem: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4D81D2',
  },
  resultContent: {
    gap: 6,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  resultText: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
  },
  resultTime: {
    fontSize: 11,
    color: '#9ca3af',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    width: '100%',
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearButtonText: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  historyItem: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  historyText: {
    fontSize: 14,
    color: '#4D81D2',
  },
});
