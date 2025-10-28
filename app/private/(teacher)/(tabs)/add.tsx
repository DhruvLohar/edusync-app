import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, StatusBar, Dimensions, Animated, Easing, Modal, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router'; 
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import AnimatedReanimated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

import AttendanceList from '../../../../components/custom/BLE/AttendanceList'; // The list component

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const INITIAL_HEIGHT = SCREEN_HEIGHT * 0.50; // Initial sheet height
const MAX_HEIGHT = SCREEN_HEIGHT * 0.90;    // Max sheet height
const MIN_HEIGHT = SCREEN_HEIGHT * 0.20;    // Min sheet height

// --- MOCK DATA ---
const mockCourses = [
    { id: 'c1', name: 'Blockchain Systems', sem: 'SEM 7' },
    { id: 'c2', name: 'Network Security', sem: 'SEM 7' },
    { id: 'c3', name: 'Distributed Ledgers', sem: 'SEM 6' },
    { id: 'c4', name: 'Advanced Algorithms', sem: 'SEM 5' },
];

interface CourseSelectionProps {
    onSelect: (course: typeof mockCourses[0]) => void;
}

const CourseSelectionModal: React.FC<CourseSelectionProps> = ({ onSelect }) => {
    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={true} 
        >
            <View style={styles.modalOverlay}>
                <View className="bg-white rounded-t-3xl w-full p-6 shadow-2xl absolute bottom-0" style={{ height: '75%' }}>
                    <Text className="text-2xl font-bold text-gray-800 mb-6" style={{ fontFamily: 'Poppins_600SemiBold' }}>
                        Select Course & Section
                    </Text>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        {mockCourses.map((course) => (
                            <TouchableOpacity 
                                key={course.id}
                                className="flex-row justify-between items-center bg-gray-50 p-4 mb-3 rounded-lg border border-gray-200"
                                onPress={() => onSelect(course)}
                            >
                                <View>
                                    <Text className="text-lg font-semibold text-gray-900">{course.name}</Text>
                                </View>
                                <Ionicons name="arrow-forward-circle-outline" size={24} color="#0095FF" />
                            </TouchableOpacity>
                        ))}
                        <View style={{ height: 50 }} />
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};


