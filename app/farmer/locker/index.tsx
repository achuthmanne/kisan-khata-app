import React, { useState, useEffect } from "react";
import { View, StyleSheet, TouchableOpacity, Dimensions, Animated, Easing, Vibration, Modal } from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AppText from "@/components/AppText";

const { width, height } = Dimensions.get("window");

// Calculate responsive sizes for smaller phones (e.g., iPhone SE height is ~667)
const isSmallScreen = height < 700;
const btnSize = isSmallScreen ? 60 : 70;
const gapSize = isSmallScreen ? 12 : 20;
const iconSize = isSmallScreen ? 30 : 36;
const titleMargin = isSmallScreen ? 15 : 30;
const lockIconSize = isSmallScreen ? 48 : 60;

const translations = {
  te: {
    setupTitle: "లాకర్‌కి పిన్ సెట్ చేయండి",
    confirmTitle: "పిన్ నిర్ధారించండి",
    enterTitle: "లాకర్ పిన్ ఎంటర్ చేయండి",
    wrongPin: "పిన్ తప్పు! మళ్ళీ ప్రయత్నించండి",
    setupSuccess: "పిన్ సెట్ అయ్యింది!",
    useFingerprint: "వేలిముద్ర వాడండి",
    fingerprintReason: "లాకర్ ఓపెన్ చేయడానికి వేలిముద్ర వేయండి",
    biometricFailed: "వేలిముద్ర పనిచేయలేదు, పిన్ వాడండి",
  },
  en: {
    setupTitle: "Set Locker PIN",
    confirmTitle: "Confirm PIN",
    enterTitle: "Enter Locker PIN",
    wrongPin: "Wrong PIN! Try again",
    setupSuccess: "PIN Setup Successful!",
    useFingerprint: "Use Fingerprint",
    fingerprintReason: "Authenticate to unlock Agri-Locker",
    biometricFailed: "Biometrics failed, use PIN",
  }
};

