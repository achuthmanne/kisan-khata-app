// app/farmer/attendance-history.tsx

import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";
import AppEmptyState from "@/components/AppEmptyState"; 
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState, useRef } from "react";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import {
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  RefreshControl
} from "react-native";
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming
} from "react-native-reanimated";
import ShimmerPlaceholder from "react-native-shimmer-placeholder";
import Svg, { Circle } from "react-native-svg";

/* ---------------- CIRCLE ---------------- */
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const ProgressCircle = ({ percent }: { percent: number }) => {
  const radius = 24;
  const strokeWidth = 5;
  const circumference = 2 * Math.PI * radius;
  const size = 60;
  const center = size / 2;

  const animatedValue = useSharedValue(0);

  useEffect(() => {
    animatedValue.value = withTiming(percent, {
      duration: 1200
    });
  }, [percent]);

  const animatedProps = useAnimatedProps(() => {
    const progress = (animatedValue.value / 100) * circumference;
    return {
      strokeDashoffset: circumference - progress
    };
  });

  const color =
    percent < 40 ? "#EF4444" :
    percent < 70 ? "#F59E0B" :
    "#22C55E";

  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          strokeLinecap="round"
          rotation="-90"
          origin={`${center},${center}`}
        />
      </Svg>
      <AppText style={styles.percentText}>
        {Math.round(percent)}%
      </AppText>
    </View>
  );
};

/* ---------------- SHIMMER ROW ---------------- */
const ShimmerRow = () => (
  <View style={styles.row}>
    <ShimmerPlaceholder
      LinearGradient={LinearGradient as any}
      style={{ width: 42, height: 42, borderRadius: 21 }}
    />
    <View style={{ flex: 1, marginLeft: 12 }}>
      <ShimmerPlaceholder
        LinearGradient={LinearGradient as any}
        style={{ width: "60%", height: 14, borderRadius: 6 }}
      />
      <ShimmerPlaceholder
        LinearGradient={LinearGradient as any}
        style={{ width: "40%", height: 12, borderRadius: 6, marginTop: 6 }}
      />
    </View>
    <ShimmerPlaceholder
      LinearGradient={LinearGradient as any}
      style={{ width: 45, height: 45, borderRadius: 25 }}
    />
  </View>
);

