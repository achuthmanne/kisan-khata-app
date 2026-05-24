// app/farmer/fields/add-field.tsx

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useLocalSearchParams } from "expo-router"; 
import React, { useEffect, useRef, useState } from "react";
import { Keyboard, Platform, KeyboardAvoidingView } from "react-native";
import {
  FlatList, Modal, SafeAreaView, ScrollView, StatusBar,
  StyleSheet, TextInput, TouchableOpacity, View
} from "react-native";

import AgriLoader from "@/components/AgriLoader";
import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { useIsFocused } from "@react-navigation/native";

// URL params helper
const getStr = (val: string | string[] | undefined) => (Array.isArray(val) ? val[0] : val || "");

export default function AddField() {
  const router = useRouter();
  const params = useLocalSearchParams(); 
  const isScreenFocused = useIsFocused(); 

  const editId = getStr(params.editId);
  const isUsed = getStr(params.isUsed) === "true"; // 🔥 NEW: Check if crop is locked

  // 🔥 INSTANT DATA LOAD FROM PARAMS
  const [crop, setCrop] = useState(getStr(params.crop));
  const [nickname, setNickname] = useState(getStr(params.nickname) || ""); // 🔥 NEW
  const [soilType, setSoilType] = useState(getStr(params.soilType));
  const [acres, setAcres] = useState(getStr(params.acres));
  const [type, setType] = useState<"own" | "rent" | null>(getStr(params.type) as "own" | "rent" | null);
  const [rent, setRent] = useState(getStr(params.rent) !== "0" ? getStr(params.rent) : "");

  const [language, setLanguage] = useState<"te" | "en">("te");
  const [loading, setLoading] = useState(false);
  
  // 🔥 STANDARD PATTERN STATES
  const [activeInput, setActiveInput] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({}); 
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  
  const [modalType, setModalType] = useState<"crop" | "soil" | null>(null); 
  const [searchText, setSearchText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceTarget, setVoiceTarget] = useState<"search" | "nickname" | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const nicknameRef = useRef<TextInput>(null);
  const acresRef = useRef<TextInput>(null);
  const rentRef = useRef<TextInput>(null);

  const cropOptions = [
    { "en": "Acid Lime / Lemon", "te": "నిమ్మ" },
    { "en": "Ajwain / Carom Seeds", "te": "వాము" },
    { "en": "Amla / Gooseberry", "te": "ఉసిరి" },
    { "en": "Apple Gourd", "te": "దండకాయ" },
    { "en": "Areca Nut", "te": "పోక చెక్క" },
    { "en": "Ash Gourd", "te": "బూడిద గుమ్మడికాయ" },
    { "en": "Avocado", "te": "ఆవకాడో" },
    { "en": "Bajra / Pearl Millet", "te": "సజ్జలు" },
    { "en": "Banana", "te": "అరటి" },
    { "en": "Beetroot", "te": "బీట్రూట్" },
    { "en": "Bengal Gram / Chickpea", "te": "శనగలు" },
    { "en": "Betel Leaves", "te": "తమలపాకులు" },
    { "en": "Bhendi / Okra", "te": "బెండకాయ" },
    { "en": "Bitter Gourd", "te": "కాకరకాయ" },
    { "en": "Black Gram / Urad Dal", "te": "మినుములు" },
    { "en": "Black Pepper", "te": "మిరియాలు" },
    { "en": "Bottle Gourd", "te": "సొరకాయ" },
    { "en": "Brinjal / Eggplant", "te": "వంకాయ" },
    { "en": "Broad Beans", "te": "చిక్కుడుకాయ" },
    { "en": "Cabbage", "te": "క్యాబేజీ" },
    { "en": "Carrot", "te": "క్యారెట్" },
    { "en": "Cashew Nut", "te": "జీడిమామిడి" },
    { "en": "Castor", "te": "ఆముదం" },
    { "en": "Cauliflower", "te": "కాలీఫ్లవర్" },
    { "en": "Chilli", "te": "మిర్చి" },
    { "en": "Citrus / Sweet Orange", "te": "బత్తాయి" },
    { "en": "Cluster Beans", "te": "గోరు చిక్కుడు" },
    { "en": "Cocoa", "te": "కోకో" },
    { "en": "Coconut", "te": "కొబ్బరి" },
    { "en": "Coffee", "te": "కాఫీ" },
    { "en": "Coriander", "te": "కొత్తిమీర" },
    { "en": "Cotton", "te": "పత్తి" },
    { "en": "Cowpea", "te": "బొబ్బర్లు" },
    { "en": "Cucumber", "te": "దోసకాయ" },
    { "en": "Curry Leaves", "te": "కరివేపాకు" },
    { "en": "Custard Apple", "te": "సీతాఫలం" },
    { "en": "Dragon Fruit", "te": "డ్రాగన్ ఫ్రూట్" },
    { "en": "Drumstick", "te": "ములక్కాయ" },
    { "en": "Fenugreek", "te": "మెంతికూర / మెంతులు" },
    { "en": "Flowers / Marigold", "te": "బంతి పూలు" },
    { "en": "Garlic", "te": "వెల్లుల్లి" },
    { "en": "Ginger", "te": "అల్లం" },
    { "en": "Grapes", "te": "ద్రాక్ష" },
    { "en": "Green Chilli", "te": "పచ్చి మిరపకాయ" },
    { "en": "Green Gram / Mung Bean", "te": "పెసలు" },
    { "en": "Groundnut / Peanut", "te": "వేరుశనగ" },
    { "en": "Guava", "te": "జామ" },
    { "en": "Horse Gram", "te": "ఉలవలు" },
    { "en": "Ivy Gourd", "te": "దొండకాయ" },
    { "en": "Jackfruit", "te": "పనసకాయ" },
    { "en": "Jasmine", "te": "మల్లె పూలు" },
    { "en": "Jowar / Sorghum", "te": "జొన్న" },
    { "en": "Jute", "te": "జనుము" },
    { "en": "Linseed", "te": "అవిసెలు" },
    { "en": "Maize / Corn", "te": "మొక్కజొన్న" },
    { "en": "Mango", "te": "మామిడి" },
    { "en": "Mesta", "te": "గోగునార" },
    { "en": "Millets / Korra", "te": "కొర్రలు" },
    { "en": "Mint", "te": "పుదీనా" },
    { "en": "Mulberry", "te": "మల్బరీ" },
    { "en": "Muskmelon", "te": "కర్బూజా" },
    { "en": "Mustard", "te": "ఆవాలు" },
    { "en": "Oil Palm", "te": "పామాయిల్" },
    { "en": "Onion", "te": "ఉల్లిపాయ" },
    { "en": "Paddy / Rice", "te": "వరి" },
    { "en": "Palm Fruit", "te": "తాటి ముంజలు" },
    { "en": "Papaya", "te": "బొప్పాయి" },
    { "en": "Pineapple", "te": "అనాసపండు" },
    { "en": "Pomegranate", "te": "దానిమ్మ" },
    { "en": "Potato", "te": "బంగాళాదుంప" },
    { "en": "Proso Millet", "te": "వరిగలు" },
    { "en": "Pumpkin", "te": "గుమ్మడికాయ" },
    { "en": "Radish", "te": "ముల్లంగి" },
    { "en": "Ragi / Finger Millet", "te": "రాగులు" },
    { "en": "Red Gram / Pigeon Pea", "te": "కంది" },
    { "en": "Ridge Gourd", "te": "బీరకాయ" },
    { "en": "Rose", "te": "గులాబీ" },
    { "en": "Safflower", "te": "కుసుమ" },
    { "en": "Sandalwood", "te": "గంధపు చెక్క" },
    { "en": "Sapota", "te": "సపోటా" },
    { "en": "Sesame / Gingelly", "te": "నువ్వులు" },
    { "en": "Small Millet / Sama", "te": "సామలు" },
    { "en": "Snake Gourd", "te": "పొట్లకాయ" },
    { "en": "Soybean", "te": "సోయాబీన్" },
    { "en": "Spinach", "te": "పాలకూర" },
    { "en": "Sugarcane", "te": "చెరకు" },
    { "en": "Sunflower", "te": "పొద్దుతిరుగుడు" },
    { "en": "Sweet Potato", "te": "చిలగడదుంప" },
    { "en": "Tamarind", "te": "చింతపండు" },
    { "en": "Tapioca", "te": "కర్రపెండలం" },
    { "en": "Teak", "te": "టేకు" },
    { "en": "Tobacco", "te": "పొగాకు" },
    { "en": "Tomato", "te": "టమాటా" },
    { "en": "Turmeric", "te": "పసుపు" },
    { "en": "Watermelon", "te": "పుచ్చకాయ" },
    { "en": "Wheat", "te": "గోధుమ" },
    { "en": "Wood Apple", "te": "వెలగపండు" }
  ];

  
const soilOptions = [
  { "en": "Black Soil", "te": "నల్ల రేగడి నేల" },
  { "en": "Red Soil", "te": "ఎర్ర నేల" },
  { "en": "Sandy Soil", "te": "ఇసుక నేల" },
  { "en": "Clay Soil", "te": "బంక మట్టి నేల" },
  { "en": "Alluvial Soil", "te": "ఒండ్రు నేల" },
  { "en": "Laterite Soil", "te": "లేటరైట్ నేల" },
  { "en": "Red Sandy Soil", "te": "ఎర్ర ఇసుక నేల" },
  { "en": "Saline Soil", "te": "చవుడు నేల" },
  { "en": "Coastal Alluvial Soil", "te": "తీర ప్రాంత ఒండ్రు నేల" },
  { "en": "Delta Alluvial Soil", "te": "డెల్టా ఒండ్రు నేల" },
  { "en": "Rocky Soil", "te": "రాతి నేల" }
];

  useEffect(() => {
    AsyncStorage.getItem("APP_LANG").then((l) => { if (l) setLanguage(l as any); });
  }, []);

  const handleSave = async (bypassDuplicate = false) => {
    if (loading) return;
    Keyboard.dismiss();

    // 🔥 INLINE VALIDATION LOGIC
    const newErrors: any = {};
    if (!crop.trim()) newErrors.crop = language === "te" ? "పంటను ఎంచుకోండి*" : "Select Crop Name*";
    if (!nickname.trim()) newErrors.nickname = language === "te" ? "పొలం గుర్తు/ఆనవాలు నమోదు చేయండి*" : "Enter Field Nickname/Location*";
    if (!soilType.trim()) newErrors.soilType = language === "te" ? "నేల రకాన్ని ఎంచుకోండి*" : "Select Soil Type*";
    
    const acresNum = Number(acres);
    if (!acres || isNaN(acresNum) || acresNum <= 0) newErrors.acres = language === "te" ? "సరైన ఎకరాలు నమోదు చేయండి*" : "Enter valid acres*";
    
    if (!type) newErrors.type = language === "te" ? "పొలం రకం ఎంచుకోండి*" : "Select field type*";
    
    if (type === "rent") {
      const rentNum = Number(rent);
      if (!rent || isNaN(rentNum) || rentNum <= 0) newErrors.rent = language === "te" ? "సరైన కౌలు మొత్తం నమోదు చేయండి*" : "Enter valid rent amount*";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setLoading(true);

    try {
      const phone = await AsyncStorage.getItem("USER_PHONE");
      if (!phone) {
        setLoading(false);
        return;
      }

      const userDoc = await firestore().collection("users").doc(phone).get();
      const activeSession = userDoc.data()?.activeSession;

      if (!activeSession) {
        setLoading(false);
        return;
      }

      const fieldData = {
        session: activeSession,
        crop: crop.trim(),
        nickname: nickname.trim(), // 🔥 Saved to DB
        soilType: soilType.trim(),
        acres: Number(acres),
        type,
        rent: type === "rent" ? Number(rent || 0) : 0,
        updatedAt: firestore.FieldValue.serverTimestamp()
      };

      const ref = firestore()
        .collection("users")
        .doc(phone)
        .collection("fields");

      if (!editId && !bypassDuplicate) {
        const duplicateCheck = await ref
          .where("crop", "==", fieldData.crop)
          .where("nickname", "==", fieldData.nickname)
          .where("session", "==", activeSession)
          .get();

        if (!duplicateCheck.empty) {
          setLoading(false);
          setShowDuplicateModal(true);
          return;
        }
      }

      if (editId) {
        await ref
          .doc(editId as string)
          .update(fieldData);
      } else {
        await ref
          .add({
            ...fieldData,
            createdAt: firestore.FieldValue.serverTimestamp()
          });
      }

      router.back();

    } catch (e: any) {
      console.log("SAVE ERROR:", e);
      setErrorMsg(language === "te" ? "సర్వర్ లోపం! దయచేసి ఇంటర్నెట్ చెక్ చేసి మళ్ళీ ప్రయత్నించండి." : "Server Error! Please check your internet and try again.");
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  const startVoice = async (target: "search" | "nickname" = "search") => {
    try {
      Keyboard.dismiss();
      const res = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!res.granted) return;
      setVoiceTarget(target);
      setIsListening(true);
      ExpoSpeechRecognitionModule.start({ lang: language === "te" ? "te-IN" : "en-US", interimResults: true });
    } catch (e) {
      console.log("Voice Search Error:", e);
      setErrorMsg(language === "te" ? "మీ ఫోన్ వాయిస్ రికగ్నిషన్ సపోర్ట్ చేయడం లేదు." : "Voice search is not supported on your device.");
      setShowErrorModal(true);
    }
  };

  useSpeechRecognitionEvent("result", (event) => {
    if (!isListening) return; // 🔥 Safety check
    const text = event.results?.[0]?.transcript?.replace(/[.,?!]/g, ""); // 🔥 Punctuation fix
    if (text) {
      if (voiceTarget === "nickname") setNickname(text);
      else setSearchText(text);
    }
  });
  useSpeechRecognitionEvent("end", () => {
    setIsListening(false);
    setVoiceTarget(null);
  });

  useEffect(() => {
    if (!isScreenFocused) {
      ExpoSpeechRecognitionModule.stop();
      setIsListening(false);
    }
    return () => {
      ExpoSpeechRecognitionModule.stop();
    };
  }, [isScreenFocused]);

  const filteredData = modalType === "crop" 
    ? cropOptions.filter(i => (language === "te" ? i.te : i.en).toLowerCase().includes(searchText.toLowerCase().trim()))
    : soilOptions.filter(i => (language === "te" ? i.te : i.en).toLowerCase().includes(searchText.toLowerCase().trim()));

  const handleAddItem = (manualName: string) => {
    if (manualName.trim().length > 0) {
      if (modalType === "crop") setCrop(manualName.trim());
      else setSoilType(manualName.trim());
      
      setSearchText("");
      setModalType(null);
      setActiveInput(null);
      ExpoSpeechRecognitionModule.stop(); 
      setIsListening(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <AppHeader
        title={editId ? (language === "te" ? "వివరాలు మార్చండి" : "Edit Field") : (language === "te" ? "పొలం వివరాలు" : "Field Details")}
        subtitle={language === "te" ? "మీ పొలం వివరాలను నమోదు చేయండి" : "Enter your field details"}
        language={language}
      />

      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : undefined} 
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

          {/* 🌾 CROP BOX (🔥 WITH LOCK LOGIC) */}
          <TouchableOpacity 
            activeOpacity={isUsed ? 1 : 0.7} 
            style={[
              styles.inputBox, 
              activeInput === "crop" && !isUsed && styles.inputFocused, 
              errors.crop && styles.inputError,
              isUsed && { backgroundColor: "#F3F4F6", borderColor: "#E5E7EB" } // 🔥 Disabled Style
            ]} 
            onPress={() => { 
              if (isUsed) return; // 🔥 LOCK EDITING IF CROP IS IN USE
              setModalType("crop"); setActiveInput("crop"); if (errors.crop) setErrors({...errors, crop: ""}); 
            }}
          >
            <Ionicons name={isUsed ? "lock-closed" : "leaf-outline"} size={20} color={isUsed ? "#D97706" : (crop ? "#16A34A" : "#9CA3AF")} />
            <View style={styles.inputWrapper}>
              <AppText style={{ color: isUsed ? "#4B5563" : (crop ? "#1F2937" : "#9CA3AF"), fontSize: 16, fontFamily: "Mandali" }}>
                {crop || (language === "te" ? "పంటను ఎంచుకోండి*" : "Select Crop*")}
              </AppText>
            </View>
            {!isUsed && <Ionicons name="chevron-down" size={18} color="#9CA3AF" />}
          </TouchableOpacity>
          {errors.crop && !isUsed && <AppText style={styles.errorText} language={language}>{errors.crop}</AppText>}
          
          {/* 🔥 INFO NOTE FOR LOCKED CROP */}
          {isUsed && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: -10, marginBottom: 16, marginLeft: 4 }}>
              <Ionicons name="information-circle" size={14} color="#D97706" />
              <AppText style={{ fontSize: 12, color: "#D97706", marginLeft: 4, fontFamily: 'Mandali' }}>
                {language === "te" 
                  ? "ఈ పంటపై ఇప్పటికే పనులు లేదా ఖర్చులు ఉన్నందున, పంట పేరు మార్చలేరు." 
                  : "Crop name cannot be changed as it already has linked works or expenses."}
              </AppText>
            </View>
          )}

          {/* 🔥 NICKNAME / LOCATION BOX */}
          <TouchableOpacity 
            activeOpacity={1}
            onPress={() => {
              setActiveInput("nickname");
              setTimeout(() => nicknameRef.current?.focus(), 50);
            }}
            style={[styles.inputBox, activeInput === "nickname" && styles.inputFocused, errors.nickname && styles.inputError]}
          >
            <Ionicons name="location-outline" size={20} color={nickname ? "#16A34A" : "#9CA3AF"} />
            <View style={styles.inputWrapper}>
              {!nickname && activeInput !== "nickname" && (
                <AppText style={styles.placeholder}>
                  {language === "te" ? "ఆనవాలు (ఉదా: చెరువు కాడ)*" : "Nickname / Location*"}
                </AppText>
              )}
              <TextInput
                ref={nicknameRef}
                value={nickname}
                maxLength={40}
                cursorColor="#16A34A"
                selectionColor="#16A34A40"
                onChangeText={(txt) => {
                  setNickname(txt);
                  if (errors.nickname) setErrors({ ...errors, nickname: "" });
                }}
                style={[styles.input, { display: (nickname || activeInput === "nickname") ? "flex" : "none", paddingRight: 40 }]}
                onFocus={() => setActiveInput("nickname")}
                onBlur={() => setActiveInput(null)}
              />
            </View>
            {/* MIC BUTTON */}
            <TouchableOpacity onPress={() => startVoice("nickname")}>
              <Ionicons 
                name={voiceTarget === "nickname" && isListening ? "mic" : "mic-outline"} 
                size={22} 
                color={voiceTarget === "nickname" && isListening ? "#EF4444" : "#9CA3AF"} 
              />
            </TouchableOpacity>
          </TouchableOpacity>
          {errors.nickname && <AppText style={styles.errorText} language={language}>{errors.nickname}</AppText>}

          {/* 🪨 SOIL TYPE BOX */}
          <TouchableOpacity 
            activeOpacity={1}
            style={[styles.inputBox, activeInput === "soil" && styles.inputFocused, errors.soilType && styles.inputError]} 
            onPress={() => { setModalType("soil"); setActiveInput("soil"); if (errors.soilType) setErrors({...errors, soilType: ""}); }}
          >
            <Ionicons name="layers-outline" size={20} color={soilType ? "#16A34A" : "#9CA3AF"} />
            <View style={styles.inputWrapper}>
              <AppText style={{ color: soilType ? "#1F2937" : "#9CA3AF", fontSize: 16, fontFamily: "Mandali" }}>
                {soilType || (language === "te" ? "నేల రకాన్ని ఎంచుకోండి*" : "Select Soil Type*")}
              </AppText>
            </View>
            <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
          </TouchableOpacity>
          {errors.soilType && <AppText style={styles.errorText} language={language}>{errors.soilType}</AppText>}

          {/* 📏 ACRES BOX */}
          <TouchableOpacity
            style={[styles.inputBox, activeInput === "acres" && styles.inputFocused, errors.acres && styles.inputError]}
            activeOpacity={1}
            onPress={() => {
              setActiveInput("acres");
              setTimeout(() => acresRef.current?.focus(), 50); 
            }}
          >
            <Ionicons name="resize-outline" size={20} color={acres ? "#16A34A" : "#9CA3AF"} />
            <View style={styles.inputWrapper}>
              {!acres && activeInput !== "acres" && (
                <AppText style={styles.placeholder}>
                  {language === "te" ? "ఎన్ని ఎకరాలు?*" : "Enter acres*"}
                </AppText>
              )}
              <TextInput
                ref={acresRef}
                value={acres}
                onChangeText={(txt) => {
                  setAcres(txt);
                  if (errors.acres) setErrors({ ...errors, acres: "" });
                }}
                keyboardType="numeric"
                cursorColor="#16A34A"
                selectionColor="#16A34A40"
                style={[styles.input, { display: (acres || activeInput === "acres") ? "flex" : "none" }]}
                onFocus={() => setActiveInput("acres")}
                onBlur={() => setActiveInput(null)}
              />
            </View>
          </TouchableOpacity>
          {errors.acres && <AppText style={styles.errorText} language={language}>{errors.acres}</AppText>}

          {/* 🔘 TYPE SELECTION */}
          <AppText style={styles.label}>{language === "te" ? "పొలం రకం*" : "Field Type*"}</AppText>
          <View style={styles.row}>
            <TouchableOpacity activeOpacity={0.8}
              style={[styles.pill, type === "own" && styles.activePill, errors.type && !type && { borderColor: "#EF4444" }]} 
              onPress={() => { 
                setType("own"); 
                setRent(""); 
                setActiveInput(null); 
                if (errors.type) setErrors({ ...errors, type: "", rent: "" }); 
              }}
            >
              <AppText style={[styles.pillText, { color: type === "own" ? "#fff" : "#4B5563" }]}>
                {language === "te" ? "సొంతం" : "Own"}
              </AppText>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.8}
              style={[styles.pill, type === "rent" && styles.activePill, errors.type && !type && { borderColor: "#EF4444" }]} 
              onPress={() => { 
                setType("rent"); 
                setActiveInput(null); 
                if (errors.type) setErrors({ ...errors, type: "" }); 
              }}
            >
              <AppText style={[styles.pillText, { color: type === "rent" ? "#fff" : "#4B5563" }]}>
                {language === "te" ? "కౌలు" : "Rent"}
              </AppText>
            </TouchableOpacity>
          </View>
          {errors.type && <AppText style={[styles.errorText, {marginTop: -10, marginBottom: 16}]} language={language}>{errors.type}</AppText>}

          {/* 💰 RENT BOX */}
          {type === "rent" && (
            <View>
              <TouchableOpacity
                style={[styles.inputBox, activeInput === "rent" && styles.inputFocused, errors.rent && styles.inputError]}
                activeOpacity={1}
                onPress={() => {
                  setActiveInput("rent");
                  setTimeout(() => rentRef.current?.focus(), 50);
                }}
              >
                <Ionicons name="cash-outline" size={20} color={rent ? "#16A34A" : "#9CA3AF"} />
                <View style={styles.inputWrapper}>
                  {!rent && activeInput !== "rent" && (
                    <AppText style={styles.placeholder}>
                      {language === "te" 
                        ? `${acres || 0} ఎకరాలకు కలిపి మొత్తం కౌలు (రూ!!)*` 
                        : `Total rent for ${acres || 0} acres (₹)*`}
                    </AppText>
                  )}
                  <TextInput
                    ref={rentRef}
                    value={rent}
                    onChangeText={(txt) => {
                      setRent(txt);
                      if (errors.rent) setErrors({ ...errors, rent: "" });
                    }}
                    keyboardType="numeric"
                    cursorColor="#16A34A"
                    selectionColor="#16A34A40"
                    style={[styles.input, { display: (rent || activeInput === "rent") ? "flex" : "none" }]}
                    onFocus={() => setActiveInput("rent")}
                    onBlur={() => setActiveInput(null)}
                  />
                </View>
              </TouchableOpacity>
              {errors.rent && <AppText style={styles.errorText} language={language}>{errors.rent}</AppText>}
            </View>
          )}

          {/* 💾 SAVE BUTTON */}
          <TouchableOpacity style={styles.saveBtn} onPress={() => handleSave(false)} disabled={loading} activeOpacity={0.8}>
            <LinearGradient colors={["#2E7D32", "#1B5E20"]} style={styles.saveGradient}>
              <AppText style={styles.saveText}>
                {editId 
                  ? (language === "te" ? "వివరాలు మార్చండి" : "Update Details") 
                  : (language === "te" ? "భద్రపరచండి" : "Save Details")}
              </AppText>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 🟢 LOADER */}
      <AgriLoader visible={loading} type={editId ? "updating" : "saving"} language={language} />
      
      {/* 🔥 MODAL WRAPPER */}
      <Modal visible={modalType !== null} transparent animationType="slide" onRequestClose={() => {
        setModalType(null);
        ExpoSpeechRecognitionModule.stop(); 
        setIsListening(false);
      }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <AppText style={{ fontSize: 18, fontWeight: "600", fontFamily: "Mandali" }}>
                {modalType === "crop" ? (language === "te" ? "పంటను ఎంచుకోండి" : "Select Crop") : (language === "te" ? "నేల రకాన్ని ఎంచుకోండి" : "Select Soil Type")}
              </AppText>
              <TouchableOpacity onPress={() => { 
                setModalType(null); 
                setActiveInput(null); 
                setSearchText(""); 
                ExpoSpeechRecognitionModule.stop(); 
                setIsListening(false);
              }}>
                <Ionicons name="close-circle" size={30} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBar}>
              <TextInput
                autoFocus
                value={searchText}
                onChangeText={setSearchText}
                placeholder={language === "te" ? "టైప్ చేయండి..." : "Search or Type..."}
                placeholderTextColor={'#9CA3AF'}
                cursorColor={'#16A34A'}
                style={[styles.searchInput, { fontFamily: 'Mandali' }]}
                onSubmitEditing={() => handleAddItem(searchText)}
              />
              {searchText.trim().length > 0 && (
                <TouchableOpacity onPress={() => handleAddItem(searchText)} style={{ backgroundColor: "#16A34A", borderRadius: 12, padding: 6, marginRight: 6 }}>
                  <Ionicons name="add" size={20} color="#fff" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => startVoice("search")} style={{ marginLeft: 8, padding: 6, borderRadius: 10, backgroundColor: "#eaedf2" }}>
                <Ionicons name={voiceTarget === "search" && isListening ? "mic" : "mic-outline"} size={24} color={voiceTarget === "search" && isListening ? "#EF4444" : "#16A34A"} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={filteredData}
              keyboardShouldPersistTaps="handled" 
              ListEmptyComponent={() => (
                searchText.length > 0 ? (
                  <TouchableOpacity style={styles.item} onPress={() => handleAddItem(searchText)}>
                    <AppText style={{ color: '#16A34A', fontWeight: '600' }}>
                      {language === "te" ? `"${searchText}" ని చేర్చండి +` : `Add "${searchText}" +`}
                    </AppText>
                  </TouchableOpacity>
                ) : null
              )}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.item}
                  onPress={() => {
                    const selected = language === "te" ? item.te : item.en;
                    if (modalType === "crop") {
                      setCrop(selected);
                      if (errors.crop) setErrors({ ...errors, crop: "" });
                    } else {
                      setSoilType(selected);
                      if (errors.soilType) setErrors({ ...errors, soilType: "" });
                    }
                    setModalType(null);
                    setSearchText("");
                    setActiveInput(null);
                    ExpoSpeechRecognitionModule.stop(); 
                    setIsListening(false);
                  }}
                >
                  <AppText style={styles.itemText}>{language === "te" ? item.te : item.en}</AppText>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* 🔥 DUPLICATE ENTRY WARNING MODAL */}
      <Modal visible={showDuplicateModal} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.modalOverlayStandard}>
          <View style={styles.modalContentStandard}>
            <View style={styles.modalIconBgStandardInfo}>
              <Ionicons name="copy-outline" size={36} color="#3B82F6" />
            </View>
            <AppText style={styles.modalTitleStandardInfo} language={language}>
              {language === "te" ? "ఇప్పటికే నమోదు అయి ఉంది!" : "Duplicate Entry!"}
            </AppText>
            <AppText style={styles.modalSubStandard} language={language}>
              {language === "te" ? "సరిగ్గా ఇదే పొలం వివరాలు (పంట, ఎకరాలు) ఇప్పటికే ఉన్నాయి.\n\nమీరు ఖచ్చితంగా మళ్లీ జతచేయాలనుకుంటున్నారా?" : "An exact field entry (Crop, Acres) already exists.\n\nAre you sure you want to add this duplicate entry?"}
            </AppText>
            <View style={styles.modalButtonsStandard}>
              <TouchableOpacity activeOpacity={0.8} style={styles.modalCancelBtnStandard} onPress={() => setShowDuplicateModal(false)}>
                <AppText style={styles.modalCancelTextStandard} language={language}>{language === 'te' ? "వద్దు" : "Cancel"}</AppText>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.8} style={styles.modalInfoBtnStandard}
                onPress={() => { setShowDuplicateModal(false); handleSave(true); }}
              >
                <AppText style={styles.modalInfoTextStandard} language={language}>{language === 'te' ? "అవును, సేవ్ చేయి" : "Yes, Save"}</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 🔥 GLOBAL ERROR MODAL */}
      <Modal visible={showErrorModal} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.modalOverlayStandard}>
          <View style={styles.modalContentStandard}>
            <View style={[styles.modalIconBgStandardInfo, { backgroundColor: "#FEE2E2" }]}>
              <Ionicons name="warning-outline" size={36} color="#EF4444" />
            </View>
            <AppText style={[styles.modalTitleStandardInfo, { color: "#EF4444" }]} language={language}>
              {language === "te" ? "లోపం జరిగింది" : "Error Occurred"}
            </AppText>
            <AppText style={styles.modalSubStandard} language={language}>
              {errorMsg}
            </AppText>
            <View style={styles.modalButtonsStandard}>
              <TouchableOpacity activeOpacity={0.8} style={styles.modalCancelBtnStandard} onPress={() => setShowErrorModal(false)}>
                <AppText style={styles.modalCancelTextStandard} language={language}>{language === 'te' ? "సరే" : "OK"}</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6F7F6" },
  container: { padding: 20, paddingBottom: 120 }, 
  label: { fontSize: 14, color: "#6B7280", marginBottom: 6, marginLeft: 4, fontWeight: '500', fontFamily: 'Mandali' },
  
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
  placeholder: {
    position: "absolute",
    fontSize: 16,
    color: "#9CA3AF",
    fontFamily: "Mandali"
  },

  row: { flexDirection: "row", gap: 12, marginBottom: 20 },
  pill: {
    flex: 1, padding: 15, borderRadius: 12, backgroundColor: "#F9FAFB", 
    alignItems: "center", borderWidth: 1, borderColor: "#D1D5DB"
  },
  
  activePill: { backgroundColor: "#1B5E20"},
  pillText: { fontSize: 16, fontWeight: "600", fontFamily: "Mandali" },

  saveBtn: { marginTop: 10, borderRadius: 18, overflow: "hidden", elevation: 6, shadowColor: "#1B5E20", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 8 },
  saveGradient: { height: 56, justifyContent: "center", alignItems: "center" },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "600" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#fff", height: "70%", borderTopLeftRadius: 25, borderTopRightRadius: 25 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", padding: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', alignItems: "center" },
  searchBar: {
    flexDirection: "row",
    margin: 20,
    backgroundColor: "#F3F4F6",
    borderRadius: 18,
    paddingHorizontal: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB"
  },
  searchInput: { flex: 1, height: 54, fontSize: 16, fontFamily: 'Mandali' },
  item: { padding: 20, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  itemText: { fontSize: 17, fontFamily: "Mandali" },

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
  modalCancelTextStandard: { color: "#4B5563", fontWeight: "600" }
});