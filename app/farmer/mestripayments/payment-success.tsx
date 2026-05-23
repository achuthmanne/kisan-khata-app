import AgriLoader from "@/components/AgriLoader";
import AppText from "@/components/AppText";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import NetInfo from "@react-native-community/netinfo";
import { BackHandler } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import {
  Animated,
  Dimensions,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
  Modal
} from "react-native";

// 🔥 FULL BLOCK iOS SWIPE BACK
export const unstable_settings = {
  gestureEnabled: false, 
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

  /* ---------- BLOCK ANDROID BACK BUTTON ---------- */
  useEffect(() => {
    const backAction = () => {
      return true; // 🔥 blocks back press
    };

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction
    );

    return () => subscription.remove();
  }, []);

  /* ---------- SAVE DATA TO FIREBASE ---------- */
  const saveData = async () => {
    setStatus("loading");

    try {
      const net = await NetInfo.fetch();

      if (!net.isConnected) {
        setStatus("failed"); // 🔥 DIRECT FAIL NO INTERNET
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

      // 🔥 ANIMATION TRIGGER
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        bounciness: 12
      }).start();

    } catch (e) {
      console.log(e);
      setStatus("failed"); 
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
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
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
                          {paymentMode === "upi" ? "UPI" : language === "te" ? "నగదు" : "Cash"}
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
              <TouchableOpacity activeOpacity={0.8} style={[styles.subBtn, { borderColor: "#D1D5DB", backgroundColor: "#fff" }]} onPress={() => setHelpModal(true)}>
                <Ionicons name="help-circle-outline" size={18} color="#4B5563" />
                <AppText style={{ color: "#4B5563", fontWeight: '600' }} language={language}>{language === "te" ? "సహాయం" : "Help"}</AppText>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.8} style={[styles.subBtn, { backgroundColor: "#fff", borderColor: SUCCESS_GREEN }]} onPress={() => router.replace("/farmer/(tabs)/history")}>
                <Ionicons name="time-outline" size={18} color={SUCCESS_GREEN} />
                <AppText style={{ color: SUCCESS_GREEN, fontWeight: '600' }} language={language}>{language === "te" ? "చెల్లింపులు" : "Payments"}</AppText>
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
            {language === "te" ? "చెల్లింపు భద్రపరచడం విఫలమైంది" : "Payment Failed"}
          </AppText>

          <AppText style={{ fontSize: 13, color: "#6B7280", marginTop: 6, textAlign: 'center' }}>
            {language === "te"
              ? "ఇంటర్నెట్ కనెక్షన్ చెక్ చేసి మళ్ళీ ప్రయత్నించండి"
              : "Check your internet and try again"}
          </AppText>

          <TouchableOpacity style={styles.retryBtn} onPress={saveData}>
            <AppText style={{ color: "#fff", fontWeight: "600" }}>
              {language === "te" ? "మళ్ళీ ప్రయత్నించండి" : "Retry"}
            </AppText>
          </TouchableOpacity>
        </View>
      )}

      {/* HELP MODAL - PREMIUM THEME */}
      <Modal visible={helpModal} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.modalOverlayStandard}>
          <View style={styles.modalContentStandard}>
            <View style={styles.modalIconBgStandardInfo}>
              <Ionicons name="information-circle" size={36} color={SUCCESS_GREEN} />
            </View>
            <AppText style={styles.modalTitleStandardInfo} language={language}>
              {language === "te" ? "ఎలా సరిచేయాలి?" : "How to fix payment?"}
            </AppText>
            
            <View style={{ width: '100%', marginTop: 15, marginBottom: 25 }}>
              <AppText style={[styles.modalSubStandard, { textAlign: 'left', marginBottom: 6 }]} language={language}>
                1. {language === "te" ? "కింద ఉన్న 'చెల్లింపులు' ఆప్షన్ నొక్కండి." : "Go to Payments below."}
              </AppText>
              <AppText style={[styles.modalSubStandard, { textAlign: 'left', marginBottom: 6 }]} language={language}>
                2. {language === "te" ? "మీరు తప్పుగా వేసిన చెల్లింపు వివరాలపై నొక్కండి." : "Tap on the incorrect payment record."}
              </AppText>
              <AppText style={[styles.modalSubStandard, { textAlign: 'left', marginBottom: 0 }]} language={language}>
                3. {language === "te" ? "పైన ఉన్న 'తొలగించు' (చెత్తబుట్ట) ఐకాన్ నొక్కి దాన్ని తీసేయండి." : "Tap the 'Delete' (trash) icon at the top."}
              </AppText>
            </View>
            
            <View style={styles.modalButtonsStandard}>
              <TouchableOpacity 
                activeOpacity={0.8} 
                style={styles.modalInfoBtnStandard} 
                onPress={() => setHelpModal(false)}
              >
                <AppText style={styles.modalInfoTextStandard} language={language}>
                  {language === "te" ? "అర్థమైంది" : "Got it"}
                </AppText>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContent: { paddingBottom: 220, flexGrow: 1 }, 
  fullCenter: {
    flex: 1,
    justifyContent: "center", 
    alignItems: "center",     
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
    marginTop: 20,
    backgroundColor: "#DC2626",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 12
  },
  bottomBtns: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 20, paddingTop: 30, backgroundColor: 'rgba(240,253,244,0.9)' },
  rowBtns: { flexDirection: "row", gap: 10, marginBottom: 12 },
  subBtn: { flex: 1, paddingVertical: 14, borderRadius: 16, alignItems: "center", borderWidth: 1, flexDirection: "row", justifyContent: "center", gap: 6 },
  
  doneWrapper: { borderRadius: 18, overflow: "hidden", elevation: 2, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 5, shadowOffset: {width: 0, height: 2} },
  confirmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, borderRadius: 18 },
  confirmText: { color: "#fff", fontSize: 16, fontWeight: "600" },

  // UNIFIED PREMIUM MODAL CLASSES
  modalOverlayStandard: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 999 },
  modalContentStandard: { width: "85%", backgroundColor: "white", borderRadius: 24, padding: 24, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 15 },
  modalSubStandard: { textAlign: "center", color: "#64748B", marginTop: 8, marginBottom: 25, fontSize: 14, lineHeight: 22 },
  modalButtonsStandard: { flexDirection: "row", gap: 12, width: '100%' },
  modalIconBgStandardInfo: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#DCFCE7", justifyContent: "center", alignItems: "center", marginBottom: 12 },
  modalTitleStandardInfo: { fontSize: 20, fontWeight: "600", color: "#16A34A", marginTop: 10, textAlign: "center" },
  modalInfoBtnStandard: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: "#16A34A", alignItems: "center", justifyContent: "center" },
  modalInfoTextStandard: { color: "white", fontWeight: "600", fontSize: 16 },
});