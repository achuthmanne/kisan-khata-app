import AgriLoader from "@/components/AgriLoader";
import AppText from "@/components/AppText";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import NetInfo from "@react-native-community/netinfo";
import { BackHandler } from "react-native";

import {
  Animated,
  Dimensions,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View
} from "react-native";
export const unstable_settings = {
  gestureEnabled: false, // 🔥 FULL BLOCK
};

export default function PaymentSuccess() {
  const router = useRouter();
  const params = useLocalSearchParams();
const hasSaved = useRef(false);
  const {
    id, ids, crop, work, name, village,
    totalDays, totalWorkers,
    totalMorning, totalEvening, totalFull,
    morningRate, eveningRate, fullRate,
    amount, paymentMode
  } = params;
const [navigating, setNavigating] = useState(false);
  const [status, setStatus] = useState<"loading" | "success" | "failed">("loading");
  const [language, setLanguage] = useState<"en" | "te">("en");
  const [helpModal, setHelpModal] = useState(false);
  const scale = useRef(new Animated.Value(0)).current;

  // Real Green Color
  const SUCCESS_GREEN = "#16A34A"; 

 let selectedIds: string[] = [];

try {
  selectedIds =
    typeof ids === "string"
      ? JSON.parse(ids)
      : Array.isArray(ids)
      ? ids
      : [];
} catch {
  selectedIds = [];
}
  /* ---------- LOAD LANGUAGE ---------- */
  useFocusEffect(
    useCallback(() => {
      const loadLang = async () => {
        const lang = await AsyncStorage.getItem("APP_LANG");
        if (lang) setLanguage(lang as any);
      };
      loadLang();
    }, [])
  );

useEffect(() => {
  const backAction = () => {
    return true; // 🔥 block back
  };

  const subscription = BackHandler.addEventListener(
    "hardwareBackPress",
    backAction
  );

  return () => subscription.remove();
}, []);




  const saveData = async () => {
  setStatus("loading");

  try {
    const net = await NetInfo.fetch();

    if (!net.isConnected) {
      setStatus("failed"); // 🔥 DIRECT FAIL
      return;
    }

    const phone = await AsyncStorage.getItem("USER_PHONE");
    if (!phone) {
      setStatus("failed");
      return;
    }

    const db = firestore();

    const userDoc = await db.collection("users").doc(phone).get();
    const activeSession = userDoc.data()?.activeSession;

    const paymentData = {
      mestriId: id,
      session: activeSession, // 🔥 IMPORTANT
      selectedAttendanceIds: selectedIds,
      crop, work, name, village, paymentMode,
      totalAmount: Number(amount),
      details: {
        totalDays: Number(totalDays),
        totalWorkers: Number(totalWorkers),
        morning: Number(totalMorning),
        evening: Number(totalEvening),
        full: Number(totalFull),
        mRate: Number(morningRate),
        eRate: Number(eveningRate),
        fRate: Number(fullRate),
      },
      createdAt: firestore.FieldValue.serverTimestamp()
    };

    await db
      .collection("users")
      .doc(phone)
      .collection("payments")
      .add(paymentData);

    setStatus("success");

    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();

  } catch (e) {
    console.log(e);
    setStatus("failed"); // 🔥 CLEAR FAIL
  }
};

useEffect(() => {
  if (!hasSaved.current) {
    hasSaved.current = true;
    saveData();
  }
}, []);
  // Home ki velle function
const handleGoHome = () => {
  if (navigating) return;
  setNavigating(true);

  setHelpModal(false);
  router.replace("/farmer/(tabs)");
};

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: status === "success" ? "#F0FDF4" : "#fff" }]}>
      <StatusBar barStyle="dark-content" />
      <AgriLoader visible={status === "loading"} type="saving" language={language} />

      {status === "success" && (
        <View style={{ flex: 1 }}>
        <ScrollView 
  contentContainerStyle={[styles.scrollContent, { flexGrow: 1 }]}
  scrollEnabled={false} // 🔥 LOCK SCREEN
  showsVerticalScrollIndicator={false}
>
            <View style={styles.centerContainer}>
              <Animated.View style={[styles.tickWrap, { backgroundColor: SUCCESS_GREEN + "15", borderColor: SUCCESS_GREEN, transform: [{ scale }] }]}>
                <Ionicons name="checkmark-done-circle" size={80} color={SUCCESS_GREEN} />
              </Animated.View>

              <AppText style={[styles.title, { color: SUCCESS_GREEN }]} language={language}>
                {language === "te" ? "చెల్లింపు విజయవంతంగా జోడించబడింది!" : "Payment Added Successfully!"}
              </AppText>

              <AppText style={styles.amountDisplay}>₹ {amount}</AppText>

              {/* RECEIPT CARD */}
              <View style={[styles.card, { borderColor: SUCCESS_GREEN + "30" }]}>
                <View style={styles.receiptHeader}>
                   <View>
                      <AppText style={styles.mestriName}>{name}</AppText>
                      <AppText style={styles.villageName}>{village}</AppText>
                   </View>
                   <View style={[styles.modeBadge, { backgroundColor: SUCCESS_GREEN + "10", borderColor: SUCCESS_GREEN }]}>
                      <AppText style={[styles.modeText, { color: SUCCESS_GREEN }]} language={language}>
                          {paymentMode === "upi"? "UPI"
                            : language === "te"? "నగదు" : "Cash"}
                      </AppText>
                   </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.infoRow}>
                   <View style={styles.infoItem}>
                      <AppText style={styles.infoLabel} language={language}>{language === "te" ? "పంట" : "Crop"}</AppText>
                      <AppText style={styles.infoValue}>{crop}</AppText>
                   </View>
                   <View style={styles.infoItem}>
                      <AppText style={styles.infoLabel} language={language}>{language === "te" ? "పని" : "Work"}</AppText>
                      <AppText style={styles.infoValue}>{work}</AppText>
                   </View>
                </View>

                <View style={styles.infoRow}>
                   <View style={styles.infoItem}>
                      <AppText style={styles.infoLabel} language={language}>{language === "te" ? "మొత్తం కార్మికులు" : "Workers"}</AppText>
                      <AppText style={styles.infoValue}>{totalWorkers}</AppText>
                   </View>
                   <View style={styles.infoItem}>
                      <AppText style={styles.infoLabel} language={language}>{language === "te" ? "మొత్తం రోజులు" : "Days"}</AppText>
                      <AppText style={styles.infoValue}>{totalDays}</AppText>
                   </View>
                </View>

                <View style={styles.dashedDivider} />

                <View style={styles.footerRow}>
                  <AppText style={styles.dateText}>{new Date().toLocaleString()}</AppText>
                  <Ionicons name="shield-checkmark" size={16} color={SUCCESS_GREEN} />
                </View>
              </View>
            </View>
          </ScrollView>

          {/* BOTTOM BUTTONS */}
          <View style={styles.bottomBtns}>
            <View style={styles.rowBtns}>
              <TouchableOpacity activeOpacity={0.8} style={[styles.subBtn, { borderColor: "#D1D5DB" }]} onPress={() => setHelpModal(true)}>
                <Ionicons name="help-circle-outline" size={18} color="#4B5563" />
                <AppText style={{ color: "#4B5563", fontWeight: '600' }} language={language}>{language === "te" ? "సహాయం" : "Help"}</AppText>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.8} style={[styles.subBtn, { backgroundColor: "#fff", borderColor: SUCCESS_GREEN }]} onPress={() => router.replace("/farmer/(tabs)/history")}>
                <Ionicons name="time-outline" size={18} color={SUCCESS_GREEN} />
                <AppText style={{ color: SUCCESS_GREEN, fontWeight: '600' }} language={language}>{language === "te" ? "చరిత్ర" : "History"}</AppText>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity activeOpacity={0.8} onPress={handleGoHome} style={styles.doneWrapper}>
              <LinearGradient colors={["#2E7D32", "#1B5E20"]} style={styles.confirmBtn}>
                        <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                        <AppText style={styles.confirmText} language={language}>
                          {language === "te" ? "చెల్లింపు పూర్తి అయ్యింది" : "Payment Done"}
                        </AppText>
                      </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      )}

