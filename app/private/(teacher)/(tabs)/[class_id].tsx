import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, StatusBar, Dimensions, Animated, Easing, Modal, ScrollView, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import AttendanceList from '../../../../components/custom/BLE/AttendanceList';
import { fetchFromAPI, postToAPI } from '~/lib/api';
import { Attendance, Class } from '~/type/Teacher';
import { BottomModal } from '../../../../components/ui/BottomModal';
import dummyTeacherData from '~/assets/dummy-teacher.json';

interface CourseSelectionProps {
  classes: Class[];
  onSelect: (course: Class) => void;
  isVisible: boolean;
}



const CourseSelectionModal: React.FC<CourseSelectionProps> = ({ classes, onSelect, isVisible }) => {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
    >
      <View style={styles.modalOverlay}>
        <View className="bg-white rounded-t-3xl w-full p-6 shadow-2xl absolute bottom-0" style={{ height: '75%' }}>
          <Text className="text-2xl font-bold text-gray-800 mb-6" style={{ fontFamily: 'Poppins_600SemiBold' }}>
            Select Course & Section
          </Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            {classes.map((course) => (
              <TouchableOpacity
                key={course.id}
                className="flex-row justify-between items-center bg-gray-50 p-4 mb-3 rounded-lg border border-gray-200"
                onPress={() => onSelect(course)}
              >
                <View>
                  <Text className="text-lg font-semibold text-gray-900">{course.subject} ({course.department})</Text>
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


/** Map dummy-teacher lecture to Class-like for BeaconSession / API */
function lectureToClass(lecture: {
  id: number;
  classId: string;
  subject: string;
  department: string;
  code: string;
  room?: string;
  startTime: string;
  endTime: string;
}): Class {
  return {
    id: lecture.id,
    subject: lecture.subject,
    department: lecture.department as Class['department'],
    year: lecture.code as Class['year'],
    teacher_id: 0,
    created_at: new Date(),
    updated_at: new Date(),
    students: [],
  };
}

interface BeaconSessionProps {
  selectedCourse: Class;
  showBackButton?: boolean;
  onBack?: () => void;
}

const BeaconSession: React.FC<BeaconSessionProps> = ({ selectedCourse, showBackButton, onBack }) => {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [attendance, setAttendance] = useState<Attendance | null>(null);

  const animatedScale = useRef(new Animated.Value(0)).current;
  const animatedOpacity = useRef(new Animated.Value(1)).current;

  const startPumpingAnimation = () => {
    animatedScale.setValue(0);
    animatedOpacity.setValue(1);
    Animated.loop(
      Animated.parallel([
        Animated.timing(animatedScale, {
          toValue: 1,
          duration: 1500,
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


  const startAttendanceSession = async () => {
    try {
      const res = await postToAPI('/teachers/start-attendance', { class_id: selectedCourse?.id });

      if (res.success) {
        setAttendance(res.data);
        setIsSessionActive(true);
        return true;
      }
      return false;
    } catch (error) {
      Alert.alert('Error', 'Failed to start session');
      return false;
    }
  };

  const endAttendanceSession = async () => {
    try {
      if (!attendance?.live_id) {
        Alert.alert('Error', 'No active session');
        return false;
      }

      const res = await postToAPI('/teachers/end-attendance', { attendance_id: attendance.id });
      // DUMMY DATA
      // const res = { success: true };

      if (res.success) {
        setIsSessionActive(false);
        setAttendance(null);
        setSessionEnded(true);
        return true;
      }
      return false;
    } catch (error) {
      Alert.alert('Error', 'Failed to end session');
      return false;
    }
  };


  const handleBluetoothPress = async () => {
    if (!isSessionActive && !isModalVisible) {
      const success = await startAttendanceSession();
      if (success) {
        setIsModalVisible(true);
      }
    } else {
      setIsModalVisible(true);
    }
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
    setSessionEnded(false);
  };

  const handleRecognizeStudent = () => {
    setSessionEnded(false);
    setIsModalVisible(false);
  };



  const rippleScale = animatedScale.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.5],
  });

  const rippleOpacity = animatedOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const rippleScale2 = animatedScale.interpolate({
    inputRange: [0, 1],
    outputRange: [1.2, 2.7],
  });

  const rippleOpacity2 = animatedOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  const rippleScale3 = animatedScale.interpolate({
    inputRange: [0, 1],
    outputRange: [1.5, 3.0],
  });

  const rippleOpacity3 = animatedOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.3],
  });


  const titleText = isSessionActive ? 'Active Session' : 'Tap to Start';
  const bgColor = isSessionActive ? '#1a2a3a' : '#D3EDFF';
  const statusBarStyle = isSessionActive ? 'light-content' : 'dark-content';



  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bgColor }}>
      <StatusBar barStyle={statusBarStyle as any} />

      {/* HEADER */}
      <View className="flex-row justify-between items-center p-4 pt-10 mt-5">
        <View className="flex-row items-center flex-1">
          {showBackButton && onBack && !isSessionActive && (
            <TouchableOpacity onPress={onBack} className="p-2 mr-2 -ml-1 rounded-full">
              <Ionicons
                name="chevron-back"
                size={24}
                color="black"
              />
            </TouchableOpacity>
          )}
          <View className='ml-3'>
            <Text className={`text-base ${isSessionActive ? 'text-gray-300' : 'text-gray-800'} opacity-80`}>
              {selectedCourse?.department} | {selectedCourse?.year ?? selectedCourse?.subject}
            </Text>
            <Text
              className={`text-xl ${isSessionActive ? 'text-white' : 'text-gray-800'}`}
              style={{ fontFamily: 'Poppins_600SemiBold' }}
            >
              {selectedCourse?.subject}
            </Text>
          </View>
        </View>

      </View>

      {/* MAIN CONTENT */}
      <View className="flex-col items-center" style={{ flex: 1 }}>
        {/* TITLE SECTION */}
        <View className="items-center mb-20 mt-16">
          <Text
            className={`text-4xl font-light ${isSessionActive ? 'text-white' : 'text-gray-800'} mb-2`}
            style={{ fontFamily: 'Poppins_500Medium' }}
          >
            {titleText}
          </Text>
          <Text
            className={`text-base text-center ${isSessionActive ? 'text-gray-300' : 'text-gray-600'} opacity-90`}
            style={{ fontFamily: 'Poppins_400Regular', maxWidth: '70%' }}
          >
            Make your class presence count—activate the beacon!
          </Text>
        </View>

        {/* RIPPLE & BLUETOOTH BUTTON */}
        <View className="relative items-center justify-center" style={{ marginTop: '5%', marginBottom: 10 }}>
          {/* Animated Ripple Circles When Active */}
          {isSessionActive && (
            <>
              <Animated.View
                className="absolute w-64 h-64 rounded-full border-2 border-[#0095FF]"
                style={{
                  opacity: rippleOpacity,
                  transform: [{ scale: rippleScale }],
                }}
              />
              <Animated.View
                className="absolute w-52 h-52 rounded-full border-2 border-[#0095FF]"
                style={{
                  opacity: rippleOpacity2,
                  transform: [{ scale: rippleScale2 }],
                }}
              />
              <Animated.View
                className="absolute w-40 h-40 rounded-full border-2 border-[#0095FF]"
                style={{
                  opacity: rippleOpacity3,
                  transform: [{ scale: rippleScale3 }],
                }}
              />
            </>
          )}

          {/* Static Circles When Inactive */}
          {!isSessionActive && (
            <>
              <View className="absolute w-64 h-64 rounded-full border-2 border-[#0095FF]" style={{ opacity: 0.2 }} />
              <View className="absolute w-52 h-52 rounded-full border-2 border-[#0095FF]" style={{ opacity: 0.3 }} />
              <View className="absolute w-40 h-40 rounded-full border-2 border-[#0095FF]" style={{ opacity: 0.5 }} />
            </>
          )}

          {/* Bluetooth Button */}
          <TouchableOpacity
            onPress={handleBluetoothPress}
            className="w-20 h-20 rounded-full bg-[#0095FF] items-center justify-center shadow-lg"
          >
            <MaterialCommunityIcons name="bluetooth" size={30} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* BOTTOM MODAL SHEET */}
      <BottomModal isVisible={isModalVisible} onClose={handleCloseModal}>
        <AttendanceList
          isScanning={!isSessionActive && !sessionEnded}
          isSessionActive={isSessionActive}
          sessionEnded={sessionEnded}
          onEndSession={endAttendanceSession}
          onRecognizeStudent={handleRecognizeStudent}
          sheetY={null}
          attendance={attendance}
          students={selectedCourse?.students || []}
        />
      </BottomModal>
    </SafeAreaView>
  );
};



