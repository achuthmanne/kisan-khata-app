// app/farmer/payments.tsx

import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";
import AppEmptyState from "@/components/AppEmptyState"; 
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
  View,
  Keyboard
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
  
  // 🔥 FIX 1: Initial loading must be TRUE to avoid Empty State flash
  const [loading, setLoading] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const isScreenFocused = useIsFocused();

  // 🔥 FIX 2: Voice Search Punctuation Bug Fix
  useSpeechRecognitionEvent("result", (event) => {
    if (!isScreenFocused || !isListening) return;

    if (event.results && event.results.length > 0) {
      // వాయిస్ సెర్చ్ లో చివర వచ్చే ఫుల్ స్టాప్ (.), కామా (,) లాంటివి తీసేస్తున్నాం
      const transcript = event.results[0].transcript.replace(/[.,?!]/g, "");
      setSearch(transcript);
    }
  });

  useSpeechRecognitionEvent("end", () => setIsListening(false));

  const handleVoiceSearch = async () => {
    Keyboard.dismiss(); // మైక్ ఆన్ అవ్వగానే కీబోర్డ్ క్లోజ్ అవ్వాలి
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
    setLoading(true);

    try {
      const userPhone = await AsyncStorage.getItem("USER_PHONE");
      if (!userPhone) return;

      const userDoc = await firestore()
        .collection("users")
        .doc(userPhone)
        .get();

      const activeSession = userDoc.data()?.activeSession;
      if (!activeSession) {
        setMestris([]);
        return;
      }

      const snap = await firestore()
        .collection("users")
        .doc(userPhone)
        .collection("mestris")
        .where(`attendanceSessions.${activeSession}`, "==", true) 
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

  /* ---------------- SEARCH FILTER (ROBUST) ---------------- */
  // 🔥 FIX 3: టెక్స్ట్ లో ఎక్స్‌ట్రా స్పేసులు, స్పెషల్ క్యారెక్టర్స్ ఉన్నా ఇగ్నోర్ చేసే సూపర్ ఫిల్టర్
  const cleanSearchTerm = search.replace(/[.,?!]/g, "").trim().toLowerCase();
  
  const filtered = mestris.filter(item => {
    const dbName = (item.name || "").replace(/[.,?!]/g, "").trim().toLowerCase();
    return dbName.includes(cleanSearchTerm);
  });

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
            ref={inputRef}
            value={search}
            onChangeText={setSearch}
            placeholder={language === "te" ? "మేస్త్రీ పేరుతో వెతకండి..." : "Search by mestriname..."}
            placeholderTextColor="#9CA3AF"
            cursorColor="#16A34A"
            selectionColor="#afd2a5"
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            style={styles.searchInput}
          />

          {search.trim().length > 0 ? (
            <TouchableOpacity 
              onPress={() => {
                setSearch("");
                inputRef.current?.focus(); // క్లియర్ చేయగానే మళ్ళీ టైప్ చేయడానికి
              }} 
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
          keyboardShouldPersistTaps="handled" 
          keyboardDismissMode="on-drag" 
          contentContainerStyle={[
            { paddingBottom: 100, paddingTop: 10 },
            filtered.length === 0 && { flexGrow: 1, justifyContent: 'center' }
          ]}
          showsVerticalScrollIndicator={false}

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
                Keyboard.dismiss(); // స్క్రీన్ మారే ముందు కీబోర్డ్ క్లోజ్ అవ్వాలి
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
                  <AppText style={styles.name} language={language} numberOfLines={1} ellipsizeMode="tail">
                    {item.name}
                  </AppText>

                  <AppText style={styles.sub} language={language} numberOfLines={1} ellipsizeMode="tail">
                    {item.village || "----"}
                  </AppText>
                </View>
              </View>

              {/* RIGHT - PREMIUM ROUND ICON BG */}
              <View style={styles.iconCircle}>
                <Ionicons name="chevron-forward" size={18} color="#6B7280" />
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
  safe: { flex: 1, backgroundColor: "#F9FAFB" },

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
    borderRadius: 14, 
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 3,
  },

  left: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12
  },

  avatarText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600"
  },

  details: {
    flex: 1,
    gap: 2,
    marginLeft: 4
  },

  name: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },

  sub: {
    fontSize: 13,
    color: "#6B7280",
  },

  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center"
  },

  shimmerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22
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
    width: 32,
    height: 32,
    borderRadius: 16
  }
});