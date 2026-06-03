import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import AgriLoader from "../components/AgriLoader";
import AppText from "../components/AppText";

export default function PinScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // TypeScript error fix: casting language type
  const language = (params.language as "te" | "en") || "en";
  const { phone, role, mode } = params;

  const [pin, setPin] = useState(["", "", "", ""]);
  const [confirmPin, setConfirmPin] = useState(["", "", "", ""]);
  const [originalPin, setOriginalPin] = useState(""); 
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [visibleIndex, setVisibleIndex] = useState<number | null>(null);

  const [attempts, setAttempts] = useState(0);
  const [lockTimer, setLockTimer] = useState(0);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [customAlert, setCustomAlert] = useState({ visible: false, message: "", type: 'error' as 'success' | 'error' });

  const [ansYear, setAnsYear] = useState("");
  const [ansCrop, setAnsCrop] = useState("");

  const inputs = useRef<Array<TextInput | null>>([]);
  const shake = useSharedValue(0);

  const showAlert = (msg: string, type: 'success' | 'error' = 'error') => {
    setCustomAlert({ visible: true, message: msg, type });
    if (type === 'success') {
      setTimeout(() => setCustomAlert(prev => ({ ...prev, visible: false })), 2000);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => inputs.current[0]?.focus(), 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let interval: any;
    if (lockTimer > 0) {
      interval = setInterval(() => setLockTimer((prev) => prev - 1), 1000);
    } else if (lockTimer === 0) {
      setError("");
      setAttempts(0);
      if(interval) clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [lockTimer]);

  const handleChange = (text: string, index: number) => {
    if (lockTimer > 0) return;
    setError("");
    const currentPin = step === 1 ? pin : confirmPin;
    const setFunction = step === 1 ? setPin : setConfirmPin;
    if (!/^[0-9]?$/.test(text)) return;

    const newPin = [...currentPin];
    newPin[index] = text;
    setFunction(newPin);

    if (text) {
      setVisibleIndex(index);
      setTimeout(() => setVisibleIndex(null), 1000);
      if (index < 3) {
        inputs.current[index + 1]?.focus();
        setFocusedIndex(index + 1);
      }
    }

    if (newPin.join("").length === 4) {
      if (mode === "create" && step === 1) {
        setOriginalPin(newPin.join(""));
        setTimeout(() => { 
          setStep(2); 
          setConfirmPin(["", "", "", ""]); 
          setFocusedIndex(0); 
          inputs.current[0]?.focus(); 
        }, 1000);
      } else {
        setTimeout(() => verifyOrSave(newPin.join("")), 1000);
      }
    }
  };

  const verifyOrSave = async (p: string) => {
    if (mode === "create") {
      if (originalPin !== p) {
        triggerShake();
        showAlert(language === "te" ? "పిన్ మ్యాచ్ కాలేదు" : "PIN does not match", "error");
        setConfirmPin(["", "", "", ""]);
        setFocusedIndex(0);
        inputs.current[0]?.focus();
        return;
      }
      setShowForgotModal(true); 
    } else {
      // 🔥 1. పిన్ కొట్టగానే వెంటనే లోడింగ్ స్టార్ట్ అవుతుంది
      setLoading(true); 
      try {
        const doc = await firestore().collection("users").doc(String(phone)).get();
        const data = doc.data();

        if (data?.pin !== p) {
          // తప్పు పిన్ కొడితే లోడింగ్ ఆపేసి, వార్నింగ్ ఇస్తాం
          setLoading(false); 
          const newAttempts = attempts + 1;
          setAttempts(newAttempts);
          if (newAttempts >= 3) {
            setLockTimer(30);
            setError(language === "te" ? "30 సెకన్లు ఆగండి" : "Try again in 30s");
          } else {
            triggerShake();
            setError(language === "te" ? `తప్పు పిన్ (${3 - newAttempts} మిగిలి ఉన్నాయి)` : `Invalid PIN (${3 - newAttempts} left)`);
          }
          setPin(["", "", "", ""]);
          setFocusedIndex(0);
          inputs.current[0]?.focus();
        } else {
          await AsyncStorage.setItem("USER_PHONE", String(phone));
          await AsyncStorage.setItem("USER_ROLE", String(role));
          if (data?.name) {
            await AsyncStorage.setItem("USER_NAME", data.name);
          }
          
          let hasNavigated = false;

          // 🔥 1. ముందు కీబోర్డ్ ని స్మూత్ గా కిందకి దించేయాలి
          Keyboard.dismiss();

          // 🔥 2. "కీబోర్డ్ పూర్తిగా కిందకి వెళ్ళిపోయింది" అని కన్ఫామ్ అయ్యాకే రౌటింగ్ జరగాలి
          const keyboardListener = Keyboard.addListener("keyboardDidHide", () => {
            if (!hasNavigated) {
              hasNavigated = true;
              keyboardListener.remove(); // పని అయ్యాక లిజనర్ ని క్లోజ్ చేయాలి
              router.replace(role === "FARMER" ? "/farmer/(tabs)" : "/(tabs)");
            }
          });

          // 🔥 3. సేఫ్టీ ఫాల్‌బ్యాక్: ఒకవేళ యూజర్ ముందే కీబోర్డ్ క్లోజ్ చేసి ఉంటే, లిజనర్ వర్క్ అవ్వదు కదా! 
          // అప్పుడు 300ms ఆగి స్మూత్ గా పంపించేస్తాం.
          setTimeout(() => {
            if (!hasNavigated) {
              hasNavigated = true;
              keyboardListener.remove();
              router.replace(role === "FARMER" ? "/farmer/(tabs)" : "/(tabs)");
            }
          }, 300);
  
        }
      } catch (e) { 
        setLoading(false);
        showAlert("Error", "error"); 
      }
      // 🔥 గమనిక: ఇక్కడ finally { setLoading(false) } తీసేసాను. ఎందుకంటే వెరిఫై అయ్యాక కూడా డాష్‌బోర్డ్ ఓపెన్ అయ్యేదాకా లోడింగ్ తిరగాలి కాబట్టి!
    }
  };
  const handleForgotVerify = async () => {
    if (ansYear.length !== 4 || ansCrop.trim() === "") {
        showAlert(language === "te" ? "వివరాలు నింపండి" : "Fill Details", "error");
        return;
    }
    setLoading(true);
    try {
        const ref = firestore().collection("users").doc(String(phone));
        if (mode === "create") {
            await ref.set({ 
                phone, role, language, 
                pin: originalPin, 
                birthYear: ansYear, 
                favCrop: ansCrop.toLowerCase().trim(),
                updatedAt: firestore.FieldValue.serverTimestamp() 
            }, { merge: true });
            setShowForgotModal(false);
            showAlert(language === "te" ? "పిన్ సెట్ చేయబడింది" : "PIN Set Successfully", "success");
            setTimeout(async () => {
                await AsyncStorage.setItem("USER_PHONE", String(phone));
                await AsyncStorage.setItem("USER_ROLE", String(role));
                router.replace(role === "FARMER" ? "/farmer/(tabs)" : "/(tabs)");
            }, 1500);
        } else {
            const doc = await ref.get();
            const data = doc.data();
            if (data?.birthYear === ansYear && data?.favCrop?.toLowerCase() === ansCrop.toLowerCase().trim()) {
                setShowForgotModal(false);
                setStep(1); setPin(["", "", "", ""]); setOriginalPin("");
                router.setParams({ mode: "create" }); 
                showAlert(language === "te" ? "కొత్త పిన్ సెట్ చేయండి" : "Set New PIN", "success");
            } else {
                triggerShake();
                showAlert(language === "te" ? "తప్పు వివరాలు!" : "Incorrect Details!", "error");
            }
        }
    } catch (e) { showAlert("Error", "error"); } finally { setLoading(false); }
  };

  const triggerShake = () => {
    shake.value = withSequence(withTiming(-10, { duration: 80 }), withTiming(10, { duration: 80 }), withTiming(0, { duration: 80 }));
  };

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
     
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={styles.container}>
          <AppText style={styles.title} language={language}>
            {lockTimer > 0 
              ? (language === "te" ? "లాక్ చేయబడింది" : "Locked") 
              : (mode === "create" ? (step === 1 ? (language === "te" ? "పిన్ సృష్టించండి" : "Create PIN") : (language === "te" ? "నిర్ధారించండి" : "Confirm PIN")) : (language === "te" ? "పిన్ నమోదు చేయండి" : "Enter PIN"))}
          </AppText>
          <AppText style={styles.subtitle} language={language}>
            {lockTimer > 0 ? (language === "te" ? `${lockTimer}సెకన్లు ఆగండి` : `Wait ${lockTimer}s`) : (language === "te" ? "సెక్యూరిటీ పిన్ నమోదు చేయండి" : "Access Security PIN")}
          </AppText>

          <Animated.View style={[styles.row, shakeStyle, lockTimer > 0 && { opacity: 0.4 }]}>
            {(step === 1 ? pin : confirmPin).map((digit, index) => (
              <View key={index} style={[styles.pinBox, focusedIndex === index && styles.pinBoxFocused]}>
                <AppText style={[styles.pinText, digit !== "" && styles.pinTextActive]} language={language}>
                  {digit !== "" ? (visibleIndex === index ? digit : "●") : "○"}
                </AppText>
                <TextInput
                  ref={(ref) => { inputs.current[index] = ref }}
                  style={styles.hiddenInput}
                  keyboardType="number-pad"
                  maxLength={1}
                  value={digit}
                  editable={lockTimer === 0}
                  onChangeText={(text) => handleChange(text, index)}
                  onFocus={() => setFocusedIndex(index)}
                  onKeyPress={({ nativeEvent }) => {
                    if (nativeEvent.key === "Backspace" && !digit && index > 0) {
                      const currentPin = step === 1 ? pin : confirmPin;
                      const setFunction = step === 1 ? setPin : setConfirmPin;
                      const newPin = [...currentPin];
                      newPin[index - 1] = "";
                      setFunction(newPin);
                      inputs.current[index - 1]?.focus();
                      setFocusedIndex(index - 1);
                    }
                  }}
                />
              </View>
            ))}
          </Animated.View>

          {error !== "" && <AppText style={styles.error} language={language}>{error}</AppText>}

          {(attempts >= 1 || lockTimer > 0) && (
            <TouchableOpacity onPress={() => setShowForgotModal(true)} style={styles.forgotBtn}>
              <AppText style={styles.forgotText} language={language}>
                {language === "te" ? "పిన్ మర్చిపోయారా?" : "Forgot PIN?"}
              </AppText>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Alert Modal */}
      <Modal visible={customAlert.visible} transparent animationType="fade">
        <View style={styles.customAlertOverlay}>
          <View style={[styles.customAlertBox, { borderLeftColor: customAlert.type === 'success' ? '#1B5E20' : '#D32F2F' }]}>
            <Ionicons name={customAlert.type === 'success' ? "checkmark-circle" : "alert-circle"} size={24} color={customAlert.type === 'success' ? '#1B5E20' : '#D32F2F'} />
            <AppText style={styles.customAlertText} language={language}>{customAlert.message}</AppText>
            <TouchableOpacity onPress={() => setCustomAlert({ ...customAlert, visible: false })}>
              <AppText style={styles.customAlertClose} language={language}>{language === "te" ? "సరే" : "OK"}</AppText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Forgot/Setup Modal */}
      <Modal visible={showForgotModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <AppText style={styles.modalTitle} language={language}>
                {mode === "create" 
                    ? (language === "te" ? "భద్రతా సెటప్" : "Security Setup") 
                    : (language === "te" ? "భద్రత తనిఖీ" : "Security Check")}
            </AppText>
            <View style={styles.modalField}>
              <AppText style={styles.modalLabel} language={language}>{language === "te" ? "పుట్టిన సంవత్సరం" : "Birth Year"}</AppText>
              <TextInput 
                placeholder="YYYY (Ex: 1995)" 
                placeholderTextColor="#94A3B8"
                style={[styles.modalInput, { fontFamily: language === 'te' ? 'Mandali' : 'Poppins-Regular' }]} 
                keyboardType="number-pad" 
                cursorColor="#1B5E20" 
    selectionColor="#1B5E20"
                value={ansYear} 
                onChangeText={(t) => setAnsYear(t.replace(/[^0-9]/g, "").slice(0, 4))}
                maxLength={4}
              />
            </View>
            <View style={styles.modalField}>
              <AppText style={styles.modalLabel} language={language}>{language === "te" ? "ఇష్టమైన పంట" : "Favorite Crop"}</AppText>
              <TextInput 
                placeholder={language === "te" ? "పంట పేరు..." : "Enter Crop Name"} 
                placeholderTextColor="#94A3B8"
                style={[styles.modalInput, { fontFamily: language === 'te' ? 'Mandali' : 'Poppins-Regular' }]} 
                value={ansCrop} 
                cursorColor="#1B5E20" 
    selectionColor="#1B5E20"
                onChangeText={setAnsCrop} 
              />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setShowForgotModal(false)} style={styles.cancelBtn}>
                <AppText style={styles.cancelTxt} language={language}>{language === "te" ? "వద్దు" : "Cancel"}</AppText>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleForgotVerify} style={styles.confirmBtn}>
                <AppText style={styles.confirmTxt} language={language}>{mode === "create" ? (language === "te" ? "సేవ్ చేయి" : "Save") : (language === "te" ? "సరే" : "Verify")}</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <AgriLoader visible={loading} type="pin" language={language} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6F7F6" },
  watermark: { position: "absolute", width: 300, height: 300, opacity: 0.05, alignSelf: "center", top: "35%" },
  container: { flex: 1, padding: 24, paddingTop: 100 }, 
  title: { fontSize: 28, fontWeight: "600", color: "#1B5E20" },
  subtitle: { marginTop: 8, marginBottom: 50, color: "#6B7280", fontWeight: "600" },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  pinBox: { flex: 1, height: 75, borderRadius: 20, backgroundColor: "#FFF", borderWidth: 1.5, borderColor: "#E5E7EB", alignItems: "center", justifyContent: "center" },
  pinBoxFocused: { borderColor: "#1B5E20", backgroundColor: "#F1F8F1", borderWidth: 2 },
  pinText: { fontSize: 24, fontWeight: "600", color: "#CBD5E1" },
  pinTextActive: { color: "#1B5E20" },
  hiddenInput: { position: "absolute", width: '100%', height: '100%', opacity: 0 },
  error: { marginTop: 30, color: "#D32F2F", textAlign: "center", fontWeight: "600" },
  forgotBtn: { marginTop: 40, alignSelf: 'center' },
  forgotText: { color: "#1B5E20", fontWeight: "600", textDecorationLine: 'underline' },
  customAlertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  customAlertBox: { backgroundColor: 'white', width: '90%', padding: 20, borderRadius: 15, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 6, elevation: 5 },
  customAlertText: { flex: 1, fontSize: 16, fontWeight: '600', color: '#334155', marginLeft: 12 },
  customAlertClose: { color: '#1B5E20', fontWeight: '600', marginLeft: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: 'white', borderRadius: 30, padding: 30 },
  modalTitle: { fontSize: 22, fontWeight: '600', color: '#1B5E20', textAlign: 'center', marginBottom: 25 , includeFontPadding: false},
  modalField: { marginBottom: 20 },
  modalLabel: { fontSize: 11, fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 8 },
  modalInput: { backgroundColor: '#F8FAFC', padding: 16, borderRadius: 15, fontSize: 16, fontWeight: '600', color: '#000000', borderWidth: 1, borderColor: '#E2E8F0' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  cancelBtn: { flex: 1, padding: 15, borderRadius: 15, backgroundColor: '#F1F5F9', alignItems: 'center' },
  confirmBtn: { flex: 1, padding: 15, borderRadius: 15, backgroundColor: '#1B5E20', alignItems: 'center' },
  cancelTxt: { fontWeight: '600', color: '#64748B' },
  confirmTxt: { fontWeight: '600', color: 'white' }
});