type TeacherLectureDummy = {
  id: number;
  subject: string;
  department: string;
  code: string;
  classId: string;
  room?: string;
  startTime: string;
  endTime: string;
  isOngoing: boolean;
};

const AddAttendanceScreen: React.FC = () => {
  const { class_id: routeClassId } = useLocalSearchParams<{ class_id?: string }>();
  const router = useRouter();
  const [selectedCourse, setSelectedCourse] = useState<Class | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [fromRoute, setFromRoute] = useState(false);

  const todayLectures = (dummyTeacherData as { todayLectures?: TeacherLectureDummy[] }).todayLectures ?? [];

  useEffect(() => {
    if (routeClassId && todayLectures.length > 0) {
      const lecture = todayLectures.find((l) => l.classId === String(routeClassId));
      if (lecture) {
        setSelectedCourse(lectureToClass(lecture));
        setFromRoute(true);
        return;
      }
    }
    fetchClasses();
  }, [routeClassId]);

  const fetchClasses = async () => {
    try {
      const res = await fetchFromAPI('/teachers/fetch-classes');

      if (res.success) {
        setClasses(res.data);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch classes');
    }
  };



  const handleSelectCourse = (course: Class) => {
    setSelectedCourse(course);
  };


  if (!selectedCourse) {
    return (
      <CourseSelectionModal
        classes={classes}
        onSelect={handleSelectCourse}
        isVisible={true}
      />
    );
  }

  return (
    <BeaconSession
      key={selectedCourse.id}
      selectedCourse={selectedCourse}
      showBackButton={fromRoute}
      onBack={fromRoute ? () => router.back() : undefined}
    />
  );
};


const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
});

export default AddAttendanceScreen;
