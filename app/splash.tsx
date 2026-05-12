import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import AppText from "../components/AppText";

const { width } = Dimensions.get("window");

export default function SplashScreen() {
  const router = useRouter();
  const [language, setLanguage] = useState<"te" | "en">("te");

  const titleOpacity = useSharedValue(0);
  const titleTranslate = useSharedValue(30);
  const titleScale = useSharedValue(0.94);
  const taglineOpacity = useSharedValue(0);
  const taglineTranslate = useSharedValue(20);
  const underlineWidth = useSharedValue(0);
  const curveTopTranslate = useSharedValue(60);
  const curveBottomTranslate = useSharedValue(-60);
  const curveOpacity = useSharedValue(0);

  useEffect(() => {
    const loadLang = async () => {
      const storedLang = await AsyncStorage.getItem("APP_LANG");
      if (storedLang) setLanguage(storedLang as "te" | "en");
    };
    loadLang();

    curveOpacity.value = withTiming(1, { duration: 1200 });
    curveTopTranslate.value = withTiming(0, { duration: 1500, easing: Easing.out(Easing.cubic) });
    curveBottomTranslate.value = withTiming(0, { duration: 1500, easing: Easing.out(Easing.cubic) });
    
    curveTopTranslate.value = withDelay(1500, withRepeat(withSequence(withTiming(-10, { duration: 4000 }), withTiming(0, { duration: 4000 })), -1, true));
    curveBottomTranslate.value = withDelay(1500, withRepeat(withSequence(withTiming(10, { duration: 4000 }), withTiming(0, { duration: 4000 })), -1, true));

    titleOpacity.value = withDelay(500, withTiming(1, { duration: 1000 }));
    titleTranslate.value = withDelay(500, withTiming(0, { duration: 1000 }));
    titleScale.value = withDelay(500, withTiming(1, { duration: 1000, easing: Easing.out(Easing.exp) }));
    underlineWidth.value = withDelay(1400, withTiming(150, { duration: 700 }));
    taglineOpacity.value = withDelay(1700, withTiming(1, { duration: 800 }));
    taglineTranslate.value = withDelay(1700, withTiming(0, { duration: 800 }));

    const boot = async () => {
      const phone = await AsyncStorage.getItem("USER_PHONE");
      const role = await AsyncStorage.getItem("USER_ROLE");

      if (!phone || !role) {
        setTimeout(() => router.replace("/login"), 3500);
        return;
      }

      try {
        const doc = await firestore().collection("users").doc(phone).get();
        if (doc.exists()) {
          setTimeout(() => {
            router.replace(role === "FARMER" ? "/farmer/(tabs)" : "/(tabs)");
          }, 3500);
        } else {
          await AsyncStorage.clear();
          router.replace("/login");
        }
      } catch (e) {
        router.replace("/login");
      }
    };
    boot();
  }, []);

  const titleStyle = useAnimatedStyle(() => ({ opacity: titleOpacity.value, transform: [{ translateY: titleTranslate.value }, { scale: titleScale.value }] }));
  const taglineStyle = useAnimatedStyle(() => ({ opacity: taglineOpacity.value, transform: [{ translateY: taglineTranslate.value }] }));
  const underlineStyle = useAnimatedStyle(() => ({ width: underlineWidth.value }));
  const topCurveStyle = useAnimatedStyle(() => ({ opacity: curveOpacity.value, transform: [{ translateY: curveTopTranslate.value }] }));
  const bottomCurveStyle = useAnimatedStyle(() => ({ opacity: curveOpacity.value, transform: [{ translateY: curveBottomTranslate.value }] }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.topCurve, topCurveStyle]} />
      <Animated.View style={[styles.bottomCurve, bottomCurveStyle]} />
      <Animated.View style={titleStyle}>
        <AppText style={styles.title} language={language}>Agrisnap</AppText>
      </Animated.View>
      <Animated.View style={[styles.underline, underlineStyle]} />
      <Animated.View style={taglineStyle}>
        <AppText style={styles.tagline} language={language}>
          {language === "te" ? "మీ వ్యవసాయానికి మా డిజిటల్ తోడ్పాటు" : "Our digital support for your farming"}
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1B5E20", justifyContent: "center", alignItems: "center" },
  title: { fontSize: 40, fontWeight: "800", color: "#FFFFFF", letterSpacing: 1.2 },
  underline: { height: 3, backgroundColor: "#E8F5E9", marginTop: 12, marginBottom: 20, borderRadius: 4 },
  tagline: { fontSize: 16, color: "#E8F5E9", fontWeight: "500", textAlign: "center", marginTop: -8 },
  topCurve: { position: "absolute", top: -180, right: -140, width: width, height: width, backgroundColor: "#2E7D32", borderRadius: width, opacity: 0.25 },
  bottomCurve: { position: "absolute", bottom: -220, left: -160, width: width * 1.3, height: width * 1.3, backgroundColor: "#388E3C", borderRadius: width, opacity: 0.18 },
});