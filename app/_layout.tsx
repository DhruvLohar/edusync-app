import { useAuthStore } from '~/lib/store/auth.store';
import '../global.css';

import { SplashScreen, Stack } from 'expo-router';
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
  const { profile, session, rehydrateSession } = useAuthStore();

  const [fontsLoaded] = useFonts({
    Poppins_300Light,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const isLoggedIn = !!(session && profile);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(console.warn);
      rehydrateSession();
    }
  }, [fontsLoaded]);

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