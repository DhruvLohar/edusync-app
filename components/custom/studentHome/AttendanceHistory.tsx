import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { fetchFromAPI } from '~/lib/api';
import type { AttendanceRecord } from '~/type/Student';

interface TodaysLectureProps {
  history: AttendanceRecord[];
}

const TodaysLecture: React.FC<TodaysLectureProps> = ({ history }) => {
  const [todaysSessions, setTodaysSessions] = useState<AttendanceRecord[]>([]);
  const [currentDate, setCurrentDate] = useState<string>('');

  useEffect(() => {
    // Format today's date
    const today = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const formattedDate = `${dayNames[today.getDay()]} ${today.getDate()} ${monthNames[today.getMonth()]} ${today.getFullYear()}`;
    setCurrentDate(formattedDate);

    // Filter today's sessions from history
    filterTodaysSessions();
  }, [history]);

  const filterTodaysSessions = () => {
    if (!history || history.length === 0) {
      setTodaysSessions([]);
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const filtered = history.filter((record) => {
      const recordDate = new Date(record.session.start_time);
      recordDate.setHours(0, 0, 0, 0);
      return recordDate.getTime() === today.getTime();
    });

    setTodaysSessions(filtered);
  };

  const formatTime = (dateValue: string | Date) => {
    const date = new Date(dateValue);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getSessionStatus = (session: AttendanceRecord) => {
    if (session.is_present && session.marked_at) {
      return {
        status: 'Actual Check-in',
        icon: 'check-circle',
        color: '#10b981',
        time: formatTime(session.marked_at),
      };
    }
    return null;
  };

  const getBreakStatus = (session: AttendanceRecord) => {
    // No break status in AttendanceRecord, return null
    return null;
  };

  const formatDate = (dateValue: string | Date) => {
    const date = new Date(dateValue);
    const day = date.getDate();
    const month = date.toLocaleString([], { month: 'short' });
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };

  return (
    <View className="mt-6 mb-10 h-full px-5">
      {/* Attendance History Header */}
      <Text
        className="text-xl text-gray-900 mb-6 mt-5"
        style={{ fontFamily: 'Poppins_600SemiBold' }}
      >
        Attendance History
      </Text>

      {/* Sessions Column */}
      <View className="gap-4">
        {todaysSessions.length > 0 ? (
          todaysSessions.map((record, index) => {
            return (
              <View
                key={index}
                className="w-full bg-white rounded-2xl p-6 flex-row"
                style={{ 
                  borderLeftWidth: 5, 
                  borderLeftColor: '#3b82f6',
                }}
              >
                {/* Left Content */}
                <View className="flex-1">
                  <Text
                    className="text-xl font-semibold text-gray-900 mb-2"
                    style={{ fontFamily: 'Poppins_600SemiBold' }}
                  >
                    {record.class?.subject || 'Lecture'}
                  </Text>
                  <Text
                    className="text-sm text-gray-500"
                    style={{ fontFamily: 'Poppins_400Regular' }}
                  >
                    {record.class?.department || 'Department'} | {record.class?.year || 'Year'}
                  </Text>
                </View>

                {/* Right Content */}
                <View className="items-end justify-center gap-3">
                  <Text
                    className="text-lg font-semibold text-gray-900"
                    style={{ fontFamily: 'Poppins_600SemiBold' }}
                  >
                    {formatTime(record.session.start_time)}
                  </Text>
                  <Text
                    className="text-sm text-gray-500"
                    style={{ fontFamily: 'Poppins_400Regular' }}
                  >
                    {formatDate(record.session.start_time)}
                  </Text>
                </View>
              </View>
            );
          })
        ) : (
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
    </View>
  );
};

export default TodaysLecture;