export default function LockerSecurityScreen() {
  const router = useRouter();
  const [language, setLanguage] = useState<"te" | "en">("te");
  const t = translations[language];

  const [phone, setPhone] = useState("");
  const [mode, setMode] = useState<"loading" | "setup" | "confirm" | "auth">("loading");
  
  const [pin, setPin] = useState<string>("");
  const [confirmPin, setConfirmPin] = useState<string>("");
  const [enteredPin, setEnteredPin] = useState<string>("");
  
  const [errorMsg, setErrorMsg] = useState("");
  const [shakeAnim] = useState(new Animated.Value(0));
  
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [showForgotModal, setShowForgotModal] = useState(false);
  
  const [biometricType, setBiometricType] = useState<"fingerprint" | "face">("fingerprint");

  useEffect(() => {
    AsyncStorage.getItem("APP_LANG").then((l) => { if (l) setLanguage(l as any); });
    checkSecurityStatus();
  }, []);

  const checkSecurityStatus = async () => {
    try {
      const p = await AsyncStorage.getItem("USER_PHONE");
      if (!p) { router.replace("/farmer/(tabs)"); return; }
      setPhone(p);

      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) && !types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setBiometricType("face");
      }

      const savedPin = await SecureStore.getItemAsync(`locker_pin_${p}`);
      if (savedPin) {
        setMode("auth");
        triggerBiometrics(p, savedPin);
      } else {
        setMode("setup");
      }
    } catch (e) {
      console.log("Security Init Error:", e);
      setMode("setup");
    }
  };

  const triggerBiometrics = async (userPhone: string, savedPin: string) => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      
      if (hasHardware && isEnrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: t.fingerprintReason,
          fallbackLabel: "Use PIN",
          disableDeviceFallback: true,
        });

        if (result.success) {
          router.replace("/farmer/locker/locker-main");
        }
      }
    } catch (e) {
      console.log("Biometric Error:", e);
    }
  };

  const shake = () => {
    Vibration.vibrate(400);
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true })
    ]).start();
  };

  const handleKeyPress = async (val: string) => {
    setErrorMsg("");
    
    if (val === "del") {
      if (mode === "setup") setPin(prev => prev.slice(0, -1));
      else if (mode === "confirm") setConfirmPin(prev => prev.slice(0, -1));
      else if (mode === "auth") setEnteredPin(prev => prev.slice(0, -1));
      return;
    }

    if (mode === "setup") {
      if (pin.length < 4) {
        const newPin = pin + val;
        setPin(newPin);
        if (newPin.length === 4) {
          setTimeout(() => setMode("confirm"), 300);
        }
      }
    } 
    else if (mode === "confirm") {
      if (confirmPin.length < 4) {
        const newConfirm = confirmPin + val;
        setConfirmPin(newConfirm);
        if (newConfirm.length === 4) {
          if (newConfirm === pin) {
            await SecureStore.setItemAsync(`locker_pin_${phone}`, pin);
            router.replace("/farmer/locker/locker-main");
          } else {
            setErrorMsg(t.wrongPin);
            shake();
            setTimeout(() => {
              setConfirmPin("");
              setPin("");
              setMode("setup");
            }, 1000);
          }
        }
      }
    }
    else if (mode === "auth") {
      if (enteredPin.length < 4) {
        const newEntered = enteredPin + val;
        setEnteredPin(newEntered);
        if (newEntered.length === 4) {
          const savedPin = await SecureStore.getItemAsync(`locker_pin_${phone}`);
          if (savedPin === newEntered) {
            setFailedAttempts(0);
            router.replace("/farmer/locker/locker-main");
          } else {
            setFailedAttempts(prev => prev + 1);
            setErrorMsg(t.wrongPin);
            shake();
            setTimeout(() => setEnteredPin(""), 800);
          }
        }
      }
    }
  };

  if (mode === "loading") {
    return (
      <View style={styles.container}>
        <AppText style={{ color: "white" }}>Loading...</AppText>
      </View>
    );
  }

  let currentVal = "";
  let titleText = "";
  if (mode === "setup") { currentVal = pin; titleText = t.setupTitle; }
  else if (mode === "confirm") { currentVal = confirmPin; titleText = t.confirmTitle; }
  else if (mode === "auth") { currentVal = enteredPin; titleText = t.enterTitle; }

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0F172A", "#1E293B"]} style={StyleSheet.absoluteFillObject} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace("/farmer/(tabs)")} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <AppText style={styles.headerTitle} language={language}>
          {language === "te" ? "అగ్రి లాకర్" : "Agri-Locker"}
        </AppText>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <Ionicons name="lock-closed" size={lockIconSize} color="#16A34A" style={{ marginBottom: isSmallScreen ? 10 : 20 }} />
        
        <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
          <AppText style={[styles.title, { marginBottom: titleMargin }]} language={language}>{titleText}</AppText>
          
          <View style={styles.dotsContainer}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[styles.dot, currentVal.length > i && styles.dotFilled]} />
            ))}
          </View>
          
          <AppText style={styles.errorText} language={language}>{errorMsg}</AppText>
        </Animated.View>

        {/* Numpad */}
        <View style={styles.numpad}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <TouchableOpacity key={num} style={styles.numBtn} onPress={() => handleKeyPress(num.toString())} activeOpacity={0.6}>
              <AppText style={styles.numText}>{num}</AppText>
            </TouchableOpacity>
          ))}
          
          {mode === "auth" ? (
            <TouchableOpacity style={styles.numBtn} onPress={() => triggerBiometrics(phone, "")} activeOpacity={0.6}>
              <Ionicons name={biometricType === "face" ? "scan-outline" : "finger-print"} size={iconSize} color="#16A34A" />
            </TouchableOpacity>
          ) : (
            <View style={styles.numBtn} />
          )}
          
          <TouchableOpacity style={styles.numBtn} onPress={() => handleKeyPress("0")} activeOpacity={0.6}>
            <AppText style={styles.numText}>0</AppText>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.numBtn} onPress={() => handleKeyPress("del")} activeOpacity={0.6}>
            <Ionicons name="backspace-outline" size={28} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {mode === "auth" && failedAttempts >= 3 && (
          <TouchableOpacity 
            style={{ marginTop: 40, padding: 10 }}
            onPress={() => setShowForgotModal(true)}
          >
            <AppText style={{ color: "#9CA3AF", fontSize: 16, textDecorationLine: "underline" }} language={language}>
              {language === "te" ? "పిన్ మర్చిపోయారా?" : "Forgot PIN?"}
            </AppText>
          </TouchableOpacity>
        )}
      </View>

      {/* Premium Custom Forgot PIN Modal */}
      <Modal visible={showForgotModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalIconBox}>
              <Ionicons name="key-outline" size={32} color="#16A34A" />
            </View>
            <AppText style={styles.modalTitle} language={language}>
              {language === "te" ? "పిన్ మర్చిపోయారా?" : "Forgot PIN?"}
            </AppText>
            <AppText style={styles.modalDesc} language={language}>
              {language === "te" 
                ? "మీ లాకర్ పిన్ మార్చుకోవడానికి, ముందుగా మీ ప్రొఫైల్ కి వెళ్లి యాప్ నుండి లాగౌట్ అవ్వండి. మళ్ళీ మీ ఫోన్ నంబర్ తో లాగిన్ అయ్యాక కొత్త పిన్ సెట్ చేసుకోవచ్చు." 
                : "To reset your Locker PIN, please go to your Profile, Logout of the app, and login again with your phone number."}
            </AppText>
            
            <TouchableOpacity 
              style={styles.modalBtn} 
              activeOpacity={0.8} 
              onPress={() => setShowForgotModal(false)}
            >
              <AppText style={styles.modalBtnText} language={language}>
                {language === "te" ? "అర్థమైంది" : "Understood"}
              </AppText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 20,
  },
  headerTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: isSmallScreen ? 20 : 40,
  },
  title: {
    color: "white",
    fontSize: 18,
    textAlign: "center",
  },
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    marginBottom: 20,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#475569",
    backgroundColor: "transparent",
  },
  dotFilled: {
    backgroundColor: "#16A34A",
    borderColor: "#16A34A",
  },
  errorText: {
    color: "#EF4444",
    fontSize: 14,
    minHeight: 24,
    textAlign: "center",
    marginBottom: 20,
  },
  numpad: {
    width: width * 0.8,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    rowGap: gapSize,
    columnGap: gapSize,
  },
  numBtn: {
    width: btnSize,
    height: btnSize,
    borderRadius: btnSize / 2,
    backgroundColor: "rgba(255,255,255,0.05)",
    justifyContent: "center",
    alignItems: "center",
  },
  numText: {
    color: "white",
    fontSize: 28,
    fontFamily: "Mandali",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    backgroundColor: "#1E293B",
    width: "100%",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  modalIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(22, 163, 74, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 12,
  },
  modalDesc: {
    color: "#9CA3AF",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
  },
  modalBtn: {
    backgroundColor: "#16A34A",
    width: "100%",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  modalBtnText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  fingerprintBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 40,
    padding: 12,
    backgroundColor: "rgba(22, 163, 74, 0.1)",
    borderRadius: 20,
    paddingHorizontal: 20,
  },
  fingerprintText: {
    color: "#16A34A",
    fontSize: 16,
    marginLeft: 8,
    fontWeight: "600",
  }
});
