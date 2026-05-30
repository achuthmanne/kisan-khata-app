// app/farmer/mestri-history.tsx

import AppEmptyState from "@/components/AppEmptyState";
import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  LayoutAnimation,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  UIManager,
  View
} from "react-native";
import ShimmerPlaceholder from "react-native-shimmer-placeholder";

export default function MestriHistory() {
  const { id, name, village } = useLocalSearchParams();

  // 🔥 PRO FIX: Memory leak కాకుండా ఆపడానికి
  const isMounted = useRef(true);

  const [data, setData] = useState<any[]>([]);
  const [grouped, setGrouped] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false); // 🔥 NEW: Network Error State
  const [refreshing, setRefreshing] = useState(false); // 🔥 NEW: Pull to refresh
  const [language, setLanguage] = useState<"te" | "en">("te");
  const [activeSession, setActiveSession] = useState("");

  // 🔥 PRO FIX: సింగిల్ ఓపెన్ స్టేట్స్ (True Accordion Auto-Close కోసం)
  const [openCrop, setOpenCrop] = useState<string | null>(null);
  const [openWork, setOpenWork] = useState<string | null>(null);

  const [deleteId, setDeleteId] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [paidIds, setPaidIds] = useState<string[]>([]);
  const [showPaidWarning, setShowPaidWarning] = useState(false);

  // 🔥 CLEANUP & ANIMATION SETUP
  useEffect(() => {
    isMounted.current = true;
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
    return () => { isMounted.current = false; };
  }, []);

  /* ---------------- LOAD LANG ---------------- */
  useFocusEffect(
    useCallback(() => {
      const loadLang = async () => {
        const lang = await AsyncStorage.getItem("APP_LANG");
        if (lang && isMounted.current) setLanguage(lang as any);
      };
      loadLang();
    }, [])
  );

  /* ---------------- LOAD DATA (ROBUST) ---------------- */
  const loadData = async (isRefreshed = false) => {
    if (!id) return;

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

      // 1️⃣ పేమెంట్ అయిన రికార్డ్స్ (Locked)
      const paymentsSnap = await firestore()
        .collection("users")
        .doc(userPhone)
        .collection("payments")
        .where("mestriId", "==", id as string)
        .where("session", "==", session)
        .get();

      let paidSet = new Set<string>();
      paymentsSnap.forEach(doc => {
         const selectedIds = doc.data().selectedAttendanceIds || [];
         selectedIds.forEach((attId: string) => paidSet.add(attId));
      });
      if (isMounted.current) setPaidIds(Array.from(paidSet));

      // 2️⃣ మామూలు హాజరు లిస్ట్
      const snap = await firestore()
        .collection("users")
        .doc(userPhone)
        .collection("mestris")
        .doc(id as string)
        .collection("attendance")
        .where("session", "==", session)
        .where("createdAt", "!=", null)
        .orderBy("createdAt", "desc")
        .get();
        
      const list = snap.docs.map(d => ({
        id: d.id,
        ...(d.data() as any)
      }));

      // 🔥 GROUP BY CROP
      const group: any = {};
      list.forEach(item => {
        const crop = item.crop || "Others";
        if (!group[crop]) group[crop] = [];
        group[crop].push(item);
      });

      if (isMounted.current) {
        setData(list);
        setGrouped(group);
      }

    } catch (error) {
      console.log("Error loading attendance history:", error);
      if (isMounted.current) setError(true);
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [id])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  /* ---------------- DELETE ---------------- */
  const handleDelete = async () => {
    const userPhone = await AsyncStorage.getItem("USER_PHONE");
    if (!userPhone) return;

    try {
      await firestore()
        .collection("users")
        .doc(userPhone)
        .collection("mestris")
        .doc(id as string)
        .collection("attendance")
        .doc(deleteId)
        .delete();

      if (isMounted.current) setModalVisible(false);
      loadData(); // మళ్ళీ సింక్ కోసం
    } catch (e) {
      console.log(e);
    }
  };

  /* ---------------- SHIMMER ---------------- */
  const ShimmerCard = () => (
    <View style={styles.shimmerCard}>
      <ShimmerPlaceholder LinearGradient={LinearGradient as any} style={{ height: 14, width: "40%", borderRadius: 6 }} />
      <ShimmerPlaceholder LinearGradient={LinearGradient as any} style={{ height: 12, width: "60%", marginTop: 10, borderRadius: 6 }} />
    </View>
  );

  // 🔥 PRO FIX: Smooth Accordion Animation (Auto-Close)
  const toggleCrop = (crop: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenCrop((prev) => (prev === crop ? null : crop));
    setOpenWork(null); // వేరే క్రాప్ ఓపెన్ చేస్తే లోపలి వర్క్ క్లోజ్ అవ్వాలి
  };

  const toggleWork = (key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenWork((prev) => (prev === key ? null : key));
  };

  const cropColors = ["#22C55E","#3B82F6","#F59E0B","#EF4444","#8B5CF6"];
  const workColors = ["#06B6D4","#84CC16","#F97316","#6366F1","#EC4899"];

  const getCropColor = (crop: string) => cropColors[crop.charCodeAt(0) % cropColors.length];
  const getWorkColor = (work: string) => workColors[work.charCodeAt(0) % workColors.length];

  // 🔥 PRO FIX: పాత Usage తీసేసి, "మొత్తం కూలీలు" లెక్కించే లాజిక్ పెట్టాం
  const getTotalWorkers = () => {
    return data.reduce((sum, entry) => {
      const m = Number(entry.morning) || 0;
      const e = Number(entry.evening) || 0;
      const f = Number(entry.full) || 0;
      return sum + (m + e + f);
    }, 0);
  };
  /* ---------------- UI ---------------- */
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />

      <AppHeader
        title={language === "te" ? "హాజరు వివరాలు" : "Attendance Details"}
        subtitle={language === "te" ? `సీజన్: ${activeSession}` : `Season: ${activeSession}`}
        language={language}
      />

      {loading && !refreshing ? (
        <>
          <View style={styles.summaryBox}>
            <View style={styles.summaryItem}>
              <ShimmerPlaceholder LinearGradient={LinearGradient as any} style={{ width: 60, height: 12, marginBottom: 6 }} />
              <ShimmerPlaceholder LinearGradient={LinearGradient as any} style={{ width: 40, height: 16 }} />
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryItem}>
              <ShimmerPlaceholder LinearGradient={LinearGradient as any} style={{ width: 60, height: 12, marginBottom: 6 }} />
              <ShimmerPlaceholder LinearGradient={LinearGradient as any} style={{ width: 40, height: 16 }} />
            </View>
          </View>
          <View style={{ paddingTop: 10 }}>
            <ShimmerCard />
            <ShimmerCard />
            <ShimmerCard />
          </View>
        </>
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
        <>
         {/* SUMMARY */}
          <View style={styles.summaryBox}>
            <View style={styles.summaryItem}>
              <AppText style={styles.summaryLabel} language={language}>
                {language === "te" ? "మొత్తం రోజులు" : "Total Days"}
              </AppText>
              <AppText style={styles.summaryValue}>{data.length}</AppText>
            </View>

            <View style={styles.divider} />

            <View style={styles.summaryItem}>
              <AppText style={styles.summaryLabel} language={language}>
                {language === "te" ? "మొత్తం కూలీలు" : "Total Workers"}
              </AppText>
              <AppText
                style={[
                  styles.summaryValue,
                  { color: "#16A34A" } // పక్కా గ్రీన్ కలర్ లో చూపిద్దాం
                ]} language={language}
              >
                {getTotalWorkers()}
              </AppText>
            </View>
          </View>

          {/* LIST */}
          <FlatList
            data={Object.keys(grouped)}
            keyExtractor={(item) => item}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#16A34A"]} />}
            contentContainerStyle={[
              { paddingBottom: 100 },
              Object.keys(grouped).length === 0 && { flexGrow: 1, justifyContent: 'center' }
            ]}
            ListEmptyComponent={
              <AppEmptyState
                iconName="file-tray-outline"
                title={language === "te" ? "హాజరు లేదు" : "No Attendance Yet"}
                subtitle={language === "te" ? "కొత్త హాజరు నమోదు చేయండి" : "Start adding records"}
                language={language}
              />
            }
            renderItem={({ item }) => {
              const cropData = grouped[item];
              const cropColor = getCropColor(item);
              
              // 🔥 Single State Check
              const isCropOpen = openCrop === item;

              const workGroups: any = {};
              cropData.forEach((entry: any) => {
                const work = entry.work || "Other";
                if (!workGroups[work]) workGroups[work] = [];
                workGroups[work].push(entry);
              });

              return (
                <View>
                  {/* 🌾 CROP HEADER */}
                  <TouchableOpacity
                    style={[styles.cropHeader, { borderLeftWidth: 5, borderLeftColor: cropColor }]}
                    activeOpacity={0.7}
                    onPress={() => toggleCrop(item)}
                  >
                    <View style={styles.cropLeft}>
                      <AppText style={styles.cropName} language={language}>{item}</AppText>
                      <AppText style={styles.cropDays} language={language}>
                        {cropData.length} {language === "te" ? "రోజులు" : "days"}
                      </AppText>
                    </View>
                    {/* 🔥 CHEVRON BG */}
                    <View style={styles.chevronBg}>
                      <Ionicons name={isCropOpen ? "chevron-up" : "chevron-down"} size={20} color="#4B5563" />
                    </View>
                  </TouchableOpacity>

                  {/* 🌾 INSIDE CROP */}
                  {isCropOpen && Object.keys(workGroups).map((work) => {
                    const workData = workGroups[work];
                    const workKey = item + "_" + work;
                    const workColor = getWorkColor(work);
                    
                    // 🔥 Single State Check
                    const isWorkOpen = openWork === workKey;

                    return (
                      <View key={work}>
                        {/* 🔹 WORK HEADER */}
                        <TouchableOpacity
                          style={[styles.workHeader, { borderLeftWidth: 4, borderLeftColor: workColor }]}
                          activeOpacity={0.7}
                          onPress={() => toggleWork(workKey)}
                        >
                          <View style={{ flex: 1, flexDirection: "column" }}>
                            <AppText style={styles.workName} language={language}>{work}</AppText>
                            <AppText style={styles.workDaysText} language={language}>
                              {workData.length} {language === "te" ? "రోజులు" : "days"}
                            </AppText>
                          </View>
                          {/* 🔥 CHEVRON BG SMALL */}
                          <View style={styles.chevronBgSmall}>
                            <Ionicons name={isWorkOpen ? "chevron-up" : "chevron-down"} size={16} color="#6B7280" />
                          </View>
                        </TouchableOpacity>

                        {/* 🧾 CARDS */}
                        {isWorkOpen && workData.map((entry: any) => {
                          const total = (entry.morning || 0) + (entry.evening || 0) + (entry.full || 0);
                          const isPaid = paidIds.includes(entry.id);
                          const acres = entry.acresWorked || 0; // 🔥 Fetching Acres

                          return (
                            <View key={entry.id} style={[styles.card, { borderLeftWidth: 4, borderLeftColor: workColor, borderColor: workColor + "30" }]}>
                              <View style={styles.rowTop}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                  <Ionicons name="calendar-outline" size={16} color={workColor} />
                                  <AppText style={styles.date} language={language}>{entry.date}</AppText>
                                </View>
                                {/* 🔥 DISPLAYING ACRES WORKED */}
                                {acres > 0 && (
                                  <View style={styles.acresBadge}>
                                    <Ionicons name="expand-outline" size={12} color="#16A34A" />
                                    <AppText style={styles.acresText} language={language}>
                                      {acres} {language === "te" ? "ఎకరాలు" : "Acres"}
                                    </AppText>
                                  </View>
                                )}
                              </View>

                              <View style={styles.valuesRow}>
                                <View style={styles.valueItem}>
                                  <Ionicons name="sunny-outline" size={14} color="#F59E0B" />
                                  <AppText style={styles.label} language={language}>{language === "te" ? "ఉదయం" : "Morning"}</AppText>
                                  <AppText style={styles.value}>{entry.morning || 0}</AppText>
                                </View>
                                <View style={styles.valueItem}>
                                  <Ionicons name="partly-sunny-outline" size={14} color="#3B82F6" />
                                  <AppText style={styles.label} language={language}>{language === "te" ? "మధ్యాహ్నం" : "Afternoon"}</AppText>
                                  <AppText style={styles.value}>{entry.evening || 0}</AppText>
                                </View>
                                <View style={styles.valueItem}>
                                  <Ionicons name="moon-outline" size={14} color="#8B5CF6" />
                                  <AppText style={styles.label} language={language}>{language === "te" ? "రోజంతా" : "Full"}</AppText>
                                  <AppText style={styles.value}>{entry.full || 0}</AppText>
                                </View>
                              </View>

                              <View style={styles.bottomRow}>
                                <AppText style={[styles.total, { color: workColor }]} language={language}>
                                  {language === "te" ? "మొత్తం కూలీల సంఖ్య" : "Total Workers"}: {total}
                                </AppText>
                                
                                <TouchableOpacity
                                  onPress={() => {
                                    if (isPaid) {
                                      setShowPaidWarning(true);
                                    } else {
                                      setDeleteId(entry.id);
                                      setModalVisible(true);
                                    }
                                  }}
                                  style={[styles.deleteIconWrap, isPaid && { backgroundColor: '#FEF3C7' }]}
                                  activeOpacity={0.6}
                                >
                                  {isPaid ? <Ionicons name="lock-closed" size={16} color="#F59E0B" /> : <Ionicons name="trash-outline" size={16} color="#DC2626" />}
                                </TouchableOpacity>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    );
                  })}
                </View>
              );
            }}
          />
        </>
      )}

      {/* 🔴 STANDARD DELETE MODAL (For Unpaid records) */}
      <Modal visible={modalVisible} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.modalOverlayStandard}>
          <View style={styles.modalContentStandard}>
            <View style={styles.modalIconBgStandard}>
              <Ionicons name="trash-outline" size={36} color="#e44830" />
            </View>
            <AppText style={styles.modalTitleStandard} language={language}>
              {language === "te" ? "తొలగించాలా?" : "Remove Entry?"}
            </AppText>
            <AppText style={styles.modalSubStandard} language={language}>
              {language === "te"
                ? "ఈ హాజరు వివరాన్ని తొలగించాలా?"
                : "Are you sure you want to delete this attendance record?"}
            </AppText>
            <View style={styles.modalButtonsStandard}>
              <TouchableOpacity style={styles.modalCancelBtnStandard} onPress={() => setModalVisible(false)}>
                <AppText style={styles.modalCancelTextStandard} language={language}>{language === "te" ? "వద్దు" : "Cancel"}</AppText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtnStandard} onPress={handleDelete}>
                <AppText style={styles.modalConfirmTextStandard} language={language}>{language === "te" ? "తొలగించు" : "Delete"}</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 🔒 ALREADY PAID WARNING MODAL */}
      <Modal visible={showPaidWarning} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.modalOverlayStandard}>
          <View style={styles.modalContentStandard}>
            <View style={styles.modalIconBgStandardWarning}>
              <Ionicons name="lock-closed" size={36} color="#F59E0B" />
            </View>
            <AppText style={styles.modalTitleStandardWarning} language={language}>
              {language === "te" ? "తొలగించడం కుదరదు" : "Cannot Delete"}
            </AppText>
            <AppText style={styles.modalSubStandard} language={language}>
              {language === "te"
                ? "ఈ హాజరుకు ఇప్పటికే చెల్లింపు జరిగింది. మీరు దీన్ని తొలగించాలనుకుంటే, ముందుగా 'చెల్లింపు చరిత్ర' (Payment History) లో పేమెంట్ రికార్డును తొలగించండి."
                : "This attendance is already paid. Please delete the payment record in Payment History first before removing it here."}
            </AppText>
            <View style={styles.modalButtonsStandard}>
              <TouchableOpacity activeOpacity={0.7} style={styles.modalWarningBtnStandard} onPress={() => setShowPaidWarning(false)}>
                <AppText style={styles.modalWarningTextStandard} language={language}>
                  {language === "te" ? "అర్థమైంది" : "Got It"}
                </AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

