// app/farmer/fields/add-land.tsx

import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSpeechRecognitionEvent } from "expo-speech-recognition";
import React, { useEffect, useRef, useState } from "react";
import { FlatList, Keyboard, KeyboardAvoidingView, Modal, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";

import AgriLoader from "@/components/AgriLoader";
import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";

export default function AddLand() {
  const router = useRouter();

  const [nickname, setNickname] = useState(""); 
  const [soilType, setSoilType] = useState("");
  const [acres, setAcres] = useState("");
  const [type, setType] = useState<"own" | "rent" | null>(null);
  const [rent, setRent] = useState("");

  const [isListening, setIsListening] = useState(false);
  const [voiceTarget, setVoiceTarget] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");

  useSpeechRecognitionEvent("start", () => setIsListening(true));
  useSpeechRecognitionEvent("end", () => setIsListening(false));
  useSpeechRecognitionEvent("result", (event) => {
    const text = event.results[0]?.transcript;
    if (text) {
      if (voiceTarget === "nickname") {
        setNickname(text);
        if (errors.nickname) setErrors({ ...errors, nickname: "" });
      } else if (voiceTarget === "soilSearch") {
        setSearchText(text);
      }
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


  const [language, setLanguage] = useState<"te" | "en">("te");
  const [loading, setLoading] = useState(false);
  const [activeSession, setActiveSession] = useState("");
  
  const [activeInput, setActiveInput] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({}); 
  
  const [modalType, setModalType] = useState<"soil" | null>(null); 
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const nicknameRef = useRef<TextInput>(null);
  const acresRef = useRef<TextInput>(null);
  const rentRef = useRef<TextInput>(null);

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
    let isMounted = true;
    AsyncStorage.getItem("APP_LANG").then((l) => { if (l && isMounted) setLanguage(l as any); });
    
    const loadSession = async () => {
      const phone = await AsyncStorage.getItem("USER_PHONE");
      if (phone) {
        const doc = await firestore().collection("users").doc(phone).get();
        if (isMounted) setActiveSession(doc.data()?.activeSession || "");
      }
    };
    loadSession();
    return () => { isMounted = false; };
  }, []);

  const filteredData = soilOptions.filter(i => (language === "te" ? i.te : i.en).toLowerCase().includes(searchText.toLowerCase().trim()));

  const handleAddItem = (manualName: string) => {
    if (manualName.trim().length > 0) {
      setSoilType(manualName.trim());
      setSearchText("");
      setModalType(null);
      setActiveInput(null);
    }
  };

  const handleSave = async () => {
    if (loading) return;
    Keyboard.dismiss();

    const newErrors: any = {};
    if (!nickname.trim()) newErrors.nickname = language === "te" ? "పొలం పేరు/ఆనవాలు ఇవ్వండి*" : "Enter Nickname*";
    
    const acresNum = Number(acres);
    if (!acres || isNaN(acresNum) || acresNum <= 0) {
      newErrors.acres = language === "te" ? "సరైన ఎకరాలు నమోదు చేయండి*" : "Enter valid acres*";
    }

    if (!soilType) newErrors.soilType = language === "te" ? "నేల రకం ఎంచుకోండి*" : "Select Soil Type*";
    if (!type) newErrors.type = language === "te" ? "పొలం రకం ఎంచుకోండి*" : "Select Field Type*";
    if (type === "rent" && (!rent || isNaN(Number(rent)))) newErrors.rent = language === "te" ? "కౌలు ఎంటర్ చేయండి*" : "Enter rent amount*";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setLoading(true);

    try {
      const phone = await AsyncStorage.getItem("USER_PHONE");
      if (!phone || !activeSession) {
        setLoading(false);
        return;
      }

      const landData = {
        session: activeSession,
        nickname: nickname.trim(),
        soilType: soilType.trim(),
        type: type,
        rent: type === "rent" ? Number(rent) : 0,
        acres: Number(acres),
        createdAt: firestore.FieldValue.serverTimestamp(),
      };

      await firestore().collection("users").doc(phone).collection("lands").add(landData);
      router.back();

    } catch (e: any) {
      console.log("SAVE ERROR:", e);
      setErrorMsg(language === "te" ? "సర్వర్ లోపం! దయచేసి ఇంటర్నెట్ చెక్ చేసి మళ్ళీ ప్రయత్నించండి." : "Server Error! Please check your internet and try again.");
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <AppHeader
        title={language === "te" ? "కొత్త భూమి నమోదు" : "Add New Land"}
        subtitle={language === "te" ? "మీ భూమి వివరాలను నమోదు చేయండి" : "Enter your land details"}
        language={language}
      />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

          {/* 🔥 NICKNAME / LOCATION BOX */}
          <TouchableOpacity 
            activeOpacity={1}
            onPress={() => {
              setActiveInput("nickname");
              setTimeout(() => nicknameRef.current?.focus(), 50);
            }}
            style={[styles.inputBox, activeInput === "nickname" && styles.inputFocused, errors.nickname && styles.inputError]}
          >
            <Ionicons name={"location-outline"} size={20} color={nickname ? "#16A34A" : "#9CA3AF"} />
            <View style={styles.inputWrapper}>
              {!nickname && activeInput !== "nickname" && (
                <AppText style={styles.placeholder}>
                  {language === "te" ? "పొలం పేరు / ఆనవాలు (ఉదా: చెరువు కాడ)*" : "Land Nickname / Location*"}
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
            <TouchableOpacity onPress={() => startListening("nickname")} style={{ padding: 4 }}>
              <Ionicons name={isListening && voiceTarget === "nickname" ? "mic" : "mic-outline"} size={22} color={isListening && voiceTarget === "nickname" ? "#EF4444" : "#9CA3AF"} />
            </TouchableOpacity>
          </TouchableOpacity>
          {errors.nickname && <AppText style={styles.errorText} language={language}>{errors.nickname}</AppText>}

          {/* 🪨 SOIL TYPE BOX */}
          <TouchableOpacity 
            activeOpacity={1}
            style={[styles.inputBox, activeInput === "soil" && styles.inputFocused, errors.soilType && styles.inputError]} 
            onPress={() => { 
              setModalType("soil"); setActiveInput("soil"); if (errors.soilType) setErrors({...errors, soilType: ""}); 
            }}
          >
            <Ionicons name={"layers-outline"} size={20} color={soilType ? "#16A34A" : "#9CA3AF"} />
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
          <AppText style={styles.label}>{language === "te" ? "పొలం రకం*" : "Land Type*"}</AppText>
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
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading} activeOpacity={0.8}>
            <LinearGradient colors={["#2E7D32", "#1B5E20"]} style={styles.saveGradient}>
              <AppText style={styles.saveText}>
                {language === "te" ? "భూమిని భద్రపరచండి" : "Save Land Details"}
              </AppText>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 🟢 LOADER */}
      <AgriLoader visible={loading} type={"saving"} language={language} />
      
      {/* 🔥 MODAL WRAPPER */}
      <Modal visible={modalType !== null} transparent animationType="slide" onRequestClose={() => setModalType(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <AppText style={{ fontSize: 18, fontWeight: "600", fontFamily: "Mandali" }}>
                {language === "te" ? "నేల రకాన్ని ఎంచుకోండి" : "Select Soil Type"}
              </AppText>
              <TouchableOpacity onPress={() => { setModalType(null); setSearchText(""); }}>
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
              <TouchableOpacity onPress={() => startListening("soilSearch")} style={{ marginLeft: 8, padding: 6, borderRadius: 10, backgroundColor: "#eaedf2" }}>
                <Ionicons name={isListening && voiceTarget === "soilSearch" ? "mic" : "mic-outline"} size={24} color={isListening && voiceTarget === "soilSearch" ? "#EF4444" : "#157c3e"} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={filteredData}
              keyboardShouldPersistTaps="handled" 
              keyExtractor={(item) => item.en}
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
                    setSoilType(selected);
                    if (errors.soilType) setErrors({ ...errors, soilType: "" });
                    setModalType(null);
                    setSearchText("");
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
  placeholder: { color: "#9CA3AF", fontSize: 16, position: 'absolute', fontFamily: "Mandali" },
  input: { fontSize: 16, color: "#1F2937", height: '100%', fontFamily: "Mandali", width: '100%' },

  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  pill: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  activePill: { backgroundColor: "#16A34A", borderColor: "#16A34A" },
  pillText: { fontSize: 15, fontWeight: "600", fontFamily: "Mandali" },

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
  modalTitleStandardInfo: { fontSize: 20, fontWeight: "600", color: "#1E3A8A", marginBottom: 8, fontFamily: "Mandali", textAlign: "center" },
  modalSubStandard: { fontSize: 14, color: "#4B5563", textAlign: "center", marginBottom: 24, lineHeight: 22, fontFamily: "Mandali" },
  modalButtonsStandard: { flexDirection: "row", gap: 12, width: "100%" },
  modalCancelBtnStandard: { flex: 1, backgroundColor: "#F3F4F6", paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  modalCancelTextStandard: { color: "#4B5563", fontSize: 15, fontWeight: "600", fontFamily: "Mandali" },
});