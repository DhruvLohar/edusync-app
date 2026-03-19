import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { postToAPI } from '~/lib/api';
import { TeacherClass } from '~/app/private/(teacher)/(tabs)';
import StartAttendanceModal from './StartAttendanceModal';

function AllClasses({ classes }: { classes: TeacherClass[] }) {
  const router = useRouter();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isStartingAttendance, setIsStartingAttendance] = useState(false);
  const [selectedClass, setSelectedClass] = useState<TeacherClass | null>(null);

  const handleCardPress = async (lecture: TeacherClass) => {
    const { attendance_exists, attendance_live_id } = lecture;

    if (attendance_exists && attendance_live_id) {
      router.push({
        pathname: '/private/(teacher)/(tabs)/[class_id]',
        params: { class_id: attendance_exists, live_id: attendance_live_id },
      });
      return;
    }

    setSelectedClass(lecture);
    setIsModalVisible(true);
  };

  const handleStartAttendance = async (payload: {
    class_id: number;
    division: 'A' | 'B';
    lecture_time: string;
  }) => {
    try {
      setIsStartingAttendance(true);
      const res = await postToAPI('teachers/start-attendance', payload);
      if (res && res.success) {
        setIsModalVisible(false);
        router.push({
          pathname: '/private/(teacher)/(tabs)/[class_id]',
          params: { class_id: res.data.id, live_id: res.data.live_id },
        });
      } else {
        Alert.alert(
          'Error',
          res?.message || 'Failed to start attendance session. Please try again.'
        );
      }
    } catch (error) {
      console.error('Navigation error:', error);
    } finally {
      setIsStartingAttendance(false);
    }
  };

  const LectureCard = ({ lecture }: { lecture: TeacherClass }) => {
    return (
      <TouchableOpacity onPress={() => handleCardPress(lecture)} activeOpacity={0.7}>
        <View
          className="w-full rounded-2xl bg-white p-6"
          style={{
            borderLeftWidth: 5,
            borderLeftColor: '#3b82f6',
          }}>
          {/* Header */}
          <View className="mb-3 flex-row items-start justify-between">
            <View className="flex-1">
              <Text
                className="mb-1 text-xl font-semibold text-gray-900"
                style={{ fontFamily: 'Poppins_600SemiBold' }}>
                {lecture.subject}
              </Text>
            </View>
          </View>

          {/* Details */}
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text
                className="mb-1 text-sm text-gray-600"
                style={{ fontFamily: 'Poppins_400Regular' }}>
                {lecture.department} | {lecture.year}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View className="gap-4 px-4 pb-4">
      {classes && classes.length > 0 ? (
        classes.map((lecture) => <LectureCard key={lecture.id} lecture={lecture} />)
      ) : (
        <View
          className="w-full items-center justify-center rounded-2xl bg-white p-6"
          style={{ borderWidth: 1, borderColor: '#e5e7eb' }}>
          <Text
            className="mb-1 text-center text-base text-gray-600"
            style={{ fontFamily: 'Poppins_600SemiBold' }}>
            No Classes Found
          </Text>
          <Text
            className="text-center text-sm text-gray-500"
            style={{ fontFamily: 'Poppins_400Regular' }}>
            You do not have any classes assigned yet
          </Text>
        </View>
      )}
      <StartAttendanceModal
        isVisible={isModalVisible}
        selectedClass={selectedClass}
        loading={isStartingAttendance}
        onClose={() => {
          if (isStartingAttendance) return;
          setIsModalVisible(false);
          setSelectedClass(null);
        }}
        onSubmit={handleStartAttendance}
      />
    </View>
  );
}

export default React.memo(AllClasses);
