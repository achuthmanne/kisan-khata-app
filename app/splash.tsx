import notifee from '@notifee/react-native';
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Dimensions, PermissionsAndroid, Platform, StyleSheet, View } from "react-native";
import { executeOfflineSafeRead } from "@/utils/offlineHelper";
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
    let timerId: any;
    
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
    
    // 🔥 Underline width పెంచాను, ఎందుకంటే టైటిల్ కొంచెం పెద్దది కాబట్టి
    underlineWidth.value = withDelay(1400, withTiming(180, { duration: 700 }));
    
    taglineOpacity.value = withDelay(1700, withTiming(1, { duration: 800 }));
    taglineTranslate.value = withDelay(1700, withTiming(0, { duration: 800 }));

    const boot = async () => {
      const startTime = Date.now();

      // 🔥 Request all permissions immediately
      if (Platform.OS === 'android') {
        const perms = [
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
        ];
        if (Platform.Version >= 33) {
          perms.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        }
        try {
          await PermissionsAndroid.requestMultiple(perms);
          await notifee.requestPermission();
        } catch (e) {
          console.log("Permissions error:", e);
        }
      }

      const phone = await AsyncStorage.getItem("USER_PHONE");
      const role = await AsyncStorage.getItem("USER_ROLE");

      // 🔥 BULLETPROOF ALARM CHECK: 
      // If the app is opened (via lockscreen bypass or manual tap) and an alarm is ringing, jump straight to it!
      const displayed = await notifee.getDisplayedNotifications();
      const alarmNotif = displayed.find(n => n.notification.data?.reminderId);
      
      const initialNotif = await notifee.getInitialNotification();
      const tappedAlarm = initialNotif?.notification.data?.reminderId;

      if (alarmNotif || tappedAlarm) {
        const targetNotif = alarmNotif || initialNotif;
        const data = targetNotif!.notification.data as any;
        const { task, crop, reminderId } = data;
        const id = targetNotif!.notification.id;
        router.replace(`/farmer/reminders/alarm-ring?task=${encodeURIComponent(task)}&crop=${encodeURIComponent(crop)}&reminderId=${reminderId}&notifId=${id}` as any);
        return; // Halt all other splash routing!
      }

      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, 3500 - elapsed);

      const goNext = (path: any) => {
        timerId = setTimeout(() => router.replace(path), remainingTime);
      };

      if (!phone || !role) {
        const hasSeenOnboarding = await AsyncStorage.getItem("HAS_SEEN_ONBOARDING");
        if (hasSeenOnboarding === "true") {
          goNext("/login");
        } else {
          goNext("/onboarding");
        }
        return;
      }

      try {
        const doc = await executeOfflineSafeRead(firestore().collection("users").doc(phone), true);
        if (doc.exists()) {
          goNext(role === "FARMER" ? "/farmer/(tabs)" : "/(tabs)");
        } else {
          await AsyncStorage.clear();
          goNext("/login");
        }
      } catch (e) {
        goNext("/login");
      }
    };
    boot();

    return () => {
      // Clear timeout if the component unmounts early (e.g. Alarm screen auto-opened from layout)
      clearTimeout(timerId);
    };
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
      
     {/* 🔥 THE BRAND NAME (ALWAYS IN ENGLISH FOR STRONG BRANDING) */}
      <Animated.View style={titleStyle}>
        {/* ఇక్కడ language కి డైరెక్ట్ గా "en" ఇచ్చేసాను, సో ఫాంట్ కూడా ఇంగ్లీష్ దే అప్లై అవుతుంది */}
        <AppText style={styles.title} language="en">
          Kisan Khata
        </AppText>
      </Animated.View>
      
      <Animated.View style={[styles.underline, underlineStyle]} />
      
      {/* 🔥 THE PREMIUM PROFESSIONAL TAGLINE (BILINGUAL & RESPONSIVE) */}
      <Animated.View style={taglineStyle}>
        <AppText style={styles.tagline} language="te">
          ఆధునిక వ్యవసాయానికి డిజిటల్ ఖాతా.
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1B5E20", justifyContent: "center", alignItems: "center" },
  title: { fontSize: 40, fontWeight: "800", color: "#FFFFFF", letterSpacing: 1.2 },
  underline: { height: 3, backgroundColor: "#E8F5E9", marginTop: 12, marginBottom: 20, borderRadius: 4 },
  tagline: { 
    fontSize: 16, 
    color: "#E8F5E9", 
    fontWeight: "500", 
    textAlign: "center", 
    marginTop: -8,
    paddingHorizontal: 20, // 🔥 ఎడ్జెస్ కి తగలకుండా నీట్ గా ఉండటానికి
    lineHeight: 24, // టెక్స్ట్ క్లియర్ గా కనపడటానికి
  },
  topCurve: { position: "absolute", top: -180, right: -140, width: width, height: width, backgroundColor: "#2E7D32", borderRadius: width, opacity: 0.25 },
  bottomCurve: { position: "absolute", bottom: -220, left: -160, width: width * 1.3, height: width * 1.3, backgroundColor: "#388E3C", borderRadius: width, opacity: 0.18 },
});