{status === "failed" && (
  <View style={styles.fullCenter}>
    <Ionicons name="close-circle" size={80} color="#DC2626" />

    <AppText style={{ fontSize: 18, fontWeight: "600", marginTop: 10 }}>
      {language === "te" ? "చెల్లింపు విఫలమైంది" : "Payment Failed"}
    </AppText>

    <AppText style={{ fontSize: 13, color: "#6B7280", marginTop: 6 }}>
      {language === "te"
        ? "ఇంటర్నెట్ కనెక్షన్ చెక్ చేసి మళ్ళీ ప్రయత్నించండి"
        : "Check your internet and try again"}
    </AppText>

    <TouchableOpacity
      style={styles.retryBtn}
      onPress={saveData}
    >
      <AppText style={{ color: "#fff" }}>
        {language === "te" ? "మళ్ళీ ప్రయత్నించండి" : "Retry"}
      </AppText>
    </TouchableOpacity>

  </View>
)}

      {/* HELP MODAL */}
      {helpModal && (
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <View style={[styles.iconBg, { backgroundColor: SUCCESS_GREEN + "15" }]}>
              <Ionicons name="information-circle" size={40} color={SUCCESS_GREEN} />
            </View>
            <AppText style={styles.modalTitle} language={language}>
              {language === "te" ? "ఎలా సరిచేయాలి?" : "How to fix payment?"}
            </AppText>
            <View style={styles.stepsContainer}>
              <AppText style={styles.step} language={language}>1. {language === "te" ? "చరిత్ర (History) లోకి వెళ్ళండి" : "Go to History"}</AppText>
              <AppText style={styles.step} language={language}>2. {language === "te" ? "వివరాలు సరిచూసుకోండి" : "Verify the details"}</AppText>
              <AppText style={styles.step} language={language}>3. {language === "te" ? "తప్పుగా ఉంటే డిలీట్ చేయండి" : "Delete if incorrect"}</AppText>
            </View>
            <TouchableOpacity activeOpacity={0.8} style={[styles.okBtn, { backgroundColor: SUCCESS_GREEN }]} onPress={handleGoHome}>
              <AppText style={{ color: "#fff", fontWeight: "600", fontSize: 16 }} language={language}>
                {language === "te" ? "సరే" : "OK"}
              </AppText>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContent: { paddingBottom: 200 },
  fullCenter: {
  flex: 1,
  justifyContent: "center", // 🔥 vertical center
  alignItems: "center",     // 🔥 horizontal center
  paddingHorizontal: 20
},
  centerContainer: { alignItems: "center", paddingHorizontal: 20, paddingTop: 50 },
  tickWrap: { width: 100, height: 100, borderRadius: 50, justifyContent: "center", alignItems: "center", marginBottom: 10 },
  title: { fontSize: 18, fontWeight: "600", textAlign: 'center', paddingHorizontal: 20 },
  amountDisplay: { fontSize: 36, fontWeight: "900", color: "#1F2937", marginTop: 10 },
  
  card: { width: "100%", marginTop: 25, padding: 20, borderRadius: 24, backgroundColor: "#fff", borderWidth: 1, elevation: 1, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  receiptHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mestriName: { fontSize: 18, fontWeight: "600", color: "#111827" },
  villageName: { fontSize: 14, color: "#6B7280" },
  modeBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  modeText: { fontSize: 11, fontWeight: "600" },
  
  divider: { height: 1, backgroundColor: "#F3F4F6", marginVertical: 15 },
  dashedDivider: { height: 1, width: '100%', borderStyle: 'dashed', borderWidth: 0.8, borderColor: '#D1D5DB', marginVertical: 15 },
  
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  infoItem: { flex: 1 },
  infoLabel: { fontSize: 12, color: "#9CA3AF", textTransform: 'uppercase', marginBottom: 2 },
  infoValue: { fontSize: 15, fontWeight: "600", color: "#374151" },
  
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateText: { fontSize: 11, color: "#9CA3AF" },
retryBtn: {
  marginTop: 16,
  backgroundColor: "#DC2626",
  paddingVertical: 10,
  paddingHorizontal: 20,
  borderRadius: 10
},
  bottomBtns: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: 'rgba(255,255,255,0.9)' },
  rowBtns: { flexDirection: "row", gap: 10, marginBottom: 12 },
  subBtn: { flex: 1, paddingVertical: 14, borderRadius: 16, alignItems: "center", borderWidth: 1, flexDirection: "row", justifyContent: "center", gap: 6 },
  
  doneWrapper: { borderRadius: 18, overflow: "hidden" },
  doneGradient: { paddingVertical: 16, alignItems: "center", justifyContent: "center" },
  doneText: { color: "#fff", fontSize: 18, fontWeight: "600" },

  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", zIndex: 1000 },
  modalBox: { width: "85%", backgroundColor: "#fff", borderRadius: 28, padding: 25, alignItems: "center" },
  iconBg: { width: 70, height: 70, borderRadius: 35, justifyContent: "center", alignItems: "center", marginBottom: 15 },
  modalTitle: { fontSize: 20, fontWeight: "600", color: '#111827' },
  stepsContainer: { width: '100%', marginTop: 15 },
  step: { fontSize: 15, color: "#4B5563", marginVertical: 5, fontWeight: '500' },
  okBtn: { marginTop: 25, paddingVertical: 16, borderRadius: 18, alignItems: "center", width: "100%" },
  confirmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15, borderRadius: 16 },
  confirmText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});