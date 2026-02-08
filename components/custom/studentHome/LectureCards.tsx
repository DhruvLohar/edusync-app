import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LiveAttendanceResponse } from '~/type/Teacher';
import { fetchFromAPI } from '~/lib/api';
import { useAuthStore } from '~/lib/store/auth.store';

function LectureCards() {
  const router = useRouter();
  const profile = useAuthStore((state) => state.profile);
  const [lecture, setLecture] = useState<LiveAttendanceResponse | null>(null);

  async function fetchLectures() {
    
    const res = await fetchFromAPI('students/live-attendance');
    console.log(res);

    if (res && res.success && res.data) {
      setLecture(res.data);
    } else {
      setLecture(null);
    }
  }

  useEffect(() => {
    fetchLectures();
  }, []);

  const handleCardPress = () => {
    try {
      router.push({
        pathname: '/private/(student)/(tabs)/[class_id]',
        params: { class_id: lecture?.id.toString() as string, live_id: `${lecture?.live_id}${profile?.gr_no}` },
      });
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  const formatTime = (dateString: Date) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const LectureCard = ({ lecture }: { lecture: LiveAttendanceResponse }) => {
    const isMarked = lecture.already_marked;
    
    return (
      <TouchableOpacity
        onPress={handleCardPress}
        activeOpacity={0.7}
        disabled={isMarked}
      >
        <View
          className={`w-full rounded-2xl p-6 ${isMarked ? 'bg-gray-100' : 'bg-white'}`}
          style={{
            borderLeftWidth: 5,
            borderLeftColor: isMarked ? '#10b981' : '#3b82f6',
            opacity: isMarked ? 0.7 : 1,
          }}
        >
          {/* Header with status badge */}
          <View className="flex-row items-start justify-between mb-3">
            <View className="flex-1">
              <Text
                className={`text-xl font-semibold ${isMarked ? 'text-gray-600' : 'text-gray-900'} mb-1`}
                style={{ fontFamily: 'Poppins_600SemiBold' }}
              >
                {lecture.class.subject}
              </Text>
            </View>
            {isMarked && (
              <View className="bg-green-500 px-3 py-1 rounded-full">
                <Text
                  className="text-xs text-white font-semibold"
                  style={{ fontFamily: 'Poppins_600SemiBold' }}
                >
                  ✓ MARKED
                </Text>
              </View>
            )}
          </View>

          {/* Details */}
          <View className="flex-row justify-between items-center">
            <View className="flex-1">
              <Text
                className={`text-sm ${isMarked ? 'text-gray-500' : 'text-gray-600'} mb-1`}
                style={{ fontFamily: 'Poppins_400Regular' }}
              >
                {lecture.class.department} | {lecture.class.year}
              </Text>
              <Text
                className={`text-sm ${isMarked ? 'text-gray-500' : 'text-gray-600'}`}
                style={{ fontFamily: 'Poppins_400Regular' }}
              >
                {lecture.class.teacher?.name || 'Instructor'}
              </Text>
            </View>
            <View className="items-end">
              <Text
                className={`text-base font-semibold ${isMarked ? 'text-gray-500' : 'text-gray-900'}`}
                style={{ fontFamily: 'Poppins_600SemiBold' }}
              >
                {formatTime(lecture.start_time)}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View className="gap-4 px-4 pb-4">
      {lecture ? (
        <View className="gap-3">
          <Text
            className="text-lg font-semibold text-gray-900 px-2 mb-1"
            style={{ fontFamily: 'Poppins_600SemiBold' }}
          >
            Ongoing Lecture
          </Text>
          <LectureCard lecture={lecture} />
        </View>
      ) : (
        <View className="w-full bg-white rounded-2xl p-6 items-center justify-center" style={{ borderWidth: 1, borderColor: '#e5e7eb' }}>
          <Text
            className="text-base text-gray-600 text-center mb-1"
            style={{ fontFamily: 'Poppins_600SemiBold' }}
          >
            No Class Found
          </Text>
          <Text
            className="text-sm text-gray-500 text-center"
            style={{ fontFamily: 'Poppins_400Regular' }}
          >
            There are no ongoing lectures at the moment
          </Text>
        </View>
      )}
    </View>
  );
}

export default React.memo(LectureCards);
