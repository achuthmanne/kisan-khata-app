import { useLanguage } from "@/context/LanguageContext";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import firestore from "@react-native-firebase/firestore";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
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
import AgriLoader from "./../../components/AgriLoader";

const { width } = Dimensions.get("window");

export default function ProfileScreen() {
  const router = useRouter();

  // --- STATE ---
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState(""); 
  const { language, changeLanguage } = useLanguage();
  const [selectedState, setSelectedState] = useState("AP");
  const [created, setCreated] = useState("");
  const [online, setOnline] = useState(true);
  const [isFocused, setIsFocused] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [loaderType, setLoaderType] = useState<"loading" | "updating">("loading");
  
  // Backup state for cancelling edits
  const [backupData, setBackupData] = useState({ name: "", state: "", language: "" });

  const displayRole = useMemo(() => {
    const isFarmer = role?.toLowerCase() === "farmer" || role === "రైతు";
    const isMestri = role?.toLowerCase() === "mestri" || role === "మేస్త్రీ";
    if (language === "te") return isFarmer ? "రైతు" : isMestri ? "మేస్త్రీ" : "యూజర్";
    return isFarmer ? "Farmer" : isMestri ? "Mestri" : "User";
  }, [role, language]);

  const profileImage = useMemo(() => {
    const isFarmer = role?.toLowerCase() === "farmer" || role === "రైతు";
    const isMestri = role?.toLowerCase() === "mestri" || role === "మేస్త్రీ";
    if (isFarmer) return require("./../../assets/images/farmer.png");
    if (isMestri) return require("./../../assets/images/kuli.png");
    return require("./../../assets/images/farmer.png");
  }, [role]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const userPhone = await AsyncStorage.getItem("USER_PHONE");
        if (!userPhone) { router.replace("/login"); return; }

        setPhone(userPhone);
        const doc = await firestore().collection("users").doc(userPhone).get();
        const data = doc.data();

        if (data) {
          setName(data.name || "");
          setRole(data.role || "");
          setSelectedState(data.state || "AP");
          setCreated(data.createdAt?.toDate()?.toLocaleDateString() || "--/--/----");
          
          if (!data.name || data.name.trim().length < 3) {
            setIsEditing(true);
            setTimeout(() => setShowAlert(true), 500);
          }
        }
      } catch (error) { 
        console.log(error); 
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
      setName(backupData.name);
      setSelectedState(backupData.state);
      if (backupData.language !== language) {
        changeLanguage(backupData.language as "en" | "te");
      }
      setIsEditing(false);
    }
  };

  const handleSave = async () => {
    if (!name || name.trim().length < 3) {
      setShowAlert(true);
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
      setIsEditing(false);
      // Navigation handled by the user's logic in the other file, but here we just keep it in profile
    } catch (error) { 
      alert("Error saving data"); 
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
                <Image source={profileImage} style={styles.avatarImage} />
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
                <AppText style={styles.roleBadgeText} language={language}>{displayRole}</AppText>
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
              <View style={[
                styles.inputContainer, 
                isEditing && styles.inputContainerActive,
                isEditing && isFocused && styles.inputContainerFocused,
                !isEditing && styles.inputContainerDisabled
              ]}>
                <Ionicons name="person-outline" size={20} color={isEditing ? "#1B5E20" : "#9CA3AF"} style={styles.inputIcon} />
                <TextInput
                  value={name}
                  onChangeText={setName}
                  editable={isEditing}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder={language === "te" ? "మీ పేరు నమోదు చేయండి" : "Enter your name"}
                  placeholderTextColor="#9CA3AF"
                  style={[styles.textInput, language === "te" && { fontFamily: "Mandali" }]}
                  selectionColor="#1B5E20"
                />
                {!isEditing && <Ionicons name="lock-closed" size={14} color="#CBD5E1" />}
              </View>
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
                    {language === "te" ? "ఆంధ్రప్రదేశ్ (AP)" : "Andhra Pradesh"}
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
              <View style={[styles.inputContainer, styles.inputContainerDisabled]}>
                <Ionicons name="call-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
                <AppText style={styles.disabledValue} language={language}>+91 {phone}</AppText>
                <Ionicons name="lock-closed" size={14} color="#CBD5E1" />
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
          
          <View style={{ height: 100 }} />
        </KeyboardAwareScrollView>
      </KeyboardAvoidingView>

      {/* --- MODALS --- */}
      
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
              <TouchableOpacity onPress={() => setShowLogoutModal(false)} style={styles.modalSecondaryBtn}>
                <AppText style={styles.modalSecondaryBtnText} language={language}>
                  {language === "te" ? "వద్దు" : "No"}
                </AppText>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmLogout} style={[styles.modalPrimaryBtn, { backgroundColor: '#EF4444', flex: 1 }]}>
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
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
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
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    paddingHorizontal: 16,
    backgroundColor: "white",
  },
  inputContainerActive: {
    borderColor: "#D1D5DB",
  },
  inputContainerFocused: {
    borderColor: "#1B5E20",
    backgroundColor: "#F0FDF4",
  },
  inputContainerDisabled: {
    backgroundColor: "#F9FAFB",
    borderColor: "#F3F4F6",
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: "#111827",
    height: "100%",
  },
  disabledValue: {
    flex: 1,
    fontSize: 16,
    color: "#6B7280",
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
    fontWeight: "700",
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
    fontWeight: "700",
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
