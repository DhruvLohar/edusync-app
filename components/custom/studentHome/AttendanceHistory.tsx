import React, { memo, useMemo } from 'react';
import { View, Text } from 'react-native';
import type { AttendanceRecord } from '~/type/Student';

interface AttendanceHistoryProps {
  history: AttendanceRecord[];
}

const AttendanceHistory: React.FC<AttendanceHistoryProps> = ({ history }) => {
  const historyRecords = useMemo(
    () =>
      [...history].sort(
        (a, b) =>
          new Date(b.session.start_time).getTime() - new Date(a.session.start_time).getTime()
      ),
    [history]
  );

  const formatTime = (dateValue: string | Date) => {
    const date = new Date(dateValue);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

      <View className="gap-4">
        {historyRecords.length > 0 ? (
          historyRecords.map((record) => {
            const attendanceStatus = record.is_present ? 'Present' : 'Absent';
            const statusBadgeClass = record.is_present ? 'bg-[#EAFBF2]' : 'bg-[#FFF1F2]';
            const statusTextClass = record.is_present ? 'text-[#1F9D62]' : 'text-[#DC5C75]';

            return (
              <View
                key={record.id}
                className="w-full bg-white rounded-2xl p-6 flex-row"
                style={{
                  borderLeftWidth: 5,
                  borderLeftColor: record.is_present ? '#1F9D62' : '#DC5C75',
                }}
              >
                <View className="flex-1">
                  <Text
                    className="text-xl font-semibold text-gray-900 mb-2"
                    style={{ fontFamily: 'Poppins_600SemiBold' }}
                  >
                    {record.class?.subject || 'Lecture'}
                  </Text>
                  <View className={`self-start px-3 py-1 rounded-full mb-2 ${statusBadgeClass}`}>
                    <Text className={`text-xs ${statusTextClass}`} style={{ fontFamily: 'Poppins_600SemiBold' }}>
                      {attendanceStatus}
                    </Text>
                  </View>
                  <Text
                    className="text-sm text-gray-500"
                    style={{ fontFamily: 'Poppins_400Regular' }}
                  >
                    {record.class?.department || 'Department'} | {record.class?.year || 'Year'}
                  </Text>
                </View>

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
                  {record.marked_at ? (
                    <Text className="text-xs text-gray-500" style={{ fontFamily: 'Poppins_400Regular' }}>
                      Marked: {formatTime(record.marked_at)}
                    </Text>
                  ) : null}
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
              No attendance history found yet
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

export default memo(AttendanceHistory);
