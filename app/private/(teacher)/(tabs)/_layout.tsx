import { Tabs } from "expo-router";
import { TouchableOpacity, View, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TabBarIcon } from "~/components/TabBarIcon";
import { GestureHandlerRootView } from "react-native-gesture-handler";

const { width } = Dimensions.get("window");

export default function TabLayout() {
  return (
      <Tabs
      screenOptions={{
        tabBarShowLabel: false,
        tabBarActiveTintColor: "#55a9d0",
        tabBarStyle: {
          backgroundColor: "#fff",
          height: 100,
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          justifyContent: "center",
          alignItems: "center",
          
        },
        headerShown: false,

      }}
    >
      {/* Left Tab */}
      <Tabs.Screen
        name="index"
        options={{
          title: "index",
          tabBarIcon: ({ color, focused }) => (
            <View style={{ marginBottom: -40 }}>
              <TabBarIcon
                name="home"
                color={focused ? "#55a9d0" : color}
              />
            </View>
          ),
        }}
      />

      {/* Center Floating Tab (now truly centered) */}
      <Tabs.Screen
        name="add"
        options={{
          title: "Add",
          tabBarButton: (props) => (
            <TouchableOpacity
              {...(props as any)}
              style={{
                position: "absolute",
                left: width / 6 - 32, 
                backgroundColor: "#0095FF",
                top:13 ,
                width: 64,
                height: 64,
                borderRadius: 32,
                justifyContent: "center",
                alignItems: "center",
                shadowOpacity: 0.3,
                shadowRadius: 6,
                elevation: 8,
              }}
            >
              <Ionicons name="bluetooth" size={28} color="#fff" />
            </TouchableOpacity>
          ),
        }}
      />

      Right Tab
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <View style={{ marginBottom: -40 }}>
              <TabBarIcon
                name="user"
                color={focused ? "#55a9d0" : color}
              />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
