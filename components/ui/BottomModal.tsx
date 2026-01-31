import React, { useEffect, useMemo } from "react";
import { View, StyleSheet, useWindowDimensions, Dimensions } from "react-native";
import Modal from "react-native-modal";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
} from "react-native-reanimated";

const MIN_HEIGHT = 200;

interface BottomModalProps {
    isVisible: boolean;
    onClose: () => void;
    children: React.ReactNode;
}

const styles = StyleSheet.create({
    modal: {
        justifyContent: "flex-end",
        margin: 0,
        flex: 1,
    },
    modalContent: {
        backgroundColor: "white",
        paddingTop: 12,
        paddingHorizontal: 12,
        borderTopRightRadius: 16,
        borderTopLeftRadius: 16,
        paddingBottom: 20,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        overflow: "hidden",
    },
    handleBarWrapper: {
        alignSelf: "stretch",
        alignItems: "center",
        paddingVertical: 12,
        marginBottom: 4,
    },
    barIcon: {
        width: 48,
        height: 4,
        backgroundColor: "#d1d5db",
        borderRadius: 2,
    },
});

export const BottomModal: React.FC<BottomModalProps> = ({ isVisible, onClose, children }) => {
    const { height: windowHeight } = useWindowDimensions();
    // Use full physical screen height so sheet can be dragged to true fullscreen
    const fullScreenHeight = useMemo(
        () => Math.max(windowHeight, Dimensions.get("screen").height),
        [windowHeight]
    );
    const INITIAL_HEIGHT = useMemo(() => fullScreenHeight * 0.5, [fullScreenHeight]);
    const MAX_HEIGHT = useMemo(() => fullScreenHeight, [fullScreenHeight]);

    const sheetHeight = useSharedValue(INITIAL_HEIGHT);
    const startHeight = useSharedValue(INITIAL_HEIGHT);
    const maxHeightSv = useSharedValue(MAX_HEIGHT);
    const initialHeightSv = useSharedValue(INITIAL_HEIGHT);

    useEffect(() => {
        maxHeightSv.value = MAX_HEIGHT;
        initialHeightSv.value = INITIAL_HEIGHT;
    }, [MAX_HEIGHT, INITIAL_HEIGHT]);

    useEffect(() => {
        if (isVisible) {
            sheetHeight.value = INITIAL_HEIGHT;
            startHeight.value = INITIAL_HEIGHT;
        }
    }, [isVisible, INITIAL_HEIGHT]);

    const pan = Gesture.Pan()
        .onStart(() => {
            startHeight.value = sheetHeight.value;
        })
        .onUpdate((e) => {
            const next = startHeight.value - e.translationY;
            sheetHeight.value = Math.min(maxHeightSv.value, Math.max(MIN_HEIGHT, next));
        })
        .onEnd((e) => {
            const current = sheetHeight.value;
            const velocity = -e.velocityY;
            const mid = initialHeightSv.value + (maxHeightSv.value - initialHeightSv.value) / 2;
            if (velocity > 300 || current > mid) {
                sheetHeight.value = withSpring(maxHeightSv.value, {
                    damping: 20,
                    stiffness: 200,
                });
            } else if (velocity < -300 || current < initialHeightSv.value) {
                sheetHeight.value = withSpring(initialHeightSv.value, {
                    damping: 20,
                    stiffness: 200,
                });
            }
        });

    const animatedContentStyle = useAnimatedStyle(() => ({
        height: sheetHeight.value,
    }));

    return (
        <Modal
            onBackButtonPress={onClose}
            isVisible={isVisible}
            swipeDirection={["down"]}
            onSwipeComplete={onClose}
            animationIn="slideInUp"
            animationOut="slideOutDown"
            animationInTiming={300}
            animationOutTiming={300}
            backdropTransitionInTiming={300}
            backdropTransitionOutTiming={300}
            useNativeDriver={false}
            hideModalContentWhileAnimating={false}
            propagateSwipe={true}
            style={styles.modal}
            avoidKeyboard
        >
            <Animated.View style={[styles.modalContent, animatedContentStyle]}>
                {/* Handle Bar only - drag here to expand/shrink; list area scrolls normally */}
                <GestureDetector gesture={pan}>
                    <View style={styles.handleBarWrapper}>
                        <View style={styles.barIcon} />
                    </View>
                </GestureDetector>
                {children}
            </Animated.View>
        </Modal>
    );
};