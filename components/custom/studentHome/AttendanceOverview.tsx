import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { AttendanceRecord } from '~/type/Student';

interface AttendanceOverviewProps {
  history: AttendanceRecord[];
}

const AttendanceOverview: React.FC<AttendanceOverviewProps> = ({ history }) => {
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  // Calculate attendance statistics
  const calculateStats = () => {
    const monthRecords = history.filter((record) => {
      const recordDate = new Date(record.session.start_time);
      return recordDate.getMonth() === selectedMonth && recordDate.getFullYear() === selectedYear;
    });

    const totalPresent = monthRecords.filter((r) => r.is_present).length;
    const totalAbsent = monthRecords.filter((r) => !r.is_present).length;
    const total = monthRecords.length;
    const percentage = total > 0 ? Math.round((totalPresent / total) * 100) : 0;

    return { totalPresent, totalAbsent, percentage };
  };

  const { totalPresent, totalAbsent, percentage } = calculateStats();

  // Get month/year for display
  const getMonthYear = (month: number, year: number) => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[month]} ${year}`;
  };

  // Get all available months from history
  const getAvailableMonths = () => {
    const months = new Set<string>();
    history.forEach((record) => {
      const recordDate = new Date(record.session.start_time);
      months.add(`${recordDate.getMonth()}-${recordDate.getFullYear()}`);
    });
    return Array.from(months).sort().reverse();
  };

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <View className="mt-10 mb-10 px-5">
      {/* Overview Header with Month Selector */}
      <View className="flex-row justify-between items-center mb-8 -mt-5">
        <Text
          className="text-2xl text-gray-900"
          style={{ fontFamily: 'Poppins_600SemiBold' }}
        >
          Overview
        </Text>
        <TouchableOpacity
          onPress={() => setShowMonthPicker(!showMonthPicker)}
          className="flex-row items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg"
        >
          <Text
            className="text-gray-700"
            style={{ fontFamily: 'Poppins_500Medium' }}
          >
            {getMonthYear(selectedMonth, selectedYear)}
          </Text>
          <MaterialCommunityIcons name="chevron-down" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Month Picker Dropdown */}
      {showMonthPicker && (
        <View className="mb-6 bg-white border border-gray-200 rounded-lg overflow-hidden">
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={{ maxHeight: 200 }}>
            {getAvailableMonths().map((monthYear) => {
              const [month, year] = monthYear.split('-').map(Number);
              const isSelected = month === selectedMonth && year === selectedYear;
              return (
                <TouchableOpacity
                  key={monthYear}
                  onPress={() => {
                    setSelectedMonth(month);
                    setSelectedYear(year);
                    setShowMonthPicker(false);
                  }}
                  className={isSelected ? 'px-4 py-3 border-b border-gray-100 bg-blue-50' : 'px-4 py-3 border-b border-gray-100'}
                >
                  <Text
                    className={isSelected ? 'text-blue-600 font-semibold' : 'text-gray-700'}
                    style={{ fontFamily: 'Poppins_500Medium' }}
                  >
                    {monthNames[month]} {year}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Cards Row */}
      <View className="flex-row gap-8 px-4 justify-between mt-5">
        {/* Presence Card */}
        <View className="flex-1 flex-col border-r border-gray-400 ">
          <Text
            className="text-base text-gray-600 mb-4"
            style={{ fontFamily: 'Poppins_400Regular' }}
          >
            Presence
          </Text>
          <Text
            className="text-4xl font-bold text-gray-900"
            style={{ fontFamily: 'Poppins_700Bold' }}
          >
            {totalPresent}
          </Text>
        </View>

        {/* Absence Card */}
        <View className="flex-1 flex-col justify-center border-r border-gray-400 ">
          <Text
            className="text-base text-gray-600 mb-4"
            style={{ fontFamily: 'Poppins_400Regular' }}
          >
            Absence
          </Text>
          <Text
            className="text-4xl font-bold text-gray-900"
            style={{ fontFamily: 'Poppins_700Bold' }}
          >
            {totalAbsent}
          </Text>
        </View>

        {/* Attendance Percentage Card */}
        <View className="flex-1 flex-col">
          <Text
            className="text-base text-gray-600 mb-4"
            style={{ fontFamily: 'Poppins_400Regular' }}
          >
            Attendance
          </Text>
          <Text
            className="text-4xl font-bold text-gray-900"
            style={{ fontFamily: 'Poppins_700Bold' }}
          >
            {percentage}%
          </Text>
        </View>
      </View>
    </View>
  );
};

export default AttendanceOverview;
