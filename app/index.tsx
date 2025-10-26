import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
  Platform,
  SafeAreaView,
} from "react-native";
import { useRouter } from 'expo-router';

const { width, height } = Dimensions.get("window");

const slides = [
  {
    id: "1",
    title: "Smart Attendance Made Simple",
    description:
      "Experience automatic attendance marking with Bluetooth technology. No manual input needed, the system does the rest.",
    backgroundColor: "#EAF5FF",
  },
  {
    id: "2",
    title: "Seamless Teacher–Student Sync",
    description:
      "Connect effortlessly with beacons and devices nearby for a truly smart classroom experience.",
    backgroundColor: "#EAF5FF",
  },
  {
    id: "3",
    title: "Reliable. Fast. Effortless.",
    description:
      "Sign in, connect your device, and let the app handle attendance automatically.",
    backgroundColor: "#EAF5FF",
  },
];

const onboarding = ({ navigation }: any) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const slidesRef = useRef<FlatList>(null);
  const router = useRouter();

const handleNext = () => {
  if (currentIndex < slides.length - 1) {
    slidesRef.current?.scrollToIndex({ index: currentIndex + 1 });
    setCurrentIndex(currentIndex + 1);
  } else {
    // Navigate to login page inside (auth)
    router.replace('/(auth)');
  }
};


  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={slides}
        renderItem={({ item }) => (
          <View
            style={[styles.slide, { backgroundColor: item.backgroundColor }]}
          >
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

              {/* Title + Description */}
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.description}>{item.description}</Text>

              {/* Blue Button */}
              <TouchableOpacity
                style={styles.button}
                onPress={handleNext}
                activeOpacity={0.85}
              >
                <Text style={styles.buttonText}>
                  {currentIndex === slides.length - 1
                    ? "Get Started"
                    : "Next"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        ref={slidesRef}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#EAF5FF",
  },
  slide: {
    width,
    height,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  bottomSheet: {
    backgroundColor: "#fff",
    width: "100%",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 40,
    alignItems: "center",
  },
  pagination: {
    flexDirection: "row",
    marginBottom: 14,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#007AFF",
    marginHorizontal: 4,
  },
  title: {
    fontSize: 30,
    color: "#000",
    textAlign: "center",
    marginBottom: 10,
    lineHeight: 40,
    marginTop: 30,
    
    fontFamily: 'Poppins_600SemiBold',
  },
  description: {
    fontSize: 15,
    color: "#777",
    textAlign: "justify",
    lineHeight: 22,
    marginBottom: 28,
    marginTop: 20,
    fontFamily: 'Poppins_400Regular',
  },
  button: {
    backgroundColor: "#007AFF",
    borderRadius: 14,
    width: "100%",
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10, 
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Poppins_500Medium',
  },
});

export default onboarding;
