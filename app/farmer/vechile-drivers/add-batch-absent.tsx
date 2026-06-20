// add-batch-absent.tsx
import AgriLoader from "@/components/AgriLoader";
import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import firestore from "@react-native-firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  Modal,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  Alert
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";

export default function AddBatchAbsent() {
  const router = useRouter();
  const { vehicleId, driverId, monthlySalary, cycleId, balance } = useLocalSearchParams();

  const [language, setLanguage] = useState<"te" | "en">("te");
  
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const [reason, setReason] = useState("");
  const [cuttingAmount, setCuttingAmount] = useState("");
  const [advanceAmount, setAdvanceAmount] = useState("");

  const [saving, setSaving] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [daysCount, setDaysCount] = useState(0);

  const [isListening, setIsListening] = useState(false);

  useSpeechRecognitionEvent("result", (event) => {
    if (event.results[0]?.transcript) {
       setReason(event.results[0].transcript);
    }
  });

  useSpeechRecognitionEvent("end", () => setIsListening(false));

  const [errors, setErrors] = useState<{fromDate?: string; toDate?: string; reason?: string}>({});

  const currentBalance = Number(balance) || 0;
  const parsedCutting = Number(cuttingAmount) || 0;
  const parsedAdvance = Number(advanceAmount) || 0;
  const newBalance = currentBalance - (parsedCutting + parsedAdvance);

  const handleValidate = () => {
    let newErrs: any = {};
    if (!fromDate) newErrs.fromDate = language === "te" ? "ప్రారంభ తేదీ ఎంచుకోండి" : "Select from date";
    if (!toDate) newErrs.toDate = language === "te" ? "ముగింపు తేదీ ఎంచుకోండి" : "Select to date";
    
    if (fromDate && toDate && fromDate > toDate) {
      newErrs.toDate = language === "te" ? "ముగింపు తేదీ సరిగ్గా ఎంచుకోండి" : "Invalid to date";
    }

    if (Object.keys(newErrs).length > 0) {
      setErrors(newErrs);
      return;
    }

    // Calculate Days
    const msDiff = toDate!.getTime() - fromDate!.getTime();
    const days = Math.floor(msDiff / (1000 * 60 * 60 * 24)) + 1;
    setDaysCount(days);
    setShowConfirmModal(true);
  };

  const handleSaveBatch = async () => {
    setShowConfirmModal(false);
    setSaving(true);
    try {
      const userPhone = await AsyncStorage.getItem("USER_PHONE");
      if (!userPhone) throw new Error("No phone number");
      
      const userDoc = await firestore().collection("users").doc(userPhone).get();
      const activeSession = userDoc.data()?.activeSession;
      if (!activeSession) throw new Error("No active session");

      const db = firestore();
      const batch = db.batch();
      
      const vId = Array.isArray(vehicleId) ? vehicleId[0] : vehicleId;
      const dId = Array.isArray(driverId) ? driverId[0] : driverId;
      const cId = Array.isArray(cycleId) ? cycleId[0] : cycleId;

      if (!vId || !dId || !cId) throw new Error("Missing IDs");

      const logsRef = db.collection("users").doc(userPhone).collection("vehicles").doc(vId).collection("drivers").doc(dId).collection("entries");

      let currentDate = new Date(fromDate!);
      let isFirstDay = true;

      while (currentDate <= toDate!) {
        const yyyy = currentDate.getFullYear();
        const mm = String(currentDate.getMonth() + 1).padStart(2, "0");
        const dd = String(currentDate.getDate()).padStart(2, "0");
        const dateStr = `${dd}-${mm}-${yyyy}`;

        // Only first day gets the cutting and advance
        const entryCutting = isFirstDay ? parsedCutting : 0;
        const entryAdvance = isFirstDay ? parsedAdvance : 0;

        const newDoc = logsRef.doc();
        batch.set(newDoc, {
          date: dateStr,
          dateRaw: currentDate.toISOString(),
          paymentType: "monthly",
          cycleId: cId,
          session: activeSession,
          attendance: "absent",
          workMode: null,
          hasBreak: false,
          breaksRaw: [],
          customerName: "",
          acresWorked: "",
          cuttingAmount: entryCutting,
          advanceAmount: entryAdvance,
          cuttingReason: reason,
          notes: reason,
          createdAt: firestore.FieldValue.serverTimestamp()
        });

        isFirstDay = false;
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Update Balance
      const totalMinus = parsedCutting + parsedAdvance;
      if (totalMinus > 0) {
        const balRef = db.collection("users").doc(userPhone).collection("vehicles").doc(vId).collection("drivers").doc(dId).collection("balances").doc(cId);
        batch.set(balRef, {
           balance: firestore.FieldValue.increment(-totalMinus),
           updatedAt: firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }

      await batch.commit();

      setTimeout(() => {
        router.back();
      }, 300);

    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <AppHeader 
        title={language === "te" ? "సెలవులు" : "Mark Absent (Batch)"} 
        subtitle={language === "te" ? "వివరాలు నమోదు చేయండి" : "Enter details"} 
        language={language} 
      />

      <KeyboardAwareScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.card}>
          
          <AppText style={styles.sectionTitle}>{language === "te" ? "తేదీలు ఎంచుకోండి" : "Select Dates"}</AppText>
          
          {/* FROM DATE */}
          <View style={{ marginBottom: 16 }}>
            <AppText style={styles.label}>{language === "te" ? "ప్రారంభ తేదీ *" : "From Date *"}</AppText>
            <TouchableOpacity style={styles.inputBox} onPress={() => setShowFromPicker(true)}>
              <AppText style={{ color: fromDate ? "#1F2937" : "#9CA3AF" }}>
                {fromDate ? fromDate.toLocaleDateString('en-GB') : (language === "te" ? "తేదీ ఎంచుకోండి" : "Select date")}
              </AppText>
              <Ionicons name="calendar-outline" size={20} color="#6B7280" />
            </TouchableOpacity>
            {errors.fromDate && <AppText style={styles.errorText}>{errors.fromDate}</AppText>}
          </View>

          {/* TO DATE */}
          <View style={{ marginBottom: 16 }}>
            <AppText style={styles.label}>{language === "te" ? "ముగింపు తేదీ *" : "To Date *"}</AppText>
            <TouchableOpacity style={styles.inputBox} onPress={() => setShowToPicker(true)}>
              <AppText style={{ color: toDate ? "#1F2937" : "#9CA3AF" }}>
                {toDate ? toDate.toLocaleDateString('en-GB') : (language === "te" ? "తేదీ ఎంచుకోండి" : "Select date")}
              </AppText>
              <Ionicons name="calendar-outline" size={20} color="#6B7280" />
            </TouchableOpacity>
            {errors.toDate && <AppText style={styles.errorText}>{errors.toDate}</AppText>}
          </View>

          <View style={{ height: 1, backgroundColor: "#E5E7EB", marginVertical: 12 }} />

          {/* REASON */}
          <View style={{ marginBottom: 16 }}>
            <AppText style={styles.label}>{language === "te" ? "సెలవుకి కారణం (ఆప్షనల్)" : "Reason for leave (Optional)"}</AppText>
            <View style={[styles.inputBox, { height: 80, alignItems: "flex-start", paddingRight: 8 }]}>
              <TextInput
                style={{ flex: 1, textAlignVertical: "top", height: "100%", fontSize: 15, color: "#1F2937", fontFamily: "Mandali" }}
                value={reason}
                onChangeText={setReason}
                placeholder={language === "te" ? "ఉదా: జ్వరం, ఊరు వెళ్ళాడు..." : "Ex: Fever, Function..."}
                placeholderTextColor="#9CA3AF"
                multiline
              />
              {reason.trim().length > 0 ? (
                <TouchableOpacity onPress={() => setReason("")} style={{ padding: 4 }} activeOpacity={0.7}>
                  <Ionicons name="close-circle" size={24} color="#9CA3AF" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={{ padding: 4 }}
                  activeOpacity={0.7}
                  onPress={async () => {
                    if (isListening) {
                      ExpoSpeechRecognitionModule.stop();
                      setIsListening(false);
                    } else {
                      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
                      if (!perm.granted) {
                        Alert.alert("Permission", "Microphone permission is needed.");
                        return;
                      }
                      setIsListening(true);
                      ExpoSpeechRecognitionModule.start({
                        lang: language === "te" ? "te-IN" : "en-IN",
                        interimResults: true
                      });
                    }
                  }}
                >
                  <Ionicons
                    name={isListening ? "mic" : "mic-outline"}
                    size={24}
                    color={isListening ? "#EF4444" : "#6B7280"}
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* CUTTING / ADVANCE */}
          <AppText style={styles.sectionTitle}>{language === "te" ? "కోత లేదా అడ్వాన్స్" : "Cutting or Advance"}</AppText>
          <View style={{ marginBottom: 16 }}>
            <AppText style={styles.label}>{language === "te" ? "కోత డబ్బులు (₹)" : "Cutting Amount (₹)"}</AppText>
            <TextInput
              style={[styles.inputBox, { fontFamily: "Mandali" }]}
              value={cuttingAmount}
              onChangeText={setCuttingAmount}
              keyboardType="numeric"
              placeholder="₹ 0"
            />
          </View>

          <View style={{ marginBottom: 16 }}>
            <AppText style={styles.label}>{language === "te" ? "అడ్వాన్స్ డబ్బులు (₹)" : "Advance Amount (₹)"}</AppText>
            <TextInput
              style={[styles.inputBox, { fontFamily: "Mandali" }]}
              value={advanceAmount}
              onChangeText={setAdvanceAmount}
              keyboardType="numeric"
              placeholder="₹ 0"
            />
          </View>

          <AppText style={{ fontSize: 12, color: "#6B7280", fontStyle: "italic", textAlign: "center", marginBottom: 16 }}>
            {language === "te" ? "* కోత లేదా అడ్వాన్స్ డబ్బులు ఈ సెలవుల మొదటి రోజున లెక్కించబడతాయి." : "* Cutting or advance amount will be logged on the first day of this leave batch."}
          </AppText>

          {/* BALANCE PREVIEW */}
          <View style={{ backgroundColor: "#F3F4F6", borderRadius: 8, padding: 12, borderWidth: 1, borderColor: "#E5E7EB" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
              <AppText style={{ color: "#4B5563", fontSize: 14, fontFamily: "Mandali" }}>{language === "te" ? "ప్రస్తుత బ్యాలెన్స్:" : "Current Balance:"}</AppText>
              <AppText style={{ color: "#1F2937", fontSize: 14, fontWeight: "600", fontFamily: "Mandali" }}>₹{currentBalance.toLocaleString('en-IN')}</AppText>
            </View>
            {(parsedCutting > 0 || parsedAdvance > 0) && (
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                <AppText style={{ color: "#DC2626", fontSize: 14, fontFamily: "Mandali" }}>{language === "te" ? "తీసివేత:" : "Minus (Cut + Adv):"}</AppText>
                <AppText style={{ color: "#DC2626", fontSize: 14, fontWeight: "600", fontFamily: "Mandali" }}>-₹{(parsedCutting + parsedAdvance).toLocaleString('en-IN')}</AppText>
              </View>
            )}
            <View style={{ height: 1, backgroundColor: "#D1D5DB", marginVertical: 6 }} />
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <AppText style={{ color: "#111827", fontSize: 16, fontWeight: "600", fontFamily: "Mandali" }}>{language === "te" ? "కొత్త బ్యాలెన్స్:" : "New Balance:"}</AppText>
              <AppText style={{ color: "#16A34A", fontSize: 16, fontWeight: "700", fontFamily: "Mandali" }}>₹{newBalance.toLocaleString('en-IN')}</AppText>
            </View>
          </View>

        </View>
      </KeyboardAwareScrollView>

      <View style={styles.bottomBar}>
         <TouchableOpacity style={styles.saveBtn} activeOpacity={0.8} onPress={handleValidate}>
            <LinearGradient colors={["#2E7D32", "#1B5E20"]} style={styles.saveGradient}>
              <Ionicons name="save-outline" size={18} color="#fff" />
              <AppText style={styles.saveText}>{language === "te" ? "భద్రపరచండి" : "Save Leaves"}</AppText>
            </LinearGradient>
         </TouchableOpacity>
      </View>

      <DateTimePickerModal
        isVisible={showFromPicker}
        mode="date"
        onConfirm={(d) => { setFromDate(d); setErrors({...errors, fromDate: ""}); setShowFromPicker(false); }}
        onCancel={() => setShowFromPicker(false)}
      />
      
      <DateTimePickerModal
        isVisible={showToPicker}
        mode="date"
        onConfirm={(d) => { setToDate(d); setErrors({...errors, toDate: ""}); setShowToPicker(false); }}
        onCancel={() => setShowToPicker(false)}
      />

      {saving && <AgriLoader visible={true} />}

      <Modal visible={showConfirmModal} transparent animationType="fade">
        <View style={styles.modalOverlayStandard}>
          <View style={styles.modalContentStandard}>
            <View style={[styles.modalIconBgStandard, { backgroundColor: "#FEF3C7" }]}>
              <Ionicons name="alert-circle-outline" size={36} color="#D97706" />
            </View>
            <AppText style={[styles.modalTitleStandard, { color: "#D97706" }]}>
              {language === "te" ? "నిర్ధారించండి" : "Confirm"}
            </AppText>
            <AppText style={styles.modalSubStandard}>
              {language === "te"
                ? `మీరు మొత్తం ${daysCount} రోజులకి సెలవు ('ఆబ్సెంట్') నమోదు చేస్తున్నారు.\n\nకారణం: ${reason}\nమొత్తం కోత: ₹${cuttingAmount || 0}\nమొత్తం అడ్వాన్స్: ₹${advanceAmount || 0}\n\nఇది సరైనదేనా?`
                : `You are marking ${daysCount} days as absent.\n\nReason: ${reason}\nCutting: ₹${cuttingAmount || 0}\nAdvance: ₹${advanceAmount || 0}\n\nProceed?`}
            </AppText>
            <View style={styles.modalButtonsStandard}>
              <TouchableOpacity activeOpacity={0.8} style={styles.modalCancelBtnStandard} onPress={() => setShowConfirmModal(false)}>
                <AppText style={styles.modalCancelTextStandard}>{language === "te" ? "రద్దు చేయి" : "Cancel"}</AppText>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.8} style={[styles.modalConfirmBtnStandard, { backgroundColor: "#D97706" }]} onPress={handleSaveBatch}>
                <AppText style={styles.modalConfirmTextStandard}>{language === "te" ? "అవును, సేవ్ చేయి" : "Yes, Save"}</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  card: { backgroundColor: "#fff", marginHorizontal: 16, marginTop: 16, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB" },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: "#1F2937", marginBottom: 12, fontFamily: "Mandali" },
  label: { fontSize: 14, color: "#4B5563", marginBottom: 6, fontWeight: "500", fontFamily: "Mandali" },
  inputBox: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 8, padding: 12, backgroundColor: "#F9FAFB", fontSize: 15 },
  errorText: { color: "#DC2626", fontSize: 12, marginTop: 4, fontFamily: "Mandali" },
  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#E5E7EB" },
  saveBtn: { borderRadius: 12, overflow: "hidden" },
  saveGradient: { flexDirection: "row", paddingVertical: 12, alignItems: "center", justifyContent: "center", gap: 8 },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "600", fontFamily: "Mandali" },
  modalOverlayStandard: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 999 },
  modalContentStandard: { width: "85%", backgroundColor: "white", borderRadius: 25, padding: 25, alignItems: "center" },
  modalIconBgStandard: { width: 70, height: 70, borderRadius: 35, justifyContent: "center", alignItems: "center", marginBottom: 15 },
  modalTitleStandard: { fontSize: 20, fontWeight: "600", marginVertical: 10, fontFamily: "Mandali" },
  modalSubStandard: { textAlign: "center", color: "#64748B", marginBottom: 20, fontFamily: "Mandali", lineHeight: 22 },
  modalButtonsStandard: { flexDirection: "row", width: "100%", justifyContent: "space-between" },
  modalCancelBtnStandard: { flex: 1, paddingVertical: 12, backgroundColor: "#F1F5F9", borderRadius: 12, marginRight: 10, alignItems: "center" },
  modalCancelTextStandard: { color: "#64748B", fontWeight: "600", fontSize: 16, fontFamily: "Mandali" },
  modalConfirmBtnStandard: { flex: 1, paddingVertical: 12, borderRadius: 12, marginLeft: 10, alignItems: "center" },
  modalConfirmTextStandard: { color: "#fff", fontWeight: "600", fontSize: 16, fontFamily: "Mandali" },
});
