import { StatusBar, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function BleStudentView() {
    return (
        <SafeAreaView className="flex-1">
            <StatusBar barStyle="dark-content" />

            <Text>BLE Student View</Text>
        </SafeAreaView>
    )
}

export default BleStudentView;