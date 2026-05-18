import { useLanguage } from "@/context/LanguageContext";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import firestore from "@react-native-firebase/firestore";
// 🔥 useFocusEffect ని ఇంపోర్ట్ చేశాం
import { useRouter, useFocusEffect } from "expo-router";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
// 🔥 useCallback ని ఇంపోర్ట్ చేశాం
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import AppText from "@/components/AppText";
import AgriLoader from "../../../components/AgriLoader";

const { width } = Dimensions.get("window");

export default function ProfileScreen() {
  const router = useRouter();

  // 🔥 APP VERSION (నువ్వు అప్‌డేట్ ఇచ్చిన ప్రతిసారీ ఇక్కడ మార్చుకో బ్రో)
  const APP_VERSION = "1.0.0";

  // --- STATE ---
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const { language, changeLanguage } = useLanguage();
  const [selectedState, setSelectedState] = useState("AP");
  const [created, setCreated] = useState("");
  const [online, setOnline] = useState(true);
  
  const [isEditing, setIsEditing] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [loaderType, setLoaderType] = useState<"loading" | "updating">("loading");

  const [activeInput, setActiveInput] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isListening, setIsListening] = useState(false);
  
  const nameRef = useRef<TextInput>(null);

  // Backup state for cancelling edits
  const [backupData, setBackupData] = useState({ name: "", state: "", language: "" });

  // 🔥 REFS FOR CLEANUP
  const isEditingRef = useRef(isEditing);
  const backupDataRef = useRef(backupData);

  useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);

  useEffect(() => {
    backupDataRef.current = backupData;
  }, [backupData]);

  // 🔥 SILENTLY CLOSE EDIT MODE ON LEAVING SCREEN
  useFocusEffect(
    useCallback(() => {
      return () => {
        if (isEditingRef.current) {
          const backup = backupDataRef.current;
          if (backup.name && backup.name.trim().length >= 3) {
            setIsEditing(false);
            setName(backup.name);
            setSelectedState(backup.state);
            setErrors({});
          }
        }
      };
    }, [])
  );

  const getDisplayRole = () => {
    const isFarmer = role?.toLowerCase() === "farmer" || role === "రైతు";
    const isMestri = role?.toLowerCase() === "mestri" || role === "మేస్త్రీ";
    if (language === "te") return isFarmer ? "రైతు" : isMestri ? "మేస్త్రీ" : "యూజర్";
    return isFarmer ? "Farmer" : isMestri ? "Mestri" : "User";
  };

  const getProfileImage = () => {
    const isFarmer = role?.toLowerCase() === "farmer" || role === "రైతు";
    const isMestri = role?.toLowerCase() === "mestri" || role === "మేస్త్రీ";
    if (isFarmer) return require("../../../assets/images/farmer.png");
    if (isMestri) return require("../../../assets/images/kuli.png");
    return require("../../../assets/images/default.jpg");
  };

  useSpeechRecognitionEvent("result", (event) => {
    if (event.results && event.results.length > 0) {
      const transcript = event.results[0].transcript;
      if (activeInput === "name") {
        setName(transcript);
        if (errors.name) setErrors({ ...errors, name: "" });
      }
    }
  });

  useSpeechRecognitionEvent("end", () => setIsListening(false));

  const handleVoiceInput = async (target: string) => {
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
    const loadProfile = async () => {
      try {
        const userPhone = await AsyncStorage.getItem("USER_PHONE");
        if (!userPhone) { router.replace("/login"); return; }

        setPhone(userPhone);
        const doc = await firestore().collection("users").doc(userPhone).get();
        const data = doc.data();

        if (data) {
          const dbName = data.name || "";
          const dbState = (data.state || "ap").toLowerCase() === "telangana" ? "Telangana" : "AP";
          
          setName(dbName);
          setRole(data.role || "");
          setSelectedState(dbState);
          setCreated(data.createdAt?.toDate()?.toLocaleDateString() || "--/--/----");

          setBackupData({ name: dbName, state: dbState, language });

          if (!dbName || dbName.trim().length < 3) {
            setIsEditing(true);
            setTimeout(() => setShowAlert(true), 500);
          }
        }
      } catch (error) {
        console.log("Error loading profile:", error);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => setOnline(!!state.isConnected));
    return unsubscribe;
  }, []);

  const handleBackPress = () => {
    if (!name || name.trim().length < 3) {
      setShowAlert(true);
      return;
    }
    router.back();
  };

  const handleEditToggle = () => {
    if (!isEditing) {
      setBackupData({ name, state: selectedState, language });
      setIsEditing(true);
    } else {
      if (!backupData.name || backupData.name.trim().length < 3) {
        setErrors({ name: language === "te" ? "దయచేసి ముందుగా మీ పేరు నమోదు చేయండి*" : "Please enter your name first*" });
        setShowAlert(true);
        return;
      }
      
      setName(backupData.name);
      setSelectedState(backupData.state);
      if (backupData.language !== language) {
        changeLanguage(backupData.language as "en" | "te");
      }
      setErrors({});
      setIsEditing(false);
    }
  };

  const handleSave = async () => {
    if (!name || name.trim().length < 3) {
      setErrors({ name: language === "te" ? "కనీసం 3 అక్షరాలు ఉండాలి*" : "Name must be at least 3 characters*" });
      return;
    }
    setErrors({});

    if (
      name.trim() === backupData.name &&
      selectedState === backupData.state &&
      language === backupData.language
    ) {
      setIsEditing(false);
      return; 
    }

    setLoaderType("updating");
    setLoading(true);
    try {
      await firestore().collection("users").doc(phone).update({
        name: name.trim(),
        language: language,
        state: selectedState.toLowerCase().trim(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
      
      await AsyncStorage.setItem("APP_LANG", language);
      
      setBackupData({ name: name.trim(), state: selectedState, language });
      setIsEditing(false);
      
      if (!backupData.name || backupData.name.trim().length < 3) {
        const isFarmer = role?.toUpperCase() === "FARMER" || role === "రైతు";
        router.replace(isFarmer ? "/farmer/(tabs)" : "/(tabs)");
      }
    } catch (error) {
      console.log("Error saving data:", error);
      alert(language === "te" ? "సర్వర్ సమస్య, దయచేసి మళ్లీ ప్రయత్నించండి." : "Server error, please try again.");
    } finally {
      setLoading(false);
    }
  };

  const confirmLogout = async () => {
    setShowLogoutModal(false);
    const lang = await AsyncStorage.getItem("APP_LANG");
    await AsyncStorage.clear();
    if (lang) await AsyncStorage.setItem("APP_LANG", lang);
    router.replace("/login");
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1B5E20" />

      {/* 🏛️ MODERN HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.headerIconBtn}>
          <Ionicons name="arrow-back" size={20} color="white" />
        </TouchableOpacity>
        <AppText style={styles.headerTitle} language={language}>
          {language === "te" ? "ప్రొఫైల్" : "My Profile"}
        </AppText>
        <TouchableOpacity onPress={() => setShowLogoutModal(true)} style={styles.headerIconBtn}>
          <Ionicons name="log-out-outline" size={22} color="white" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <KeyboardAwareScrollView
          enableOnAndroid={true}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* 👤 PROFILE HERO SECTION */}
          <View style={styles.heroSection}>
            <View style={styles.avatarWrapper}>
              <View style={styles.avatarInner}>
                <Image source={getProfileImage()} style={styles.avatarImage} />
                <View style={[styles.onlineDot, { backgroundColor: online ? "#4ADE80" : "#F87171" }]} />
              </View>
              <TouchableOpacity
                onPress={handleEditToggle}
                style={[styles.editFloatingBtn, isEditing && styles.editFloatingBtnActive]}
                activeOpacity={0.7}
              >
                <Ionicons name={isEditing ? "close" : "pencil"} size={20} color="white" />
              </TouchableOpacity>
            </View>

            <View style={styles.heroInfo}>
              <AppText style={styles.heroName} language={language}>
                {name || (language === "te" ? "యూజర్" : "User")}
              </AppText>
              <View style={styles.roleBadge}>
                <AppText style={styles.roleBadgeText} language={language}>{getDisplayRole()}</AppText>
              </View>
            </View>
          </View>

          {/* 📝 FORM SECTION */}
          <View style={styles.formCard}>
            
            {/* FULL NAME */}
            <View style={styles.fieldGroup}>
              <AppText style={styles.fieldLabel} language={language}>
                {language === "te" ? "పూర్తి పేరు" : "Full Name"}
              </AppText>
              <TouchableOpacity
                activeOpacity={isEditing ? 1 : 0.9}
                style={[
                  styles.inputBox,
                  isEditing && activeInput === "name" && styles.inputFocused,
                  errors.name && styles.inputError,
                  !isEditing && styles.inputBoxDisabled
                ]}
                onPress={() => {
                  if (isEditing) {
                    setActiveInput("name");
                    nameRef.current?.focus();
                  }
                }}
              >
                <Ionicons 
                  name="person-outline" 
                  size={20} 
                  color={name || (isEditing && activeInput === "name") ? (isEditing ? "#16A34A" : "#1F2937") : "#9CA3AF"} 
                />
                <View style={styles.inputWrapper}>
                  {!name && (!isEditing || activeInput !== "name") && (
                    <AppText style={{ color: "#9CA3AF", fontFamily: "Mandali" }}>
                      {language === "te" ? "మీ పేరు నమోదు చేయండి*" : "Enter your name*"}
                    </AppText>
                  )}
                  <TextInput
                    ref={nameRef}
                    value={name}
                    onChangeText={(txt) => {
                      setName(txt);
                      if (errors.name) setErrors({ ...errors, name: "" });
                    }}
                    editable={isEditing}
                    cursorColor="#16A34A"
                    selectionColor="#16A34A40"
                    style={[styles.input, { display: (name || (isEditing && activeInput === "name")) ? "flex" : "none" }]}
                    onFocus={() => setActiveInput("name")}
                    onBlur={() => setActiveInput(null)}
                  />
                </View>
                {isEditing ? (
                  <TouchableOpacity onPress={() => handleVoiceInput("name")} style={styles.micBtn}>
                    <MaterialCommunityIcons 
                      name={isListening && activeInput === "name" ? "microphone" : "microphone-outline"} 
                      size={24} color={isListening && activeInput === "name" ? "#EF4444" : (activeInput === "name" ? "#16A34A" : "#6B7280")} 
                    />
                  </TouchableOpacity>
                ) : (
                  <Ionicons name="lock-closed" size={16} color="#CBD5E1" style={{ marginRight: 4 }} />
                )}
              </TouchableOpacity>
              {errors.name && <AppText style={styles.errorText} language={language}>{errors.name}</AppText>}
            </View>

            {/* STATE TOGGLE */}
            <View style={styles.fieldGroup}>
              <AppText style={styles.fieldLabel} language={language}>
                {language === "te" ? "రాష్ట్రం" : "State"}
              </AppText>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  onPress={() => setSelectedState("AP")}
                  disabled={!isEditing}
                  style={[
                    styles.toggleChip,
                    selectedState === "AP" && styles.toggleChipActive,
                    !isEditing && selectedState !== "AP" && { opacity: 0.5 }
                  ]}
                >
                  <AppText style={[styles.toggleChipText, selectedState === "AP" && styles.toggleChipTextActive]} language={language}>
                    {language === "te" ? "ఆంధ్రప్రదేశ్" : "Andhra Pradesh"}
                  </AppText>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setSelectedState("Telangana")}
                  disabled={!isEditing}
                  style={[
                    styles.toggleChip,
                    selectedState === "Telangana" && styles.toggleChipActive,
                    !isEditing && selectedState !== "Telangana" && { opacity: 0.5 }
                  ]}
                >
                  <AppText style={[styles.toggleChipText, selectedState === "Telangana" && styles.toggleChipTextActive]} language={language}>
                    {language === "te" ? "తెలంగాణ" : "Telangana"}
                  </AppText>
                </TouchableOpacity>
              </View>
            </View>

            {/* PHONE NUMBER */}
            <View style={styles.fieldGroup}>
              <AppText style={styles.fieldLabel} language={language}>
                {language === "te" ? "మొబైల్ సంఖ్య" : "Phone Number"}
              </AppText>
              <View style={[styles.inputBox, styles.inputBoxDisabled]}>
                <Ionicons name="call-outline" size={20} color="#9CA3AF" />
                <View style={styles.inputWrapper}>
                  <AppText style={{ fontSize: 16, color: "#6B7280", fontFamily: "Mandali" }} language={language}>
                    +91 {phone}
                  </AppText>
                </View>
                <Ionicons name="lock-closed" size={16} color="#CBD5E1" style={{ marginRight: 4 }} />
              </View>
            </View>

            {/* LANGUAGE SELECTION */}
            <View style={styles.fieldGroup}>
              <AppText style={styles.fieldLabel} language={language}>
                {language === "te" ? "యాప్ భాష" : "App Language"}
              </AppText>
              <View style={styles.languageGrid}>
                <TouchableOpacity
                  onPress={() => changeLanguage("te")}
                  disabled={!isEditing}
                  style={[
                    styles.langOption,
                    language === "te" && styles.langOptionActive,
                    !isEditing && language !== "te" && { opacity: 0.5 }
                  ]}
                >
                  <View style={[styles.radio, language === "te" && styles.radioActive]}>
                    {language === "te" && <View style={styles.radioInner} />}
                  </View>
                  <AppText style={[styles.langOptionText, language === "te" && styles.langOptionTextActive]} language="te">తెలుగు</AppText>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => changeLanguage("en")}
                  disabled={!isEditing}
                  style={[
                    styles.langOption,
                    language === "en" && styles.langOptionActive,
                    !isEditing && language !== "en" && { opacity: 0.5 }
                  ]}
                >
                  <View style={[styles.radio, language === "en" && styles.radioActive]}>
                    {language === "en" && <View style={styles.radioInner} />}
                  </View>
                  <AppText style={[styles.langOptionText, language === "en" && styles.langOptionTextActive]} language="en">English</AppText>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* 💾 SAVE BUTTON */}
          {isEditing && (
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.9}>
                <AppText style={styles.saveBtnText} language={language}>
                  {language === "te" ? "వివరాలు సేవ్ చేయండి" : "Save Changes"}
                </AppText>
              </TouchableOpacity>
            </View>
          )}

          {/* 📱 APP VERSION DISPLAY */}
          <View style={styles.versionContainer}>
            <AppText style={styles.versionText} language={language}>
              {language === "te" ? `యాప్ వెర్షన్: ${APP_VERSION}` : `App Version: ${APP_VERSION}`}
            </AppText>
          </View>

          <View style={{ height: 100 }} />
        </KeyboardAwareScrollView>
      </KeyboardAvoidingView>

      {/* --- MODALS --- */}

      {/* Name Alert Modal */}
      <Modal visible={showAlert} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.modalIconBg, { backgroundColor: '#E8F5E9' }]}>
              <Ionicons name="alert-circle" size={40} color="#1B5E20" />
            </View>
            <AppText style={styles.modalTitle} language={language}>
              {language === "te" ? "పేరు అవసరం" : "Name Required"}
            </AppText>
            <AppText style={styles.modalSubText} language={language}>
              {language === "te" ? "ముందుకు సాగడానికి దయచేసి మీ పేరును నమోదు చేయండి." : "Please enter your name to continue using the app."}
            </AppText>
            <TouchableOpacity onPress={() => setShowAlert(false)} style={styles.modalPrimaryBtn}>
              <AppText style={styles.modalPrimaryBtnText} language={language}>
                {language === "te" ? "సరే" : "Okay"}
              </AppText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Logout Confirmation Modal */}
      <Modal visible={showLogoutModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.modalIconBg, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="log-out" size={36} color="#EF4444" />
            </View>
            <AppText style={[styles.modalTitle, { color: '#EF4444' }]} language={language}>
              {language === "te" ? "లాగౌట్" : "Logout"}
            </AppText>
            <AppText style={styles.modalSubText} language={language}>
              {language === "te" ? "మీరు నిజంగా నిష్క్రమించాలనుకుంటున్నారా?" : "Are you sure you want to sign out?"}
            </AppText>
            <View style={styles.modalActionRow}>
              <TouchableOpacity activeOpacity={0.8} onPress={() => setShowLogoutModal(false)} style={styles.modalSecondaryBtn}>
                <AppText style={styles.modalSecondaryBtnText} language={language}>
                  {language === "te" ? "వద్దు" : "No"}
                </AppText>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.8} onPress={confirmLogout} style={[styles.modalPrimaryBtn, { backgroundColor: '#EF4444', flex: 1 }]}>
                <AppText style={styles.modalPrimaryBtnText} language={language}>
                  {language === "te" ? "అవును" : "Yes"}
                </AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <AgriLoader visible={loading} type={loaderType} language={language} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1B5E20",
    paddingTop: Platform.OS === "android" ? 50 : 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroSection: {
    alignItems: "center",
    paddingVertical: 32,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  avatarWrapper: {
    position: "relative",
    marginBottom: 16,
  },
  avatarInner: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 4,
    borderColor: "#F3F4F6",
    overflow: "visible",
    backgroundColor: "#F3F4F6",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 55,
  },
  onlineDot: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: "white",
  },
  editFloatingBtn: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1B5E20",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "white",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  editFloatingBtnActive: {
    backgroundColor: "#EF4444",
  },
  heroInfo: {
    alignItems: "center",
  },
  heroName: {
    fontSize: 24,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
    includeFontPadding: false
  },
  roleBadge: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1B5E20",
    textTransform: "uppercase",
  },
  formCard: {
    marginTop: 20,
    marginHorizontal: 16,
    padding: 20,
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  fieldGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 55,
    borderWidth: 1,
    borderColor: "#D1D5DB"
  },
  inputBoxDisabled: {
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
    marginTop: 6,
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
  toggleRow: {
    flexDirection: "row",
    gap: 12,
  },
  toggleChip: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "white",
  },
  toggleChipActive: {
    borderColor: "#1B5E20",
    backgroundColor: "#E8F5E9",
  },
  toggleChipText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
  },
  toggleChipTextActive: {
    color: "#1B5E20",
    fontWeight: "600",
  },
  languageGrid: {
    flexDirection: "row",
    gap: 12,
  },
  langOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    backgroundColor: "white",
  },
  langOptionActive: {
    borderColor: "#1B5E20",
    backgroundColor: "#F0FDF4",
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  radioActive: {
    borderColor: "#1B5E20",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#1B5E20",
  },
  langOptionText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#4B5563",
  },
  langOptionTextActive: {
    color: "#1B5E20",
    fontWeight: "600",
  },
  buttonContainer: {
    paddingHorizontal: 16,
    marginTop: 10,
  },
  saveBtn: {
    backgroundColor: "#1B5E20",
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  saveBtnText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  // 🔥 VERSION STYLES ADDED HERE
  versionContainer: {
    alignItems: "center",
    marginTop: 30,
  },
  versionText: {
    fontSize: 13,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    backgroundColor: "white",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
  },
  modalIconBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
    textAlign: "center",
  },
  modalSubText: {
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  modalPrimaryBtn: {
    backgroundColor: "#1B5E20",
    width: "100%",
    height: 52,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  modalPrimaryBtnText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  modalActionRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  modalSecondaryBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  modalSecondaryBtnText: {
    color: "#4B5563",
    fontSize: 16,
    fontWeight: "600",
  },
});