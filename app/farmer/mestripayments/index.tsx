// app/farmer/payments.tsx

import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";
import AppEmptyState from "@/components/AppEmptyState"; // 🔥 మన గ్లోబల్ కాంపోనెంట్
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import ShimmerPlaceholder from "react-native-shimmer-placeholder";
import { useEffect } from "react";
import { useIsFocused } from "@react-navigation/native";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";

export default function PaymentsScreen() {

  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  const [mestris, setMestris] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState<"te" | "en">("te");
  const [isFocused, setIsFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const isScreenFocused = useIsFocused();

  useSpeechRecognitionEvent("result", (event) => {
    // 🔥 FIX: only current screen lo unna appude work avvali
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
      ExpoSpeechRecognitionModule.stop(); // 🔥 ADD
    };
  }, [isScreenFocused]);

  /* ---------------- LOAD LANG ---------------- */
  useFocusEffect(
    useCallback(() => {
      const loadLang = async () => {
        const lang = await AsyncStorage.getItem("APP_LANG");
        if (lang) setLanguage(lang as any);
      };
      loadLang();
    }, [])
  );

  /* ---------------- SHIMMER ---------------- */
  const ShimmerRow = () => (
    <View style={styles.row}>
      <ShimmerPlaceholder LinearGradient={LinearGradient} style={styles.shimmerAvatar} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <ShimmerPlaceholder LinearGradient={LinearGradient} style={styles.shimmerText} />
        <ShimmerPlaceholder LinearGradient={LinearGradient} style={[styles.shimmerSub, { marginTop: 6 }]} />
      </View>
      <ShimmerPlaceholder LinearGradient={LinearGradient} style={styles.shimmerRight} />
    </View>
  );

  /* ---------------- LOAD DATA ---------------- */
  const loadData = async () => {
    const userPhone = await AsyncStorage.getItem("USER_PHONE");
    if (!userPhone) return;

    setLoading(true);

    try {
      const userDoc = await firestore()
        .collection("users")
        .doc(userPhone)
        .get();

      const activeSession = userDoc.data()?.activeSession;
      if (!activeSession) return;

      const snap = await firestore()
        .collection("users")
        .doc(userPhone)
        .collection("mestris")
        .where(`attendanceSessions.${activeSession}`, "==", true) // 🔥 KEY
        .get();

      const result = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setMestris(result);

    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  /* ---------------- SEARCH FILTER ---------------- */
  const filtered = mestris.filter(item =>
    (item.name || "").toLowerCase().includes(search.trim().toLowerCase())
  );

  /* ---------------- AVATAR COLOR ---------------- */
  const colors = [
    "#22C55E", "#3B82F6", "#F59E0B", "#EF4444",
    "#8B5CF6", "#14B8A6", "#F97316", "#6366F1",
    "#10B981", "#E11D48"
  ];
  const getColor = (id: string) => {
    const index = id.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const optionsStyles = {
    optionsContainer: {
      borderRadius: 10,
      padding: 4,
      backgroundColor: "#fff",
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 5
    }
  };

  /* ---------------- UI ---------------- */
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />

      <AppHeader
        title={language === "te" ? "చెల్లింపులు" : "Payments"}
        subtitle={language === "te" ? "మేస్త్రీ చెల్లింపులు" : "Mestri Payments"}
        language={language}
      />

      {/* 🔥 HIDE SEARCH BAR IF NO DATA EXISTS */}
      {(!loading && mestris.length === 0) ? null : (
        <View style={[styles.searchContainer, isFocused && styles.searchFocused]}>
          <Ionicons name="search-outline" size={20} color={isFocused ? "#16A34A" : "#9CA3AF"} />

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={language === "te" ? "మేస్త్రీ పేరుతో వెతకండి..." : "Search by mestriname..."}
            placeholderTextColor="#9CA3AF"
            cursorColor="#16A34A"
            selectionColor="#16A34A40"
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            style={styles.searchInput}
          />

          {search.trim().length > 0 ? (
            <TouchableOpacity 
              onPress={() => setSearch("")} 
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              onPress={handleVoiceSearch} 
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialCommunityIcons 
                name={isListening ? "microphone" : "microphone-outline"} 
                size={22} 
                color={isListening ? "#EF4444" : (isFocused ? "#16A34A" : "#9CA3AF")} 
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* LIST */}
      {loading ? (
        <View style={{ paddingTop: 10 }}>
          <ShimmerRow />
          <ShimmerRow />
          <ShimmerRow />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled" // 🔥 PREVENT KEYBOARD CLOSING
          contentContainerStyle={[
            { paddingBottom: 100, paddingTop: 10 },
            // 🔥 డేటా లేనప్పుడు సెంటర్ లో రావడానికి ఫ్లెక్స్ లాజిక్
            filtered.length === 0 && { flexGrow: 1, justifyContent: 'center' }
          ]}
          showsVerticalScrollIndicator={false}

          /* 🔥 OUR NEW GLOBAL EMPTY STATE COMPONENT */
          ListEmptyComponent={
            <AppEmptyState
              iconName={search.trim().length > 0 ? "search-outline" : "wallet-outline"}
              title={
                search.trim().length > 0
                  ? (language === "te" ? "ఏమి దొరకలేదు" : "Not Found")
                  : (language === "te" ? "చెల్లింపులు లేవు" : "No Payments Yet")
              }
              subtitle={
                search.trim().length > 0
                  ? (language === "te" ? "మీ శోధనకు సరిపడే ఫలితాలు లేవు" : "No results match your search")
                  : (language === "te" ? "ముందుగా హాజరు నమోదు చేయండి" : "Mark Attendance to get Payments")
              }
              language={language}
              marginTop={mestris.length === 0 ? 0 : 60} 
            />
          }

          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.8}
              onPress={() => {
                router.push({
                  pathname: "/farmer/mestripayments/payment-details",
                  params: {
                    id: item.id,
                    name: item.name,
                    village: item.village
                  }
                });
              }}
            >
              {/* LEFT */}
              <View style={styles.left}>
                <View style={[
                  styles.avatar,
                  { backgroundColor: getColor(item.id) }
                ]}>
                  <AppText style={styles.avatarText} language={language}>
                    {item.name?.charAt(0)?.toUpperCase()}
                  </AppText>
                </View>

                <View style={styles.details}>
                  <AppText style={styles.name} language={language}>
                    {item.name}
                  </AppText>

                  <AppText style={styles.sub} language={language}>
                    {item.village || "----"}
                  </AppText>
                </View>
              </View>

              {/* RIGHT */}
              <View style={styles.right}>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </View>

            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6F7F6" },

  // 🔥 MINIMAL, CLEAN SEARCH BAR STYLES
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

  left: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12
  },

  avatarText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600"
  },

  details: {
    flex: 1,
    gap: 4,
    marginLeft: 8
  },

  name: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A",
    lineHeight: 24
  },

  sub: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 20
  },

  right: {
    justifyContent: "center",
    alignItems: "center"
  },

  shimmerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21
  },

  shimmerText: {
    width: "60%",
    height: 14,
    borderRadius: 6
  },

  shimmerSub: {
    width: "40%",
    height: 12,
    borderRadius: 6
  },

  shimmerRight: {
    width: 20,
    height: 20,
    borderRadius: 10
  }
});