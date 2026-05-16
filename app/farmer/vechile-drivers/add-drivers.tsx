//vechile drivers
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

import AgriLoader from "@/components/AgriLoader";
import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";

// URL params లో arrays వస్తే string లా మార్చడానికి చిన్న హెల్పర్
const getStr = (val: string | string[] | undefined) => (Array.isArray(val) ? val[0] : val || "");

export default function AddWork() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const vehicleId = getStr(params.vehicleId);
  const editId = getStr(params.editId);
  const hasRecords = getStr(params.hasRecords);

  // 🔥 LOCK LOGIC
  const isLocked = hasRecords === "true";

  // 🔥 INSTANT DATA LOAD FROM PARAMS (No delay!)
  const [name, setName] = useState(getStr(params.name));
  const [phone, setPhone] = useState(getStr(params.phone));
  const [village, setVillage] = useState(getStr(params.village));

  const [activeSession, setActiveSession] = useState("");
  const [activeInput, setActiveInput] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({}); 
  const [loading, setLoading] = useState(false);

  const [language, setLanguage] = useState<"te" | "en">("te");
  
  // 🔥 Lock Info Modal State
  const [showLockInfo, setShowLockInfo] = useState(false);

  const nameRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const villageRef = useRef<TextInput>(null);

  const placeholders = {
    en: {
      name: "Full Name*",
      phone: "Phone Number*",
      village: "Village Name*"
    },
    te: {
      name: "డ్రైవర్ పూర్తి పేరు*",
      phone: "ఫోన్ నంబర్*",
      village: "గ్రామం పేరు*"
    }
  };

  const t = placeholders[language] || placeholders.en;
  const [isListening, setIsListening] = useState(false);

  useSpeechRecognitionEvent("result", (event) => {
    if (event.results && event.results.length > 0) {
      const transcript = event.results[0].transcript;
      if (activeInput === "name" && !isLocked) {
        setName(transcript);
        if (errors.name) setErrors({ ...errors, name: "" });
      }
      else if (activeInput === "village") {
        setVillage(transcript);
        if (errors.village) setErrors({ ...errors, village: "" });
      }
    }
  });

  useSpeechRecognitionEvent("end", () => setIsListening(false));

  const handleVoiceInput = async (target: string) => {
    if (target === "name" && isLocked) {
      setShowLockInfo(true);
      return;
    }
    setActiveInput(target);
    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!result.granted) return;
    setIsListening(true);
    ExpoSpeechRecognitionModule.start({
      lang: language === "te" ? "te-IN" : "en-US",
      interimResults: true,
    });
  };

  /* ---------------- LOAD ---------------- */
  useEffect(() => {
    AsyncStorage.getItem("APP_LANG").then((l) => {
      if (l) setLanguage(l as any);
    });

    // 🔥 సేవ్ చేయడానికి Session కావాలి కాబట్టి ఇది మాత్రం లోడ్ చేస్తున్నాం
    const fetchSession = async () => {
      const userPhone = await AsyncStorage.getItem("USER_PHONE");
      if (!userPhone) return;
      const doc = await firestore().collection("users").doc(userPhone).get();
      setActiveSession(doc.data()?.activeSession || "");
    };
    fetchSession();
  }, []);

  useEffect(() => {
    return () => {
      ExpoSpeechRecognitionModule.stop();
    };
  }, []);

  /* ---------------- SAVE ---------------- */
  const handleSave = async () => {
    if (loading) return;

    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const cleanVillage = village.trim();

    // 🔥 INLINE VALIDATION LOGIC
    const newErrors: any = {};
    if (!cleanName) newErrors.name = language === "te" ? "డ్రైవర్ పేరు నమోదు చేయండి*" : "Enter driver name*";
    
    if (!cleanPhone) {
      newErrors.phone = language === "te" ? "ఫోన్ నంబర్ నమోదు చేయండి*" : "Enter phone number*";
    } else if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      newErrors.phone = language === "te" ? "సరైన ఫోన్ నంబర్ ఇవ్వండి*" : "Enter valid phone number*";
    }

    if (!cleanVillage) newErrors.village = language === "te" ? "గ్రామం పేరు నమోదు చేయండి*" : "Enter village name*";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    try {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 0));

      const userPhone = await AsyncStorage.getItem("USER_PHONE");
      if (!userPhone || !vehicleId || !activeSession) {
        setLoading(false);
        return;
      }

      const ref = firestore()
        .collection("users")
        .doc(userPhone)
        .collection("vehicles")
        .doc(vehicleId)
        .collection("drivers");

      if (editId) {
        await ref.doc(editId).update({
          driverName: cleanName, // లాక్ ఉన్నా పాత పేరే వెళ్తుంది
          phone: cleanPhone,
          village: cleanVillage
        });
      } else {
        await ref.add({
          driverName: cleanName,
          phone: cleanPhone,
          village: cleanVillage,
          session: activeSession, 
          createdAt: firestore.FieldValue.serverTimestamp()
        });
      }

      setTimeout(() => {
        setLoading(false);
        router.back();
      }, 400);

    } catch (e) {
      console.log(e);
      setLoading(false);
    }
  };

  /* ---------------- UI ---------------- */
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />

      <AppHeader
        title={
          editId
            ? (language === "te" ? "డ్రైవర్ వివరాలు మార్చండి" : "Edit Driver")
            : (language === "te" ? "డ్రైవర్ వివరాలు" : "Add Driver")
        }
        subtitle={
          editId
            ? (language === "te" ? "సవరించండి" : "Update Details")
            : (language === "te" ? "డ్రైవర్ నమోదు చేయండి" : "Add Driver Details")
        }
        language={language}
      />

      <View style={styles.container}>

        {/* 👤 NAME (LOCKED IF hasRecords === true) */}
        <TouchableOpacity
          style={[
            styles.inputBox, 
            activeInput === "name" && !isLocked && styles.inputFocused, 
            errors.name && styles.inputError,
            isLocked && styles.inputLocked // 🔥 లాక్ అయితే గ్రే కలర్
          ]}
          activeOpacity={1}
          onPress={() => {
            if (isLocked) setShowLockInfo(true);
            else { setActiveInput("name"); nameRef.current?.focus(); }
          }}
        >
          {isLocked ? (
             <Ionicons name="lock-closed" size={20} color="#9CA3AF" />
          ) : (
             <Ionicons name="person-outline" size={20} color={name || activeInput === "name" ? "#16A34A" : "#9CA3AF"} />
          )}
          
          <View style={styles.inputWrapper}>
            {!name && activeInput !== "name" && (
              <AppText style={{ color: "#9CA3AF", fontFamily: "Mandali" }}>{t.name}</AppText>
            )}
            <TextInput
              ref={nameRef}
              value={name}
              editable={!isLocked} // 🔥 THE MAIN LOCK
              onChangeText={(txt) => {
                setName(txt);
                if (errors.name) setErrors({ ...errors, name: "" });
              }}
              cursorColor="#16A34A"
              selectionColor="#16A34A40"
              style={[styles.input, { display: (name || activeInput === "name") ? "flex" : "none" }, isLocked && { color: "#6B7280" }]}
              onFocus={() => setActiveInput("name")}
              onBlur={() => setActiveInput(null)}
              returnKeyType="next"
              onSubmitEditing={() => phoneRef.current?.focus()}
            />
          </View>
          <TouchableOpacity 
            onPress={() => {
              if (isLocked) setShowLockInfo(true);
              else handleVoiceInput("name");
            }} 
            style={styles.micBtn}
          >
            {isLocked ? (
              <Ionicons name="information-circle-outline" size={24} color="#F59E0B" />
            ) : (
              <MaterialCommunityIcons 
                name={isListening && activeInput === "name" ? "microphone" : "microphone-outline"} 
                size={24} 
                color={isListening && activeInput === "name" ? "#EF4444" : (activeInput === "name" ? "#16A34A" : "#6B7280")} 
              />
            )}
          </TouchableOpacity>
        </TouchableOpacity>
        {errors.name && <AppText style={styles.errorText} language={language}>{errors.name}</AppText>}

        {/* 📞 PHONE */}
        <TouchableOpacity
          style={[styles.inputBox, activeInput === "phone" && styles.inputFocused, errors.phone && styles.inputError]}
          activeOpacity={1}
          onPress={() => { setActiveInput("phone"); phoneRef.current?.focus(); }}
        >
          <Ionicons 
            name="call-outline" 
            size={20} 
            color={phone || activeInput === "phone" ? "#16A34A" : "#9CA3AF"} 
          />
          <View style={styles.inputWrapper}>
            {!phone && activeInput !== "phone" && (
              <AppText style={{ color: "#9CA3AF", fontFamily: "Mandali" }}>{t.phone}</AppText>
            )}
            <TextInput
              ref={phoneRef}
              value={phone}
              onChangeText={(txt) => {
                setPhone(txt);
                if (errors.phone) setErrors({ ...errors, phone: "" });
              }}
              keyboardType="number-pad"
              maxLength={10}
              cursorColor="#16A34A"
              selectionColor="#16A34A40"
              style={[styles.input, { display: (phone || activeInput === "phone") ? "flex" : "none" }]}
              onFocus={() => setActiveInput("phone")}
              onBlur={() => setActiveInput(null)}
              returnKeyType="next"
              onSubmitEditing={() => villageRef.current?.focus()}
            />
          </View>
        </TouchableOpacity>
        {errors.phone && <AppText style={styles.errorText} language={language}>{errors.phone}</AppText>}

        {/* 📍 VILLAGE */}
        <TouchableOpacity
          style={[styles.inputBox, activeInput === "village" && styles.inputFocused, errors.village && styles.inputError]}
          activeOpacity={1}
          onPress={() => { setActiveInput("village"); villageRef.current?.focus(); }}
        >
          <Ionicons 
            name="location-outline" 
            size={20} 
            color={village || activeInput === "village" ? "#16A34A" : "#9CA3AF"} 
          />
          <View style={styles.inputWrapper}>
            {!village && activeInput !== "village" && (
              <AppText style={{ color: "#9CA3AF", fontFamily: "Mandali" }}>{t.village}</AppText>
            )}
            <TextInput
              ref={villageRef}
              value={village}
              onChangeText={(txt) => {
                setVillage(txt);
                if (errors.village) setErrors({ ...errors, village: "" });
              }}
              cursorColor="#16A34A"
              selectionColor="#16A34A40"
              style={[styles.input, { display: (village || activeInput === "village") ? "flex" : "none" }]}
              onFocus={() => setActiveInput("village")}
              onBlur={() => setActiveInput(null)}
              returnKeyType="done"
            />
          </View>
          <TouchableOpacity onPress={() => handleVoiceInput("village")} style={styles.micBtn}>
            <MaterialCommunityIcons 
              name={isListening && activeInput === "village" ? "microphone" : "microphone-outline"} 
              size={24} 
              color={isListening && activeInput === "village" ? "#EF4444" : (activeInput === "village" ? "#16A34A" : "#6B7280")} 
            />
          </TouchableOpacity>
        </TouchableOpacity>
        {errors.village && <AppText style={styles.errorText} language={language}>{errors.village}</AppText>}

        {/* SAVE */}
        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleSave}
          activeOpacity={0.9}
          disabled={loading}
        >
          <LinearGradient
            colors={["#2E7D32", "#1B5E20"]}
            style={styles.saveGradient}
          >
          <AppText style={styles.saveText}>
              {editId
                ? (language === "te" ? "సవరించండి" : "Update Driver")
                : (language === "te" ? "భద్రపరచండి" : "Save Driver")}
            </AppText>
          </LinearGradient>
        </TouchableOpacity>

      </View>

      <AgriLoader visible={loading} type={editId ? "updating" : "saving"} language={language} />

      {/* 🔥 LOCK INFO MODAL */}
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
                ? "ఈ డ్రైవర్ కి సంబంధించిన పని వివరాలు ఇప్పటికే రికార్డ్ అయినందున మీరు పేరును సవరించలేరు. కేవలం ఫోన్ నంబర్ మరియు గ్రామం మార్చుకోవచ్చు."
                : "Since this driver has existing work records, you cannot change the name. You can only update the phone number and village."}
            </AppText>
            <TouchableOpacity
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
  safe: {
    flex: 1,
    backgroundColor: "#F6F7F6"
  },
  container: {
    padding: 20
  },
  // 🔥 STANDARD PATTERN INPUT STYLES
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
  inputFocused: {
    borderColor: "#16A34A",
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inputError: {
    borderColor: "#EF4444",
  },
  errorText: {
    color: "#EF4444",
    fontSize: 12,
    fontFamily: "Mandali",
    marginTop: -10,
    marginBottom: 10,
    marginLeft: 4,
  },
  micBtn: {
    marginLeft: 10,
    padding: 4,
  },
  inputWrapper: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center'
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#1F2937",
    fontFamily: "Mandali",
    textAlignVertical: "center",
    includeFontPadding: false,
  },
  // ORIGINAL BUTTON STYLES
  saveBtn: {
    marginTop: 10,
    borderRadius: 18,
    overflow: "hidden",
    elevation: 6,
    shadowColor: "#1B5E20",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  saveGradient: {
    height: 56,
    justifyContent: "center",
    alignItems: "center"
  },
  saveText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600"
  },
  overlay: {
    position: "absolute",
    top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999
  },
  modalBox: { width: "80%", backgroundColor: "#fff", borderRadius: 20, padding: 24, alignItems: "center" },
  iconBg: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#E8F5E9", justifyContent: "center", alignItems: "center", marginBottom: 10 },
  modalTitle: { fontSize: 16, fontWeight: "600", textAlign: "center" },
  modalSub: { fontSize: 13, color: "#6B7280", textAlign: "center", marginTop: 8 },
  okBtn: { marginTop: 20, backgroundColor: "#1B5E20", paddingVertical: 12, paddingHorizontal: 40, borderRadius: 12 },
  okText: { color: "white", fontWeight: "600" }
});