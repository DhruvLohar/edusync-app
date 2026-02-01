import { useState, useCallback } from "react";
import { Pressable, StatusBar, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ExpoBleCore from "modules/expo-ble-core";

function BleTeacherView() {
    const [status, setStatus] = useState("Idle");
    const [advertising, setAdvertising] = useState(false);

    const handleToggle = useCallback(async () => {
        if (advertising) {
            const message = await ExpoBleCore.stopAdvertising();
            setStatus(message);
            setAdvertising(false);
            return;
        }

        const message = await ExpoBleCore.startAdvertising();
        setStatus(message);
        setAdvertising(true);
    }, [advertising]);

    return (
        <SafeAreaView className="flex-1 items-center justify-center bg-white">
            <StatusBar barStyle="dark-content" />

            <Text className="text-xl font-semibold mb-4">BLE Teacher View</Text>

            <Pressable
                onPress={handleToggle}
                className={`h-24 w-24 rounded-full items-center justify-center ${
                    advertising ? "bg-red-500" : "bg-green-500"
                } shadow-lg`}
            >
                <Text className="text-white text-base font-medium">
                    {advertising ? "Stop" : "Start"}
                </Text>
            </Pressable>

            <Text className="mt-4 text-sm text-gray-600">{status}</Text>
        </SafeAreaView>
    );
}

export default BleTeacherView;