import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import dummyData from '~/assets/dummy-teacher.json';
import { useRouter } from 'expo-router';


export interface TeacherLecture {
  id: number;
  subject: string;
  department: string;
  code: string;
  classId: string;
  room?: string;
  startTime: string;
  endTime: string;
  isOngoing: boolean;
}

interface LectureCardsProps {
  onSelectLecture?: (classId: string, lecture: TeacherLecture) => void;
}

const LectureCards: React.FC<LectureCardsProps> = ({ onSelectLecture }) => {
  const router = useRouter();

  const [todayLectures, setTodayLectures] = useState<TeacherLecture[]>([]);

  useEffect(() => {
    setTodayLectures((dummyData as { todayLectures?: TeacherLecture[] }).todayLectures || []);
  }, []);

  const handleCardPress = (classId: string) => {
    try {
      router.push({
        pathname: '/private/(teacher)/(tabs)/[class_id]',
        params: { class_id: classId },
      });
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  const LectureCard = ({ lecture, isOngoing }: { lecture: TeacherLecture; isOngoing?: boolean }) => (
    <TouchableOpacity
      onPress={() => handleCardPress(lecture.classId)}
      activeOpacity={0.7}
    >
      <View
        className="w-full bg-white rounded-2xl p-5 flex-row items-center"
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
            {lecture.department} | {lecture.code}
          </Text>
          {lecture.room && (
            <Text
              className="text-xs text-gray-400 mt-1"
              style={{ fontFamily: 'Poppins_400Regular' }}
            >
              {lecture.room}
            </Text>
          )}
        </View>
        <View className="items-end">
          <Text
            className="text-base font-semibold text-gray-900"
            style={{ fontFamily: 'Poppins_600SemiBold' }}
          >
            {lecture.startTime}
          </Text>
          <Text
            className="text-xs text-gray-500"
            style={{ fontFamily: 'Poppins_400Regular' }}
          >
            {lecture.startTime} – {lecture.endTime}
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
            isOngoing={lecture.isOngoing}
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

export default LectureCards;
