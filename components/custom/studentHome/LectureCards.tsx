import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import dummyData from '~/assets/dummy.json';

interface DummyLecture {
  id: number;
  subject: string;
  department: string;
  code: string;
  classId: string;
  startTime: string;
  endTime: string;
  isOngoing: boolean;
}

interface LectureCardsProps {
  history?: any[];
}

const LectureCards: React.FC<LectureCardsProps> = ({ history }) => {
  const router = useRouter();
  const [ongoingLectures, setOngoingLectures] = useState<DummyLecture[]>([]);
  const [upcomingLectures, setUpcomingLectures] = useState<DummyLecture[]>([]);

  useEffect(() => {
    setOngoingLectures(dummyData.ongoingLectures || []);
    setUpcomingLectures(dummyData.upcomingLectures || []);
  }, []);

  const handleCardPress = (classId: string) => {
    try {
      router.push({
        pathname: '/private/(student)/(tabs)/[class_id]',
        params: { class_id: classId },
      });
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  const LectureCard = ({ lecture, isOngoing }: { lecture: DummyLecture; isOngoing?: boolean }) => (
    <TouchableOpacity
      onPress={() => handleCardPress(lecture.classId)}
      activeOpacity={0.7}
    >
      <View
        className="w-full bg-white rounded-2xl p-6 flex-row"
        style={{ 
          borderLeftWidth: 5, 
          borderLeftColor: isOngoing ? '#ef4444' : '#3b82f6',
        }}
      >
      {/* Left Content */}
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
          className="text-xl font-semibold text-gray-900 mb-2"
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
      </View>

      {/* Right Content */}
      <View className="items-end justify-center gap-3">
        <Text
          className="text-lg font-semibold text-gray-900"
          style={{ fontFamily: 'Poppins_600SemiBold' }}
        >
          {lecture.startTime}
        </Text>
        <Text
          className="text-sm text-gray-500"
          style={{ fontFamily: 'Poppins_400Regular' }}
        >
          {lecture.startTime} - {lecture.endTime}
        </Text>
      </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View className="gap-4 px-4 pb-4">
      {/* Ongoing Lectures */}
      {ongoingLectures.length > 0 && (
        <View className="gap-3">
          <Text
            className="text-lg font-semibold text-gray-900 px-2"
            style={{ fontFamily: 'Poppins_600SemiBold' }}
          >
            Now
          </Text>
          {ongoingLectures.map((lecture) => (
            <LectureCard key={lecture.id} lecture={lecture} isOngoing={true} />
          ))}
        </View>
      )}

      {/* Upcoming Lectures */}
      {upcomingLectures.length > 0 && (
        <View className="gap-3">
          <Text
            className="text-lg font-semibold text-gray-900 px-2"
            style={{ fontFamily: 'Poppins_600SemiBold' }}
          >
            Today
          </Text>
          {upcomingLectures.map((lecture) => (
            <LectureCard key={lecture.id} lecture={lecture} />
          ))}
        </View>
      )}

      {/* No Lectures */}
      {ongoingLectures.length === 0 && upcomingLectures.length === 0 && (
        <View className="w-full bg-white rounded-2xl p-6 items-center justify-center" style={{ borderWidth: 1, borderColor: '#e5e7eb' }}>
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