const TeacherBeaconSession: React.FC<{ selectedCourse: typeof mockCourses[0] }> = ({ selectedCourse }) => {
    const router = useRouter(); 
    
    const [isSessionActive, setIsSessionActive] = useState<boolean>(false);
    const [isTransitioning, setIsTransitioning] = useState<boolean>(false);

    const animatedScale = useRef(new Animated.Value(0)).current;
    const animatedOpacity = useRef(new Animated.Value(1)).current;
    
    const startPumpingAnimation = () => {
        animatedScale.setValue(0);
        animatedOpacity.setValue(1);
        Animated.loop(
            Animated.parallel([
                Animated.timing(animatedScale, { toValue: 1, duration: 1500, easing: Easing.out(Easing.ease), useNativeDriver: true }),
                Animated.timing(animatedOpacity, { toValue: 0, duration: 1500, easing: Easing.out(Easing.ease), useNativeDriver: true }),
            ])
        ).start();
    };

    const stopPumpingAnimation = () => {
        animatedScale.stopAnimation();
        animatedOpacity.stopAnimation();
    };

    useEffect(() => {
        if (isSessionActive) {
            startPumpingAnimation();
        } else {
            stopPumpingAnimation();
        }
        return () => stopPumpingAnimation();
    }, [isSessionActive]);

    const sheetY = useSharedValue(INITIAL_HEIGHT);
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
    
    const handleTapToStart = () => {
        if (!isSessionActive && !isTransitioning) {
            setIsTransitioning(true);
            setTimeout(() => {
                setIsSessionActive(true);
                setIsTransitioning(false);
            }, 2000); 
        }
    };
    
    const handleEndSession = () => {
        setIsSessionActive(false);
        setIsTransitioning(false);
        sheetY.value = withSpring(INITIAL_HEIGHT);
    };

    const titleText = isSessionActive ? 'Active Session' : 'Tap to Start';
    
    const rippleScale = animatedScale.interpolate({ inputRange: [0, 1], outputRange: [1, 2.5] });
    const rippleOpacity = animatedOpacity.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });


    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: isSessionActive ? '#1a2a3a' : '#D3EDFF' }}>
            <StatusBar barStyle={isSessionActive ? "light-content" : "dark-content"} />

            <View style={{ flex: 1, backgroundColor: isSessionActive ? '#1a2a3a' : '#D3EDFF', marginTop: 0 }}>

                <View className="flex-row justify-between items-center p-4 pt-10">
                    <View>
                        <Text className={`text-base ${isSessionActive ? 'text-gray-300' : 'text-gray-800'} opacity-80`}>Prof. Satish Ket</Text>
                        <Text className={`text-xl ${isSessionActive ? 'text-white' : 'text-gray-800'}`} style={{ fontFamily: 'Poppins_600SemiBold' }}>{selectedCourse.name}</Text>
                    </View>
                    <TouchableOpacity className={`p-2 border rounded-full`}>
                        <Ionicons name="settings-outline" size={24} color={isSessionActive ? 'white' : 'black'} />
                    </TouchableOpacity>
                </View>

                <View className="flex-col items-center" style={{ flex: 1 }}>
                    
                    <View className="items-center mb-20 mt-16">
                        <Text className={`text-4xl font-light ${isSessionActive ? 'text-white' : 'text-gray-800'} mb-2`} style={{ fontFamily: 'Poppins_500Medium' }}>{titleText}</Text>
                        <Text className={`text-base text-center ${isSessionActive ? 'text-gray-300' : 'text-gray-600'} opacity-90`} style={{ fontFamily: 'Poppins_400Regular', maxWidth: '70%' }}>
                            Make your class presence count—activate the beacon!
                        </Text>
                    </View>
                    
                    <View className="relative items-center justify-center " style={{ marginTop: '5%', marginBottom: 10 }}>
                        
                        {isSessionActive || isTransitioning ? (
                            <>
                                <Animated.View className="absolute w-64 h-64 rounded-full border-2 border-[#0095FF]" style={{ opacity: isSessionActive ? rippleOpacity : 0.2, transform: [{ scale: isSessionActive ? rippleScale : 1 }] }} />
                                <Animated.View className="absolute w-52 h-52 rounded-full border-2 border-[#0095FF]" style={{ opacity: isSessionActive ? rippleOpacity.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }) : 0.3, transform: [{ scale: isSessionActive ? animatedScale.interpolate({ inputRange: [0, 1], outputRange: [1.2, 2.7] }) : 1 }] }} />
                                <Animated.View className="absolute w-40 h-40 rounded-full border-2 border-[#0095FF]" style={{ opacity: isSessionActive ? rippleOpacity.interpolate({ inputRange: [0, 1], outputRange: [0, 0.3] }) : 0.5, transform: [{ scale: isSessionActive ? animatedScale.interpolate({ inputRange: [0, 1], outputRange: [1.5, 3.0] }) : 1 }] }} />
                            </>
                        ) : (
                            <>
                                <View className="absolute w-64 h-64 rounded-full border-2 border-[#0095FF]" style={{ opacity: 0.2 }} />
                                <View className="absolute w-52 h-52 rounded-full border-2 border-[#0095FF]" style={{ opacity: 0.3 }} />
                                <View className="absolute w-40 h-40 rounded-full border-2 border-[#0095FF]" style={{ opacity: 0.5 }} />
                            </>
                        )}
                        
                        <TouchableOpacity 
                            onPress={handleTapToStart} 
                            disabled={isSessionActive || isTransitioning} 
                            className="w-20 h-20 rounded-full bg-[#0095FF] items-center justify-center shadow-lg">
                            <MaterialCommunityIcons name="bluetooth" size={30} color="white" />
                        </TouchableOpacity>
                    </View>
                </View>
                
                {(isTransitioning || isSessionActive) && (
                    <GestureDetector gesture={gesture}>
                        <AnimatedReanimated.View 
                            style={[
                                { position: 'absolute', width: '100%', top:0 }, 
                                animatedSheetStyle,
                                { zIndex: 1000 }
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


const BeaconScreen: React.FC = () => {
    const [selectedCourse, setSelectedCourse] = useState<typeof mockCourses[0] | null>(null);

    const handleCourseSelect = (course: typeof mockCourses[0]) => {
        setSelectedCourse(course);
    };

    if (!selectedCourse) {
        return <CourseSelectionModal onSelect={handleCourseSelect} />;
    }

    return <TeacherBeaconSession selectedCourse={selectedCourse} />;
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1, 
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
});


export default BeaconScreen;