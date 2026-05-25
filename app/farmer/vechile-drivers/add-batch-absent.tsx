import AgriLoader from "@/components/AgriLoader";
import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import firestore from "@react-native-firebase/firestore";
import { useIsFocused } from "@react-navigation/native";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Modal,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

export default function AddBatchAbsent() {
  const router = useRouter();
  const { vehicleId, driverId, cycleId, balance } = useLocalSearchParams();
  const isMounted = useRef(true); 

  const currentBalance = parseFloat(Array.isArray(balance) ? balance[0] : balance || "0");

  const vIdStr = Array.isArray(vehicleId) ? vehicleId[0] : vehicleId;
  const dIdStr = Array.isArray(driverId) ? driverId[0] : driverId;
  const cycleIdStr = Array.isArray(cycleId) ? cycleId[0] : cycleId;

  const [language, setLanguage] = useState<"te" | "en">("te");

  // Form States
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [reason, setReason] = useState("");
  const [cuttingAmount, setCuttingAmount] = useState("");
  const [advanceAmount, setAdvanceAmount] = useState("");

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [saving, setSaving] = useState(false);
  
  // Validation States
  const [cycleData, setCycleData] = useState<any>(null);
  const [existingDates, setExistingDates] = useState<Set<string>>(new Set());
  
  // Speech Recognition States
  const isScreenFocused = useIsFocused();
  const [isListening, setIsListening] = useState(false);
  const [voiceTarget, setVoiceTarget] = useState<"reason" | null>(null);

  // Confirmation Modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    isMounted.current = true;
    AsyncStorage.getItem("APP_LANG").then((l) => {
      if (l && isMounted.current) setLanguage(l as any);
    });

    return () => {
      isMounted.current = false;
      ExpoSpeechRecognitionModule.stop();
    };
  }, []);

  useEffect(() => {
    const fetchCycleData = async () => {
      try {
        const userPhone = await AsyncStorage.getItem("USER_PHONE");
        if (!userPhone || !vIdStr || !dIdStr || !cycleIdStr) return;
        
        const docRef = firestore()
          .collection("users").doc(userPhone)
          .collection("vehicles").doc(vIdStr)
          .collection("drivers").doc(dIdStr)
          .collection("cycles").doc(cycleIdStr);
        
        const snap = await docRef.get();
        if (snap.exists && isMounted.current) {
           setCycleData(snap.data());
        }

        const entriesSnap = await firestore()
          .collection("users").doc(userPhone)
          .collection("vehicles").doc(vIdStr)
          .collection("drivers").doc(dIdStr)
          .collection("entries")
          .where("cycleId", "==", cycleIdStr)
          .get();

        const dates = new Set<string>();
        entriesSnap.forEach(doc => {
           dates.add(doc.data().date); 
        });
        if (isMounted.current) {
           setExistingDates(dates);
        }

      } catch (e) {
        console.error("Error fetching validation data", e);
      }
    };
    fetchCycleData();
  }, [vIdStr, dIdStr, cycleIdStr]);

  const startListening = async (target: "reason") => {
    setVoiceTarget(target);
    setIsListening(true);
    let hasPermission = false;
    const { status } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (status === "granted") hasPermission = true;

    if (!hasPermission) {
      setIsListening(false);
      setVoiceTarget(null);
      return;
    }

    ExpoSpeechRecognitionModule.start({
      lang: language === "te" ? "te-IN" : "en-US",
      interimResults: true,
    });
  };

  useSpeechRecognitionEvent("result", (event) => {
    if (!isScreenFocused || !isMounted.current) return;
    if (!event.results || event.results.length === 0) return;

    const text = event.results[0].transcript;
    if (voiceTarget === "reason") {
      setReason((prev) => prev ? prev + " " + text : text);
      setErrors({...errors, reason: ""});
    }
  });

  useSpeechRecognitionEvent("end", () => {
    if (isMounted.current) {
      setIsListening(false);
      setVoiceTarget(null);
    }
  });

  const calculateDays = () => {
    if (!fromDate || !toDate) return 0;
    const f = new Date(fromDate);
    f.setHours(0,0,0,0);
    const t = new Date(toDate);
    t.setHours(0,0,0,0);
    const diff = t.getTime() - f.getTime();
    if (diff < 0) return 0;
    return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
  };

  const handleValidate = () => {
    const errs: any = {};
    if (!fromDate) errs.fromDate = language === "te" ? "నుండి తేదీ ఎంచుకోండి" : "Select From Date";
    if (!toDate) errs.toDate = language === "te" ? "వరకు తేదీ ఎంచుకోండి" : "Select To Date";
    
    if (fromDate && toDate) {
      if (fromDate.getTime() > toDate.getTime()) {
        errs.toDate = language === "te" ? "'వరకు' తేదీ ముందు ఉండకూడదు" : "To Date cannot be before From Date";
      }

      // Cycle Bounds Check
      if (cycleData && cycleData.startDateRaw) {
        const cStart = new Date(cycleData.startDateRaw);
        cStart.setHours(0,0,0,0);
        
        let cEnd = new Date(cStart);
        const expectedMonth = (cEnd.getMonth() + 1) % 12;
        cEnd.setMonth(cEnd.getMonth() + 1);
        if (cEnd.getMonth() !== expectedMonth) {
           cEnd.setDate(0);
        }
        cEnd.setDate(cEnd.getDate() - 1);
        cEnd.setHours(0,0,0,0);

        const f = new Date(fromDate); f.setHours(0,0,0,0);
        const t = new Date(toDate); t.setHours(0,0,0,0);

        if (f < cStart || f > cEnd) {
           errs.fromDate = language === "te" ? "ఈ నెల లెక్కలోని తేదీలను మాత్రమే ఎంచుకోండి." : "Select date within this month.";
        }
        if (t < cStart || t > cEnd) {
           errs.toDate = language === "te" ? "ఈ నెల లెక్కలోని తేదీలను మాత్రమే ఎంచుకోండి." : "Select date within this month.";
        }

        // Duplicate Check
        if (!errs.fromDate && !errs.toDate) {
           let current = new Date(f);
           let hasOverlap = false;
           while (current <= t) {
              const dStr = current.toLocaleDateString('en-GB').replace(/\//g, '-');
              if (existingDates.has(dStr)) {
                 hasOverlap = true;
                 break;
              }
              current.setDate(current.getDate() + 1);
           }
           if (hasOverlap) {
              errs.toDate = language === "te" ? "కొన్ని రోజులకు ఇదివరకే హాజరు వేయబడింది. దయచేసి ఖాళీగా ఉన్న రోజులను ఎంచుకోండి." : "Some dates already have attendance. Select empty dates.";
           }
        }
      }
    }

    if (!reason.trim()) {
      errs.reason = language === "te" ? "కారణం తప్పనిసరి" : "Reason is required";
    }

    setErrors(errs);
    if (Object.keys(errs).length === 0) {
      setShowConfirmModal(true);
    }
  };

  const handleSaveBatch = async () => {
    if (!fromDate || !toDate || !vIdStr || !dIdStr || !cycleIdStr) return;
    
    setShowConfirmModal(false);
    
    try {
      const userPhone = await AsyncStorage.getItem("USER_PHONE");
      if (!userPhone) throw new Error("No user phone");

      const userDoc = await firestore().collection("users").doc(userPhone).get();
      const activeSession = userDoc.data()?.activeSession;

      const batch = firestore().batch();
      
      const f = new Date(fromDate);
      f.setHours(0,0,0,0);
      const t = new Date(toDate);
      t.setHours(0,0,0,0);
      
      let isFirstDay = true;
      let current = new Date(f);

      while (current <= t) {
        const dStr = current.toLocaleDateString('en-GB').replace(/\//g, '-');
        
        const entryRef = firestore()
          .collection("users").doc(userPhone)
          .collection("vehicles").doc(vIdStr)
          .collection("drivers").doc(dIdStr)
          .collection("entries").doc();

        batch.set(entryRef, {
          cycleId: cycleIdStr,
          date: dStr,
          dateRaw: current.toISOString(),
          attendance: "absent",
          work: "",
          cuttingReason: reason,
          advanceAmount: isFirstDay ? advanceAmount : "",
          cuttingAmount: isFirstDay ? cuttingAmount : "",
          workMode: null,
          session: activeSession,
          createdAt: firestore.FieldValue.serverTimestamp()
        });

        isFirstDay = false;
        current.setDate(current.getDate() + 1);
      }

      // Optimistic UI: Don't await the network. 
      // Firestore instantly updates local cache, so the previous screen will reflect changes immediately!
      batch.commit().catch(e => console.error("Error saving batch absent:", e));
      
      router.back();

    } catch (e) {
      console.error("Error preparing batch absent:", e);
    }
  };

  const daysCount = calculateDays();

  const parsedCutting = parseFloat(cuttingAmount) || 0;
  const parsedAdvance = parseFloat(advanceAmount) || 0;
  const newBalance = currentBalance - parsedCutting - parsedAdvance;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <AppHeader
        title={language === "te" ? "ఎక్కువ సెలవులు నమోదు" : "Bulk Absent"}
        subtitle={language === "te" ? "ఒకేసారి సెలవులు ఇవ్వండి" : "Add leaves in bulk"}
        language={language}
      />

      <KeyboardAwareScrollView 
        contentContainerStyle={{ padding: 16, paddingBottom: 150 }}
        enableOnAndroid={true}
        extraScrollHeight={50}
        keyboardShouldPersistTaps="handled"
      >
        
        <View style={styles.card}>
          <AppText style={styles.sectionTitle}>{language === "te" ? "తేదీలు ఎంచుకోండి" : "Select Dates"}</AppText>
          
          {/* FROM DATE */}
          <View style={{ marginBottom: 16 }}>
            <AppText style={styles.label}>{language === "te" ? "నుండి తేదీ*" : "From Date*"}</AppText>
            <TouchableOpacity style={[styles.inputBox, errors.fromDate && { borderColor: "#DC2626" }]} onPress={() => setShowFromPicker(true)}>
              <AppText style={{ color: fromDate ? "#1F2937" : "#9CA3AF" }}>
                {fromDate ? fromDate.toLocaleDateString('en-GB').replace(/\//g, '-') : (language === "te" ? "తేదీ ఎంచుకోండి" : "Select Date")}
              </AppText>
              <Ionicons name="calendar-outline" size={20} color="#6B7280" />
            </TouchableOpacity>
            {errors.fromDate && <AppText style={styles.errorText}>{errors.fromDate}</AppText>}
          </View>

          {/* TO DATE */}
          <View style={{ marginBottom: 16 }}>
            <AppText style={styles.label}>{language === "te" ? "వరకు తేదీ*" : "To Date*"}</AppText>
            <TouchableOpacity style={[styles.inputBox, errors.toDate && { borderColor: "#DC2626" }]} onPress={() => setShowToPicker(true)}>
              <AppText style={{ color: toDate ? "#1F2937" : "#9CA3AF" }}>
                {toDate ? toDate.toLocaleDateString('en-GB').replace(/\//g, '-') : (language === "te" ? "తేదీ ఎంచుకోండి" : "Select Date")}
              </AppText>
              <Ionicons name="calendar-outline" size={20} color="#6B7280" />
            </TouchableOpacity>
            {errors.toDate && <AppText style={styles.errorText}>{errors.toDate}</AppText>}
          </View>
          
          {daysCount > 0 && (
            <View style={{ backgroundColor: "#F0FDF4", padding: 10, borderRadius: 8, borderWidth: 1, borderColor: "#BBF7D0", alignItems: "center", marginBottom: 10 }}>
                <AppText style={{ color: "#166534", fontWeight: "600" }}>{language === "te" ? `మొత్తం సెలవు రోజులు: ${daysCount}` : `Total Leave Days: ${daysCount}`}</AppText>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <AppText style={styles.sectionTitle}>{language === "te" ? "సెలవు వివరాలు" : "Leave Details"}</AppText>

          <View style={{ marginBottom: 16 }}>
            <AppText style={styles.label}>{language === "te" ? "సెలవుకి కారణం*" : "Reason for Leave*"}</AppText>
            <View style={[styles.inputBox, errors.reason && { borderColor: "#DC2626" }]}>
              <TextInput
                style={{ flex: 1, fontFamily: "Mandali", fontSize: 15, color: "#1F2937" }}
                value={reason}
                onChangeText={(t) => { setReason(t); setErrors({...errors, reason: ""}); }}
                placeholder={language === "te" ? "ఉదా: జ్వరం, ఊరికి వెళ్లారు" : "e.g., Sick, Went to hometown"}
                placeholderTextColor="#9CA3AF"
                multiline
              />
              <TouchableOpacity onPress={() => {
                if (isListening && voiceTarget === "reason") {
                   ExpoSpeechRecognitionModule.stop();
                } else {
                   startListening("reason");
                }
              }}>
                <MaterialCommunityIcons 
                   name={isListening && voiceTarget === "reason" ? "microphone" : "microphone-outline"} 
                   size={24} 
                   color={isListening && voiceTarget === "reason" ? "#EF4444" : "#16A34A"} 
                />
              </TouchableOpacity>
            </View>
            {errors.reason && <AppText style={styles.errorText}>{errors.reason}</AppText>}
          </View>

          <View style={{ marginBottom: 16 }}>
            <AppText style={styles.label}>{language === "te" ? "మొత్తం కోత డబ్బులు (ఐచ్ఛికం)" : "Total Cutting Amount (Optional)"}</AppText>
            <TextInput
              style={[styles.inputBox, { fontFamily: "Mandali", color: "#1F2937" }]}
              value={cuttingAmount}
              onChangeText={setCuttingAmount}
              keyboardType="numeric"
              placeholder="₹ 0"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={{ marginBottom: 16 }}>
            <AppText style={styles.label}>{language === "te" ? "మొత్తం అడ్వాన్స్ (ఐచ్ఛికం)" : "Total Advance (Optional)"}</AppText>
            <TextInput
              style={[styles.inputBox, { fontFamily: "Mandali", color: "#1F2937" }]}
              value={advanceAmount}
              onChangeText={setAdvanceAmount}
              keyboardType="numeric"
              placeholder="₹ 0"
              placeholderTextColor="#9CA3AF"
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
                <AppText style={{ color: "#DC2626", fontSize: 14, fontFamily: "Mandali" }}>{language === "te" ? "మైనస్ (కోత + అడ్వాన్స్):" : "Minus (Cut + Adv):"}</AppText>
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

      {saving && <AgriLoader />}

      {/* CONFIRMATION MODAL */}
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
