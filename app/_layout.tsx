import { useAuthStore } from '~/lib/store/auth.store';
import '../global.css';

import { SplashScreen, Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { 
  useFonts, 
  Poppins_300Light, 
  Poppins_400Regular, 
  Poppins_500Medium, 
  Poppins_600SemiBold, 
  Poppins_700Bold 
} from '@expo-google-fonts/poppins';
import CustomSplashScreen from '~/components/layout/SplashScreen';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { profile, session, rehydrateSession, isSessionInitialized } = useAuthStore();

  const [fontsLoaded] = useFonts({
    Poppins_300Light,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  // Toggle this for testing - set to true to test logged-in state
  const isLoggedIn = true; // Change to: !!(session && profile) for production

  async function checkSession() {
    await rehydrateSession();
  }

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(console.warn);
      // Uncomment for production:
      checkSession();
    }
  }, [fontsLoaded]);

  // // Simple navigation logic: logged in users go to private, others to onboarding
  // useEffect(() => {
  //   if (!fontsLoaded) return;

  //   const inPrivateGroup = segments[0] === 'private';
  //   const inAuthGroup = segments[0] === '(auth)';

  //   if (isLoggedIn && !inPrivateGroup) {
  //     // User is logged in but not in private area → redirect to private
  //     router.replace('/private/(tabs)');
  //   } else if (!isLoggedIn && !inAuthGroup) {
  //     // User is not logged in and not on onboarding/auth → redirect to onboarding
  //     router.replace('/');
  //   }
  // }, [isLoggedIn, segments, fontsLoaded]);

  // Show splash screen while fonts load
  if (!fontsLoaded) {
    return <CustomSplashScreen message="Loading..." />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Auth routes - only when NOT logged in */}
      <Stack.Protected guard={!isLoggedIn}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="index" />
      </Stack.Protected>

      {/* Private routes - only when logged in */}
      <Stack.Protected guard={isLoggedIn}>
        <Stack.Screen name="private" />
      </Stack.Protected>
    </Stack>
  );
}