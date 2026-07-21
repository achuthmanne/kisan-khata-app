import React, { useEffect, useState } from "react";
import { Modal, StyleSheet, TouchableOpacity, View, Dimensions } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, runOnJS } from "react-native-reanimated";

interface SmoothBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const { height } = Dimensions.get("window");

export default function SmoothBottomSheet({ visible, onClose, children }: SmoothBottomSheetProps) {
  const [showModal, setShowModal] = useState(visible);
  const translateY = useSharedValue(height);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setShowModal(true);
    } else {
      translateY.value = withTiming(height, { duration: 400, easing: Easing.bezier(0.25, 1, 0.5, 1) });
      opacity.value = withTiming(0, { duration: 400 }, (finished) => {
        if (finished) {
          runOnJS(setShowModal)(false);
        }
      });
    }
  }, [visible]);

  const handleShow = () => {
    translateY.value = withTiming(0, { duration: 400, easing: Easing.bezier(0.25, 1, 0.5, 1) });
    opacity.value = withTiming(1, { duration: 400 });
  };

  const animatedBackgroundStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const animatedContentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!showModal) return null;

  return (
    <Modal visible={showModal} transparent animationType="none" onRequestClose={onClose} onShow={handleShow} statusBarTranslucent>
      <View style={styles.container}>
        {/* Dark Overlay Background */}
        <Animated.View style={[styles.backdrop, animatedBackgroundStyle]}>
          <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />
        </Animated.View>

        {/* Bottom Sheet Content */}
        <Animated.View style={[styles.contentWrapper, animatedContentStyle]}>
          <View style={styles.content}>{children}</View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  backdropTouch: {
    flex: 1,
  },
  contentWrapper: {
    width: "100%",
  },
  content: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 20, 
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    overflow: "hidden",
  },
});
