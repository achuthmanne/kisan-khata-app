// app/farmer/payment-summary.tsx

import AppEmptyState from "@/components/AppEmptyState";
import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
  Modal,
  TextInput
} from "react-native";
import ShimmerPlaceholder from "react-native-shimmer-placeholder";

export default function PaymentSummary() {
  const { ids, crop, work, id, name, village } = useLocalSearchParams();
  const router = useRouter();
  const [focused, setFocused] = useState("");
  const [data, setData] = useState<any[]>([]);
  const [errorModal, setErrorModal] = useState(false);
  const [errorType, setErrorType] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<"te" | "en">("te");
  const [modeModal, setModeModal] = useState(false);
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi" | "">("");
  const [morningRate, setMorningRate] = useState("");
  const [eveningRate, setEveningRate] = useState("");
  const [fullRate, setFullRate] = useState("");
  const [showModal, setShowModal] = useState(false);

  /* ---------------- LOAD LANGUAGE ---------------- */
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem("APP_LANG").then(l => {
        if (l) setLanguage(l as any);
      });
    }, [])
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
        if (!activeSession) return;

        const selectedIds = JSON.parse(ids as string);
        const snap = await firestore()
          .collection("users")
          .doc(userPhone)
          .collection("mestris")
          .doc(id as string)
          .collection("attendance")
          .where("session", "==", activeSession) 
          .get();

        const list = snap.docs
          .map(d => ({ id: d.id, ...(d.data() as any) }))
          .filter(item => selectedIds.includes(item.id));

        setData(list);
    } catch (err) {
        console.log("Error loading payment summary:", err);
    } finally {
        setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  /* ---------------- CALCULATIONS ---------------- */
  const totalMorning = data.reduce((sum, item) => sum + (item.morning || 0), 0);
  const totalEvening = data.reduce((sum, item) => sum + (item.evening || 0), 0);
  const totalFull = data.reduce((sum, item) => sum + (item.full || 0), 0);
  const totalWorkers = totalMorning + totalEvening + totalFull;
  const totalDays = data.length;

  const colors = ["#06B6D4","#84CC16","#F97316","#6366F1","#EC4899"];
  const workColor = colors[(work as string).charCodeAt(0) % colors.length];
  
  const amount =
    totalMorning * Number(morningRate || 0) +
    totalEvening * Number(eveningRate || 0) +
    totalFull * Number(fullRate || 0);

  // 🔥 AMOUNT FORMATTING FIX
  const formattedAmount = amount.toLocaleString("en-IN");

  /* ---------------- SHIMMERS ---------------- */
  const SummaryShimmer = () => (
    <View style={styles.shimmerSummary}>
      <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ height: 14, width: 100, borderRadius: 6, alignSelf: "center" }} />
      <View style={{ flexDirection: "row", marginTop: 10 }}>
        <ShimmerPlaceholder LinearGradient={LinearGradient} style={styles.shimmerBox} />
        <ShimmerPlaceholder LinearGradient={LinearGradient} style={styles.shimmerBox} />
      </View>
    </View>
  );

  const CardShimmer = () => (
    <View style={styles.shimmerCard}>
      <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ height: 12, width: 120, borderRadius: 6 }} />
      <View style={styles.divider} />
      <View style={styles.valuesContainer}>
        <ShimmerPlaceholder LinearGradient={LinearGradient} style={styles.shimmerSmall} />
        <ShimmerPlaceholder LinearGradient={LinearGradient} style={styles.shimmerSmall} />
        <ShimmerPlaceholder LinearGradient={LinearGradient} style={styles.shimmerSmall} />
      </View>
      <View style={styles.divider} />
      <View style={{ alignItems: "center" }}>
        <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ height: 12, width: 80, borderRadius: 6 }} />
      </View>
    </View>
  );

  // 🔥 SHIMMER FIX: Match Rates and Total layout perfectly
  const RatesShimmer = () => (
    <View>
      <View style={styles.shimmerRates}>
        <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ height: 14, width: 140, borderRadius: 6, marginBottom: 15 }} />
        <View style={styles.inputRow}>
          <ShimmerPlaceholder LinearGradient={LinearGradient} style={styles.shimmerInput} />
          <ShimmerPlaceholder LinearGradient={LinearGradient} style={styles.shimmerInput} />
          <ShimmerPlaceholder LinearGradient={LinearGradient} style={styles.shimmerInput} />
        </View>
      </View>
      <View style={[styles.shimmerRates, { alignItems: 'center', paddingVertical: 20 }]}>
        <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ height: 12, width: 120, borderRadius: 6, marginBottom: 10 }} />
        <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ height: 24, width: 100, borderRadius: 8 }} />
      </View>
    </View>
  );

  const renderItem = ({ item }: any) => {
    const total = (item.morning || 0) + (item.evening || 0) + (item.full || 0);
    return (
      <View style={[styles.card, { borderColor: workColor }]}>
        <View style={styles.topRow}>
          <View style={styles.dateWrap}>
            <Ionicons name="calendar-outline" size={16} color="#6B7280" />
            <AppText style={styles.dateText} language={language}>{item.date}</AppText>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.valuesContainer}>
          <View style={styles.valueBox}>
            <Ionicons name="sunny-outline" size={14} color="#F59E0B" />
            <AppText style={styles.label} language={language}>{language === "te" ? "ఉదయం" : "Morning"}</AppText>
            <AppText style={styles.value}>{item.morning || 0}</AppText>
          </View>
          <View style={styles.valueBox}>
            <Ionicons name="partly-sunny-outline" size={14} color="#3B82F6" />
            <AppText style={styles.label} language={language}>{language === "te" ? "మధ్యాహ్నం" : "Afternoon"}</AppText>
            <AppText style={styles.value}>{item.evening || 0}</AppText>
          </View>
          <View style={styles.valueBox}>
            <Ionicons name="moon-outline" size={14} color="#8B5CF6" />
            <AppText style={styles.label} language={language}>{language === "te" ? "రోజంతా" : "Full day"}</AppText>
            <AppText style={styles.value}>{item.full || 0}</AppText>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.bottomRow}>
          <AppText style={[styles.totalText, { color: workColor }]} language={language}>
            {language === "te" ? "మొత్తం" : "Total"}: {total}
          </AppText>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />

      <AppHeader
        title={language === "te" ? "చెల్లింపు వివరాలు" : "Payment Summary"}
        subtitle={language === "te" ? "ఎంపిక చేసిన హాజరు" : "Selected Attendance"}
        language={language}
      />

      {/* 🔥 FIX: keyboardVerticalOffset={100} is the magic number to clear the Header */}
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 80} 
      >
        <View style={styles.summaryCard}>
          <AppText style={styles.summaryTitle} language={language}>
            {language === "te" ? "సారాంశం" : "Summary"}
          </AppText>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Ionicons name="calendar-number-outline" size={16} color="#6B7280" />
              <AppText style={styles.summaryLabel} language={language}>{language === "te" ? "మొత్తం రోజులు" : "Total Days"}</AppText>
              <AppText style={styles.summaryValue}>{totalDays}</AppText>
            </View>
            <View style={styles.verticalDivider} />
            <View style={styles.summaryItem}>
              <Ionicons name="people-outline" size={16} color="#6B7280" />
              <AppText style={styles.summaryLabel} language={language}>{language === "te" ? "మొత్తం కార్మికులు" : "Total Workers"}</AppText>
              <AppText style={styles.summaryValue}>{totalWorkers}</AppText>
            </View>
          </View>
        </View>

        {loading ? (
          <View style={{ flex: 1 }}>
            <SummaryShimmer />
            <CardShimmer />
            <CardShimmer />
            <RatesShimmer />
          </View>
        ) : (
          <FlatList
            data={data}
            keyExtractor={(item, index) => item.id || index.toString()}
            style={{ flex: 1 }} // 🔥 Important: Ensure list occupies remaining space
            contentContainerStyle={[
              { paddingBottom: 200 }, // 🔥 Added extra bottom padding so footer is scrollable above keyboard
              data.length === 0 && { flexGrow: 1, justifyContent: 'center' }
            ]}
            ListEmptyComponent={
              <AppEmptyState
                iconName="wallet-outline"
                title={language === "te" ? "హాజరు ఎంచుకోలేదు" : "No Attendance Selected"}
                subtitle={language === "te" ? "చెల్లింపు చేయడానికి ముందు హాజరును ఎంచుకోండి" : "Please select attendance to make a payment"}
                language={language}
              />
            }
            renderItem={renderItem}
            ListFooterComponent={
              data.length > 0 ? (
                <View style={styles.footer}>
                  <View style={[styles.ratesBox, { borderColor: workColor }]}>
                    <AppText style={styles.sectionTitle} language={language}>
                      {language === "te" ? "కూలీ రేట్లు నమోదు చేయండి" : "Enter Daily Rates"}
                    </AppText>
                    <View style={styles.inputRow}>
                      {/* MORNING */}
                      <View style={[styles.inputBox, { borderColor: focused === "morning" ? workColor : "#E5E7EB", opacity: totalMorning > 0 ? 1 : 0.5 }]}>
                        <Ionicons name="sunny-outline" size={16} color={totalMorning > 0 ? "#F59E0B" : "#9CA3AF"} />
                        <AppText style={styles.rs}>₹</AppText>
                        <TextInput
                          value={morningRate}
                          onChangeText={setMorningRate}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor={'#9CA3AF'}
                          cursorColor={workColor}
                          style={styles.inputText}
                          onFocus={() => setFocused("morning")}
                          onBlur={() => setFocused("")}
                          editable={totalMorning > 0}
                        />
                      </View>
                      {/* EVENING */}
                      <View style={[styles.inputBox, { borderColor: focused === "evening" ? workColor : "#E5E7EB", opacity: totalEvening > 0 ? 1 : 0.5 }]}>
                        <Ionicons name="partly-sunny-outline" size={16} color={totalEvening > 0 ? "#3B82F6" : "#9CA3AF"} />
                        <AppText style={styles.rs}>₹</AppText>
                        <TextInput
                          value={eveningRate}
                          onChangeText={setEveningRate}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor={'#9CA3AF'}
                          cursorColor={workColor}
                          style={styles.inputText}
                          onFocus={() => setFocused("evening")}
                          onBlur={() => setFocused("")}
                          editable={totalEvening > 0}
                        />
                      </View>
                      {/* FULL */}
                      <View style={[styles.inputBox, { borderColor: focused === "full" ? workColor : "#E5E7EB", opacity: totalFull > 0 ? 1 : 0.5 }]}>
                        <Ionicons name="moon-outline" size={16} color={totalFull > 0 ? "#8B5CF6" : "#9CA3AF"} />
                        <AppText style={styles.rs}>₹</AppText>
                        <TextInput
                          value={fullRate}
                          onChangeText={setFullRate}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor={'#9CA3AF'}
                          cursorColor={workColor}
                          style={styles.inputText}
                          onFocus={() => setFocused("full")}
                          onBlur={() => setFocused("")}
                          editable={totalFull > 0}
                        />
                      </View>
                    </View>
                  </View>

                  <View style={styles.totalBox}>
                    <AppText style={styles.totalLabel} language={language}>
                      {language === "te" ? "మొత్తం చెల్లించాల్సిన మొత్తం:" : "Total Payable Amount:"}
                    </AppText>
                    <AppText style={styles.totalValue}>
                      ₹ {formattedAmount}
                    </AppText>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => {
                      if (totalMorning > 0 && !morningRate) { setErrorType("morning"); setErrorModal(true); return; }
                      if (totalEvening > 0 && !eveningRate) { setErrorType("evening"); setErrorModal(true); return; }
                      if (totalFull > 0 && !fullRate) { setErrorType("full"); setErrorModal(true); return; }
                      setModeModal(true);
                    }}
                    style={styles.inlineConfirmWrapper}
                  >
                    <LinearGradient colors={["#2E7D32", "#1B5E20"]} style={styles.confirmBtn}>
                      <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                      <AppText style={styles.confirmText} language={language}>
                        {language === "te" ? "లెక్కలు భద్రపరచండి" : "Save Payment Record"}
                      </AppText>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              ) : null
            }
          />
        )}
      </KeyboardAvoidingView>

      {/* VALIDATION ERROR MODAL - PREMIUM THEME */}
      <Modal visible={errorModal} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.modalOverlayStandard}>
          <View style={styles.modalContentStandard}>
            <View style={[styles.modalIconBgStandardInfo, { backgroundColor: "#FEE2E2" }]}>
              <Ionicons name="alert-circle" size={36} color="#DC2626" />
            </View>
            <AppText style={[styles.modalTitleStandardInfo, { color: "#DC2626" }]} language={language}>
              {language === "te" ? "రేటు నమోదు చేయండి" : "Rate Required"}
            </AppText>
            <AppText style={styles.modalSubStandard} language={language}>
              {language === "te" ? "దయచేసి కూలీలందరికీ రేటు ఎంటర్ చేయండి" : "Please enter the daily rate for the workers"}
            </AppText>
            <View style={styles.modalButtonsStandard}>
              <TouchableOpacity style={[styles.modalInfoBtnStandard, { backgroundColor: "#DC2626" }]} onPress={() => setErrorModal(false)}>
                <AppText style={styles.modalInfoTextStandard} language={language}>{language === "te" ? "సరే" : "OK"}</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* UX UPGRADED PAYMENT MODE MODAL - PREMIUM THEME */}
      <Modal visible={modeModal} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.modalOverlayStandard}>
          <View style={[styles.modalContentStandard, { paddingBottom: 15 }]}>

            <View style={[styles.modalIconBgStandardInfo, { backgroundColor: workColor + "20" }]}>
              <Ionicons name="wallet-outline" size={34} color={workColor} />
            </View>

            <AppText style={[styles.modalTitleStandardInfo, { color: workColor }]} language={language}>
              {language === "te" ? `మీరు ${name} కి ఎలా చెల్లించారు?` : `How did you pay ${name}?`}
            </AppText>

            <AppText style={[styles.modalSubStandard, { color: '#DC2626', fontWeight: '500', marginBottom: 15 }]} language={language}>
              {language === "te" 
                ? "గమనిక: ఇది కేవలం మీ లెక్కల కోసం మాత్రమే. యాప్ ద్వారా డబ్బులు కట్ అవ్వవు." 
                : "Note: This is only for your records. No money will be deducted from the app."}
            </AppText>

            {/* CASH OPTION */}
            <TouchableOpacity style={styles.radioRow} activeOpacity={0.8} onPress={() => setPaymentMode("cash")}>
              <View style={[styles.radioOuter, { borderColor: workColor }]}>
                {paymentMode === "cash" && <View style={[styles.radioInner, { backgroundColor: workColor }]} />}
              </View>
              <Ionicons name="cash-outline" size={20} color={workColor} />
              <AppText style={styles.radioText} language={language}>{language === "te" ? "నగదు (Cash)" : "Cash"}</AppText>
            </TouchableOpacity>

            {/* UPI OPTION */}
            <TouchableOpacity style={styles.radioRow} activeOpacity={0.8} onPress={() => setPaymentMode("upi")}>
              <View style={[styles.radioOuter, { borderColor: workColor }]}>
                {paymentMode === "upi" && <View style={[styles.radioInner, { backgroundColor: workColor }]} />}
              </View>
              <Ionicons name="phone-portrait-outline" size={20} color={workColor} />
              <AppText style={styles.radioText} language={language}>{language === "te" ? "ఫోన్ పే / గూగుల్ పే (UPI)" : "PhonePe / GPay (UPI)"}</AppText>
            </TouchableOpacity>

            <View style={[styles.modalButtonsStandard, { marginTop: 20 }]}>
              <TouchableOpacity
                disabled={!paymentMode} activeOpacity={0.9}
                style={[styles.modalInfoBtnStandard, { backgroundColor: paymentMode ? workColor : "#D1D5DB" }]}
                onPress={() => { setModeModal(false); setShowModal(true); }}
              >
                <AppText style={styles.modalInfoTextStandard} language={language}>{language === "te" ? "లెక్క భద్రపరచండి" : "Save Record"}</AppText>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

      <Modal visible={showModal} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.modalOverlayStandard}>
          <View style={styles.modalContentStandard}>
            <View style={[styles.modalIconBgStandardInfo, { backgroundColor: workColor + "20" }]}>
              <Ionicons name="shield-checkmark-outline" size={36} color={workColor} />
            </View>
            <AppText style={[styles.modalTitleStandardInfo, { color: workColor }]} language={language}>{language === "te" ? "చెల్లింపు నిర్ధారణ" : "Confirm Record"}</AppText>
            <AppText style={[styles.modalSubStandard, { marginBottom: 10 }]} language={language}>{language === "te" ? "ఈ లెక్కను మీ యాప్ లో భద్రపరచాలా?" : "Do you want to save this record?"}</AppText>
            
            <AppText style={[styles.modalAmount, { color: workColor, marginBottom: 20 }]}>₹ {formattedAmount}</AppText>
            
            <View style={styles.modalButtonsStandard}>
              <TouchableOpacity style={styles.modalCancelBtnStandard} onPress={() => setShowModal(false)}>
                <AppText style={styles.modalCancelTextStandard} language={language}>{language === "te" ? "వద్దు" : "Cancel"}</AppText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalInfoBtnStandard, { backgroundColor: workColor }]}
                activeOpacity={0.8}
                onPress={() => {
                  setShowModal(false);
                  router.push({
                    pathname: "/farmer/mestripayments/payment-success",
                    params: { ids, id, name, village, crop, work, totalDays, totalWorkers, totalMorning, totalEvening, totalFull, morningRate, eveningRate, fullRate, amount, paymentMode }
                  });
                }}
              >
                <AppText style={styles.modalInfoTextStandard} language={language}>{language === "te" ? "కొనసాగించు" : "Proceed"}</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6F7F6" },
  summaryCard: { marginHorizontal: 20, marginTop: 12, padding: 16, borderRadius: 14, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e9ecf3" },
  summaryTitle: { fontSize: 13, color: "#16A34A", fontWeight: "600", marginBottom: 10, textAlign: 'center' },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryItem: { alignItems: "center", flex: 1 },
  summaryLabel: { fontSize: 12, color: "#6B7280" },
  summaryValue: { fontSize: 18, fontWeight: "700", color: "#111827", marginTop: 4 },
  verticalDivider: { width: 1, height: "80%", backgroundColor: "#E5E7EB", alignSelf: "center" },
  card: { marginHorizontal: 20, marginVertical: 6, padding: 14, borderWidth: 1, borderRadius: 14, backgroundColor: "#fff" },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dateWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  dateText: { fontSize: 13, color: "#374151" },
  divider: { height: 1, backgroundColor: "#F3F4F6", marginVertical: 10 },
  valuesContainer: { flexDirection: "row", justifyContent: "space-between" },
  valueBox: { alignItems: "center", flex: 1 },
  label: { fontSize: 11, color: "#6B7280", marginTop: 4 },
  value: { fontSize: 15, fontWeight: "600", marginTop: 2, color: "#111827" },
  bottomRow: { marginTop: 10, alignItems: "center" },
  totalText: { fontSize: 15, fontWeight: "600" },
  footer: { marginTop: 10, paddingBottom: 20 },
  ratesBox: { marginHorizontal: 20, padding: 14, borderRadius: 14, backgroundColor: "#fff", borderWidth: 1 },
  sectionTitle: { fontSize: 13, fontWeight: "600", marginBottom: 10 },
  inputRow: { flexDirection: "row" },
  inputBox: { flex: 1, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 10, marginHorizontal: 4, backgroundColor: "#FAFAFA" },
  inputText: { flex: 1, fontSize: 14, fontWeight: "600", color: "#111827" },
  rs: { marginLeft: 4, marginRight: 2, fontSize: 13, color: "#374151" },
  totalBox: { marginHorizontal: 20, marginTop: 12, padding: 16, borderRadius: 14, backgroundColor: "#ffffff", alignItems: "center", borderWidth: 1, borderColor: "#eaebee" },
  totalLabel: { fontSize: 12, color: "#6B7280" },
  totalValue: { fontSize: 24, fontWeight: "700", color: "#16A34A", marginTop: 5 }, // Enlarge for impact
  
  // 🔥 INLINE BUTTON FIX
  inlineConfirmWrapper: { marginHorizontal: 20, marginTop: 16, borderRadius: 16, overflow: "hidden" },
  confirmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15, borderRadius: 16 },
  confirmText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  // UNIFIED PREMIUM MODAL CLASSES
  modalOverlayStandard: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 999 },
  modalContentStandard: { width: "85%", backgroundColor: "white", borderRadius: 24, padding: 24, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 15 },
  modalSubStandard: { textAlign: "center", color: "#64748B", marginTop: 8, marginBottom: 25, fontSize: 14, lineHeight: 22 },
  modalButtonsStandard: { flexDirection: "row", gap: 12, width: '100%' },
  modalIconBgStandardInfo: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#DCFCE7", justifyContent: "center", alignItems: "center", marginBottom: 12 },
  modalTitleStandardInfo: { fontSize: 20, fontWeight: "600", color: "#16A34A", marginTop: 10, textAlign: "center" },
  modalInfoBtnStandard: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: "#16A34A", alignItems: "center", justifyContent: "center" },
  modalInfoTextStandard: { color: "white", fontWeight: "600", fontSize: 16 },
  modalCancelBtnStandard: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  modalCancelTextStandard: { color: "#4B5563", fontWeight: "600", fontSize: 16 },
  modalAmount: { fontSize: 28, fontWeight: "800", marginTop: 15, textAlign: 'center' },
  
  shimmerSummary: { marginHorizontal: 20, marginTop: 12, padding: 16, borderRadius: 14, backgroundColor: "#fff" },
  shimmerBox: { flex: 1, height: 40, borderRadius: 8, marginHorizontal: 4 },
  shimmerCard: { marginHorizontal: 20, marginVertical: 6, padding: 14, borderRadius: 14, backgroundColor: "#fff" },
  shimmerSmall: { width: 50, height: 20, borderRadius: 6 },
  shimmerRates: { marginHorizontal: 20, padding: 14, borderRadius: 14, backgroundColor: "#fff", marginTop: 10 },
  shimmerInput: { flex: 1, height: 40, borderRadius: 10, marginHorizontal: 4 },
  radioRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16, width: "100%", paddingHorizontal: 10 },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, justifyContent: "center", alignItems: "center" },
  radioInner: { width: 12, height: 12, borderRadius: 6 },
  radioText: { fontSize: 15, fontWeight: "600", color: "#111827" },
  continueBtn: { marginTop: 24, paddingVertical: 14, borderRadius: 12, alignItems: "center", width: "100%" },
  continueText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});