import AsyncStorage from "@react-native-async-storage/async-storage";
import auth, { FirebaseAuthTypes } from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeInLeft,
  FadeInRight,
  FadeOutLeft,
  FadeOutRight,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming
} from "react-native-reanimated";

import { Ionicons } from "@expo/vector-icons";
import AgriLoader from "../components/AgriLoader";
import AppText from "../components/AppText";

export default function LoginScreen() {
  const router = useRouter();

  // Screen State
  const [step, setStep] = useState<1 | 2>(1); // 1 = Phone, 2 = OTP
  const [language, setLanguage] = useState<"te" | "en">("te");
  const [loading, setLoading] = useState(false);
  const [loaderType, setLoaderType] = useState<"loading" | "sending_otp" | "verifying_otp">("loading");
  const [error, setError] = useState("");
  
  // Phone State
  const [phone, setPhone] = useState("");
  const focusPhone = useSharedValue(0);

  // OTP State
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [confirm, setConfirm] = useState<FirebaseAuthTypes.ConfirmationResult | null>(null);
  const [resendTimer, setResendTimer] = useState(0);
  
  const otpInputs = useRef<Array<TextInput | null>>([]);
  const shake = useSharedValue(0);

  // Auto-Read OTP listener
  useEffect(() => {
    const subscriber = auth().onAuthStateChanged(async (user) => {
      // If we are on step 2 and user becomes available, it means Android auto-verified!
      if (user && step === 2) {
        handleSuccessfulAuth(user.phoneNumber?.replace('+91', '') || phone);
      }
    });
    return subscriber; 
  }, [step]);

  // Resend Timer
  useEffect(() => {
    let interval: any;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  // --- PHONE LOGIC ---
  const validPhone = phone.length === 10;

  const phoneBorderStyle = useAnimatedStyle(() => ({
    borderColor: focusPhone.value ? "#1B5E20" : "#E5E7EB",
    borderWidth: focusPhone.value ? 1 : 0.5,
  }));

  const handleSendOTP = async () => {
    if (!validPhone) {
      setError(language === "te" ? "సరైన ఫోన్ నంబర్ నమోదు చేయండి" : "Enter a valid phone number");
      return;
    }
    Keyboard.dismiss();
    setLoaderType("sending_otp");
    setLoading(true);
    setError("");

    try {
      const confirmation = await auth().signInWithPhoneNumber(`+91${phone}`);
      setConfirm(confirmation);
      setStep(2);
      setResendTimer(30);
      setLoading(false);
      // focus first OTP input slightly after animation
      setTimeout(() => otpInputs.current[0]?.focus(), 400);
    } catch (err: any) {
      setLoading(false);
      console.log("OTP Send Error:", err);
      if (err.code === 'auth/too-many-requests') {
        setError(language === "te" ? "చాలా సార్లు ప్రయత్నించారు. కాసేపు ఆగి మళ్ళీ ప్రయత్నించండి." : "Too many requests. Please try again later.");
      } else {
        // Show the exact error to the user for debugging
        setError(`Error: ${err.code || err.message}`);
      }
    }
  };

  // --- OTP LOGIC ---
  const triggerShake = () => {
    shake.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(0, { duration: 50 })
    );
  };

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }]
  }));

  const handleOtpChange = (text: string, index: number) => {
    setError("");
    if (!/^[0-9]?$/.test(text)) return;

    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    if (text) {
      if (index < 5) {
        otpInputs.current[index + 1]?.focus();
        setFocusedIndex(index + 1);
      }
    }

    // Auto verify if 6 digits are entered
    if (newOtp.join("").length === 6) {
      Keyboard.dismiss();
      verifyOTP(newOtp.join(""));
    }
  };

  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      const newOtp = [...otp];
      newOtp[index - 1] = "";
      setOtp(newOtp);
      otpInputs.current[index - 1]?.focus();
      setFocusedIndex(index - 1);
    }
  };

  const verifyOTP = async (code: string) => {
    if (!confirm) return;
    setLoaderType("verifying_otp");
    setLoading(true);
    setError("");
    try {
      await confirm.confirm(code);
      // onAuthStateChanged will catch this usually, but we handle it here explicitly too
      await handleSuccessfulAuth(phone);
    } catch (err: any) {
      setLoading(false);
      triggerShake();
      setError(language === "te" ? "తప్పు OTP నమోదు చేసారు" : "Invalid OTP entered");
      setOtp(["", "", "", "", "", ""]);
      setFocusedIndex(0);
      otpInputs.current[0]?.focus();
    }
  };

  const handleSuccessfulAuth = async (userPhone: string) => {
    try {
      const doc = await firestore().collection("users").doc(userPhone).get();
      const data = doc.data();
      const userExists = !!data;
      
      const roleToSave = "FARMER"; // App is strictly for Farmers now

      if (!userExists) {
        // Create new user silently
        await firestore().collection("users").doc(userPhone).set({
          phone: userPhone,
          role: roleToSave,
          language: language,
          createdAt: firestore.FieldValue.serverTimestamp(),
          updatedAt: firestore.FieldValue.serverTimestamp()
        });
      } else {
        // Just update language and ensure role is farmer
        await firestore().collection("users").doc(userPhone).update({
          role: roleToSave,
          language: language,
          updatedAt: firestore.FieldValue.serverTimestamp()
        });
      }

      // Save Local State
      await AsyncStorage.setItem("USER_PHONE", userPhone);
      await AsyncStorage.setItem("USER_ROLE", roleToSave);
      await AsyncStorage.setItem("APP_LANG", language);
      
      if (data?.name) {
        await AsyncStorage.setItem("USER_NAME", data.name);
      }

      // Butter-smooth Route transition:
      // 1. Hide keyboard gracefully
      Keyboard.dismiss();
      
      // 2. Keep loader running while routing to prevent flicker
      setTimeout(() => {
        router.replace("/farmer/(tabs)");
      }, 300);
    } catch (err) {
      console.log("DB Save Error:", err);
      setLoading(false);
      setError(language === "te" ? "సర్వర్ లోపం, మళ్ళీ ప్రయత్నించండి" : "Server error, please try again");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
    
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={styles.container}>
          
          {/* Top Language Toggle */}
          <View style={styles.langRow}>
            <Pressable onPress={() => setLanguage("te")} disabled={loading}>
              <AppText style={[styles.lang, language === "te" && styles.active]} language={language}>తెలుగు</AppText>
            </Pressable>
            <AppText style={{ marginHorizontal: 8, color: "#E5E7EB" }} language={language}>|</AppText>
            <Pressable onPress={() => setLanguage("en")} disabled={loading}>
              <AppText style={[styles.lang, language === "en" && styles.active]} language={language}>English</AppText>
            </Pressable>
          </View>

          {step === 1 ? (
            // --- STEP 1: PHONE INPUT ---
            <Animated.View entering={FadeInLeft} exiting={FadeOutLeft} style={{ flex: 1 }}>
              <AppText style={styles.title} language={language}>Kisan Khata</AppText>
              <AppText style={styles.tagline} language={language}>
              {language === "te" 
                ? "ఆధునిక వ్యవసాయానికి డిజిటల్ ఖాతా." 
                : "The Digital Ledger for Modern Agriculture."}
              </AppText>

              <Animated.View style={[styles.inputBox, phoneBorderStyle]}>
                <AppText style={styles.prefix} language={language}>+91</AppText>
                <View style={styles.divider} />
                <TextInput
                  style={[styles.input, { fontFamily: "Mandali", marginTop: Platform.OS === "android" ? 2 : 0 }]}
                  keyboardType="number-pad"
                  maxLength={10}
                  value={phone}
                  cursorColor="#1B5E20"
                  selectionColor="#16A34A40"
                  placeholder={language === "te" ? "ఫోన్ నంబర్" : "Phone Number"}
                  placeholderTextColor="#9CA3AF"
                  onFocus={() => (focusPhone.value = withTiming(1))}
                  onBlur={() => (focusPhone.value = withTiming(0))}
                  onChangeText={(t) => {
                    setPhone(t.replace(/[^0-9]/g, ""));
                    setError("");
                  }}
                  editable={!loading}
                />
              </Animated.View>

              {error !== "" && <AppText style={styles.error} language={language}>{error}</AppText>}

              <TouchableOpacity 
                activeOpacity={0.8} 
                style={[styles.button, !validPhone && styles.disabledBtn]} 
                disabled={!validPhone || loading} 
                onPress={handleSendOTP}
              >
                <AppText style={styles.buttonText} language={language}>
                  {language === "te" ? "OTP పంపండి" : "Send OTP"}
                </AppText>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            // --- STEP 2: OTP INPUT ---
            <Animated.View entering={FadeInRight} exiting={FadeOutRight} style={{ flex: 1 }}>
              
              <TouchableOpacity onPress={() => { setStep(1); setError(""); }} style={styles.backBtn} disabled={loading}>
                <Ionicons name="arrow-back" size={24} color="#1B5E20" />
              </TouchableOpacity>

              <AppText style={styles.title} language={language}>
                {language === "te" ? "OTP నమోదు చేయండి" : "Enter OTP"}
              </AppText>
              <AppText style={styles.tagline} language={language}>
                {language === "te" 
                  ? `+91 ${phone} కి పంపిన 6-అంకెల కోడ్ ని ఇక్కడ ఇవ్వండి.` 
                  : `Enter the 6-digit code sent to +91 ${phone}.`}
              </AppText>

              <Animated.View style={[styles.otpRow, shakeStyle]}>
                {otp.map((digit, index) => (
                  <View key={index} style={[styles.otpBox, (focusedIndex === index || digit !== "") && styles.otpBoxFocused, error !== "" && styles.otpBoxError]}>
                    <AppText style={[styles.otpText, digit !== "" && styles.otpTextActive]} language={language}>
                      {digit}
                    </AppText>
                    <TextInput
                      ref={(ref) => { otpInputs.current[index] = ref }}
                      style={styles.hiddenInput}
                      keyboardType="number-pad"
                      maxLength={1}
                      value={digit}
                      editable={!loading}
                      onChangeText={(text) => handleOtpChange(text, index)}
                      onFocus={() => setFocusedIndex(index)}
                      onKeyPress={(e) => handleOtpKeyPress(e, index)}
                    />
                  </View>
                ))}
              </Animated.View>

              {error !== "" && <AppText style={styles.error} language={language}>{error}</AppText>}

              <View style={styles.resendContainer}>
                {resendTimer > 0 ? (
                  <AppText style={styles.resendTextWait} language={language}>
                    {language === "te" ? `మళ్ళీ పంపడానికి ${resendTimer}s ఆగండి` : `Resend OTP in ${resendTimer}s`}
                  </AppText>
                ) : (
                  <TouchableOpacity onPress={handleSendOTP} disabled={loading}>
                    <AppText style={styles.resendTextActive} language={language}>
                      {language === "te" ? "OTP మళ్ళీ పంపండి" : "Resend OTP"}
                    </AppText>
                  </TouchableOpacity>
                )}
              </View>

            </Animated.View>
          )}

        </View>

        <AgriLoader visible={loading} type={loaderType as any} language={language} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6F7F6" },
  container: { flex: 1, padding: 24, paddingTop: 60 },
  langRow: { flexDirection: "row", alignSelf: "flex-end", marginBottom: 40, alignItems: 'center' },
  lang: { color: "#9CA3AF", fontSize: 14 },
  active: { color: "#1B5E20", fontWeight: "500" },
  
  title: { fontSize: 28, fontWeight: "700", color: "#1B5E20", letterSpacing: -0.5 },
  tagline: { fontSize: 15, color: "#6B7280", marginBottom: 40, fontWeight: "500", lineHeight: 22 },
  
  inputBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFF", borderRadius: 22, borderWidth: 0.5, borderColor: "#E5E7EB", paddingHorizontal: 18, height: 60, marginBottom: 20 },
  prefix: { fontSize: 17, fontWeight: "600", color: "#1B5E20", marginRight: 8 },
  divider: { width: 1.5, height: 24, backgroundColor: "#E5E7EB", marginRight: 15 },
  input: { flex: 1, fontSize: 18, fontWeight: "600", color: "#111827", height: '100%', paddingVertical: 0 },
  
  button: { height: 55, borderRadius: 22, backgroundColor: "#1B5E20", justifyContent: "center", alignItems: "center", marginTop: 20 },
  disabledBtn: { backgroundColor: "#D1D5DB" },
  buttonText: { color: "#FFF", fontWeight: "600", fontSize: 18, letterSpacing: 0.5 },
  
  error: { color: "#EF4444", marginTop: 10, fontWeight: "600", textAlign: "center" },

  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#E8F5E9", justifyContent: "center", alignItems: "center", marginBottom: 20 },
  
  otpRow: { flexDirection: "row", justifyContent: "space-between", gap: 6, marginTop: 10 },
  otpBox: { flex: 1, height: 55, borderRadius: 12, backgroundColor: "#FFF", borderWidth: 0.5, borderColor: "#E5E7EB", alignItems: "center", justifyContent: "center" },
  otpBoxFocused: { borderColor: "#1B5E20", backgroundColor: "#F1F8F1", borderWidth: 1 },
  otpBoxError: { borderColor: "#EF4444", backgroundColor: "#FEF2F2", borderWidth: 1 },
  otpText: { fontSize: 22, fontWeight: "700", color: "#CBD5E1" },
  otpTextActive: { color: "#1B5E20" },
  hiddenInput: { position: "absolute", width: '100%', height: '100%', opacity: 0 },
  
  resendContainer: { marginTop: 30, alignItems: "center" },
  resendTextWait: { color: "#9CA3AF", fontSize: 14, fontWeight: "500" },
  resendTextActive: { color: "#1B5E20", fontSize: 15, fontWeight: "600", textDecorationLine: "underline" }
});
