import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { useRouter } from 'expo-router';

const slides = [
  {
    id: "1",
    title: "Smart Attendance Made Simple",
    description: "Experience automatic attendance marking with Bluetooth technology. No manual input needed, the system does the rest.",
  },
  {
    id: "2",
    title: "Seamless Teacher–Student Sync",
    description: "Connect effortlessly with beacons and devices nearby for a truly smart classroom experience.",
  },
  {
    id: "3",
    title: "Reliable. Fast. Effortless.",
    description: "Sign in, connect your device, and let the app handle attendance automatically.",
  },
];

const Onboarding = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const router = useRouter();

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      router.replace('/(auth)');
    }
  };

  const currentSlide = slides[currentIndex];

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Section: Stays empty and static */}
      <View style={styles.topSection} />

      {/* Static Bottom Sheet: Height and position are fixed */}
      <View style={styles.bottomSheet}>
        {/* Pagination Dots */}
        <View style={styles.pagination}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  opacity: i === currentIndex ? 1 : 0.3,
                  width: i === currentIndex ? 20 : 8,
                },
              ]}
            />
          ))}
        </View>

        {/* Dynamic Text: Only this part changes */}
        <View style={styles.contentContainer}>
          <Text style={styles.title}>{currentSlide.title}</Text>
          <Text style={styles.description}>{currentSlide.description}</Text>
        </View>

        {/* Fixed Button */}
        <TouchableOpacity
          style={styles.button}
          onPress={handleNext}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>
            {currentIndex === slides.length - 1 ? "Get Started" : "Next"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#EAF5FF",
  },
  topSection: {
    flex: 1, // Pushes the bottom sheet down
  },
  bottomSheet: {
    backgroundColor: "#fff",
    width: "100%",
    height: 350, // Strictly fixed height as requested
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 28,
    paddingTop: 30,
    paddingBottom: 40,
    alignItems: "center",
    justifyContent: "space-between", // Keeps elements spaced out within the fixed height
  },
  pagination: {
    flexDirection: "row",
  },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#007AFF",
    marginHorizontal: 4,
  },
  contentContainer: {
    alignItems: "center",
    width: '100%',
  },
  title: {
    fontSize: 28,
    color: "#000",
    textAlign: "center",
    lineHeight: 36,
    fontWeight: '700',
    fontFamily: 'Poppins_600SemiBold',
  },
  description: {
    fontSize: 15,
    color: "#777",
    textAlign: "center",
    lineHeight: 22,
    marginTop: 15,
    fontFamily: 'Poppins_400Regular',
  },
  button: {
    backgroundColor: "#007AFF",
    borderRadius: 14,
    width: "100%",
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Poppins_500Medium',
  },
});

export default Onboarding;