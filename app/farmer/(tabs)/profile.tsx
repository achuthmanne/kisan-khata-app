// app/farmer/profile/index.tsx

import { useLanguage } from "@/context/LanguageContext";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import * as ImagePicker from "expo-image-picker";
import { useRouter, useFocusEffect } from "expo-router";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator
} from "react-native";
import { Image } from "expo-image";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import AppText from "@/components/AppText";
import AgriLoader from "../../../components/AgriLoader";

const { width } = Dimensions.get("window");

export default function ProfileScreen() {
  const router = useRouter();

  // 🔥 APP VERSION
  const APP_VERSION = "1.0.0";

  // --- STATE ---
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const { language, changeLanguage } = useLanguage();
  const [selectedState, setSelectedState] = useState("AP");
  const [created, setCreated] = useState("");
  const [online, setOnline] = useState(true);
  const [tierColor, setTierColor] = useState('#E5E7EB'); 
  
  const [isEditing, setIsEditing] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [loaderType, setLoaderType] = useState<"loading" | "updating">("loading");
  const [photoModal, setPhotoModal] = useState(false);

  const [activeInput, setActiveInput] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isListening, setIsListening] = useState(false);
  
  const nameRef = useRef<TextInput>(null);

  // Backup state for cancelling edits
  const [backupData, setBackupData] = useState({ name: "", state: "", language: "" });

  const isEditingRef = useRef(isEditing);
  const backupDataRef = useRef(backupData);

  useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);

  useEffect(() => {
    backupDataRef.current = backupData;
  }, [backupData]);

  // SILENTLY CLOSE EDIT MODE ON LEAVING SCREEN
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

  const getDefaultImage = () => {
    const isFarmer = role?.toLowerCase() === "farmer" || role === "రైతు";
    const isMestri = role?.toLowerCase() === "mestri" || role === "మేస్త్రీ";
    if (isFarmer) return require("../../../assets/images/farmer.png");
    if (isMestri) return require("../../../assets/images/kuli.png");
    return require("../../../assets/images/default.jpg");
  };

  // 🔥 TIER BADGE DYNAMIC LOGIC BASED ON SAVED COLOR
  const getTierDisplay = () => {
    if (tierColor === '#F59E0B') return language === 'te' ? '🏆 ఆదర్శ రైతు' : '🏆 Model Farmer';
    if (tierColor === '#3B82F6') return language === 'te' ? '🥈 ప్రగతిశీల రైతు' : '🥈 Progressive Farmer';
    if (tierColor === '#F97316') return language === 'te' ? '🥉 కష్టజీవి' : '🥉 Hardworking Farmer';
    if (tierColor === '#8B5CF6') return language === 'te' ? '🛡️ పోరాట యోధుడు' : '🛡️ Warrior Farmer';
    
    // Default (Locked or New Farmer)
    return language === 'te' ? '🌱 నవ రైతు' : '🌱 New Farmer';
  };

  const getTierBgColor = () => {
    if (tierColor === '#F59E0B') return '#FEF3C7'; // Yellow/Amber light bg
    if (tierColor === '#3B82F6') return '#DBEAFE'; // Blue light bg
    if (tierColor === '#F97316') return '#FFEDD5'; // Orange light bg
    if (tierColor === '#8B5CF6') return '#EDE9FE'; // Purple light bg
    return '#D1FAE5'; // Default Green light bg
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
          setProfileImage(data.profileImage || null); 
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

  useFocusEffect(
    useCallback(() => {
      const fetchTierColor = async () => {
        const userPhone = await AsyncStorage.getItem("USER_PHONE");
        if (!userPhone) return;
        const doc = await firestore().collection("users").doc(userPhone).get();
        const activeSession = doc.data()?.activeSession;
        
        if (activeSession) {
          const hasUserUnlocked = await AsyncStorage.getItem(`USER_UNLOCKED_${activeSession}`);
          if (hasUserUnlocked === 'true') {
            const color = await AsyncStorage.getItem('TIER_COLOR');
            if (color) setTierColor(color);
            else setTierColor('#10B981'); // Fallback New Farmer Color
          } else {
            setTierColor('#E5E7EB'); 
          }
        }
      };
      fetchTierColor();
    }, [])
  );

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => setOnline(!!state.isConnected));
    return unsubscribe;
  }, []);

  const handleImagePick = async () => {
    setPhotoModal(true);
  };

  const processPhotoUpload = async (uri: string) => {
    try {
      setUploadingImage(true);
      const userPhone = await AsyncStorage.getItem("USER_PHONE");
      
      const fileName = `profileImages/${userPhone}_${Date.now()}.jpg`;
      const reference = storage().ref(fileName);
      
      await reference.putFile(uri);
      const downloadURL = await reference.getDownloadURL();
      
      await firestore().collection("users").doc(userPhone!).update({
        profileImage: downloadURL
      });
      
      setProfileImage(downloadURL);
    } catch (error) {
      console.log("Image upload error:", error);
      alert(language === "te" ? "ఫోటో అప్‌లోడ్ విఫలమైంది." : "Image upload failed.");
    } finally {
      setUploadingImage(false);
    }
  };

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
      setErrors({ name: language === "te" ? "దయచేసి మీ పేరు నమోదు చేయండి*" : "Please enter your name*" });
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
              <View style={[styles.avatarInner, { borderColor: tierColor, borderWidth: 4 }]}>
                <Image 
                  source={profileImage ? { uri: profileImage } : getDefaultImage()} 
                  style={styles.avatarImage} 
                  contentFit="cover"
                />
                <View style={[styles.onlineDot, { backgroundColor: online ? "#4ADE80" : "#F87171" }]} />
                
                {uploadingImage && (
                  <View style={styles.avatarLoadingOverlay}>
                    <ActivityIndicator size="small" color="#fff" />
                  </View>
                )}
              </View>

              <TouchableOpacity
                onPress={handleImagePick}
                style={styles.cameraFloatingBtn}
                activeOpacity={0.8}
                disabled={uploadingImage}
              >
                <Ionicons name="camera" size={16} color="white" />
              </TouchableOpacity>
            </View>

            <View style={styles.heroInfo}>
              <AppText style={styles.heroName} language={language}>
                {name || (language === "te" ? "యూజర్" : "User")}
              </AppText>
              
              {/* 🔥 DYNAMIC TIER BADGE */}
              <View style={[styles.roleBadge, { backgroundColor: getTierBgColor() }]}>
                <AppText 
                  style={[styles.roleBadgeText, { color: tierColor !== '#E5E7EB' ? tierColor : '#10B981' }]} 
                  language={language}
                >
                  {getTierDisplay()}
                </AppText>
              </View>
            </View>
          </View>

          {/* 📝 FORM SECTION */}
          <View style={styles.formCard}>
            
            <View style={styles.formHeaderRow}>
               <AppText style={styles.sectionHeaderTitle} language={language}>
                 {language === "te" ? "వ్యక్తిగత వివరాలు" : "Personal Details"}
               </AppText>
               <TouchableOpacity 
                 activeOpacity={0.8}
                 onPress={handleEditToggle}
                 style={[
                   styles.editToggleBtn, 
                   isEditing ? styles.editToggleBtnCancel : styles.editToggleBtnActive,
                   { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 0, paddingVertical: 0 }
                 ]}
               >
                 <Ionicons name={isEditing ? "close" : "pencil"} size={18} color="#fff" />
               </TouchableOpacity>
            </View>

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

          <View style={{ height: 40 }} />
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
            
            {/* 🔥 ఇక్కడ బటన్ స్టైల్ అప్‌డేట్ చేశాను చూడు బ్రో */}
            <TouchableOpacity 
              onPress={() => setShowAlert(false)} 
              style={[styles.modalPrimaryBtn, { paddingHorizontal: 40, minWidth: 140 }]}
            >
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
              {language === "te" ? "మీరు కిసాన్ ఖాతా యాప్ నుండి బయటకు రావాలనుకుంటున్నారా?" : "Are you sure you want to sign out?"}
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

      {/* PHOTO UPLOAD MODAL */}
      <Modal visible={photoModal} transparent animationType="slide" statusBarTranslucent>
        <TouchableOpacity style={styles.bottomSheetOverlay} activeOpacity={1} onPress={() => setPhotoModal(false)}>
          <View style={styles.bottomSheetContent}>
            <View style={styles.bsHeader}>
              <View style={styles.bsHeaderLeft}>
                <View style={styles.bsIconBg}>
                  <Ionicons name="camera-outline" size={22} color="#1B5E20" />
                </View>
                <AppText style={styles.bsTitle} language={language}>
                  {language === "te" ? "ప్రొఫైల్ ఫోటో అప్డేట్" : "Update Profile Photo"}
                </AppText>
              </View>
              <TouchableOpacity onPress={() => setPhotoModal(false)} hitSlop={{top:10, bottom:10, left:10, right:10}}>
                <Ionicons name="close" size={26} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.bsOption} activeOpacity={0.8} onPress={async () => {
              setPhotoModal(false);
              const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.2 });
              if (!result.canceled && result.assets[0].uri) {
                processPhotoUpload(result.assets[0].uri);
              }
            }}>
              <View style={[styles.bsOptionIcon, { backgroundColor: "#EFF6FF" }]}><Ionicons name="camera" size={24} color="#3B82F6" /></View>
              <View>
                <AppText style={styles.bsOptionTitle} language={language}>{language === "te" ? "కెమెరా ద్వారా" : "Take Photo"}</AppText>
                <AppText style={styles.bsOptionSub} language={language}>{language === "te" ? "ఇప్పుడే ఫోటో తీయండి" : "Capture a live photo"}</AppText>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.bsOption} activeOpacity={0.8} onPress={async () => {
              setPhotoModal(false);
              const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.2 });
              if (!result.canceled && result.assets[0].uri) {
                processPhotoUpload(result.assets[0].uri);
              }
            }}>
              <View style={[styles.bsOptionIcon, { backgroundColor: "#F0FDF4" }]}><Ionicons name="images" size={24} color="#16A34A" /></View>
              <View>
                <AppText style={styles.bsOptionTitle} language={language}>{language === "te" ? "గ్యాలరీ నుండి" : "Gallery"}</AppText>
                <AppText style={styles.bsOptionSub} language={language}>{language === "te" ? "పాత ఫోటో ఎంచుకోండి" : "Choose an existing photo"}</AppText>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
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
    paddingBottom: 0,
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
    overflow: "hidden", 
    backgroundColor: "#F3F4F6",
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarLoadingOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center'
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
    zIndex: 10
  },
  cameraFloatingBtn: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1B5E20",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "white",
    zIndex: 20
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
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  formCard: {
    marginTop: 20,
    marginHorizontal: 16,
    padding: 20,
    paddingTop: 16,
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  
  // 🔥 NEW EDIT BUTTON STYLES
  formHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6'
  },
  sectionHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937'
  },
  editToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  editToggleBtnActive: {
    backgroundColor: '#1B5E20', // Solid Green for Edit
  },
  editToggleBtnCancel: {
    backgroundColor: '#DC2626', // Solid Red for Cancel
  },
  editToggleText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600'
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
  bottomSheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  bottomSheetContent: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, elevation: 15 },
  bsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  bsHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  bsIconBg: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#E8F5E9", justifyContent: "center", alignItems: "center" },
  bsTitle: { fontSize: 18, fontWeight: "600", color: "#1F2937" },
  bsOption: { flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  bsOptionIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center" },
  bsOptionTitle: { fontSize: 16, fontWeight: "600", color: "#1F2937", marginBottom: 2 },
  bsOptionSub: { fontSize: 13, color: "#6B7280" },
});