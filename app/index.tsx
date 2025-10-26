import React, { useEffect } from 'react';
import { SafeAreaView, ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the private onboarding screen which holds the onboarding UI
    router.replace('/private/onboarding');
  }, [router]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0ea5e9" />
        <Text style={styles.text}>Opening onboarding…</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  text: { marginTop: 12, color: '#64748b' },
});
