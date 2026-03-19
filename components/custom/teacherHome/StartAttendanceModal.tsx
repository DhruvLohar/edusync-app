import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import BottomModal from '~/components/ui/BottomModal';
import { Button } from '~/components/ui/Button';

interface StartAttendanceClass {
  id: number;
  subject: string;
  department: string;
  year: string;
}

interface StartAttendanceModalProps {
  isVisible: boolean;
  selectedClass: StartAttendanceClass | null;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (payload: { class_id: number; division: 'A' | 'B'; lecture_time: string }) => Promise<void>;
}

const DIVISION_OPTIONS = ['A', 'B'] as const;

const LECTURE_TIMING_OPTIONS = [
  { value: 'AM830', label: '8:30 AM - 9:30 AM' },
  { value: 'AM930', label: '9:30 AM - 10:30 AM' },
  { value: 'AM1030', label: '10:30 AM - 11:30 AM' },
  { value: 'AM1130', label: '11:30 AM - 12:30 PM' },
  { value: 'PM1230', label: '12:30 PM - 1:15 PM' },
  { value: 'PM115', label: '1:15 PM - 2:15 PM' },
  { value: 'PM215', label: '2:15 PM - 3:15 PM' },
  { value: 'PM315', label: '3:15 PM - 4:15 PM' },
] as const;

function StartAttendanceModal({
  isVisible,
  selectedClass,
  loading = false,
  onClose,
  onSubmit,
}: StartAttendanceModalProps) {
  const [division, setDivision] = useState<'A' | 'B'>('A');
  const [lectureTiming, setLectureTiming] = useState<string>('AM830');

  useEffect(() => {
    if (!isVisible) return;
    setDivision('A');
    setLectureTiming('AM830');
  }, [isVisible]);

  const handleStartAttendance = async () => {
    if (!selectedClass) return;
    await onSubmit({
      class_id: selectedClass.id,
      division,
      lecture_time: lectureTiming,
    });
  };

  return (
    <BottomModal isVisible={isVisible} onClose={onClose}>
      <View className="pb-4">
        <Text className="text-2xl text-gray-900 mb-1" style={{ fontFamily: 'Poppins_600SemiBold' }}>
          Start Attendance
        </Text>
        <Text className="text-sm text-gray-600 mb-4" style={{ fontFamily: 'Poppins_400Regular' }}>
          {selectedClass ? `${selectedClass.subject} • ${selectedClass.department} ${selectedClass.year}` : 'Select class'}
        </Text>

        <Text className="text-base text-gray-900 mb-2" style={{ fontFamily: 'Poppins_500Medium' }}>
          Division
        </Text>
        <View className="flex-row gap-3 mb-5">
          {DIVISION_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option}
              onPress={() => setDivision(option)}
              className={`px-4 py-2 rounded-full border ${division === option ? 'bg-[#0095FF] border-[#0095FF]' : 'bg-white border-gray-300'}`}
              activeOpacity={0.8}
            >
              <Text
                className={`${division === option ? 'text-white' : 'text-gray-700'}`}
                style={{ fontFamily: 'Poppins_500Medium' }}
              >
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text className="text-base text-gray-900 mb-2" style={{ fontFamily: 'Poppins_500Medium' }}>
          Lecture Timing
        </Text>
        <View className="gap-2 mb-6">
          {LECTURE_TIMING_OPTIONS.map((option) => {
            const selected = lectureTiming === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                onPress={() => setLectureTiming(option.value)}
                className={`px-4 py-3 rounded-xl border ${selected ? 'bg-blue-50 border-[#0095FF]' : 'bg-white border-gray-200'}`}
                activeOpacity={0.8}
              >
                <Text
                  className={`${selected ? 'text-[#0095FF]' : 'text-gray-700'}`}
                  style={{ fontFamily: selected ? 'Poppins_500Medium' : 'Poppins_400Regular' }}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View className="flex-row gap-3">
          <Button
            title="Cancel"
            outline
            onPress={onClose}
            disabled={loading}
            className="flex-1"
          />
          <Button
            title="Start"
            onPress={handleStartAttendance}
            loading={loading}
            className="flex-1 !bg-[#0095FF]"
          />
        </View>
      </View>
    </BottomModal>
  );
}

export default React.memo(StartAttendanceModal);
