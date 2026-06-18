import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { fonts } from '@/theme';
import { useModuleSwitch } from '@/hooks/useModuleSwitch';
import ModuleCardsList from '@/components/ModuleCardsList';
import type { AppModule } from '@/constants/modules';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function ModuleSwitcherSheet({ visible, onClose }: Props) {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const { activeModule, loadingModule, selectModule } = useModuleSwitch();

  const handleSelect = useCallback(
    async (key: AppModule) => {
      const result = await selectModule(key);
      onClose();
      if (!result.switched && key === activeModule) {
        return;
      }
    },
    [activeModule, onClose, selectModule],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={[
            styles.sheet,
            { backgroundColor: isDark ? '#1f2937' : '#ffffff' },
          ]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.handleBar}>
            <View
              style={[
                styles.handle,
                { backgroundColor: isDark ? '#4b5563' : '#d1d5db' },
              ]}
            />
          </View>

          <View style={styles.header}>
            <Text
              style={[
                styles.title,
                {
                  color: isDark ? '#e5e7eb' : '#111827',
                  fontFamily: fonts.bold,
                },
              ]}
            >
              {t('moduleSwitcher.title') || 'Switch application'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={isDark ? '#9ca3af' : '#6b7280'} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={styles.content}
          >
            <ModuleCardsList
              variant="sheet"
              activeModule={activeModule}
              loadingModule={loadingModule}
              onSelect={handleSelect}
            />
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '78%',
  },
  handleBar: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 20,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    paddingBottom: 8,
  },
});
