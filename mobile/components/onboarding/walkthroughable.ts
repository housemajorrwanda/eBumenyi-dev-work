import { View, TouchableOpacity, Text, ScrollView, Image } from 'react-native';
import { walkthroughable } from 'react-native-copilot';

// Pre-built walkthroughable versions of common RN primitives.
// Usage: <CopilotStep ...><WalkthroughableView {...copilot} /></CopilotStep>
export const WalkthroughableView = walkthroughable(View);
export const WalkthroughableTouchable = walkthroughable(TouchableOpacity);
export const WalkthroughableText = walkthroughable(Text);
export const WalkthroughableScrollView = walkthroughable(ScrollView);
export const WalkthroughableImage = walkthroughable(Image);
