// app/farmer/mestripayments/payment-success.tsx

import AgriLoader from "@/components/AgriLoader";
import AppText from "@/components/AppText";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import firestore from "@react-native-firebase/firestore";
import { executeOfflineSafeRead, executeOfflineSafeWrite } from "@/utils/offlineHelper";
import storage from "@react-native-firebase/storage";
import * as FileSystem from "expo-file-system";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler } from "react-native";

import {
  Animated,
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View
} from "react-native";

export const unstable_settings = {
  gestureEnabled: false, 
};

type Proof = { uri: string, type: "image" | "pdf", name?: string };

export default function PaymentSuccess() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const hasSaved = useRef(false);
  
  const {
    id, ids, crop, work, name, village,
    totalDays, totalWorkers, totalAcres, 
    totalMorning, totalEvening, totalFull,
    morningRate, eveningRate, fullRate,
    amount, paymentMode,
    splitCash, splitUpi, proofs
  } = params;

  const [navigating, setNavigating] = useState(false);
  const [status, setStatus] = useState<"loading" | "success" | "failed">("loading");
  const [errorDetails, setErrorDetails] = useState("");
  const [language, setLanguage] = useState<"en" | "te">("en");
  const [helpModal, setHelpModal] = useState(false);
  const scale = useRef(new Animated.Value(0)).current;

  const SUCCESS_GREEN = "#16A34A"; 

  let selectedIds: string[] = [];
  try { selectedIds = typeof ids === "string" ? JSON.parse(ids) : Array.isArray(ids) ? ids : []; } catch { selectedIds = []; }

  let parsedProofs: Proof[] = [];
  try { parsedProofs = typeof proofs === "string" ? JSON.parse(proofs) : []; } catch { parsedProofs = []; }

  /* ---------- LOAD LANGUAGE ---------- */
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem("APP_LANG").then(lang => {
        if (lang) setLanguage(lang as any);
      });
    }, [])
  );

  /* ---------- BLOCK ANDROID BACK BUTTON ---------- */
  useEffect(() => {
    const backAction = () => true; 
    const subscription = BackHandler.addEventListener("hardwareBackPress", backAction);
    return () => subscription.remove();
  }, []);

  /* ---------- SAVE DATA TO FIREBASE ---------- */
  const saveData = async () => {
    setStatus("loading");

    try {
      const net = await NetInfo.fetch();
      const isOffline = !net.isConnected || !net.isInternetReachable;

      const phone = await AsyncStorage.getItem("USER_PHONE");
      if (!phone) { setStatus("failed"); return; }

      // 1. UPLOAD PROOFS (Images + PDF) - CONCURRENT UPLOAD FOR SPEED
      let uploadedProofs: { url: string, type: string, name?: string }[] = [];
      if (parsedProofs.length > 0) {
        const uploadTasks = parsedProofs.map(async (proof, i) => {
          try {
            const ext = proof.type === "pdf" ? "pdf" : "jpg";
            const fileName = `payments/${phone}/${Date.now()}_${i}.${ext}`;
            const reference = storage().ref(fileName);

            let uploadUri = proof.uri;
            // @ts-ignore
            if (uploadUri.startsWith("content://") && FileSystem.cacheDirectory) {
              // @ts-ignore
              const localUri = `${FileSystem.cacheDirectory}temp_upload_${Date.now()}_${i}.${ext}`;
              await FileSystem.copyAsync({ from: uploadUri, to: localUri });
              uploadUri = localUri;
            }

            // If offline or storage fails, we just keep the local URI. 
            // In a full production app, you'd queue this for later upload.
            if (isOffline) {
              return { url: uploadUri, type: proof.type, name: proof.name || "", isLocal: true };
            }

            await reference.putFile(uploadUri);
            const url = await reference.getDownloadURL();
            return { url, type: proof.type, name: proof.name || "" };
          } catch (storageErr) {
            console.log("Storage upload error:", storageErr);
            // Fallback to local URI so we don't lose the record
            return { url: proof.uri, type: proof.type, name: proof.name || "", isLocal: true };
          }
        });

        const results = await Promise.all(uploadTasks);
        uploadedProofs = results.filter(Boolean) as any[];
      }

      // 2. SAVE FIRESTORE DOC
      const db = firestore();
      const userDoc = await executeOfflineSafeRead(db.collection("users").doc(phone));
      const activeSession = userDoc.data()?.activeSession || "default";

      const paymentData: any = {
        mestriId: id || "",
        session: activeSession, 
        selectedAttendanceIds: selectedIds || [],
        crop: crop || "", 
        work: work || "", 
        name: name || "", 
        village: village || "", 
        paymentMode: paymentMode || "",
        totalAmount: Number(amount) || 0,
        proofs: uploadedProofs,
        details: {
          totalDays: Number(totalDays) || 0,
          totalWorkers: Number(totalWorkers) || 0,
          totalAcres: Number(totalAcres) || 0, 
          morning: Number(totalMorning) || 0,
          evening: Number(totalEvening) || 0,
          full: Number(totalFull) || 0,
          mRate: Number(morningRate) || 0,
          eRate: Number(eveningRate) || 0,
          fRate: Number(fullRate) || 0,
        },
        createdAt: firestore.FieldValue.serverTimestamp()
      };

      if (paymentMode === "both") {
        paymentData.splitDetails = {
          cash: Number(splitCash),
          upi: Number(splitUpi)
        };
      }

      const batch = db.batch();
      const paymentRef = db.collection("users").doc(phone).collection("payments").doc();
      batch.set(paymentRef, paymentData);

      selectedIds.forEach((attId) => {
        const attRef = db
          .collection("users")
          .doc(phone)
          .collection("mestris")
          .doc(id as string)
          .collection("attendance")
          .doc(attId);
        batch.update(attRef, { isPaid: true, paymentId: paymentRef.id });
      });

      await executeOfflineSafeWrite(batch.commit());

      setStatus("success");

      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        bounciness: 12
      }).start();

    } catch (e: any) {
      console.log("Save error:", e);
      setErrorDetails(e?.message || String(e));
      setStatus("failed"); 
    }
  };

  useEffect(() => {
    if (!hasSaved.current) {
      hasSaved.current = true;
      saveData();
    }
  }, []);

  const handleGoHome = () => {
    if (navigating) return;
    setNavigating(true);
    setHelpModal(false);
    router.replace("/farmer/(tabs)");
  };

  const getPaymentModeBadge = () => {
    if (paymentMode === "upi") return "UPI";
    if (paymentMode === "both") return language === "te" ? "రెండు (Split)" : "Both";
    return language === "te" ? "నగదు" : "Cash";
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

              <AppText style={styles.amountDisplay}>₹ {Number(amount).toLocaleString('en-IN')}</AppText>

              <View style={[styles.card, { borderColor: SUCCESS_GREEN + "30" }]}>
                <View style={styles.receiptHeader}>
                   <View style={{ flex: 1 }}>
                      <AppText style={styles.mestriName} numberOfLines={1} ellipsizeMode="tail">{name}</AppText>
                      <AppText style={styles.villageName} numberOfLines={1} ellipsizeMode="tail">{village}</AppText>
                   </View>
                   <View style={[styles.modeBadge, { backgroundColor: SUCCESS_GREEN + "10", borderColor: SUCCESS_GREEN }]}>
                      <AppText style={[styles.modeText, { color: SUCCESS_GREEN }]} language={language}>
                          {getPaymentModeBadge()}
                      </AppText>
                   </View>
                </View>

                {paymentMode === "both" && (
                  <View style={styles.splitBox}>
                    <View style={styles.splitItem}>
                      <AppText style={styles.splitLabel} language={language}>{language === "te" ? "క్యాష్ (Cash)" : "Cash"}</AppText>
                      <AppText style={styles.splitVal}>₹ {Number(splitCash).toLocaleString('en-IN')}</AppText>
                    </View>
                    <View style={styles.splitDivider} />
                    <View style={styles.splitItem}>
                      <AppText style={styles.splitLabel} language={language}>{language === "te" ? "యూపీఐ (UPI)" : "UPI"}</AppText>
                      <AppText style={styles.splitVal}>₹ {Number(splitUpi).toLocaleString('en-IN')}</AppText>
                    </View>
                  </View>
                )}

                <View style={styles.divider} />

                {/* ROW 1: CROP & WORK */}
                <View style={styles.infoRow}>
                   <View style={styles.infoItem}>
                      <AppText style={styles.infoLabel} language={language}>{language === "te" ? "పంట" : "Crop"}</AppText>
                      <AppText style={styles.infoValue} numberOfLines={1} ellipsizeMode="tail">{crop}</AppText>
                   </View>
                   <View style={styles.infoItemRight}>
                      <AppText style={[styles.infoLabel, { textAlign: "right" }]} language={language}>{language === "te" ? "పని" : "Work"}</AppText>
                      <AppText style={[styles.infoValue, { textAlign: "right" }]} numberOfLines={1} ellipsizeMode="tail">{work}</AppText>
                   </View>
                </View>

                {/* ROW 2: WORKERS & ACRES */}
                <View style={styles.infoRow}>
                   <View style={styles.infoItem}>
                      <AppText style={styles.infoLabel} language={language}>{language === "te" ? "మొత్తం కార్మికులు" : "Workers"}</AppText>
                      <AppText style={styles.infoValue}>{totalWorkers || 0}</AppText>
                   </View>
                   <View style={styles.infoItemRight}>
                      <AppText style={[styles.infoLabel, { textAlign: "right" }]} language={language}>{language === "te" ? "మొత్తం ఎకరాలు" : "Total Acres"}</AppText>
                      <AppText style={[styles.infoValue, { textAlign: "right" }]}>{totalAcres || 0}</AppText>
                   </View>
                </View>

                {/* 🔥 ROW 3: PROOFS & DAYS (HORIZONTALLY ALIGNED) */}
                <View style={[styles.infoRow, { alignItems: 'flex-start' }]}>
                   <View style={styles.infoItem}>
                      <AppText style={styles.infoLabel} language={language}>{language === "te" ? "జోడించిన ఆధారాలు" : "Attached Proofs"}</AppText>
                      {parsedProofs.length > 0 ? (
                        <View style={styles.proofsRow}>
                          {parsedProofs.map((proof, idx) => (
                            <View key={idx} style={styles.proofWrap}>
                              {proof.type === "image" ? (
                                <Image source={{ uri: proof.uri }} style={styles.proofImage} contentFit="cover" />
                              ) : (
                                <View style={[styles.proofImage, { backgroundColor: "#FEE2E2", justifyContent: "center", alignItems: "center" }]}>
                                  <Ionicons name="document-text" size={24} color="#DC2626" />
                                </View>
                              )}
                            </View>
                          ))}
                        </View>
                      ) : (
                        <AppText style={styles.infoValue}>-</AppText>
                      )}
                   </View>
                   <View style={styles.infoItemRight}>
                      <AppText style={[styles.infoLabel, { textAlign: "right" }]} language={language}>{language === "te" ? "మొత్తం రోజులు" : "Total Days"}</AppText>
                      <AppText style={[styles.infoValue, { textAlign: "right" }]}>{totalDays || 0}</AppText>
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
              ? "దయచేసి మీ ఇంటర్నెట్ కనెక్షన్ చెక్ చేసి మళ్ళీ ప్రయత్నించండి."
              : "Check your internet connection and try again."}
          </AppText>
          
          {errorDetails ? (
            <AppText style={{ fontSize: 11, color: "#9CA3AF", marginTop: 10, textAlign: 'center', marginHorizontal: 20 }}>
              Error: {errorDetails}
            </AppText>
          ) : null}

          <TouchableOpacity style={styles.retryBtn} onPress={saveData}>
            <AppText style={{ color: "#fff", fontWeight: "600" }}>
              {language === "te" ? "మళ్ళీ ప్రయత్నించండి" : "Retry"}
            </AppText>
          </TouchableOpacity>
        </View>
      )}

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
              <TouchableOpacity activeOpacity={0.8} style={styles.modalInfoBtnStandard} onPress={() => setHelpModal(false)}>
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
  fullCenter: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
  centerContainer: { alignItems: "center", paddingHorizontal: 20, paddingTop: 50 },
  tickWrap: { width: 100, height: 100, borderRadius: 50, justifyContent: "center", alignItems: "center", marginBottom: 10 },
  title: { fontSize: 18, fontWeight: "600", textAlign: 'center', paddingHorizontal: 20 },
  amountDisplay: { fontSize: 36, fontWeight: "900", color: "#1F2937", marginTop: 10 },
  
  card: { width: "100%", marginTop: 25, padding: 20, borderRadius: 24, backgroundColor: "#fff", borderWidth: 1, elevation: 1, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  receiptHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mestriName: { fontSize: 18, fontWeight: "600", color: "#111827" },
  villageName: { fontSize: 14, color: "#6B7280" },
  modeBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, borderWidth: 1, marginLeft: 10 },
  modeText: { fontSize: 11, fontWeight: "600" },
  
  divider: { height: 1, backgroundColor: "#F3F4F6", marginVertical: 15 },
  dashedDivider: { height: 1, width: '100%', borderStyle: 'dashed', borderWidth: 0.8, borderColor: '#D1D5DB', marginVertical: 15 },
  
  // SPLIT STYLES
  splitBox: { flexDirection: "row", marginTop: 15, padding: 12, backgroundColor: "#F9FAFB", borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB" },
  splitItem: { flex: 1, alignItems: "center" },
  splitDivider: { width: 1, backgroundColor: "#D1D5DB", marginHorizontal: 10 },
  splitLabel: { fontSize: 11, color: "#6B7280", marginBottom: 4 },
  splitVal: { fontSize: 15, fontWeight: "700", color: "#374151" },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  infoItem: { flex: 1 },
  infoItemRight: { flex: 1, alignItems: "flex-end" },
  infoLabel: { fontSize: 12, color: "#9CA3AF", textTransform: 'uppercase', marginBottom: 2 },
  infoValue: { fontSize: 15, fontWeight: "600", color: "#374151" },
  
  // PROOFS STYLES
  proofsRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  proofWrap: { width: 44, height: 44 }, // Made slightly smaller to fit perfectly
  proofImage: { width: "100%", height: "100%", borderRadius: 8, borderWidth: 1, borderColor: "#E5E7EB" },

  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateText: { fontSize: 11, color: "#9CA3AF" },
  retryBtn: { marginTop: 20, backgroundColor: "#DC2626", paddingVertical: 12, paddingHorizontal: 30, borderRadius: 12 },
  bottomBtns: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, paddingTop: 20, backgroundColor: 'rgba(240,253,244,0.9)' },
  rowBtns: { flexDirection: "row", gap: 10, marginBottom: 10 },
  subBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center", borderWidth: 1, flexDirection: "row", justifyContent: "center", gap: 6 },
  
  doneWrapper: { borderRadius: 14, overflow: "hidden", elevation: 2, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 5, shadowOffset: {width: 0, height: 2} },
  confirmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 14 },
  confirmText: { color: "#fff", fontSize: 15, fontWeight: "600" },

  modalOverlayStandard: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 999 },
  modalContentStandard: { width: "85%", backgroundColor: "white", borderRadius: 24, padding: 24, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 15 },
  modalSubStandard: { textAlign: "center", color: "#64748B", marginTop: 8, marginBottom: 25, fontSize: 14, lineHeight: 22 },
  modalButtonsStandard: { flexDirection: "row", justifyContent: "center", width: '100%' },
  modalIconBgStandardInfo: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#DCFCE7", justifyContent: "center", alignItems: "center", marginBottom: 12 },
  modalTitleStandardInfo: { fontSize: 20, fontWeight: "600", color: "#16A34A", marginTop: 10, textAlign: "center" },
  modalInfoBtnStandard: { paddingHorizontal: 30, paddingVertical: 10, borderRadius: 10, backgroundColor: "#16A34A", alignItems: "center", justifyContent: "center" },
  modalInfoTextStandard: { color: "white", fontWeight: "600", fontSize: 15 },
});