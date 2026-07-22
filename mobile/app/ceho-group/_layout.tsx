import { Stack } from 'expo-router';

export default function CEHOGroupLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="invite" />
    </Stack>
  );
}
