import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, FlatList, ListRenderItem, ListRenderItemInfo, TouchableOpacity, Alert, Dimensions, TextInput } from 'react-native';
import { SharedValue } from 'react-native-reanimated';
import { Attendance } from '~/type/Teacher';
import { User } from '~/type/user';

import io, { Socket } from 'socket.io-client';
import { API_URL } from '~/lib/api';

interface AttendanceListProps {
  isScanning: boolean;
  isSessionActive: boolean;
  sessionEnded?: boolean;
  onEndSession: () => void;
  onRecognizeStudent?: () => void;
  sheetY?: SharedValue<number> | null;
  attendance?: Attendance | null;
  students?: User[];
}

interface MarkedStudent extends User {
  markedAt: string;
}

const AttendanceList: React.FC<AttendanceListProps> = ({ 
  isScanning, 
  isSessionActive, 
  sessionEnded = false,
  onEndSession, 
  onRecognizeStudent,
  sheetY, 
  attendance, 
  students 
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [pendingStudents, setPendingStudents] = useState<User[]>(students || []);
  const [markedStudents, setMarkedStudents] = useState<MarkedStudent[]>([]);
  const [activeTab, setActiveTab] = useState<'present' | 'pending'>('present');

  useEffect(() => {
    if (students && students.length > 0) {
      setPendingStudents(students);
    }
  }, [students]);

  useEffect(() => {
    const newSocket = io(API_URL, {
      extraHeaders: {
        token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJUeXBlIjoidGVhY2hlciIsImlhdCI6MTc2MTY4MTYwOSwiZXhwIjoxNzYxOTQwODA5fQ.h3yhAIuMqvbpkcDggAiRtJaifkAgOi3rRYYj61VFQK8"
      }
    });
    setSocket(newSocket);

    newSocket.on('student_marked_present', (data) => {
      const studentId = data.student.id;
      const markedAt = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      setPendingStudents(prev => prev.filter(s => s.id !== studentId));
      setMarkedStudents(prev =>
        prev.some(m => m.id === studentId) ? prev : [...prev, { ...data.student, markedAt }]
      );
    });

    return () => { newSocket.disconnect(); };
  }, [attendance?.live_id]);

  // --- Search Logic ---
  const filteredPresent = useMemo(() => {
    return markedStudents.filter(s => (s.name ?? '').toLowerCase().includes(searchQuery.toLowerCase()));
  }, [markedStudents, searchQuery]);

  const filteredPending = useMemo(() => {
    return pendingStudents.filter(s => (s.name ?? '').toLowerCase().includes(searchQuery.toLowerCase()));
  }, [pendingStudents, searchQuery]);

  // After "End Session": show only Present tab and "Recognize Student" button
  if (sessionEnded) {
    const renderSummaryPresentItem: ListRenderItem<MarkedStudent> = ({ item }) => (
      <View className="flex-row justify-between items-center py-3 px-4 border-b border-gray-100">
        <View className="flex-row items-center flex-1">
          <View className="w-4 h-4 rounded-full bg-green-500 mr-3" />
          <View>
            <Text className="text-base font-semibold text-gray-800">{item.name}</Text>
            <Text className="text-xs text-gray-400">{item.markedAt}</Text>
          </View>
        </View>
      </View>
    );
    return (
      <View className="w-full bg-white" style={{ flex: 1, minHeight: 320, borderTopLeftRadius: 40, borderTopRightRadius: 40 }}>
        <Text className="text-xl text-gray-800 px-4 pb-2 pt-2" style={{ fontFamily: 'Poppins_600SemiBold' }}>
          Live Attendance
        </Text>
        <View className="px-5 py-2">
          <TextInput
            placeholder="Search students..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="bg-gray-100 px-4 py-3 rounded-2xl text-gray-700"
            style={{ fontFamily: 'Poppins_400Regular' }}
          />
        </View>
        <Text className="text-lg text-[#0095FF] px-4 pb-2 pt-2" style={{ fontFamily: 'Poppins_400Regular', borderBottomWidth: 2, borderBottomColor: '#0095FF', alignSelf: 'flex-start', marginLeft: 16 }}>
          Present ({filteredPresent.length})
        </Text>
        <View style={{ flex: 1, maxHeight: Dimensions.get('window').height * 0.55, minHeight: 180 }}>
          <FlatList
            data={filteredPresent}
            renderItem={renderSummaryPresentItem}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={{ paddingBottom: 120 }}
            showsVerticalScrollIndicator={true}
            ListEmptyComponent={
              <View className="items-center justify-center py-10">
                <Text className="text-gray-400 text-base">{searchQuery ? 'No matching students' : 'No students present'}</Text>
              </View>
            }
          />
        </View>
        <View className="absolute bottom-10 w-full items-center z-20">
          <TouchableOpacity onPress={onRecognizeStudent} className="w-[80%] h-16 bg-[#0095FF] rounded-full items-center justify-center shadow-md">
            <Text className="text-xl font-bold text-white">Recognize Student</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (isScanning && !isSessionActive) {
    return (
      <View className="w-full bg-white items-center justify-center" style={{ minHeight: 160, borderTopLeftRadius: 40, borderTopRightRadius: 40 }}>
        <Text className="text-xl font-medium text-gray-700">Scanning for students...</Text>
      </View>
    );
  }

  if (isSessionActive) {
    // --- RENDER PRESENT ITEM (With Unmark Button) ---
    const renderPresentItem: ListRenderItem<MarkedStudent> = ({ item }) => (
      <View className="flex-row justify-between items-center py-3 px-4 border-b border-gray-100">
        <View className="flex-row items-center flex-1">
          <View className="w-4 h-4 rounded-full bg-green-500 mr-3" />
          <View>
            <Text className="text-base font-semibold text-gray-800">{item.name}</Text>
            <Text className="text-xs text-gray-400">{item.markedAt}</Text>
          </View>
        </View>
        
        <TouchableOpacity
          onPress={() => {
            const studentId = item.id;
            // 1. Remove from marked
            setMarkedStudents(prev => prev.filter(s => s.id !== studentId));
            // 2. Add back to pending (without the markedAt property)
            const { markedAt, ...userBase } = item;
            setPendingStudents(prev => [...prev, userBase]);
            
            // 3. Inform Server
            if (socket && attendance?.live_id) {
              socket.emit('manual_unmark_student', { 
                live_id: attendance.live_id, 
                student_id: studentId 
              });
            }
          }}
          className="px-3 py-1 rounded-full border border-red-400"
        >
          <Text className="text-red-500 font-bold text-xs text-center">Unmark</Text>
        </TouchableOpacity>
      </View>
    );
    
    // --- RENDER PENDING ITEM ---
    const renderPendingItem: ListRenderItem<User> = ({ item }) => (
      <View className="flex-row justify-between items-center py-3 px-4 border-b border-gray-100">
        <View className="flex-row items-center">
          <View className="w-4 h-4 rounded-full bg-gray-300 mr-3" />
          <Text className="text-base font-semibold text-gray-800">{item.name}</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            const studentId = item.id;
            const markedAt = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            setPendingStudents(prev => prev.filter(s => s.id !== studentId));
            setMarkedStudents(prev => [...prev, { ...item, markedAt }]);
            if (socket && attendance?.live_id) {
              socket.emit('manual_mark_student', { live_id: attendance.live_id, student_id: studentId });
            }
          }}
          className="px-3 py-1 rounded-full bg-[#0095FF]"
        >
          <Text className="text-white font-bold text-xs">Mark</Text>
        </TouchableOpacity>
      </View>
    );

    return (
      <View className="w-full bg-white" style={{ flex: 1, minHeight: 320, borderTopLeftRadius: 40, borderTopRightRadius: 40 }}>
        <Text className="text-xl text-gray-800 px-4 pb-2 pt-2" style={{ fontFamily: 'Poppins_600SemiBold' }}>
          Live Attendance
        </Text>

        <View className="px-5 py-2">
          <TextInput
            placeholder="Search students..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="bg-gray-100 px-4 py-3 rounded-2xl text-gray-700"
            style={{ fontFamily: 'Poppins_400Regular' }}
          />
        </View>

        <View className="flex-row justify-between px-20 pb-0 pt-2 mt-2">
          <TouchableOpacity onPress={() => setActiveTab('present')} className="mr-6 pb-2" style={{ borderBottomWidth: activeTab === 'present' ? 2 : 0, borderBottomColor: '#0095FF' }}>
            <Text className={`text-lg ${activeTab === 'present' ? 'text-[#0095FF]' : 'text-gray-500'}`} style={{ fontFamily: 'Poppins_400Regular' }}>
              Present ({markedStudents.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveTab('pending')} className="pb-2" style={{ borderBottomWidth: activeTab === 'pending' ? 2 : 0, borderBottomColor: '#0095FF' }}>
            <Text className={`text-lg ${activeTab === 'pending' ? 'text-[#0095FF]' : 'text-gray-500'}`} style={{ fontFamily: 'Poppins_400Regular' }}>
              Pending ({pendingStudents.length})
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1, maxHeight: Dimensions.get('window').height * 0.55, minHeight: 180 }}>
          <FlatList<MarkedStudent | User>
            data={activeTab === 'present' ? filteredPresent : filteredPending}
            renderItem={(info) => (activeTab === 'present' ? renderPresentItem(info as ListRenderItemInfo<MarkedStudent>) : renderPendingItem(info as ListRenderItemInfo<User>))}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={{ paddingBottom: 120 }}
            showsVerticalScrollIndicator={true}
            ListEmptyComponent={
              <View className="items-center justify-center py-10">
                <Text className="text-gray-400 text-base">
                  {searchQuery ? "No matching students" : activeTab === 'present' ? "No students present" : "All students marked!"}
                </Text>
              </View>
            }
          />
        </View>

        <View className="absolute bottom-10 w-full items-center z-20">
          <TouchableOpacity onPress={onEndSession} className="w-[80%] h-16 bg-[#0095FF] rounded-full items-center justify-center shadow-md">
            <Text className="text-xl font-bold text-white">End Session</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return null;
};

export default AttendanceList;