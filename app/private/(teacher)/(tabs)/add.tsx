import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, StatusBar, Dimensions, Animated, Easing } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
// >>> ADDED IMPORTS FOR DRAGGABILITY <<<
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import AnimatedReanimated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

import AttendanceList from '../../../../components/custom/BLE/AttendanceList'; // The list component

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const INITIAL_HEIGHT = SCREEN_HEIGHT * 0.50; // Initial sheet height
const MAX_HEIGHT = SCREEN_HEIGHT * 0.90;    // Max sheet height
const MIN_HEIGHT = SCREEN_HEIGHT * 0.20;    // Min sheet height

const BeaconScreen: React.FC = () => {
  const navigation = useNavigation();
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
// Animated value for the ripple effect
 const animatedScale = useRef(new Animated.Value(0)).current;
 const animatedOpacity = useRef(new Animated.Value(1)).current;

 // Function to start the pumping animation
 const startPumpingAnimation = () => {
 animatedScale.setValue(0); // Reset scale
animatedOpacity.setValue(1); // Reset opacity
 Animated.loop(
 Animated.parallel([
 Animated.timing(animatedScale, {
 toValue: 1,
 duration: 1500, // Duration of one pump cycle
 easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(animatedOpacity, {
          toValue: 0,
          duration: 1500,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  // Function to stop the pumping animation
  const stopPumpingAnimation = () => {
    animatedScale.stopAnimation();
    animatedOpacity.stopAnimation();
    // Removed: animatedScale.setValue(0);
    // Removed: animatedOpacity.setValue(1); 
  };

  useEffect(() => {
    if (isSessionActive) {
      startPumpingAnimation();
    } else {
      stopPumpingAnimation();
    }
    // Cleanup on unmount or if state changes
    return () => stopPumpingAnimation();
  }, [isSessionActive]); // Re-run effect when isSessionActive changes


  const handleTapToStart = () => {
    if (!isSessionActive && !isTransitioning) {
      setIsTransitioning(true);
      setTimeout(() => {
        setIsSessionActive(true);
        setIsTransitioning(false);
      }, 2000); // 2 seconds delay
    }
  };
  
  const handleEndSession = () => {
    setIsSessionActive(false);
    setIsTransitioning(false);
    // >>> ADDED: Reset sheet position when session ends
    sheetY.value = withSpring(INITIAL_HEIGHT);
  };
  const titleText = isSessionActive ? 'Active Session' : 'Tap to Start';


  // The bottom component should always be visible in the initial state as "Scanning for students..."
  const showBottomComponent = true; 

  const rippleScale = animatedScale.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.5], // Scale from original to 2.5 times
  });
  const rippleOpacity = animatedOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1], // Fade out
  });
  
  // >>> DRAGGABLE SHEET LOGIC (Reanimated) <<<
  const sheetY = useSharedValue(INITIAL_HEIGHT); // Starting height
  const context = useSharedValue(0);

  const gesture = Gesture.Pan()
    .onStart(() => {
      context.value = sheetY.value;
    })
    .onUpdate((event) => {
      sheetY.value = Math.min(
        MAX_HEIGHT,
        Math.max(MIN_HEIGHT, context.value - event.translationY)
      );
    })
    .onEnd(() => {
      if (sheetY.value > INITIAL_HEIGHT + 50) {
        sheetY.value = withSpring(MAX_HEIGHT, { damping: 50, stiffness: 200 });
      } else {
        sheetY.value = withSpring(INITIAL_HEIGHT, { damping: 50, stiffness: 200 });
      }
    });

  const animatedSheetStyle = useAnimatedStyle(() => {
    return {
      height: sheetY.value,
      transform: [{ translateY: SCREEN_HEIGHT - sheetY.value }],
    };
  });
  // >>> End Draggable Sheet Logic <<<



  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#D3EDFF' }}>
      <StatusBar barStyle={isSessionActive ? "light-content" : "dark-content"} />

      <View style={{ flex: 1, backgroundColor: '#D3EDFF', marginTop: 20 }}> {/* Changed marginTop: 20 to 0 */}

        {/* Top Header */}
        <View className="flex-row justify-between items-center p-4 pt-10">
          <View>
            <Text className={`text-base text-gray-800 opacity-80`}>Prof. Satish Ket</Text>
            <Text className={`text-2xl text-gray-800`} style={{ fontFamily: 'Poppins_600SemiBold' }}>Blockchain</Text>
          </View>
          <TouchableOpacity className={`p-2 border rounded-full`}>
            <Ionicons name="settings-outline" size={24} color="black" />
          </TouchableOpacity>
        </View>

        {/* Content Area (Title and Beacon) - REMOVED: -mt-[20rem] gap-[8rem] */}
        <View className="flex-col items-center" style={{ flex: 1 }}>
          
          {/* Title and Subtext */}
          <View className="items-center mb-28 mt-16">
            <Text className={`text-4xl font-light text-gray-800 mb-2`} style={{ fontFamily: 'Poppins_500Medium' }}>{titleText}</Text>
            <Text className={`text-base text-center text-gray-600 opacity-90`} style={{ fontFamily: 'Poppins_400Regular', maxWidth: '70%' }}>
Make your class presence count—activate the beacon!
 </Text>
          </View>
          
          {/* Beacon Circle and Ripple Effect */}
         <View className="relative items-center justify-center" style={{ marginTop: '5%', marginBottom: 10 }}>
            
            {/* --- CONDITIONAL RIPPLE RINGS --- */}
            {isSessionActive ? (
              // PUMPING RINGS (Active Session)
              <>
                {/* Animated Ripple Ring 1 (outermost) */}
                <Animated.View
                  className="absolute w-72 h-72 rounded-full border-2 border-[#0095FF]"
                  style={{
                    transform: [{ scale: rippleScale }],
                    opacity: rippleOpacity,
                  }}
                />
                {/* Animated Ripple Ring 2 (inner) */}
                <Animated.View
                  className="absolute w-60 h-60 rounded-full border-2 border-[#0095FF]"
                  style={{
                    transform: [{ scale: animatedScale.interpolate({ inputRange: [0, 1], outputRange: [1.2, 2.7] }) }],
                    opacity: animatedOpacity.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }),
                  }}
                />
                <Animated.View
                  className="absolute w-48 h-48 rounded-full border-2 border-[#0095FF]"
                  style={{
                    transform: [{ scale: animatedScale.interpolate({ inputRange: [0, 1], outputRange: [1.5, 3.0] }) }],
                    opacity: animatedOpacity.interpolate({ inputRange: [0, 1], outputRange: [0, 0.3] }),
                  }}
                />
              </>
            ) : (
              // STATIC RINGS (Initial State)
              <>
                {/* Static Outer Ring */}
                <View className="absolute w-72 h-72 rounded-full border-2 border-[#0095FF]" style={{ opacity: 0.2 }} />
                <View className="absolute w-60 h-60 rounded-full border-2 border-[#0095FF]" style={{ opacity: 0.3 }} />
                <View className="absolute w-48 h-48 rounded-full border-2 border-[#0095FF]" style={{ opacity: 0.5 }} />
              </>
            )}
            
            {/* The Main Bluetooth Button */}
            <TouchableOpacity 
              onPress={handleTapToStart} 
              disabled={isSessionActive || isTransitioning} 
              className="w-36 h-36 rounded-full bg-[#0095FF] items-center justify-center shadow-lg">
              <MaterialCommunityIcons name="bluetooth" size={62} color="white" />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* >>> DRAGGABLE ATTENDANCE LIST (Bottom Sheet) <<< */}
        {showBottomComponent && (
            // GestureDetector wraps the content to enable dragging
            <GestureDetector gesture={gesture}>
                <AnimatedReanimated.View 
                    style={[
                        { position: 'absolute', width: '100%', top:0 }, 
                        animatedSheetStyle,
                        { zIndex: 1000 } // Ensure it's above other content
                    ]}
                >
                    <AttendanceList 
                        isScanning={!isSessionActive}
                        isSessionActive={isSessionActive}
                        onEndSession={handleEndSession}
                        sheetY={sheetY} 
                    />
                </AnimatedReanimated.View>
            </GestureDetector>
        )}
      </View>
    </SafeAreaView>
  );
};

export default BeaconScreen;