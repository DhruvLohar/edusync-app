import React, { memo, useMemo } from 'react';
import { View, Text } from 'react-native';
import type { AttendanceRecord } from '~/type/Student';

interface AttendanceOverviewProps {
  history: AttendanceRecord[];
}

interface StatCardProps {
  title: string;
  value: string | number;
  cardClassName: string;
  valueClassName: string;
}

const StatCard = memo(({ title, value, cardClassName, valueClassName }: StatCardProps) => (
  <View className={`flex-1 rounded-2xl p-4 mr-3 last:mr-0 ${cardClassName}`}>
    <Text className="text-xs text-gray-600 mb-2" style={{ fontFamily: 'Poppins_500Medium' }}>
      {title}
    </Text>
    <Text className={`text-2xl ${valueClassName}`} style={{ fontFamily: 'Poppins_700Bold' }}>
      {value}
    </Text>
  </View>
));

const AttendanceOverview: React.FC<AttendanceOverviewProps> = ({ history }) => {
  const { totalPresent, totalAbsent, percentage } = useMemo(() => {
    const total = history.length;
    const present = history.filter((record) => record.is_present).length;
    const absent = total - present;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;

    return {
      totalPresent: present,
      totalAbsent: absent,
      percentage: rate,
    };
  }, [history]);

  return (
    <View className="mt-8 mb-2 px-5">
      <View className="flex-row justify-between items-center mb-4">
        <Text
          className="text-2xl text-gray-900"
          style={{ fontFamily: 'Poppins_600SemiBold' }}
        >
          Overview
        </Text>
      </View>

      <View className="flex-row gap-2 mt-2">
        <StatCard title="Present" value={totalPresent} cardClassName="bg-[#EAFBF2]" valueClassName="text-[#1F9D62]" />
        <StatCard title="Absent" value={totalAbsent} cardClassName="bg-[#FFF1F2]" valueClassName="text-[#DC5C75]" />
        <StatCard title="Overall %" value={`${percentage}%`} cardClassName="bg-[#EEF3FF]" valueClassName="text-[#4E6DD8]" />
      </View>
    </View>
  );
};

export default memo(AttendanceOverview);
