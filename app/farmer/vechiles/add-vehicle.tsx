// app/vehicle/add-vehicle.tsx

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { executeOfflineSafeRead, executeOfflineSafeWrite } from "@/utils/offlineHelper";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Modal,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view"; // 🔥 PRO FIX

import AgriLoader from "@/components/AgriLoader";
import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";

// URL params helper
const getStr = (val: string | string[] | undefined) => (Array.isArray(val) ? val[0] : val || "");

export default function AddVehicle() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const isMounted = useRef(true); // 🔥 PRO FIX: Memory leak protection

  const vehicleId = getStr(params.vehicleId);
  const paramName = getStr(params.name);
  const paramType = getStr(params.type);
  const paramNumber = getStr(params.number);
  const hasRecords = getStr(params.hasRecords);

  // 🔥 LOCK LOGIC
  const isLocked = hasRecords === "true";

  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [type, setType] = useState("");
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState<"te" | "en">("te");
  const [modalType, setModalType] = useState<"vehicle" | null>(null);
  
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [errorType, setErrorType] = useState<"validation" | "duplicate" | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({}); 
  
  // 🔥 Lock Info Modal State
  const [showLockInfo, setShowLockInfo] = useState(false);

  const [activeSession, setActiveSession] = useState("");
  const [activeInput, setActiveInput] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);

  const nameRef = useRef<TextInput>(null);
  const numberRef = useRef<TextInput>(null);

  const vehicleOptions = [
    { en: "Tractor", te: "ట్రాక్టర్" },
    { en: "Mini Tractor", te: "మినీ ట్రాక్టర్" },
    { en: "Combine Harvester", te: "కంబైన్ హార్వెస్టర్" },
    { en: "Power Tiller", te: "పవర్ టిల్లర్" },
    { en: "Tractor Trailer", te: "ట్రాక్టర్ ట్రైలర్" },
    { en: "Tata Ace (Chhota Hathi)", te: "టాటా ఏస్ / చిన్న ఏనుగు" },
    { en: "Mahindra Bolero Pickup", te: "మహీంద్రా బొలెరో పికప్" },
    { en: "Ashok Leyland Dost", te: "అశోక్ లేలాండ్ దోస్త్" },
    { en: "Auto Rickshaw (Trolley Auto)", te: "ట్రాలీ ఆటో" },
    { en: "Seven Seater / Passenger Auto", te: "ప్యాసింజర్ ఆటో" },
    { en: "Bullock Cart", te: "ఎద్దుల బండి" },
    { en: "JCB / Backhoe Loader", te: "జెసిబి" },
    { en: "Dozer", te: "డోజర్" },
    { en: "Tipper Truck", te: "టిప్పర్ లారీ" },
  ];
  
  const filteredVehicles = vehicleOptions.filter(item => {
    const value = (language === "te" ? item.te : item.en).toLowerCase().trim();
    return value.includes(searchText.toLowerCase().trim());
  });

  // 🔥 SMART NUMBER FORMATTER LOGIC
  const formatVehicleNumber = (text: string) => {
    let val = text.toUpperCase().replace(/\s/g, "");
    let result = "";

    const stateCode = val.match(/^[A-Z]{1,2}/);
    if (stateCode) {
      result += stateCode[0];
      val = val.substring(stateCode[0].length);
    } else if (val.length > 0) {
      return ""; 
    }

    if (result.length === 2) {
      const rtoCode = val.match(/^\d{1,2}/);
      if (rtoCode) {
        result += " " + rtoCode[0]; 
        val = val.substring(rtoCode[0].length);
      } else if (val.length > 0) {
        return result; 
      }

      if (rtoCode && rtoCode[0].length === 2) {
        const series = val.match(/^[A-Z]{1,2}/);
        if (series) {
          result += " " + series[0]; 
          val = val.substring(series[0].length);
          const numbers = val.match(/^\d{1,4}/);
          if (numbers) result += " " + numbers[0];
        } else {
          const numbers = val.match(/^\d{1,4}/);
          if (numbers) result += " " + numbers[0];
        }
      }
    }
    return result;
  };

  useSpeechRecognitionEvent("result", (event) => {
    if (!isMounted.current) return;
    if (event.results && event.results.length > 0) {
      const transcript = event.results[0].transcript;
      if (activeInput === "name" && !isLocked) {
        setName(transcript);
        if (errors.name) setErrors({ ...errors, name: "" });
      }
      else if (activeInput === "number") {
        setVehicleNumber(formatVehicleNumber(transcript));
        if (errors.number) setErrors({ ...errors, number: "" });
      }
      else if (activeInput === "modal") { 
        setSearchText(transcript); 
      }
    }
  });

  useSpeechRecognitionEvent("end", () => {
    if (isMounted.current) setIsListening(false);
  });

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

  useEffect(() => {
    isMounted.current = true;
    AsyncStorage.getItem("APP_LANG").then((l) => { if (l && isMounted.current) setLanguage(l as any); });
    
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

    return () => {
      isMounted.current = false;
      ExpoSpeechRecognitionModule.stop();
    };
  }, []);

  const getCurrentSession = () => {
    const now = new Date();
    const year = now.getFullYear();
    const startYear = now.getMonth() >= 5 ? year : year - 1;
    return `${startYear}-${(startYear + 1).toString().slice(-2)}`;
  };

  useEffect(() => {
    if (vehicleId) {
      setName(paramName || "");
      setType(paramType || "");
      setVehicleNumber(formatVehicleNumber(paramNumber || ""));
    }
  }, [vehicleId]);

  const handleSave = async () => {
    if (saving) return; 

    const newErrors: any = {};
    if (!name.trim()) newErrors.name = language === "te" ? "వాహనం పేరు నమోదు చేయండి*" : "Enter Vehicle Name*";
    if (!type.trim()) newErrors.type = language === "te" ? "వాహనం రకం ఎంచుకోండి*" : "Select Vehicle Type*";
    
    // 🔥 PRO FIX: Number is completely optional now
    const cleanNumber = vehicleNumber.replace(/\s/g, "");
    if (cleanNumber.length > 0) {
        const isValid = /^[A-Z]{2}\d{2}[A-Z]{0,2}\d{4}$/.test(cleanNumber);
        if (!isValid) {
            newErrors.number = language === "te" ? "సరైన నంబర్ (ఉదా: AP 16 CD 1234) ఇవ్వండి" : "Enter proper number (Ex: AP 16 CD 1234)";
        }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    
    setSaving(true);

    const phone = await AsyncStorage.getItem("USER_PHONE");
    if (!phone) {
      setSaving(false); 
      return;
    }
    
    const userDoc = await executeOfflineSafeRead(firestore().collection("users").doc(phone), true);
    const activeSession = userDoc.data()?.activeSession;
    if (!activeSession) {
      setSaving(false);
      return;
    }
    
    // 🔥 DUPLICATE CHECK (Only if number is provided)
    if (cleanNumber.length > 0) {
      const existing = await executeOfflineSafeRead(firestore()
        .collection("users")
        .doc(phone)
        .collection("vehicles")
        .where("number", "==", cleanNumber)
        .where("session", "==", activeSession), true
        );
        
      if (!existing.empty && !vehicleId) {
        setErrorType("duplicate");
        setShowValidationModal(true);
        setSaving(false); 
        return;
      }
    }

    setLoading(true);
    
    const data = {
      nickname: name.trim(),
      type,
      number: cleanNumber, // Will save as empty string if not provided
      session: activeSession, 
      createdAt: firestore.FieldValue.serverTimestamp()
    };
    
    try {
      const col = firestore().collection("users").doc(phone).collection("vehicles");
      if (vehicleId) await executeOfflineSafeWrite(col.doc(vehicleId as string).update(data));
      else await executeOfflineSafeWrite(col.add(data));
      
      if (isMounted.current) router.back();
    } catch (e) {
      console.log(e);
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setSaving(false); 
      }
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <AppHeader
        title={vehicleId ? (language === "te" ? "వాహనం సవరించు" : "Edit Vehicle") : (language === "te" ? "వాహనం చేర్చండి" : "Add Vehicle")}
        subtitle={language === "te" ? "వివరాలు నమోదు చేయండి" : "Enter vehicle details"}
        language={language}
      />

      <KeyboardAwareScrollView 
        contentContainerStyle={styles.container} 
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        showsVerticalScrollIndicator={false}
      >
          
          {/* 🔥 OLD SESSION WARNING BANNER */}
          {activeSession && activeSession !== getCurrentSession() && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#FFFBEB", borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "#FDE68A" }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#FEF3C7", justifyContent: "center", alignItems: "center" }}>
                <Ionicons name="warning" size={22} color="#D97706" />
              </View>
              <View style={{ flex: 1 }}>
<AppText style={{ fontSize: 13, color: "#92400E", lineHeight: 18 }} language={language}>
                  {language === "te" 
                    ? `మీరు పాత సాగు సంవత్సరం (${activeSession}) లో వాహనం నమోదు చేస్తున్నారు.` 
                    : `You are adding a vehicle to an older season (${activeSession}).`}
                </AppText>
              </View>
            </View>
          )}

          {/* 🚜 VEHICLE NAME */}
          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.inputBox,
              activeInput === "name" && !isLocked && styles.inputFocused,
              errors.name && styles.inputError,
              isLocked && styles.inputLocked 
            ]}
            onPress={() => {
              if (isLocked) setShowLockInfo(true);
              else { setActiveInput("name"); nameRef.current?.focus(); }
            }}
          >
            {isLocked ? (
               <Ionicons name="lock-closed" size={22} color="#9CA3AF" />
            ) : (
               <MaterialCommunityIcons name="tractor" size={22} color={name || activeInput === "name" ? "#16A34A" : "#9CA3AF"} />
            )}
            
            <View style={styles.inputWrapper}>
              {!name && activeInput !== "name" && (
                <AppText style={{ color: "#9CA3AF", fontFamily: "Mandali" }}>
                  {language === "te" ? "వాహనం పేరు*" : "Vehicle Name (Nickname)*"}
                </AppText>
              )}
              <TextInput
                ref={nameRef}
                value={name}
                editable={!isLocked} 
                onChangeText={(txt) => {
                  setName(txt);
                  if (errors.name) setErrors({ ...errors, name: "" });
                }}
                onFocus={() => setActiveInput("name")}
                onBlur={() => setActiveInput(null)}
                style={[styles.input, { fontFamily: 'Mandali', display: (name || activeInput === "name") ? "flex" : "none" }, isLocked && { color: "#6B7280" }]}
                cursorColor="#16A34A"
                selectionColor="#16A34A40"
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

          {/* 🔽 VEHICLE TYPE */}
          <TouchableOpacity
            activeOpacity={0.7}
            style={[
              styles.inputBox,
              modalType === "vehicle" && styles.inputFocused,
              errors.type && styles.inputError
            ]}
            onPress={() => {
              setModalType("vehicle");
              setActiveInput("type");
              if (errors.type) setErrors({ ...errors, type: "" });
            }}
          >
            <MaterialCommunityIcons name="forklift" size={22} color={type || modalType === "vehicle" ? "#16A34A" : "#9CA3AF"} />
            <View style={styles.inputWrapper}>
              <AppText style={{ color: type ? "#1F2937" : "#9CA3AF", fontFamily: "Mandali" }}>
                {type || (language === "te" ? "వాహనం రకం ఎంచుకోండి*" : "Select Type*")}
              </AppText>
            </View>
            <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
          </TouchableOpacity>
          {errors.type && <AppText style={styles.errorText} language={language}>{errors.type}</AppText>}

          {/* 🔢 VEHICLE NUMBER (OPTIONAL) */}
          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.inputBox,
              activeInput === "number" && styles.inputFocused,
              errors.number && styles.inputError
            ]}
            onPress={() => {
              setActiveInput("number");
              numberRef.current?.focus();
            }}
          >
            <Ionicons name="card-outline" size={20} color={vehicleNumber || activeInput === "number" ? "#16A34A" : "#9CA3AF"} />
            <View style={styles.inputWrapper}>
              {!vehicleNumber && activeInput !== "number" && (
                <AppText style={{ color: "#9CA3AF", fontFamily: "Mandali", fontSize: 14 }}>
                  {language === "te" ? "వాహనం నంబర్ (ఐచ్ఛికం/Optional)" : "Vehicle Number (Optional)"}
                </AppText>
              )}
              <TextInput
                ref={numberRef}
                value={vehicleNumber}
                onChangeText={(text) => {
                  const formatted = formatVehicleNumber(text);
                  setVehicleNumber(formatted);
                  if (errors.number) setErrors({ ...errors, number: "" });
                }}
                onFocus={() => setActiveInput("number")}
                onBlur={() => setActiveInput(null)}
                style={[
                  styles.input, 
                  { textTransform: "uppercase", fontFamily: 'Mandali', display: (vehicleNumber || activeInput === "number") ? "flex" : "none" }
                ]}
                autoCapitalize="characters"
                maxLength={13} 
                cursorColor="#16A34A"
                selectionColor="#16A34A40"
              />
            </View>
            <TouchableOpacity onPress={() => handleVoiceInput("number")} style={styles.micBtn}>
              <MaterialCommunityIcons 
                name={isListening && activeInput === "number" ? "microphone" : "microphone-outline"} 
                size={24} 
                color={isListening && activeInput === "number" ? "#EF4444" : (activeInput === "number" ? "#16A34A" : "#6B7280")} 
              />
            </TouchableOpacity>
          </TouchableOpacity>
          {errors.number && <AppText style={styles.errorText} language={language}>{errors.number}</AppText>}

          {/* SAVE BUTTON */}
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.saveBtn]}
            onPress={handleSave}
            disabled={saving} 
          >
            <LinearGradient colors={["#2E7D32", "#1B5E20"]} style={styles.saveGradient}>
              <AppText style={styles.saveText}>
                {vehicleId ? (language === "te" ? "సవరించండి" : "Update Vehicle") : (language === "te" ? "భద్రపరచండి" : "Save Vehicle")}
              </AppText>
            </LinearGradient>
          </TouchableOpacity>
      </KeyboardAwareScrollView>

      {/* 🚀 PREMIUM VALIDATION / DUPLICATE MODAL */}
      <Modal visible={showValidationModal} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.modalOverlayStandard}>
          <View style={styles.modalContentStandard}>
            <View style={[styles.modalIconBgStandardInfo, { backgroundColor: errorType === "duplicate" ? "#DBEAFE" : "#FEE2E2" }]}>
              <Ionicons 
                name={errorType === "duplicate" ? "copy-outline" : "warning"} 
                size={36} 
                color={errorType === "duplicate" ? "#3B82F6" : "#DC2626"} 
              />
            </View>
            <AppText style={[styles.modalTitleStandardInfo, { color: errorType === "duplicate" ? "#2563EB" : "#DC2626" }]} language={language}>
              {errorType === "duplicate"
                ? (language === "te" ? "ఇప్పటికే ఉంది" : "Already Exists")
                : (language === "te" ? "వివరాలు అవసరం" : "Missing Details")}
            </AppText>
            <AppText style={styles.modalSubStandard} language={language}>
              {errorType === "duplicate"
                ? (language === "te"
                  ? "ఈ నంబర్ తో వాహనం ఇప్పటికే మీ ఖాతాలో నమోదు చేయబడింది. దయచేసి నంబర్ సరిచూసుకోండి."
                  : "This vehicle number already exists in your account. Please check the number.")
                : (language === "te"
                  ? "దయచేసి అన్ని వివరాలు సరిగ్గా నమోదు చేయండి."
                  : "Please check your entered details.")}
            </AppText>
            <View style={styles.modalButtonsStandard}>
              <TouchableOpacity 
                activeOpacity={0.8}
                style={[styles.modalInfoBtnStandard, { backgroundColor: errorType === "duplicate" ? "#3B82F6" : "#DC2626" }]} 
                onPress={() => setShowValidationModal(false)}
              >
                <AppText style={styles.modalInfoTextStandard} language={language}>
                  {language === "te" ? "సరే" : "OK"}
                </AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 🔥 LOCK INFO MODAL */}
      <Modal visible={showLockInfo} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.modalOverlayStandard}>
          <View style={styles.modalContentStandard}>
            <View style={[styles.modalIconBgStandardInfo, { backgroundColor: "#FEF3C7" }]}>
              <Ionicons name="lock-closed" size={36} color="#F59E0B" />
            </View>
            <AppText style={[styles.modalTitleStandardInfo, { color: "#F59E0B" }]} language={language}>
              {language === "te" ? "పేరు మార్చలేరు" : "Name Locked"}
            </AppText>
            <AppText style={styles.modalSubStandard} language={language}>
              {language === "te"
                ? "ఈ వాహనానికి సంబంధించి రైతులు లేదా డ్రైవర్ల వివరాలు ఇప్పటికే నమోదు అయ్యాయి. కావున వాహనం పేరును మార్చడం కుదరదు."
                : "Since this vehicle has associated farmers or drivers, you cannot change its name."}
            </AppText>
            <View style={[styles.modalButtonsStandard, { justifyContent: "center" }]}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.modalInfoBtnStandard, { backgroundColor: "#F59E0B", paddingVertical: 10, paddingHorizontal: 36, flex: 0 }]}
                onPress={() => setShowLockInfo(false)}
              >
                <AppText style={[styles.modalInfoTextStandard, { fontSize: 16 }]} language={language}>
                  {language === "te" ? "అర్థమైంది" : "Got It"}
                </AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 🚀 PREMIUM VEHICLE TYPE MODAL */}
      <Modal visible={modalType !== null} transparent animationType="slide" statusBarTranslucent>
        <View style={styles.bottomSheetOverlay}>
          <TouchableWithoutFeedback onPress={() => { setModalType(null); setActiveInput(null); }}>
            <View style={styles.bottomSheetBackdrop} />
          </TouchableWithoutFeedback>
          <View style={styles.bottomSheetContent}>
            <View style={styles.dragIndicator} />
            <View style={styles.modalHeader}>
              <AppText style={styles.sheetTitleText}>{language === "te" ? "వాహనం ఎంచుకోండి" : "Select Vehicle"}</AppText>
            </View>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color="#9CA3AF" style={{ marginRight: 8 }} />
              <TextInput
                autoFocus
                placeholder={language === "te" ? "ఇక్కడ వెతకండి లేదా రాయండి..." : "Search or type here..."}
                value={searchText}
                cursorColor={'#16A34A'}
                placeholderTextColor={'#9CA3AF'}
                onChangeText={(text) => setSearchText(text)}
                style={[styles.searchInput, { fontFamily: "Mandali", flex: 1, color: "#1F2937" }]}
              />
              {searchText.trim().length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setType(searchText);
                    setModalType(null);
                    setSearchText("");
                    setActiveInput(null);
                  }}
                  style={{ backgroundColor: "#16A34A", borderRadius: 10, paddingVertical: 6, paddingHorizontal: 12, marginLeft: 6 }}
                >
                  <AppText style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>
                    {language === "te" ? "వాడు" : "Use"}
                  </AppText>
                </TouchableOpacity>
              )}
              {searchText.trim().length > 0 ? (
                <TouchableOpacity onPress={() => setSearchText("")} style={{ padding: 6, marginLeft: 4 }}>
                  <Ionicons name="close-circle" size={24} color="#9CA3AF" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => handleVoiceInput("modal")} style={{ padding: 6 }}>
                  <MaterialCommunityIcons 
                    name={isListening && activeInput === "modal" ? "microphone" : "microphone-outline"} 
                    size={24} 
                    color={isListening && activeInput === "modal" ? "#EF4444" : "#16A34A"} 
                  />
                </TouchableOpacity>
              )}
            </View>
            <FlatList
              data={filteredVehicles}
              keyExtractor={(_, i) => i.toString()}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 30 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.categoryItem}
                  onPress={() => {
                    setType(language === "te" ? item.te : item.en);
                    setModalType(null);
                    setSearchText("");
                    setActiveInput(null);
                  }}
                >
                  <View style={styles.categoryIconBox}>
                    <MaterialCommunityIcons name="tractor-variant" size={20} color="#16A34A" />
                  </View>
                  <AppText style={styles.categoryItemText}>{language === "te" ? item.te : item.en}</AppText>
                  <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      <AgriLoader visible={loading} type="saving" language={language} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6F7F6" },
  container: { padding: 20 },
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
  inputError: { borderColor: "#EF4444" },
  errorText: {
    color: "#EF4444",
    fontSize: 12,
    fontFamily: "Mandali",
    marginTop: -10,
    marginBottom: 10,
    marginLeft: 4,
  },
  micBtn: { marginLeft: 10, padding: 4 },
  inputWrapper: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#1F2937",
    textAlignVertical: "center",
    includeFontPadding: false,
  },
  saveBtn: { marginTop: 20, borderRadius: 18, overflow: "hidden" },
  saveGradient: { height: 56, justifyContent: "center", alignItems: "center" },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "600" },

  // 🔥 PREMIUM CENTER MODALS (Validation & Lock Info)
  overlayCenter: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", zIndex: 999 },
  premiumModalBox: { width: "80%", backgroundColor: "#fff", borderRadius: 24, padding: 24, alignItems: "center", elevation: 10 },
  iconBgWarning: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#FEE2E2", justifyContent: "center", alignItems: "center", marginBottom: 12 },
  modalTitleTextDark: { fontSize: 18, fontWeight: "600", color: '#111827', textAlign: "center" },
  modalSubText: { fontSize: 13, color: "#6B7280", textAlign: "center", marginTop: 8 },
  modalBtnsRow: { flexDirection: "row", marginTop: 24, width: '100%' },
  actionBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: "center", justifyContent: 'center' },

  // 🔥 PREMIUM BOTTOM SHEET MODAL (Vehicle Type)
  bottomSheetOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  bottomSheetBackdrop: { ...StyleSheet.absoluteFillObject },
  bottomSheetContent: { 
    backgroundColor: "#fff", 
    borderTopLeftRadius: 28, 
    borderTopRightRadius: 28, 
    maxHeight: "85%",
    paddingTop: 10
  },
  dragIndicator: { width: 40, height: 5, backgroundColor: "#D1D5DB", borderRadius: 3, alignSelf: "center", marginBottom: 10 },
  modalHeader: { flexDirection: "row", justifyContent: "center", paddingVertical: 10, paddingHorizontal: 20 },
  sheetTitleText: { fontSize: 18, fontWeight: "600", color: "#111827" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    marginHorizontal: 20,
    marginBottom: 10,
    marginTop: 5,
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB"
  },
  searchInput: { height: 50, fontSize: 15 },
  categoryItem: { 
    flexDirection: "row", 
    alignItems: "center", 
    paddingVertical: 16, 
    paddingHorizontal: 20, 
    borderBottomWidth: 1, 
    borderBottomColor: "#F3F4F6" 
  },
  categoryIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#DCFCE7", justifyContent: "center", alignItems: "center", marginRight: 14 },
  categoryItemText: { flex: 1, fontSize: 15, fontWeight: "500", color: "#374151" },

  // UNIFIED PREMIUM MODAL CLASSES (DUPLICATE BLUE INFO THEME & RED VALIDATION)
  modalOverlayStandard: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 999 },
  modalContentStandard: { width: "85%", backgroundColor: "white", borderRadius: 24, padding: 24, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 15 },
  modalSubStandard: { textAlign: "center", color: "#64748B", marginTop: 8, marginBottom: 25, fontSize: 14, lineHeight: 22 },
  modalButtonsStandard: { flexDirection: "row", gap: 12, width: '100%' },
  modalIconBgStandardInfo: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#DBEAFE", justifyContent: "center", alignItems: "center", marginBottom: 12 },
  modalTitleStandardInfo: { fontSize: 20, fontWeight: "600", color: "#2563EB", marginTop: 10, textAlign: "center" },
  modalInfoBtnStandard: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#3B82F6", alignItems: "center", justifyContent: "center" },
  modalInfoTextStandard: { color: "white", fontWeight: "600" },
  modalCancelBtnStandard: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  modalCancelTextStandard: { color: "#4B5563", fontWeight: "600" },
});