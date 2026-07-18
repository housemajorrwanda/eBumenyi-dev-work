import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Users, MoreVertical } from 'lucide-react-native';
import { IConversation } from '@/types';
import { CopilotStep } from 'react-native-copilot';
import { WalkthroughableTouchable } from '@/components/onboarding/walkthroughable';
import { useTourStepAdvance } from '@/hooks/useTourStepAdvance';

interface GroupHeaderProps {
  group: IConversation;
  router: any;
  groupId: string;
  onSettingsPress?: () => void;
  // Only set true when rendered inside a CopilotProvider (i.e. group/[id].tsx tour).
  tourEnabled?: boolean;
}

export function GroupHeader({ group, router, groupId, onSettingsPress, tourEnabled = false }: GroupHeaderProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const responsiveStyles = getResponsiveHeaderStyles(width);
  // Get member count from 'participants' array
  const participantCount = group?.participants?.length || 0;
  
  // Use backend-calculated displayName
  const groupName = group?.displayName || group?.name || '----';

  const advanceInfo = useTourStepAdvance('group-info');
  const advanceMembers = useTourStepAdvance('group-members');

  return (
    <View style={[styles.header, { paddingTop: insets.top, paddingHorizontal: responsiveStyles.paddingHorizontal, paddingVertical: responsiveStyles.paddingVertical }]}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <ArrowLeft size={responsiveStyles.backIconSize} color="#FFFFFF" />
      </TouchableOpacity>

      {tourEnabled ? (
        <CopilotStep
          text="Hano ugaragara izina ry'itsinda n'umubare w'abanyamuryango. Kanda kugira ngo urebe amakuru y'itsinda."
          order={1}
          name="group-info"
        >
          <WalkthroughableTouchable
            style={styles.headerInfo}
            onPress={advanceInfo(() => router.push(`/group/${groupId}/info`))}
          >
            <View style={styles.headerTextContainer}>
              <Text style={[styles.headerName, { fontSize: responsiveStyles.headerNameSize }]}>
                {groupName}
              </Text>
              <View style={styles.memberRow}>
                <Users size={responsiveStyles.headerStatusSize} color="#D1F4CC" />
                <Text style={[styles.headerStatus, { fontSize: responsiveStyles.headerStatusSize }]}>
                  {participantCount}
                </Text>
              </View>
            </View>
          </WalkthroughableTouchable>
        </CopilotStep>
      ) : (
        <TouchableOpacity
          style={styles.headerInfo}
          onPress={() => router.push(`/group/${groupId}/info`)}
        >
          <View style={styles.headerTextContainer}>
            <Text style={[styles.headerName, { fontSize: responsiveStyles.headerNameSize }]}>
              {groupName}
            </Text>
            <View style={styles.memberRow}>
              <Users size={responsiveStyles.headerStatusSize} color="#D1F4CC" />
              <Text style={[styles.headerStatus, { fontSize: responsiveStyles.headerStatusSize }]}>
                {participantCount}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      )}

      {tourEnabled ? (
        <CopilotStep
          text="Kanda hano kureba urutonde rw'abanyamuryango bose no guhindura igenamiterere ry'itsinda."
          order={2}
          name="group-members"
        >
          <WalkthroughableTouchable
            style={styles.headerButton}
            onPress={advanceMembers(() => router.push(`/group/${groupId}/info`))}
          >
            <MoreVertical size={responsiveStyles.backIconSize} color="#FFFFFF" />
          </WalkthroughableTouchable>
        </CopilotStep>
      ) : (
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.push(`/group/${groupId}/info`)}
        >
          <MoreVertical size={responsiveStyles.backIconSize} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4D81D2',
  },
  backButton: {
    padding: 8,
    marginRight: 4,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    backgroundColor: '#E9EDEF',
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerName: {
    fontWeight: '600',
    color: '#FFFFFF',
  },
    memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  headerStatus: {
    color: '#D1F4CC',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    padding: 8,
  },
});

function getResponsiveHeaderStyles(width: number) {
  const isSmallScreen = width < 400;
  const isLargeScreen = width > 768;
  
  return {
    paddingHorizontal: isSmallScreen ? 4 : isLargeScreen ? 16 : 8,
    paddingVertical: isSmallScreen ? 8 : isLargeScreen ? 14 : 10,
    backIconSize: isSmallScreen ? 20 : isLargeScreen ? 28 : 24,
    headerAvatarSize: isSmallScreen ? 32 : isLargeScreen ? 48 : 40,
    headerNameSize: isSmallScreen ? 16 : isLargeScreen ? 20 : 18,
    headerStatusSize: isSmallScreen ? 12 : isLargeScreen ? 14 : 13,
    actionIconSize: isSmallScreen ? 18 : isLargeScreen ? 26 : 22,
  };
}
