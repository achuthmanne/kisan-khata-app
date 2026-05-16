// app/farmer/payment-summary.tsx

import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";
import AppEmptyState from "@/components/AppEmptyState"; // 🔥 మన గ్లోబల్ కాంపోనెంట్
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
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

export default function PaymentSummary() {
  const { ids, crop, work, id, name, village } = useLocalSearchParams();
  const router = useRouter();
  const [focused, setFocused] = useState("");
  const [data, setData] = useState<any[]>([]);
  const [errorModal, setErrorModal] = useState(false);
  const [errorType, setErrorType] = useState("");
  const [loading, setLoading] = useState(false);
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
    const userPhone = await AsyncStorage.getItem("USER_PHONE");
    if (!userPhone) return;
    const userDoc = await firestore()
      .collection("users")
      .doc(userPhone)
      .get();

    const activeSession = userDoc.data()?.activeSession;
    if (!activeSession) return;

    setLoading(true);

    try {
        const selectedIds = JSON.parse(ids as string);
        const snap = await firestore()
          .collection("users")
          .doc(userPhone)
          .collection("mestris")
          .doc(id as string)
          .collection("attendance")
          .where("session", "==", activeSession) // 🔥 ADD THIS
          .get();

        const list = snap.docs
          .map(d => ({ id: d.id, ...(d.data() as any) }))
          .filter(item => selectedIds.includes(item.id));

        setData(list);
    } catch (err) {
        console.log(err);
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

  const RatesShimmer = () => (
    <View style={styles.shimmerRates}>
      <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ height: 12, width: 120, borderRadius: 6 }} />
      <View style={styles.inputRow}>
        <ShimmerPlaceholder LinearGradient={LinearGradient} style={styles.shimmerInput} />
        <ShimmerPlaceholder LinearGradient={LinearGradient} style={styles.shimmerInput} />
        <ShimmerPlaceholder LinearGradient={LinearGradient} style={styles.shimmerInput} />
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
            <AppText style={styles.label} language={language}>{language === "te" ? "సాయంత్రం" : "Evening"}</AppText>
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
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
          contentContainerStyle={[
            { paddingBottom: 140 },
            data.length === 0 && { flexGrow: 1, justifyContent: 'center' }
          ]}

          /* 🔥 OUR NEW GLOBAL EMPTY STATE COMPONENT */
          ListEmptyComponent={
            <AppEmptyState
              iconName="wallet-outline"
              title={language === "te" ? "హాజరు ఎంచుకోలేదు" : "No Attendance Selected"}
              subtitle={language === "te" ? "చెల్లింపు చేయడానికి ముందు స్క్రీన్ లో హాజరును ఎంచుకోండి" : "Please select attendance from the previous screen to make a payment"}
              language={language}
            />
          }

          renderItem={renderItem}
          ListFooterComponent={
            data.length > 0 ? (
              <View style={styles.footer}>
                <View style={[styles.ratesBox, { borderColor: workColor }]}>
                  <AppText style={styles.sectionTitle} language={language}>
                    {language === "te" ? "రేట్లు నమోదు చేయండి" : "Enter Rates"}
                  </AppText>
                  <View style={styles.inputRow}>
                    {/* MORNING */}
                    <View style={[styles.inputBox, { borderColor: focused === "morning" ? workColor : "#E5E7EB" }]}>
                      <Ionicons name="sunny-outline" size={16} color="#F59E0B" />
                      <AppText style={styles.rs}>₹</AppText>
                      <TextInput
                        value={morningRate}
                        onChangeText={setMorningRate}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={'black'}
                        cursorColor={workColor}
                        selectionColor={workColor}
                        style={styles.inputText}
                        onFocus={() => setFocused("morning")}
                        onBlur={() => setFocused("")}
                      />
                    </View>
                    {/* EVENING */}
                    <View style={[styles.inputBox, { borderColor: focused === "evening" ? workColor : "#E5E7EB" }]}>
                      <Ionicons name="partly-sunny-outline" size={16} color="#3B82F6" />
                      <AppText style={styles.rs}>₹</AppText>
                      <TextInput
                        value={eveningRate}
                        onChangeText={setEveningRate}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={'black'}
                        cursorColor={workColor}
                        selectionColor={workColor}
                        style={styles.inputText}
                        onFocus={() => setFocused("evening")}
                        onBlur={() => setFocused("")}
                      />
                    </View>
                    {/* FULL */}
                    <View style={[styles.inputBox, { borderColor: focused === "full" ? workColor : "#E5E7EB" }]}>
                      <Ionicons name="moon-outline" size={16} color="#8B5CF6" />
                      <AppText style={styles.rs}>₹</AppText>
                      <TextInput
                        value={fullRate}
                        onChangeText={setFullRate}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={'black'}
                        cursorColor={workColor}
                        selectionColor={workColor}
                        style={styles.inputText}
                        onFocus={() => setFocused("full")}
                        onBlur={() => setFocused("")}
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.totalBox}>
                  <AppText style={styles.totalLabel} language={language}>
                    {language === "te" ? "మొత్తం చెల్లింపు:" : "Total Amount:"}
                  </AppText>
                  <AppText style={styles.totalValue}>
                    ₹ {amount || 0}
                  </AppText>
                </View>
              </View>
            ) : null
          }
        />
      )}

      {/* డేటా ఉంటేనే బటన్ చూపిస్తాం */}
      {data.length > 0 && (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => {
            if (totalMorning > 0 && !morningRate) { setErrorType("morning"); setErrorModal(true); return; }
            if (totalEvening > 0 && !eveningRate) { setErrorType("evening"); setErrorModal(true); return; }
            if (totalFull > 0 && !fullRate) { setErrorType("full"); setErrorModal(true); return; }
            setModeModal(true);
          }}
          style={styles.confirmWrapper}
        >
          <LinearGradient colors={["#2E7D32", "#1B5E20"]} style={styles.confirmBtn}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
            <AppText style={styles.confirmText} language={language}>
              {language === "te" ? "చెల్లింపు చేయండి" : "Proceed to Pay"}
            </AppText>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {errorModal && (
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <View style={[styles.iconBg, { backgroundColor: "#FEE2E2" }]}>
              <Ionicons name="alert-circle" size={30} color="#DC2626" />
            </View>
            <AppText style={styles.modalTitle} language={language}>
              {language === "te" ? "రేటు అవసరం" : "Rate Required"}
            </AppText>
            <AppText style={styles.modalSub} language={language}>
              {language === "te" ? "దయచేసి అవసరమైన రేటు నమోదు చేయండి" : "Please enter required rate"}
            </AppText>
            <TouchableOpacity style={styles.okBtn} onPress={() => setErrorModal(false)}>
              <AppText style={styles.okText} language={language}>{language === "te" ? "సరే" : "OK"}</AppText>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {modeModal && (
        <View style={styles.overlay}>
          <View style={styles.modalBox}>

            {/* ICON */}
            <View style={[styles.iconBg, { backgroundColor: workColor + "20" }]}>
              <Ionicons name="wallet-outline" size={34} color={workColor} />
            </View>

            {/* TITLE */}
            <AppText style={styles.modalTitle} language={language}>
              {language === "te" ? "చెల్లింపు విధానం ఎంచుకోండి" : "Select Payment Mode"}
            </AppText>

            {/* CASH OPTION */}
            <TouchableOpacity
              style={styles.radioRow}
              activeOpacity={0.8}
              onPress={() => setPaymentMode("cash")}
            >
              <View style={[styles.radioOuter, { borderColor: workColor }]}>
                {paymentMode === "cash" && (
                  <View style={[styles.radioInner, { backgroundColor: workColor }]} />
                )}
              </View>

              <Ionicons name="cash-outline" size={18} color={workColor} />

              <AppText style={styles.radioText} language={language}>
                {language === "te" ? "నగదు (Cash)" : "Cash"}
              </AppText>
            </TouchableOpacity>

            {/* UPI OPTION */}
            <TouchableOpacity
              style={styles.radioRow}
              activeOpacity={0.8}
              onPress={() => setPaymentMode("upi")}
            >
              <View style={[styles.radioOuter, { borderColor: workColor }]}>
                {paymentMode === "upi" && (
                  <View style={[styles.radioInner, { backgroundColor: workColor }]} />
                )}
              </View>

              <Ionicons name="card-outline" size={18} color={workColor} />

              <AppText style={styles.radioText} language={language}>
                UPI
              </AppText>
            </TouchableOpacity>

            {/* CONTINUE BUTTON */}
            <TouchableOpacity
              disabled={!paymentMode}
              activeOpacity={0.9}
              style={[
                styles.continueBtn,
                {
                  backgroundColor: paymentMode ? workColor : "#D1D5DB"
                }
              ]}
              onPress={() => {
                setModeModal(false);
                setShowModal(true);
              }}
            >
              <AppText style={styles.continueText} language={language}>
                {language === "te" ? "కొనసాగించండి" : "Continue"}
              </AppText>
            </TouchableOpacity>

          </View>
        </View>
      )}

      {showModal && (
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <View style={[styles.iconBg, { backgroundColor: workColor + "20" }]}>
              <Ionicons name="shield-checkmark-outline" size={30} color={workColor} />
            </View>
            <AppText style={styles.modalTitle} language={language}>
              {language === "te" ? "చెల్లింపు నిర్ధారణ" : "Confirm Payment"}
            </AppText>
            <AppText style={styles.modalSub} language={language}>
              {language === "te" ? "ఈ చెల్లింపును కొనసాగించాలా?" : "Do you want to proceed with this payment?"}
            </AppText>
            <AppText style={[styles.modalAmount, { color: workColor }]}>₹ {amount}</AppText>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                <AppText style={styles.cancelText} language={language}>{language === "te" ? "వద్దు" : "Cancel"}</AppText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.proceedBtn, { backgroundColor: workColor }]}
                activeOpacity={0.8}
                onPress={() => {
                  setShowModal(false);
                  router.push({
                    pathname: "/farmer/mestripayments/payment-success",
                    params: {
                      ids,        
                      id,         
                      name,
                      village,
                      crop,
                      work,
                      totalDays,
                      totalWorkers,
                      totalMorning,
                      totalEvening,
                      totalFull,
                      morningRate,
                      eveningRate,
                      fullRate,
                      amount,
                      paymentMode
                    }
                  });
                }}
              >
                <Ionicons name="arrow-forward" size={16} color="#fff" />
                <AppText style={styles.proceedText} language={language}>{language === "te" ? "కొనసాగించు" : "Proceed"}</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
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
  footer: { marginTop: 10, paddingBottom: 100 },
  ratesBox: { marginHorizontal: 20, padding: 14, borderRadius: 14, backgroundColor: "#fff", borderWidth: 1 },
  sectionTitle: { fontSize: 13, fontWeight: "600", marginBottom: 10 },
  inputRow: { flexDirection: "row" },
  inputBox: { flex: 1, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 10, marginHorizontal: 4, backgroundColor: "#FAFAFA" },
  inputText: { flex: 1, fontSize: 14, fontWeight: "600", color: "#111827" },
  rs: { marginLeft: 4, marginRight: 2, fontSize: 13, color: "#374151" },
  totalBox: { marginHorizontal: 20, marginTop: 12, padding: 16, borderRadius: 14, backgroundColor: "#ffffff", alignItems: "center", borderWidth: 1, borderColor: "#eaebee" },
  totalLabel: { fontSize: 12, color: "#6B7280" },
  totalValue: { fontSize: 20, fontWeight: "700", color: "#16A34A" },
  confirmWrapper: { position: "absolute", bottom: 20, left: 20, right: 20, borderRadius: 16, overflow: "hidden" },
  confirmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15, borderRadius: 16 },
  confirmText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  overlay: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", zIndex: 999, elevation: 10 },
  modalBox: { width: "85%", backgroundColor: "#fff", borderRadius: 18, padding: 20, alignItems: "center" },
  iconBg: { width: 60, height: 60, borderRadius: 30, justifyContent: "center", alignItems: "center", marginBottom: 10 },
  modalTitle: { fontSize: 18, fontWeight: "600" },
  modalSub: { fontSize: 13, color: "#6B7280", textAlign: "center", marginTop: 6 },
  modalAmount: { fontSize: 22, fontWeight: "700", marginTop: 10 },
  modalBtns: { flexDirection: "row", marginTop: 20 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: "#E5E7EB", marginRight: 6, backgroundColor: "#F9FAFB" },
  cancelText: { color: "#374151", fontWeight: "500" },
  proceedBtn: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, paddingVertical: 12, borderRadius: 10, marginLeft: 6 },
  proceedText: { color: "#fff", fontWeight: "600" },
  okBtn: { marginTop: 16, backgroundColor: "#DC2626", paddingVertical: 8, paddingHorizontal: 25, borderRadius: 10 },
  okText: { color: "#fff", fontWeight: "600" },
  shimmerSummary: { marginHorizontal: 20, marginTop: 12, padding: 16, borderRadius: 14, backgroundColor: "#fff" },
  shimmerBox: { flex: 1, height: 40, borderRadius: 8, marginHorizontal: 4 },
  shimmerCard: { marginHorizontal: 20, marginVertical: 6, padding: 14, borderRadius: 14, backgroundColor: "#fff" },
  shimmerSmall: { width: 50, height: 20, borderRadius: 6 },
  shimmerRates: { marginHorizontal: 20, padding: 14, borderRadius: 14, backgroundColor: "#fff", marginTop: 10 },
  shimmerInput: { flex: 1, height: 40, borderRadius: 10, marginHorizontal: 4 },
  modeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginTop: 10
  },
  deleteBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
    marginLeft: 6
  },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
    width: "100%"
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center"
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5
  },
  radioText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827"
  },
  continueBtn: {
    marginTop: 20,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    width: "100%"
  },
  continueText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600"
  },
});