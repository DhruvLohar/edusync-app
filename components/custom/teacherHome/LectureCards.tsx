import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import dummyData from '~/assets/dummy-teacher.json';
import { useRouter } from 'expo-router';
import { Student } from '~/type/Student';
import { fetchFromAPI, postToAPI } from '~/lib/api';


interface TeacherLectureResponse {
  id: number;
  department: string;
  year: string;
  subject: string;
  teacher_id: number;
  created_at: string;
  updated_at: string;
  total_students: number;
  total_attendance_sessions: number;
  students: Student[];
}

function LectureCards() {
  const router = useRouter();

  const [todayLectures, setTodayLectures] = useState<TeacherLectureResponse[]>([]);

  async function fetchLectures() {
    try {
      const res = await fetchFromAPI('teachers/fetch-classes');
      console.log(res);

      if (res && res.success) {
        setTodayLectures(res.data);
      }
    } catch (error) {
      console.error('Error fetching lectures:', error);
    }
  }

  useEffect(() => {
    fetchLectures();
  }, []);

  const createAttendance = async (classId: number) => {
    try {

      const res = await postToAPI('teachers/start-attendance', { class_id: classId }, false, true);

      if (res && res.success) {
        router.push({
          pathname: '/private/(teacher)/(tabs)/[class_id]',
          params: { class_id: res.data.id, live_id: res.data.live_id },
        });
      } else {
        Alert.alert('Error', res?.message || 'Failed to start attendance session. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    }
  };

  const LectureCard = ({ lecture }: { lecture: TeacherLectureResponse }) => (
    <TouchableOpacity
      onPress={() => createAttendance(lecture.id)}
      activeOpacity={0.7}
    >
      <View
        className="w-full bg-white rounded-2xl p-5 flex-row items-center justify-between"
        style={{
          borderLeftWidth: 5,
          borderLeftColor: isOngoing ? '#ef4444' : '#0095FF',
        }}
      >
        <View className="flex-1">
          {isOngoing && (
            <View className="bg-red-500 px-2 py-1 rounded-full mb-2 w-20">
              <Text
                className="text-xs text-white font-semibold"
                style={{ fontFamily: 'Poppins_600SemiBold' }}
              >
                ONGOING
              </Text>
            </View>
          )}
          <Text
            className="text-lg font-semibold text-gray-900 mb-1"
            style={{ fontFamily: 'Poppins_600SemiBold' }}
          >
            {lecture.subject}
          </Text>
          <Text
            className="text-sm text-gray-500"
            style={{ fontFamily: 'Poppins_400Regular' }}
          >
            {lecture.department} | {lecture.year}
          </Text>
        </View>
        <View className="items-end">
          <View className="bg-blue-50 px-3 py-1 rounded-full mb-1">
            <Text
              className="text-xs font-semibold text-[#0095FF]"
              style={{ fontFamily: 'Poppins_600SemiBold' }}
            >
              {lecture.total_students} Students
            </Text>
          </View>
          <Text
            className="text-xs text-gray-400"
            style={{ fontFamily: 'Poppins_400Regular' }}
          >
            {lecture.total_attendance_sessions} Sessions
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View className="gap-3 px-2 pb-6">
      {todayLectures.length > 0 ? (
        todayLectures.map((lecture) => (
          <LectureCard
            key={lecture.id}
            lecture={lecture}
          />
        ))
      ) : (
        <View
          className="w-full bg-white rounded-2xl p-6 items-center justify-center"
          style={{ borderWidth: 1, borderColor: '#e5e7eb' }}
        >
          <Text
            className="text-gray-600 text-center"
            style={{ fontFamily: 'Poppins_400Regular' }}
          >
            No lectures scheduled for today
          </Text>
        </View>
      )}
    </View>
  );
};

export default React.memo(LectureCards);
