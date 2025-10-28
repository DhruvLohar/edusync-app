import React, { useState } from 'react';
import { View, Text, FlatList, ListRenderItem, TouchableOpacity, Switch } from 'react-native';
import { SharedValue } from 'react-native-reanimated'; 

// --- TYPE DEFINITIONS ---
interface Student {
  id: string;
  name: string;
  time: string | null;
  status: 'present' | 'pending';
  isManualMarked?: boolean;
}

interface AttendanceListProps {
  isScanning: boolean;
  isSessionActive: boolean;
  onEndSession: () => void;
  sheetY: SharedValue<number>; 
}

// Mock list data with explicit status
const initialMockStudents: Student[] = [
  // PRESENT Students (Initial Mock)
  { id: '1', name: 'Nandani Kadave', time: '9:01 am', status: 'present' },
  { id: '2', name: 'Tanvi Kinjale', time: '9:01 am', status: 'present' },
  { id: '3', name: 'Vivek Sharma', time: '9:02 am', status: 'present' },
  // PENDING Students
  { id: '101', name: 'Dhruv Lohar', time: null, status: 'pending', isManualMarked: false },
  { id: '102', name: 'Mohit Jain', time: null, status: 'pending', isManualMarked: false },
  { id: '103', name: 'Rohan Gupta', time: null, status: 'pending', isManualMarked: false },
];

const AttendanceList: React.FC<AttendanceListProps> = ({ isScanning, isSessionActive, onEndSession, sheetY }) => {
  
  const [mockStudents, setMockStudents] = useState<Student[]>(initialMockStudents);
  const [activeTab, setActiveTab] = useState<'present' | 'pending'>('present');

  // Function to move student and update status upon marking
  const toggleMarkStatus = (studentId: string, markPresent: boolean) => {
    setMockStudents(prevStudents => 
      prevStudents.map(student => {
        if (student.id === studentId) {
          const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          return {
            ...student,
            isManualMarked: markPresent,
            // Key change: Update status and time if marked present
            status: markPresent ? 'present' : 'pending',
            time: markPresent ? currentTime : null,
          };
        }
        return student;
      })
    );
  };

  // --- Scanning View (Initial State) ---
  if (isScanning && !isSessionActive) { 
    return (
      <View 
          className="w-full bg-white items-center justify-center flex-1"
          style={{ borderTopLeftRadius: 40, borderTopRightRadius: 40, marginTop: -40 }}
      >
        <Text className="text-xl font-medium text-gray-700">
          Scanning for students...
        </Text>
      </View>
    );
  }

  // --- Active Session View ---
  if (isSessionActive) {
    // Filter lists based on the current status in state
    const presentStudents = mockStudents.filter(s => s.status === 'present');
    const pendingStudents = mockStudents.filter(s => s.status === 'pending');

    const displayStudents = activeTab === 'present' ? presentStudents : pendingStudents;

    const renderItem: ListRenderItem<Student> = ({ item }) => (
      <View className="flex-row justify-between items-center py-3 px-4 border-b border-gray-100">
        <View className="flex-row items-center">
          {/* Placeholder gray circle */}
          <View className="w-4 h-4 rounded-full bg-gray-300 mr-3" />
          <Text className="text-base font-semibold text-gray-800">{item.name}</Text>
        </View>
        
        {/* --- CONDITIONAL RENDERING FOR PENDING/PRESENT --- */}
        {item.status === 'pending' ? (
          // PENDING VIEW: Mark Button and Toggle
          <View className="flex-row items-center space-x-2">
            
            {/* Mark Button */}
            <TouchableOpacity 
              onPress={() => toggleMarkStatus(item.id, true)} // Only allows marking PRESENT
              className="px-3 py-1 rounded-full"
              style={{ backgroundColor: '#0095FF' }}
            >
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }}>
                Mark
              </Text>
            </TouchableOpacity>
            
            {/* Toggle Switch (Visual, but the Mark button handles the core action) */}
            <Switch
              // Custom colors to match the UI (Blue thumb/track when marked)
              trackColor={{ false: "#E0E0E0", true: "#7CBEFF" }}
              thumbColor={item.isManualMarked ? "#0095FF" : "#F4F4F4"}
              // Toggling the switch immediately marks them present
              onValueChange={(newValue) => toggleMarkStatus(item.id, newValue)}
              value={item.isManualMarked}
            />
          </View>
        ) : (
          // PRESENT VIEW: Time Stamp
          <Text className="text-sm text-gray-500">{item.time}</Text>
        )}
      </View>
    );

    return (
      <View 
        className="w-full bg-white flex-1"
        style={{ borderTopLeftRadius: 40, borderTopRightRadius: 40, marginTop: -40 }}
      >
        
        {/* Pull Handle/Grabber */}
        <View className="w-full items-center pt-6 pb-4"> 
            <View className="w-10 h-1 bg-gray-300 rounded-full" />
        </View>
        
        {/* Live Attendance Header */}
        <Text className="text-xl text-center  text-gray-800 px-4 pb-2" style={{ fontFamily: 'Poppins_600SemiBold' }}>Live Attendance</Text>

        {/* Tab Navigation */}
        <View className="flex-row justify-between px-20 pb-0 pt-2 mt-5">
          {/* Present Tab */}
          <TouchableOpacity
            onPress={() => setActiveTab('present')}
            className="mr-6 pb-2"
            style={{ borderBottomWidth: activeTab === 'present' ? 2 : 0, borderBottomColor: '#0095FF' }}
          >
            <Text className={`text-lg ${activeTab === 'present' ? 'text-[#0095FF]' : 'text-gray-500'}`} style={{ fontFamily: 'Poppins_400Regular' }}>
              Present ({presentStudents.length})
            </Text>
          </TouchableOpacity>
          {/* Pending Tab */}
          <TouchableOpacity
            onPress={() => setActiveTab('pending')}
            className="pb-2"
            style={{ borderBottomWidth: activeTab === 'pending' ? 2 : 0, borderBottomColor: '#0095FF' }}
          >
            <Text className={`text-lg ${activeTab === 'pending' ? 'text-[#0095FF]' : 'text-gray-500'}`} style={{ fontFamily: 'Poppins_400Regular' }}>
              Pending ({pendingStudents.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Student List */}
        <FlatList
          data={displayStudents}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 120 }} 
          showsVerticalScrollIndicator={false}
        />
        
        {/* Floating End Session Button */}
        <View className="absolute bottom-40 w-full items-center z-20"> 
          <TouchableOpacity 
              onPress={onEndSession} 
              className="w-[80%] h-16 bg-[#0095FF] rounded-full items-center justify-center shadow-md">
            <Text className="text-xl font-bold text-white">End Session</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  
  return null;
};

export default AttendanceList;