/* ---------------- STYLES ---------------- */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6F7F6" },

  errorContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 40 },
  errorIconBg: { width: 90, height: 90, borderRadius: 45, backgroundColor: "#F3F4F6", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  errorText: { fontSize: 16, fontWeight: "600", color: "#4B5563", textAlign: "center", marginBottom: 20 },
  retryBtn: { backgroundColor: "#16A34A", paddingHorizontal: 30, paddingVertical: 12, borderRadius: 14 },
  retryText: { color: "white", fontSize: 15, fontWeight: "600" },

  summaryBox: { marginHorizontal: 20, marginTop: 10, paddingVertical: 14, flexDirection: "row", justifyContent: "space-around", alignItems: "center", backgroundColor: "#ffffff", borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB" },
  summaryItem: { alignItems: "center" },
  summaryLabel: { fontSize: 12, color: "#6B7280" },
  summaryValue: { fontSize: 16, fontWeight: "600", marginTop: 2, lineHeight: 28, includeFontPadding: false },
  divider: { width: 1, height: 30, backgroundColor: "#E5E7EB" },

  cropHeader: { marginHorizontal: 20, marginTop: 12, paddingVertical: 12, paddingHorizontal: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB" },
  cropLeft: { flexDirection: "column", justifyContent: "center" },
  cropName: { fontSize: 20, fontWeight: "600", color: "#111827", includeFontPadding: false },
  cropDays: { fontSize: 12, color: "#6B7280", marginTop: 3 },
  
  workHeader: { marginHorizontal: 28, marginTop: 8, paddingVertical: 10, paddingHorizontal: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#E5E7EB" },
  workName: { fontSize: 14, fontWeight: "600", color: "#111827" },
  workDaysText: { fontSize: 11, color: "#6B7280", marginTop: 2 },

  // 🔥 NEW STYLES: Chevron Backgrounds
  chevronBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6", 
    justifyContent: "center",
    alignItems: "center"
  },
  chevronBgSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F3F4F6", 
    justifyContent: "center",
    alignItems: "center"
  },

  card: { marginHorizontal: 30, marginVertical: 6, padding: 14, borderWidth: 1, borderRadius: 12, backgroundColor: "#fff", position: "relative" },
  shimmerCard: { marginHorizontal: 20, marginVertical: 6, padding: 14, borderRadius: 14, backgroundColor: "#fff" },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  date: { fontSize: 13, color: "#374151", fontWeight: "500", marginLeft: 6 },
  
  // 🔥 ACRES STYLES
  acresBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#BBF7D0' },
  acresText: { fontSize: 11, color: '#15803D', fontWeight: '600', marginLeft: 4 },

  valuesRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  valueItem: { alignItems: "center" },
  label: { fontSize: 11, color: "#6B7280", marginTop: 2 },
  value: { fontSize: 14, fontWeight: "600", marginTop: 2 },
  
  bottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  total: { fontSize: 15, fontWeight: "600" },
  
  deleteIconWrap: { padding: 8, borderRadius: 10, backgroundColor: "#FEF2F2", zIndex: 50 },
  
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center" },
  modalBox: { width: "80%", backgroundColor: "#fff", borderRadius: 18, padding: 20, alignItems: "center" },
  iconBg: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#FEE2E2", justifyContent: "center", alignItems: "center", marginBottom: 10 },
  modalTitle: { fontSize: 16, fontWeight: "600", marginTop: 6, color: '#111827' },
  modalSub: { fontSize: 13, color: "#6B7280", textAlign: "center", marginTop: 8 },
  modalBtns: { flexDirection: "row", marginTop: 22, gap: 12 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: "#F3F4F6", justifyContent: 'center', alignItems: 'center' },
  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, backgroundColor: "#DC2626" },
  cancelText: { fontSize: 13, color: "#374151", fontWeight: "500", textAlign: 'center' },
  deleteText: { fontSize: 13, color: "#fff", fontWeight: "600", textAlign: 'center' },
  
  // UNIFIED PREMIUM MODAL CLASSES
  modalOverlayStandard: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 999 },
  modalContentStandard: { width: "80%", backgroundColor: "white", borderRadius: 25, padding: 25, alignItems: "center" },
  modalTitleStandard: { fontSize: 20, fontWeight: "500", color: "#e2431f", marginVertical: 10 },
  modalSubStandard: { textAlign: "center", color: "#64748B", marginBottom: 25 },
  modalButtonsStandard: { flexDirection: "row", gap: 10 },
  modalCancelBtnStandard: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#F1F5F9", alignItems: "center" },
  modalConfirmBtnStandard: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#EF4444", alignItems: "center" },
  modalCancelTextStandard: { color: "#64748B", fontWeight: "500" },
  modalConfirmTextStandard: { color: "white", fontWeight: "500" },
  modalIconBgStandard: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#f5e8e8", justifyContent: "center", alignItems: "center", marginBottom: 10 },
  modalTitleStandardWarning: { fontSize: 20, fontWeight: "500", color: "#F59E0B", marginVertical: 10, textAlign: "center" },
  modalWarningBtnStandard: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#F59E0B", alignItems: "center" },
  modalWarningTextStandard: { color: "white", fontWeight: "500" },
  modalIconBgStandardWarning: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#FEF3C7", justifyContent: "center", alignItems: "center", marginBottom: 10 },
});