import React, { useEffect } from "react";
import { StyleSheet, View, Modal, Platform } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import AppText from "./AppText";

interface Props {
  visible: boolean;
  type?: "loading" | "saving" | "deleting" | "updating" | "pin" | "open" | "sending_otp" | "verifying_otp";
  language?: "te" | "en";
}

export default function AgriLoader({ visible, type = "loading", language = "en" }: Props) {

  /* ---------- DYNAMIC TEXT ---------- */
  const getText = () => {
    if (language === "te") {
      switch (type) {
        case "saving": return "సేవ్ అవుతోంది...";
        case "deleting": return "తొలగిస్తోంది...";
        case "updating": return "అప్డేట్ అవుతోంది...";
        case "sending_otp": return "OTP పంపుతున్నాం...";
        case "verifying_otp": return "OTP నిర్ధారిస్తున్నాం...";
        default: return "లోడ్ అవుతోంది...";
      }
    } else {
      switch (type) {
        case "saving": return "Saving...";
        case "deleting": return "Deleting...";
        case "updating": return "Updating...";
        case "sending_otp": return "Sending OTP...";
        case "verifying_otp": return "Verifying OTP...";
        default: return "Loading...";
      }
    }
  };

  /* ---------- DYNAMIC COLOR ---------- */
  const getColor = () => {
    switch (type) {
      case "deleting": return "#EF4444";
      case "updating": return "#3B82F6";
      default: return "#1B5E20";
    }
  };

  const color = getColor();

  /* ---------- ANIMATION ---------- */
  const dot1 = useSharedValue(0.3);
  const dot2 = useSharedValue(0.3);
  const dot3 = useSharedValue(0.3);

  useEffect(() => {
    if (visible) {
      dot1.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 400 }),
          withTiming(0.3, { duration: 400 })
        ),
        -1,
        true
      );

      dot2.value = withDelay(
        150,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 400 }),
            withTiming(0.3, { duration: 400 })
          ),
          -1,
          true
        )
      );

      dot3.value = withDelay(
        300,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 400 }),
            withTiming(0.3, { duration: 400 })
          ),
          -1,
          true
        )
      );
    }
  }, [visible]);

  const dotStyle1 = useAnimatedStyle(() => ({
    opacity: dot1.value,
    transform: [{ scale: dot1.value }],
  }));

  const dotStyle2 = useAnimatedStyle(() => ({
    opacity: dot2.value,
    transform: [{ scale: dot2.value }],
  }));

  const dotStyle3 = useAnimatedStyle(() => ({
    opacity: dot3.value,
    transform: [{ scale: dot3.value }],
  }));

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.pillContainer}>
          <AppText style={[styles.text, { color }]} language={language}>
            {getText()}
          </AppText>

          <View style={styles.row}>
            <Animated.View style={[styles.dot, { backgroundColor: color }, dotStyle1]} />
            <Animated.View style={[styles.dot, { backgroundColor: color }, dotStyle2]} />
            <Animated.View style={[styles.dot, { backgroundColor: color }, dotStyle3]} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "transparent",
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    zIndex: 999,
  },

  pillContainer: {
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 30,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },

  text: {
    fontSize: 14,
    fontWeight: "600",
    marginRight: 12,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
  },

  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 3,
  },
});