/* ---------------- SCREEN ---------------- */
export default function AttendanceHistory() {
  const router = useRouter();
  
  const isMounted = useRef(true);

  const [mestris, setMestris] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState<"te" | "en">("te");
  const [isFocused, setIsFocused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false); 
  const [refreshing, setRefreshing] = useState(false); 
  const [isListening, setIsListening] = useState(false);
  const [activeSession, setActiveSession] = useState("");
  const isScreenFocused = useIsFocused();

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useSpeechRecognitionEvent("result", (event) => {
    if (!isScreenFocused || !isListening) return;

    if (event.results && event.results.length > 0) {
      setSearch(event.results[0].transcript);
    }
  });

  useSpeechRecognitionEvent("end", () => setIsListening(false));

  const handleVoiceSearch = async () => {
    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!result.granted) return;

    setIsListening(true);
    ExpoSpeechRecognitionModule.start({
      lang: language === "te" ? "te-IN" : "en-US",
      interimResults: true,
    });
  };

  useEffect(() => {
    if (!isScreenFocused) {
      ExpoSpeechRecognitionModule.stop();
      setIsListening(false);
    }
    return () => {
      ExpoSpeechRecognitionModule.stop(); 
    };
  }, [isScreenFocused]);

  useFocusEffect(
    useCallback(() => {
      const loadLang = async () => {
        const lang = await AsyncStorage.getItem("APP_LANG");
        if (lang && isMounted.current) setLanguage(lang as "te" | "en");
      };
      loadLang();
      loadData();
    }, [])
  );

  const avatarColors = [
    "#22C55E", "#3B82F6", "#F59E0B", "#EF4444",
    "#8B5CF6", "#14B8A6", "#F97316", "#6366F1",
    "#10B981", "#E11D48"
  ];

  const getColor = (id: string) => {
    const index = id.charCodeAt(0) % avatarColors.length;
    return avatarColors[index];
  };

  const getUsageColor = (percent: number) => {
    if (percent >= 70) return "#16A34A"; 
    if (percent >= 40) return "#F59E0B"; 
    return "#EF4444"; 
  };

  /* ---------- LOAD DATA (TRUE WORK VOLUME LOGIC) ---------- */
  const loadData = async (isRefreshed = false) => {
    try {
      if (!isRefreshed) setLoading(true);
      setError(false);

      const userPhone = await AsyncStorage.getItem("USER_PHONE");
      if (!userPhone) throw new Error("NO_USER");

      const userDoc = await firestore().collection("users").doc(userPhone).get();
      const session = userDoc.data()?.activeSession;

      if (!session) {
        if (isMounted.current) { setLoading(false); setRefreshing(false); }
        return;
      }

      if (isMounted.current) setActiveSession(session);

      const mestriSnap = await firestore()
        .collection("users")
        .doc(userPhone)
        .collection("mestris")
        .get();

      const counts: any[] = [];
      for (const doc of mestriSnap.docs) {
        const mestri = doc.data();
        const attendanceSnap = await firestore()
          .collection("users")
          .doc(userPhone)
          .collection("mestris")
          .doc(doc.id)
          .collection("attendance")
          .where("session", "==", session) 
          .get();

        // 🔥 PRO FIX: Calculate actual volume of work (Morning + Evening + Full)
        let totalWorksVolume = 0;
        attendanceSnap.docs.forEach(attDoc => {
          const attData = attDoc.data();
          const m = Number(attData.morning) || 0;
          const e = Number(attData.evening) || 0;
          const f = Number(attData.full) || 0;
          totalWorksVolume += (m + e + f);
        });

        if (totalWorksVolume > 0) {
          counts.push({ id: doc.id, ...mestri, totalWorksVolume });
        }
      }

      // 🔥 Percentage is now based on actual Work Volume
      const grandTotalVolume = counts.reduce((sum, item) => sum + item.totalWorksVolume, 0);
      const result = counts.map(item => ({
        ...item,
        percent: grandTotalVolume > 0 ? Math.round((item.totalWorksVolume / grandTotalVolume) * 100) : 0
      }));
      
      result.sort((a, b) => b.percent - a.percent);
      
      if (isMounted.current) setMestris(result);

    } catch (e) {
      console.log("Attendance History Fetch Error:", e);
      if (isMounted.current) setError(true);
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const filtered = mestris.filter(item =>
    (item.name || "").toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />

      <AppHeader
        title={language === "te" ? "హాజరు చరిత్ర" : "Attendance History"}
        subtitle={language === "te" ? `సీజన్: ${activeSession}` : `Season: ${activeSession}`}
        language={language}
      />

      {(!loading && !error && mestris.length > 0) && (
        <View style={[styles.searchContainer, isFocused && styles.searchFocused]}>
          <Ionicons name="search-outline" size={20} color={isFocused ? "#16A34A" : "#9CA3AF"} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={language === "te" ? "మేస్త్రీ పేరుతో వెతకండి..." : "Search by mestri name..."}
            placeholderTextColor="#9CA3AF"
            cursorColor="#16A34A"
            selectionColor="#16A34A40"
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            style={styles.searchInput}
          />
          {search.trim().length > 0 ? (
            <TouchableOpacity onPress={() => setSearch("")} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handleVoiceSearch} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialCommunityIcons 
                name={isListening ? "microphone" : "microphone-outline"} 
                size={22} 
                color={isListening ? "#EF4444" : (isFocused ? "#16A34A" : "#9CA3AF")} 
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      {loading && !refreshing ? (
        <View style={{ paddingTop: 10 }}>
          <ShimmerRow />
          <ShimmerRow />
          <ShimmerRow />
          <ShimmerRow />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <View style={styles.errorIconBg}>
            <Ionicons name="cloud-offline" size={50} color="#9CA3AF" />
          </View>
          <AppText style={styles.errorText} language={language}>
            {language === "te" ? "సర్వర్ కి కనెక్ట్ అవ్వలేకపోయాం" : "Failed to connect to server"}
          </AppText>
          <TouchableOpacity style={styles.retryBtn} onPress={() => loadData(false)}>
            <AppText style={styles.retryText} language={language}>
              {language === "te" ? "మళ్ళీ ప్రయత్నించండి" : "Try Again"}
            </AppText>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#16A34A"]} />
          }
          contentContainerStyle={[
            { paddingBottom: 100, paddingTop: 10 },
            filtered.length === 0 && { flexGrow: 1, justifyContent: 'center' }
          ]}
          ListEmptyComponent={
            <AppEmptyState
              iconName={search.trim().length > 0 ? "search-outline" : "people-outline"}
              title={
                search.trim().length > 0
                  ? (language === "te" ? "ఏమి దొరకలేదు" : "Not Found")
                  : (language === "te" ? "హాజరు చరిత్ర లేదు" : "No Attendance History")
              }
              subtitle={
                search.trim().length > 0
                  ? (language === "te" ? "మీ శోధనకు సరిపడే ఫలితాలు లేవు" : "No results match your search")
                  : (language === "te" ? "ముందుగా హాజరు నమోదు చేయండి." : "Please record the attendance first.")
              }
              language={language}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.8}
              onPress={() => {
                router.push({
                  pathname: "/farmer/mestri-history",
                  params: {
                    id: item.id,
                    name: item.name,
                    village: item.village
                  }
                });
              }}
            >
              <View style={styles.left}>
                <View style={[styles.avatar, { backgroundColor: getColor(item.id) }]}>
                  <AppText style={styles.avatarText} language={language}>
                    {item.name?.charAt(0)?.toUpperCase()}
                  </AppText>
                </View>
                <View style={styles.details}>
                  <AppText style={styles.name} language={language}>{item.name}</AppText>
                  <AppText style={styles.sub} language={language}>{item.village || "----"}</AppText>
                </View>
              </View>

              <View style={styles.right}>
                <View style={styles.circleWrapper}>
                  <ProgressCircle percent={item.percent || 0} />
                </View>
                <View
                  style={{
                    backgroundColor: getUsageColor(item.percent) + "15", 
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 6,
                    marginTop: 6,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4
                  }}
                >
                  <AppText
                    style={{
                      fontSize: 11,
                      color: getUsageColor(item.percent),
                      fontWeight: "600"
                    }}
                    language={language}
                  >
                    {language === "te" ? "పని వాటా" : "Work Share"}
                  </AppText>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6F7F6" },
  
  errorContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 40 },
  errorIconBg: { width: 90, height: 90, borderRadius: 45, backgroundColor: "#F3F4F6", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  errorText: { fontSize: 16, fontWeight: "600", color: "#4B5563", textAlign: "center", marginBottom: 20 },
  retryBtn: { backgroundColor: "#16A34A", paddingHorizontal: 30, paddingVertical: 12, borderRadius: 14 },
  retryText: { color: "white", fontSize: 15, fontWeight: "600" },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    marginHorizontal: 20,
    marginTop: 15,
    marginBottom: 10,
    paddingHorizontal: 12,
    height: 50, 
    borderRadius: 8, 
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  searchFocused: {
    borderColor: "#16A34A",
    backgroundColor: "#FFFFFF",
  },
  searchInput: {
    flex: 1,
    height: "100%", 
    marginLeft: 10,
    fontSize: 15,
    paddingTop: 0, 
    paddingBottom: 0, 
    textAlignVertical: "center", 
    color: "#1F2937",
    fontFamily: "Mandali",
    includeFontPadding: false, 
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 20,
    marginVertical: 6,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    backgroundColor: "#ffffff",
  },
  percentLabel: { fontSize: 12, color: "#6B7280", marginTop: 2, lineHeight: 18 },
  left: { flexDirection: "row", alignItems: "center", flex: 1 },
  avatar: { width: 50, height: 50, borderRadius: 25, justifyContent: "center", alignItems: "center", marginRight: 12 },
  avatarText: { color: "#fff", fontSize: 16, fontWeight: "600", lineHeight: 20 },
  details: { flex: 1, gap: 4, marginLeft: 8 },
  name: { fontSize: 16, fontWeight: "600", color: "#0F172A", lineHeight: 24 },
  sub: { fontSize: 14, color: "#64748B", lineHeight: 26 },
  right: { justifyContent: "center", alignItems: "center" },
  percentText: { position: "absolute", fontSize: 10, fontWeight: "600" },
  circleWrapper: { width: 60, height: 60, justifyContent: "center", alignItems: "center" },
});