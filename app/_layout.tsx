import '../global.css';
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SplashScreen } from 'expo-router';
import { useAuthStore } from '~/lib/store/auth.store';
import CustomSplashScreen from '~/components/layout/SplashScreen';
import {
  useFonts,
  Poppins_300Light,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { profile, session, rehydrateSession } = useAuthStore();

  const [fontsLoaded] = useFonts({
    Poppins_300Light,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const isLoggedIn = true;

  useEffect(() => {
    const init = async () => {
      await rehydrateSession();
      if (fontsLoaded) {
        await SplashScreen.hideAsync().catch(console.warn);
      }
    };
    init();
  }, [fontsLoaded]);

  useEffect(() => {
    if (!fontsLoaded) return;

    const inPrivateGroup = segments[0] === 'private';
    const inAuthGroup = segments[0] === '(auth)';

    if (isLoggedIn && !inPrivateGroup) {
      router.replace('/private/(tabs)');
    } else if (!isLoggedIn && !inAuthGroup) {
      router.replace('/');
    }
  }, [isLoggedIn, segments, fontsLoaded]);

  if (!fontsLoaded) {
    return <CustomSplashScreen message="Loading..." />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="index" />
      <Stack.Screen name="private" />
    </Stack>
  );
}
