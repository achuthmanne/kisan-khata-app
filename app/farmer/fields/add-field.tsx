// app/farmer/fields/add-field.tsx

import { Ionicons } from "@expo/vector-icons";
import { executeOfflineSafeFetch, executeOfflineSafeRead, executeOfflineSafeWrite } from "@/utils/offlineHelper";

import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSpeechRecognitionEvent } from "expo-speech-recognition";
import React, { useEffect, useRef, useState } from "react";
import { FlatList, Keyboard, KeyboardAvoidingView, Modal, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";

import AgriLoader from "@/components/AgriLoader";
import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";

const getStr = (val: string | string[] | undefined) => (Array.isArray(val) ? val[0] : val || "");

export default function AddField() {
  const router = useRouter();
  const params = useLocalSearchParams(); 

  const editId = getStr(params.editId);
  const isUsed = getStr(params.isUsed) === "true"; 
  const landId = getStr(params.landId);
  const landName = getStr(params.nickname) || getStr(params.oldNickname) || "";

  const [crop, setCrop] = useState(getStr(params.crop));
  const [acres, setAcres] = useState(getStr(params.defaultAcres) || getStr(params.acres) || getStr(params.maxAcres));

  const [language, setLanguage] = useState<"te" | "en">("te");
  const [loading, setLoading] = useState(false);
  const [activeSession, setActiveSession] = useState("");
  
  const [activeInput, setActiveInput] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({}); 
  
  const [modalType, setModalType] = useState<"crop" | null>(null); 
  const [searchText, setSearchText] = useState("");
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [isListening, setIsListening] = useState(false);
  const [voiceTarget, setVoiceTarget] = useState<string | null>(null);

  useSpeechRecognitionEvent("start", () => setIsListening(true));
  useSpeechRecognitionEvent("end", () => setIsListening(false));
  useSpeechRecognitionEvent("result", (event) => {
    const text = event.results[0]?.transcript;
    if (text && voiceTarget === "cropSearch") {
      setSearchText(text);
    }
  });
  useSpeechRecognitionEvent("error", (event) => {
    console.log("Speech error:", event.error, event.message);
    setIsListening(false);
  });

  const startListening = async (target: string) => {
    try {
      const ExpoSpeechRecognitionModule = require("expo-speech-recognition").ExpoSpeechRecognitionModule;
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!result.granted) {
        setErrorMsg(language === "te" ? "మైక్ పర్మిషన్ లేదు!" : "Microphone permission denied!");
        setShowErrorModal(true);
        return;
      }
      setVoiceTarget(target);
      ExpoSpeechRecognitionModule.start({ lang: language === "te" ? "te-IN" : "en-IN", interimResults: true, maxAlternatives: 1 });
    } catch (e) {
      console.log("Speech Error:", e);
    }
  };

  const acresRef = useRef<TextInput>(null);

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

  useEffect(() => {
    let isMounted = true;
    AsyncStorage.getItem("APP_LANG").then((l) => { if (l && isMounted) setLanguage(l as any); });
    
    const loadSession = async () => {
      const session = await AsyncStorage.getItem("ACTIVE_SESSION");
      if (session && isMounted) {
        setActiveSession(session);
      } else {
        const phone = await AsyncStorage.getItem("USER_PHONE");
        if (phone) {
          const doc = await executeOfflineSafeRead(firestore().collection("users").doc(phone), true);
          if (isMounted) setActiveSession(doc.data()?.activeSession || "");
        }
      }
    };
    loadSession();
    return () => { isMounted = false; };
  }, []);

  const handleSave = async () => {
    if (loading) return;
    Keyboard.dismiss();

    const newErrors: any = {};
    if (!crop.trim()) newErrors.crop = language === "te" ? "పంటను ఎంచుకోండి*" : "Select Crop Name*";
    
    const acresNum = Number(acres);
    const maxAcresNum = Number(getStr(params.maxAcres));
    if (!acres || isNaN(acresNum) || acresNum <= 0) {
      newErrors.acres = language === "te" ? "సరైన ఎకరాలు నమోదు చేయండి*" : "Enter valid acres*";
    } else if (maxAcresNum > 0 && acresNum > maxAcresNum) {
      newErrors.acres = language === "te" ? `ఈ భూమిలో కేవలం ${maxAcresNum} ఎకరాలు మాత్రమే ఖాళీగా ఉంది*` : `Only ${maxAcresNum} acres available in this land*`;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setLoading(true);

    try {
      const phone = await AsyncStorage.getItem("USER_PHONE");
      if (!phone || !activeSession) {
        setLoading(false); return;
      }

      const fieldData = {
        session: activeSession,
        crop: crop.trim(),
        landId: landId,
        acres: Number(acres),
        updatedAt: firestore.FieldValue.serverTimestamp(),
        status: "active"
      };

      const ref = firestore().collection("users").doc(phone).collection("fields");

      if (editId) {
        let ids = [editId as string];
        try { ids = JSON.parse(editId as string); } catch(e){}
        
        if (Array.isArray(ids) && ids.length > 0) {
           await executeOfflineSafeWrite(ref.doc(ids[0]).update(fieldData));
           if (ids.length > 1) {
              const batch = firestore().batch();
              for (let i = 1; i < ids.length; i++) {
                 batch.delete(ref.doc(ids[i]));
              }
              await executeOfflineSafeWrite(batch.commit());
           }
        } else {
           await executeOfflineSafeWrite(ref.doc(editId as string).update(fieldData));
        }
      } else {
        const markCompletedId = getStr(params.markCompletedId);
        if (markCompletedId) {
          const batch = firestore().batch();
          const newRef = ref.doc();
          batch.set(newRef, {
            ...fieldData,
            createdAt: firestore.FieldValue.serverTimestamp()
          });
          batch.update(ref.doc(markCompletedId), {
            status: "completed",
            endedAt: firestore.FieldValue.serverTimestamp()
          });
          await executeOfflineSafeWrite(batch.commit());
        } else {
          await executeOfflineSafeWrite(ref.add({
            ...fieldData,
            createdAt: firestore.FieldValue.serverTimestamp()
          }));
        }
      }

      router.back();
    } catch (e: any) {
      console.log("SAVE ERROR:", e);
      setErrorMsg(language === "te" ? "సర్వర్ లోపం! దయచేసి ఇంటర్నెట్ చెక్ చేసి మళ్ళీ ప్రయత్నించండి." : "Server Error! Please try again.");
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = cropOptions.filter(i => (language === "te" ? i.te : i.en).toLowerCase().includes(searchText.toLowerCase().trim()));

  const handleAddItem = (manualName: string) => {
    if (manualName.trim().length > 0) {
      setCrop(manualName.trim());
      setSearchText("");
      setModalType(null);
      setActiveInput(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <AppHeader
        title={editId ? (language === "te" ? "పంట వివరాలు మార్చండి" : "Edit Crop") : (language === "te" ? "కొత్త పంట నమోదు" : "Add Crop")}
        subtitle={language === "te" ? "పంట వివరాలను నమోదు చేయండి" : "Enter your crop details"}
        language={language}
      />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

          {/* 🔥 LAND BANNER */}
          <View style={{ backgroundColor: "#EFF6FF", padding: 14, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: "#BFDBFE", flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="location" size={24} color="#2563EB" />
            <View style={{ marginLeft: 10 }}>
                <AppText style={{ color: "#1E3A8A", fontSize: 13, fontWeight: "600" }}>
                {language === "te" ? "ఎంచుకున్న భూమి" : "Selected Land"}
                </AppText>
                <AppText style={{ color: "#1D4ED8", fontSize: 16, fontWeight: "600" }}>
                {landName || (language === "te" ? "భూమి పేరు లేదు" : "Unnamed Land")}
                </AppText>
            </View>
          </View>

          {/* 🌾 CROP BOX (🔥 WITH LOCK LOGIC) */}
          <TouchableOpacity 
            activeOpacity={isUsed ? 1 : 0.7} 
            style={[
              styles.inputBox, 
              activeInput === "crop" && !isUsed && styles.inputFocused, 
              errors.crop && styles.inputError,
              isUsed && { backgroundColor: "#F3F4F6", borderColor: "#E5E7EB" }
            ]} 
            onPress={() => { 
              if (isUsed) return;
              setModalType("crop"); setActiveInput("crop"); if (errors.crop) setErrors({...errors, crop: ""}); 
            }}
          >
            <Ionicons name={isUsed ? "lock-closed" : "leaf-outline"} size={20} color={isUsed ? "#D97706" : (crop ? "#16A34A" : "#9CA3AF")} />
            <View style={styles.inputWrapper}>
              <AppText style={{ color: isUsed ? "#4B5563" : (crop ? "#1F2937" : "#9CA3AF"), fontSize: 16, fontFamily: "Mandali", fontWeight: "600" }}>
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

          {/* 💾 SAVE BUTTON */}
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading} activeOpacity={0.8}>
            <LinearGradient colors={["#2E7D32", "#1B5E20"]} style={styles.saveGradient}>
              <AppText style={styles.saveText}>
                {editId 
                  ? (language === "te" ? "వివరాలు మార్చండి" : "Update Details") 
                  : (language === "te" ? "పంటను భద్రపరచండి" : "Save Crop")}
              </AppText>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 🟢 LOADER */}
      <AgriLoader visible={loading} type={editId ? "updating" : "saving"} language={language} />
      
      {/* 🔥 MODAL WRAPPER */}
      <Modal visible={modalType !== null} transparent animationType="slide" onRequestClose={() => setModalType(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <AppText style={{ fontSize: 18, fontWeight: "600", fontFamily: "Mandali" }}>
                {language === "te" ? "పంటను ఎంచుకోండి" : "Select Crop"}
              </AppText>
              <TouchableOpacity onPress={() => { 
                setModalType(null); 
                setActiveInput(null); 
                setSearchText(""); 
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
                onSubmitEditing={() => {
                   if (searchText.trim().length > 0) handleAddItem(searchText);
                }}
              />
              {searchText.trim().length > 0 && (
                <TouchableOpacity onPress={() => handleAddItem(searchText)} style={{ backgroundColor: "#16A34A", borderRadius: 12, padding: 6, marginLeft: 6 }}>
                  <Ionicons name="add" size={20} color="#fff" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => startListening("cropSearch")} style={{ marginLeft: 8, padding: 6, borderRadius: 10, backgroundColor: "#eaedf2" }}>
                <Ionicons name={isListening && voiceTarget === "cropSearch" ? "mic" : "mic-outline"} size={24} color={isListening && voiceTarget === "cropSearch" ? "#EF4444" : "#157c3e"} />
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
                    setCrop(selected);
                    if (errors.crop) setErrors({ ...errors, crop: "" });
                    setModalType(null);
                    setSearchText("");
                    setActiveInput(null);
                  }}
                >
                  <AppText style={styles.itemText}>{language === "te" ? item.te : item.en}</AppText>
                </TouchableOpacity>
              )}
            />
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
  container: { padding: 20, paddingBottom: 150 }, 
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
    marginBottom: 16,
    marginLeft: 4,
  },
  inputWrapper: { flex: 1, marginLeft: 10, justifyContent: 'center', height: '100%' },
  placeholder: { color: "#9CA3AF", fontSize: 16, position: 'absolute', fontFamily: "Mandali", fontWeight: "600" },
  input: { fontSize: 16, color: "#1F2937", height: '100%', fontFamily: "Mandali", width: '100%', fontWeight: "600" },

  saveBtn: { marginTop: 10, borderRadius: 14, overflow: 'hidden' },
  saveGradient: { paddingVertical: 10, alignItems: "center" },
  saveText: { color: "#fff", fontSize: 18, fontWeight: "600", fontFamily: "Mandali", letterSpacing: 0.5 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, height: "75%" },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', marginHorizontal: 20, marginVertical: 15, borderRadius: 18, paddingHorizontal: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  searchInput: { flex: 1, height: 54, fontSize: 16, color: '#1F2937' },
  item: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  itemText: { fontSize: 16, color: "#1F2937", fontFamily: "Mandali" },

  modalOverlayStandard: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalContentStandard: { backgroundColor: "#fff", borderRadius: 24, padding: 24, width: "100%", maxWidth: 340, alignItems: "center", elevation: 10 },
  modalIconBgStandardInfo: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#EFF6FF", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  modalTitleStandardInfo: { fontSize: 20, fontWeight: "bold", color: "#1E3A8A", marginBottom: 8, fontFamily: "Mandali", textAlign: "center" },
  modalSubStandard: { fontSize: 14, color: "#4B5563", textAlign: "center", marginBottom: 24, lineHeight: 22, fontFamily: "Mandali" },
  modalButtonsStandard: { flexDirection: "row", gap: 12, width: "100%" },
  modalCancelBtnStandard: { flex: 1, backgroundColor: "#F3F4F6", paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  modalCancelTextStandard: { color: "#4B5563", fontSize: 15, fontWeight: "600", fontFamily: "Mandali" },
});