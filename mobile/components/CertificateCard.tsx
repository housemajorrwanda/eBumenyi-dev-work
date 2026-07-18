import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, Modal } from 'react-native';
import { Clock, BookOpen, Loader } from 'lucide-react-native';
import DocumentViewer from '@/components/DocumentViewer';
// Use legacy FileSystem API to keep downloadAsync working until migration to new File/Directory API
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import calculateTimeSpent from '@/utils/format';
import { regenerateMyCertificate } from '@/services/certificate.api';

interface CertificateCardProps {
  id: string;
  courseId: string;
  title: string;
  image: string;
  progress: number;
  completedAt: string;
  enrollmentDate: string;
  slides: number;
  certificateUrl: string;
  onRegenerate?: () => void;
  // Wraps a handler so tapping it also advances/dismisses the parent screen's
  // tour, if active — see hooks/useTourStepAdvance.ts. Optional because this
  // card is also used outside any tour context.
  tourAdvance?: (handler: () => void) => () => void;
}

export function CertificateCard({
  id,
  courseId,
  title,
  image,
  progress,
  completedAt,
  enrollmentDate,
  slides,
  certificateUrl,
  onRegenerate,
  tourAdvance,
}: CertificateCardProps) {
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [certificateLoading, setCertificateLoading] = useState(false);

  const handleDownloadCertificate = async () => {
    if (!certificateUrl || certificateLoading) return;
    
    setCertificateLoading(true);
    try {
      const fileName = `impamyabumenyi_${title?.replace(/[^a-zA-Z0-9]/g, '_') || 'course'}.pdf`;
      const fileUri = FileSystem.documentDirectory + fileName;
      
      if (certificateUrl.startsWith('http')) {
        const downloadResult = await FileSystem.downloadAsync(certificateUrl, fileUri);
        console.log('Certificate downloaded to', downloadResult.uri);
        
        // Use the downloaded file path for sharing
        let finalUri = downloadResult.uri;
        try {
          if (downloadResult.uri !== fileUri) {
            // Move to our intended destination if needed
            await FileSystem.moveAsync({ from: downloadResult.uri, to: fileUri });
            finalUri = fileUri;
            console.log('Moved certificate file to', finalUri);
          }
        } catch (moveErr) {
          console.log('Failed to move certificate file, using original path', moveErr);
        }
        
        try {
          const available = await Sharing.isAvailableAsync();
          if (available) {
            await Sharing.shareAsync(finalUri, {
              mimeType: 'application/pdf',
              dialogTitle: fileName,
            });
          } else {
            console.log('Sharing is not available on this device.');
            Alert.alert('Ibikubiyemo', 'Kugabana ntikishoboka kuri iki gikoresho.');
          }
        } catch (shareErr) {
          console.log('Failed to share certificate', shareErr);
          Alert.alert('Ikosa', 'Ntibishobotse kugabana impamyabumenyi.');
        }
      } else {
        // If it's a local file, share directly
        try {
          const available = await Sharing.isAvailableAsync();
          if (available) {
            await Sharing.shareAsync(certificateUrl, {
              mimeType: 'application/pdf',
              dialogTitle: fileName,
            });
          } else {
            Alert.alert('Ibikubiyemo', 'Kugabana ntikishoboka kuri iki gikoresho.');
          }
        } catch (shareErr) {
          console.log('Failed to share certificate', shareErr);
          Alert.alert('Ikosa', 'Ntibishobotse kugabana impamyabumenyi.');
        }
      }
    } catch (error) {
      console.log('Download error', error);
      Alert.alert('Ikosa', 'Ntibishobotse kubika impamyabumenyi.');
    } finally {
      setCertificateLoading(false);
    }
  };
  const handleRegenerateCertificate = () => {
    Alert.alert(
      'Saba Impamyabumenyi nshya',
      'Urashaka gusaba impamyabumenyi nshya? Impamyabumenyi isanzwe izasimburwa.',
      [
        { text: 'Oya', style: 'cancel' },
        {
          text: 'Yego',
          onPress: async () => {
            setCertificateLoading(true);
            try {
              await regenerateMyCertificate(courseId);
              Alert.alert('Byagenze neza', 'Impamyabumenyi nshya yakozwe.');
              onRegenerate?.();
            } catch (error) {
              console.log('Certificate regeneration failed:', error);
              Alert.alert('Ikosa', 'Impamyabumenyi ntishobora gukozwa. Ongera ugerageze.');
            } finally {
              setCertificateLoading(false);
            }
          },
        },
      ],
    );
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={tourAdvance ? tourAdvance(() => setShowCertificateModal(true)) : () => setShowCertificateModal(true)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.iconContainer}>
          <Image source={{ uri: image }} style={styles.iconImage} />
        </View>
        <View style={styles.rightContainer}>
          <View style={styles.titleRow}>
            <View style={styles.titleContainer}>
              <Text style={styles.title} numberOfLines={2}>{title}</Text>
            </View>
          </View>
          <View style={styles.metaContainer}>
            <View style={styles.metaItem}>
              <Loader size={12} color="#4D81D2" />
              <Text style={styles.metaText}>Ikigero: {progress}%</Text>
            </View>
            <View style={styles.metaItem}>
              <Clock size={12} color="#4D81D2" />
              <Text style={styles.metaText}>{calculateTimeSpent(enrollmentDate,completedAt)}</Text>
            </View>
            <View style={styles.metaItem}>
              <BookOpen size={12} color="#4D81D2" />
              <Text style={styles.metaText}>Paje: {slides}</Text>
            </View>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.regenerateButton, certificateLoading && { opacity: 0.6 }]}
        onPress={tourAdvance ? tourAdvance(handleRegenerateCertificate) : handleRegenerateCertificate}
        disabled={certificateLoading}
        activeOpacity={0.8}
      >
        <Text style={styles.regenerateButtonText}>
          {certificateLoading ? 'Tegereza...' : '🔄  Saba Impamyabumenyi nshya'}
        </Text>
      </TouchableOpacity>

      <Modal visible={showCertificateModal} animationType="slide" transparent={false}>
        <View style={styles.certificateModalContainer}>
          {certificateUrl && (
            <DocumentViewer 
              uri={certificateUrl} 
              title="Impamyabumenyi yawe" 
              onDownload={handleDownloadCertificate} 
              onClose={() => setShowCertificateModal(false)} 
            />
          )}
        </View>
      </Modal>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#EFF1F8',
    borderRadius: 16,
    padding: 10,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 0,
    gap: 12,
  },
  rightContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 100,
    height: 84,
    borderRadius: 12,
    backgroundColor: '#E8F0FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconImage: {
    width: 100,
    height: 84,
    borderRadius: 12,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4D81D2',
    lineHeight: 22,
  },
  certificateButton: {
    backgroundColor: 'rgba(51, 99, 173, 0.75)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  certificateButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  regenerateButton: {
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: '#3363AD',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#F0F4FF',
  },
  regenerateButtonText: {
    fontSize: 12,
    color: '#3363AD',
    fontWeight: '600',
  },
  metaContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 10,
    color: '#4D81D2',
  },
  certificateModalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  certificateModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  certificateModalCloseButton: {
    marginRight: 16,
  },
  certificateModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4D81D2',
  },
  certificateModalContent: {
    flex: 1,
  },
});