// app/farmer/mestri/edit/[id].tsx

import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { executeOfflineSafeRead, executeOfflineSafeWrite } from "@/utils/offlineHelper";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

import AgriLoader from "@/components/AgriLoader";
import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";

export default function EditMestri() {
  const router = useRouter();
  
  // 🔥 GET hasRecords FROM PARAMS
  const { id, hasRecords } = useLocalSearchParams();
  const isLocked = hasRecords === "true"; 

  const [activeSession, setActiveSession] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [village, setVillage] = useState("");
  const [language, setLanguage] = useState<"te" | "en">("te");
  const [loading, setLoading] = useState(false);
  const [loaderType, setLoaderType] = useState<"loading" | "updating">("loading");
  const [activeInput, setActiveInput] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ name?: string; phone?: string; village?: string }>({});
  
  const [showWarning, setShowWarning] = useState(false);
  const [showLockInfo, setShowLockInfo] = useState(false); 

  const nameRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const villageRef = useRef<TextInput>(null);
  
  const t = {
    name: language === "te" ? "పేరు నమోదు చేయండి*" : "Enter name*",
    phone: language === "te" ? "ఫోన్ నంబర్ నమోదు చేయండి" : "Enter phone number",
    village: language === "te" ? "గ్రామం నమోదు చేయండి*" : "Enter village*"
  };
  const [isListening, setIsListening] = useState(false);

  // 🔥 PRODUCTION FIX 1: Voice input punctuation cleanup 
  useSpeechRecognitionEvent("result", (event) => {
    if (!isListening) return;

    if (event.results && event.results.length > 0) {
      const transcript = event.results[0].transcript.replace(/[.,?!]/g, "").trim();
      if (activeInput === "name" && !isLocked) {
        setName(transcript);
        if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
      }
      else if (activeInput === "village") {
        setVillage(transcript);
        if (errors.village) setErrors((prev) => ({ ...prev, village: undefined }));
      }
    }
  });

  useSpeechRecognitionEvent("end", () => setIsListening(false));

  const handleVoiceInput = async (target: string) => {
    if (target === "name" && isLocked) {
      setShowLockInfo(true);
      return;
    }
    Keyboard.dismiss(); // మైక్ ఆన్ చేసే ముందు కీబోర్డ్ దించేయాలి
    setActiveInput(target);
    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!result.granted) return;

    setIsListening(true);
    ExpoSpeechRecognitionModule.start({
      lang: language === "te" ? "te-IN" : "en-US",
      interimResults: true,
    });
  };

  useEffect(() => {
    const loadSession = async () => {
      const session = await AsyncStorage.getItem("ACTIVE_SESSION");
      if (session) {
        if (isMountedLocal) setActiveSession(session);
      } else {
        const phone = await AsyncStorage.getItem("USER_PHONE");
        if (phone) {
          const doc = await executeOfflineSafeRead(firestore().collection("users").doc(phone), true);
          setActiveSession(doc.data()?.activeSession || "");
        }
      }
    };

    loadSession();
  }, []);

  useEffect(() => {
    const loadLang = async () => {
      const lang = await AsyncStorage.getItem("APP_LANG");
      if (lang) setLanguage(lang as "te" | "en");
    };
    loadLang();
  }, []);

  /* ---------------- LOAD DATA ---------------- */
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoaderType("loading");
        setLoading(true);

        const userPhone = await AsyncStorage.getItem("USER_PHONE");
        if (!userPhone || !id) return;

        const doc = await executeOfflineSafeRead(firestore()
          .collection("users")
          .doc(userPhone)
          .collection("mestris")
          .doc(id as string)
          , true);

        const data = doc.data();

        if (data) {
          setName(data.name || "");
          setPhone(data.phone || "");
          setVillage(data.village || "");
        }
      } catch (err) {
        console.log("Load error:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // 🔥 PRODUCTION FIX 2: Stop listening on unmount to prevent leaks
  useEffect(() => {
    return () => {
      ExpoSpeechRecognitionModule.stop();
      setIsListening(false);
    };
  }, []);

  /* ---------------- UPDATE ---------------- */
  const handleUpdate = async () => {
    Keyboard.dismiss();
    
    const newErrors: { name?: string; phone?: string; village?: string } = {};
    if (!name.trim()) {
      newErrors.name = language === "te" ? "పేరు నమోదు చేయండి*" : "Name is required*";
    }
    if (!village.trim()) {
      newErrors.village = language === "te" ? "గ్రామం నమోదు చేయండి*" : "Village is required*";
    }

    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone && cleanPhone.length !== 10) {
      newErrors.phone = language === "te" ? "సరైన ఫోన్ నంబర్ ఇవ్వండి" : "Enter valid phone number";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});

    try {
      setLoaderType("updating");
      setLoading(true);

      const userPhone = await AsyncStorage.getItem("USER_PHONE");
      if (!userPhone || !id) {
        setLoading(false);
        return;
      }

      if (!activeSession) {
        setLoading(false);
        Alert.alert("Error", "Session missing");
        return;
      }
      
      await executeOfflineSafeWrite(firestore()
        .collection("users")
        .doc(userPhone)
        .collection("mestris")
        .doc(id as string)
        .update({
          name: name.trim(), 
          phone: cleanPhone,
          village: village.trim(),
          session: activeSession 
        }));

      setLoading(false);
      router.back();

    } catch (e) {
      setLoading(false);
      console.log("Update error:", e);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />

      <AppHeader
        title={language === "te" ? "మార్చండి" : "Edit Mestri"}
        subtitle={language === "te" ? "వివరాలు సవరించండి" : "Update Details"}
        language={language}
      />

      {/* 🔥 PRODUCTION FIX 3: Added KeyboardAvoidingView + ScrollView to avoid fields blocking */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

          {/* 👤 NAME (LOCKED IF hasRecords === true) */}
          <TouchableOpacity
            style={[
              styles.inputBox,
              activeInput === "name" && !isLocked && styles.inputFocused,
              errors.name && styles.inputError,
              isLocked && styles.inputLocked 
            ]}
            activeOpacity={1}
            onPress={() => {
              if (isLocked) setShowLockInfo(true);
              else nameRef.current?.focus();
            }}
          >
            {isLocked ? (
               <Ionicons name="lock-closed" size={20} color="#9CA3AF" />
            ) : (
               <Ionicons name="person-outline" size={20} color={activeInput === "name" ? "#16A34A" : "#9CA3AF"} />
            )}

            <TextInput
              ref={nameRef}
              placeholder={isListening && activeInput === "name" ? (language === "te" ? "వింటున్నాను..." : "Listening...") : t.name}
              placeholderTextColor={isListening && activeInput === "name" ? "#EF4444" : "#9CA3AF"}
              value={name}
              editable={!isLocked} 
              onChangeText={(txt) => {
                setName(txt);
                if (errors.name) setErrors({ ...errors, name: undefined });
              }}
              cursorColor="#16A34A"
              selectionColor="#16A34A40"
              style={[styles.input, isLocked && { color: "#6B7280" }]} 
              onFocus={() => setActiveInput("name")}
              onBlur={() => setActiveInput(null)}
              returnKeyType="next"
              onSubmitEditing={() => phoneRef.current?.focus()}
            />
            
            {isLocked ? (
              <TouchableOpacity onPress={() => setShowLockInfo(true)} style={styles.micBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="information-circle-outline" size={24} color="#F59E0B" />
              </TouchableOpacity>
            ) : name.trim().length > 0 ? (
              <TouchableOpacity onPress={() => setName("")} style={styles.micBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => handleVoiceInput("name")} style={styles.micBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons
                  name={isListening && activeInput === "name" ? "mic" : "mic-outline"}
                  size={24}
                  color={isListening && activeInput === "name" ? "#EF4444" : (activeInput === "name" ? "#16A34A" : "#6B7280")}
                />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
          {errors.name && <AppText style={styles.errorText} language={language}>{errors.name}</AppText>}

          {/* 📞 PHONE */}
          <TouchableOpacity
            style={[
              styles.inputBox,
              activeInput === "phone" && styles.inputFocused,
              errors.phone && styles.inputError
            ]}
            activeOpacity={1}
            onPress={() => phoneRef.current?.focus()}
          >
            <Ionicons name="call-outline" size={20} color={activeInput === "phone" ? "#16A34A" : "#9CA3AF"} />

            <TextInput
              ref={phoneRef}
              placeholder={t.phone}
              placeholderTextColor="#9CA3AF"
              value={phone}
              onChangeText={(txt) => {
                setPhone(txt);
                if (errors.phone) setErrors({ ...errors, phone: undefined });
              }}
              cursorColor="#16A34A"
              selectionColor="#16A34A40"
              style={styles.input}
              onFocus={() => setActiveInput("phone")}
              onBlur={() => setActiveInput(null)}
              keyboardType="number-pad"
              maxLength={10}
              returnKeyType="next"
              onSubmitEditing={() => villageRef.current?.focus()}
            />
          </TouchableOpacity>
          {errors.phone && <AppText style={styles.errorText} language={language}>{errors.phone}</AppText>}

          {/* 📍 VILLAGE */}
          <TouchableOpacity
            style={[
              styles.inputBox,
              activeInput === "village" && styles.inputFocused,
              errors.village && styles.inputError
            ]}
            activeOpacity={1}
            onPress={() => villageRef.current?.focus()}
          >
            <Ionicons name="location-outline" size={20} color={activeInput === "village" ? "#16A34A" : "#9CA3AF"} />

            <TextInput
              ref={villageRef}
              placeholder={isListening && activeInput === "village" ? (language === "te" ? "వింటున్నాను..." : "Listening...") : t.village}
              placeholderTextColor={isListening && activeInput === "village" ? "#EF4444" : "#9CA3AF"}
              value={village}
              onChangeText={(txt) => {
                setVillage(txt);
                if (errors.village) setErrors({ ...errors, village: undefined });
              }}
              cursorColor="#16A34A"
              selectionColor="#16A34A40"
              style={styles.input}
              onFocus={() => setActiveInput("village")}
              onBlur={() => setActiveInput(null)}
              returnKeyType="done"
              onSubmitEditing={handleUpdate}
            />
            {village.trim().length > 0 ? (
              <TouchableOpacity onPress={() => setVillage("")} style={styles.micBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => handleVoiceInput("village")} style={styles.micBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons
                  name={isListening && activeInput === "village" ? "mic" : "mic-outline"}
                  size={24}
                  color={isListening && activeInput === "village" ? "#EF4444" : (activeInput === "village" ? "#16A34A" : "#6B7280")}
                />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
          {errors.village && <AppText style={styles.errorText} language={language}>{errors.village}</AppText>}

          {/* UPDATE BUTTON */}
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleUpdate}
            disabled={loading} 
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={["#2E7D32", "#1B5E20"]}
              style={styles.saveGradient}
            >
              <AppText style={styles.saveText} language={language}>
                {language === "te" ? "సవరించండి" : "Update"}
              </AppText>
            </LinearGradient>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      <AgriLoader
        visible={loading}
        type={loaderType}
        language={language}
      />

      {/* 🔒 LOCK INFO MODAL */}
      <Modal visible={showLockInfo} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <View style={[styles.iconBg, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="lock-closed" size={36} color="#F59E0B" />
            </View>
            <AppText style={styles.modalTitle} language={language}>
              {language === "te" ? "పేరు మార్చలేరు" : "Name Locked"}
            </AppText>
            <AppText style={[styles.modalSub, { lineHeight: 22 }]} language={language}>
              {language === "te"
                ? "ఈ మేస్త్రీకి ఇప్పటికే హాజరు లేదా చెల్లింపుల రికార్డ్స్ ఉన్నందున మీరు పేరును సవరించలేరు. కేవలం ఫోన్ నంబర్ మరియు గ్రామం మార్చుకోవచ్చు."
                : "Since this mestri already has attendance or payment records, you cannot change the name. You can only update the phone number and village."}
            </AppText>
            <TouchableOpacity activeOpacity={0.8}
              style={[styles.okBtn, { backgroundColor: '#F59E0B' }]}
              onPress={() => setShowLockInfo(false)}
            >
              <AppText style={styles.okText} language={language}>
                {language === "te" ? "అర్థమైంది" : "Got It"}
              </AppText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

/* ---------------- STYLES ---------------- */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6F7F6" },
  container: { padding: 20, paddingBottom: 40 },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 55,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#D1D5DB"
  },
  inputLocked: {
    backgroundColor: "#F3F4F6", 
    borderColor: "#E5E7EB",
  },
  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: "#1F2937",
    fontFamily: "Mandali",
    textAlignVertical: "center",
    includeFontPadding: false,
  },
  inputFocused: {
    borderColor: "#16A34A",
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inputError: { borderColor: "#EF4444" },
  errorText: {
    color: "#EF4444",
    fontSize: 12,
    fontFamily: "Mandali",
    marginTop: -12,
    marginBottom: 12,
    marginLeft: 5,
  },
  micBtn: { marginLeft: 10, padding: 4 },
  saveBtn: { marginTop: 25, borderRadius: 18, overflow: "hidden", elevation: 4 },
  saveGradient: { height: 52, justifyContent: "center", alignItems: "center" },
  saveText: { color: "white", fontSize: 15, fontWeight: "600" },
  overlay: {
    position: "absolute",
    top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999
  },
  modalBox: { width: "80%", backgroundColor: "#fff", borderRadius: 20, padding: 24, alignItems: "center", elevation: 10 },
  iconBg: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#E8F5E9", justifyContent: "center", alignItems: "center", marginBottom: 10 },
  modalTitle: { fontSize: 18, fontWeight: "600", color: "#111827" },
  modalSub: { fontSize: 13, color: "#6B7280", textAlign: "center", marginTop: 8 },
  okBtn: { marginTop: 20, paddingVertical: 10, paddingHorizontal: 36, borderRadius: 12, alignSelf: "center", alignItems: "center" },
  okText: { color: "white", fontWeight: "600", fontSize: 16 }
});