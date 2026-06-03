// app/farmer/sales/add-sale.tsx

import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  FlatList, Keyboard,
  Modal,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import AgriLoader from "@/components/AgriLoader";
import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { useIsFocused } from "@react-navigation/native";

// URL params helper
const getStr = (val: string | string[] | undefined) => (Array.isArray(val) ? val[0] : val || "");

export default function AddSale() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const isScreenFocused = useIsFocused(); 

  const editId = getStr(params.editId);

  // 🔥 DATA LOAD FROM PARAMS
  const [crop, setCrop] = useState(getStr(params.crop));
  const [description, setDescription] = useState(getStr(params.desc) || ""); // 🔥 NEW: Grade/Type
  const [quantity, setQuantity] = useState(getStr(params.qty));
  const [unit, setUnit] = useState(getStr(params.unit) || "kg");
  const [rate, setRate] = useState(getStr(params.rate));

  const [modalType, setModalType] = useState<"crop" | null>(null);
  const [searchText, setSearchText] = useState("");
  const [unitOpen, setUnitOpen] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  
  const [activeInput, setActiveInput] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({}); 
  const [isListening, setIsListening] = useState(false);
  const [voiceTarget, setVoiceTarget] = useState<"crop" | "desc" | null>(null); // 🔥 UPDATED: Added desc
  
  const [userCrops, setUserCrops] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState<"te" | "en">("te");
  const [activeSession, setActiveSession] = useState("");

  const unitMapping: any = {
    "gm": "గ్రాములు",
    "kg": "కిలోలు",
    "quintal": "క్వింటాల్",
    "ton": "టన్ను"
  };

  const unitOptions = ["gm", "kg", "quintal", "ton"];

  const qtyRef = useRef<TextInput>(null);
  const rateRef = useRef<TextInput>(null);
  const descRef = useRef<TextInput>(null); // 🔥 ఇక్కడ యాడ్ చెయ్

  useEffect(() => {
    AsyncStorage.getItem("APP_LANG").then((l) => {
      if (l) setLanguage(l as any);
    });

    const loadUserCrops = async () => {
      const phone = await AsyncStorage.getItem("USER_PHONE");
      if (!phone) return;

      const userDoc = await firestore().collection("users").doc(phone).get();
      const fetchedSession = userDoc.data()?.activeSession;
      if (!fetchedSession) return; 
      
      setActiveSession(fetchedSession);

      const snap = await firestore()
        .collection("users").doc(phone).collection("fields")
        .where("session", "==", fetchedSession) 
        .get();

      const set = new Set<string>();
      snap.forEach(doc => {
        const data = doc.data();
        if (data.crop) {
          const formatted = data.nickname ? `${data.crop} - ${data.nickname}` : data.crop;
          set.add(formatted);
        }
      });
      setUserCrops(Array.from(set));
    };
    loadUserCrops();
  }, []);

  const getCurrentSession = () => {
    const now = new Date();
    const year = now.getFullYear();
    const startYear = now.getMonth() >= 5 ? year : year - 1;
    return `${startYear}-${(startYear + 1).toString().slice(-2)}`;
  };

  // 🔥 UPDATED VOICE FUNCTION (Supports both Crop Search and Description)
  const startVoice = async (target: "crop" | "desc") => {
    try {
      Keyboard.dismiss(); // Hide keyboard while speaking
      ExpoSpeechRecognitionModule.stop(); 
      const res = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!res.granted) return;
      
      setVoiceTarget(target);
      setIsListening(true);
      ExpoSpeechRecognitionModule.start({ lang: language === "te" ? "te-IN" : "en-US", interimResults: true });
    } catch (e) { console.log(e); }
  };

  useSpeechRecognitionEvent("result", (event) => {
    if (!isListening) return;
    const text = event.results?.[0]?.transcript;
    
    if (text) {
      const cleanText = text.replace(/[.,?!]/g, "").trim();
      if (voiceTarget === "crop" && modalType === "crop") {
        setSearchText(cleanText);
      } else if (voiceTarget === "desc") {
        setDescription(cleanText);
      }
    }
  });

  useSpeechRecognitionEvent("end", () => {
    setIsListening(false);
    setVoiceTarget(null);
  });

  // Cleanup listener
  useEffect(() => {
    if (!isScreenFocused) {
      ExpoSpeechRecognitionModule.stop();
      setIsListening(false);
    }
    return () => {
      ExpoSpeechRecognitionModule.stop();
    };
  }, [isScreenFocused]);

  const total = (Number(quantity) || 0) * (Number(rate) || 0);

  const filteredCrops = userCrops.filter(c =>
    c.toLowerCase().includes(searchText.toLowerCase().trim())
  );

  const handleSave = async (bypassDuplicate = false) => {
    Keyboard.dismiss(); 
    if (loading) return;

    const newErrors: any = {};
    if (!crop.trim()) newErrors.crop = language === "te" ? "పంటను ఎంచుకోండి*" : "Select Crop Name*";
    if (!quantity) newErrors.quantity = language === "te" ? "పరిమాణం నమోదు చేయండి*" : "Enter Quantity*";
    if (!rate) newErrors.rate = language === "te" ? "ధర నమోదు చేయండి*" : "Enter Rate*";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    const phone = await AsyncStorage.getItem("USER_PHONE");
    if (!phone) return;

    setLoading(true);
    try {
      const userDoc = await firestore().collection("users").doc(phone).get();
      const activeSession = userDoc.data()?.activeSession;
      if (!activeSession) { setLoading(false); return; }

      const data = {
        crop: crop.trim(),
        description: description.trim(), // 🔥 Saved to DB
        quantity: Number(quantity),
        unit,
        rate: Number(rate),
        total: total,
        session: activeSession, 
        createdAt: firestore.FieldValue.serverTimestamp(),
      };

      const ref = firestore().collection("users").doc(phone).collection("sales");

      if (!editId && !bypassDuplicate) {
        const duplicateCheck = await ref
          .where("crop", "==", data.crop)
          .where("quantity", "==", data.quantity)
          .where("rate", "==", data.rate)
          .where("session", "==", activeSession)
          .get();

        if (!duplicateCheck.empty) {
          setLoading(false);
          setShowDuplicateModal(true);
          return;
        }
      }

      if (editId) await ref.doc(editId as string).update(data);
      else await ref.add(data);

      router.back();
    } catch (e) { console.log(e); }
    finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <AppHeader
        title={editId ? (language === "te" ? "అమ్మకం సవరించు" : "Edit Sale") : (language === "te" ? "అమ్మకం చేర్చండి" : "Add Sale")}
        subtitle={language === "te" ? "వివరాలు నమోదు చేయండి" : "Enter Details"}
        language={language}
      />

      <KeyboardAwareScrollView 
        enableOnAndroid={true}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, paddingBottom: 150 }}
      >
        
        {/* 🔥 OLD SESSION WARNING BANNER */}
        {activeSession && activeSession !== getCurrentSession() && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#FFFBEB", borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "#FDE68A" }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#FEF3C7", justifyContent: "center", alignItems: "center" }}>
              <Ionicons name="warning" size={22} color="#D97706" />
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={{ fontSize: 14, color: "#92400E", fontWeight: "600", marginBottom: 2 }} language={language}>
                {language === "te" ? "పాత సాగు సంవత్సరం" : "Old Active Season"}
              </AppText>
              <AppText style={{ fontSize: 13, color: "#92400E", lineHeight: 18 }} language={language}>
                {language === "te" 
                  ? `మీరు పాత సాగు సంవత్సరం (${activeSession}) లో అమ్మకం వివరాలు నమోదు చేస్తున్నారు.` 
                  : `You are adding a sale to an older season (${activeSession}).`}
              </AppText>
            </View>
          </View>
        )}

        {/* 🌾 CROP BOX */}
        <TouchableOpacity
          style={[styles.inputBox, activeInput === "crop" && styles.inputFocused, errors.crop && styles.inputError]}
          activeOpacity={1}
          onPress={() => {
            setModalType("crop");
            setActiveInput("crop");
            if (errors.crop) setErrors({ ...errors, crop: "" });
          }}
        >
          <Ionicons name="leaf-outline" size={20} color={crop ? "#16A34A" : "#9CA3AF"} />
          <View style={styles.inputWrapper}>
            <AppText style={{ color: crop ? "#1F2937" : "#9CA3AF", fontSize: 16, fontFamily: "Mandali" }}>
              {crop || (language === "te" ? "పంటను ఎంచుకోండి*" : "Select Crop*")}
            </AppText>
          </View>
          <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
        </TouchableOpacity>
        {errors.crop && <AppText style={styles.errorText} language={language}>{errors.crop}</AppText>}

        {/* 📋 HINT */}
        <View style={styles.cropHintBox}>
          <Ionicons name="bulb" size={18} color="#059669" />
          <AppText style={styles.cropHintText} language={language}>
            {language === "te"
              ? "సూచన: ప్రధాన పంట పేరునే ఎంచుకోండి (ఉదా: తాలు మిర్చి అమ్మినా 'మిర్చి' అని ఎంచుకోండి)."
              : "Tip: Select the main crop name (e.g., select 'Chilli' even for Chilli Thalu/Waste)."}
          </AppText>
        </View>

        {/* 📦 QTY & UNIT ROW */}
        <View style={{ flexDirection: "row", gap: 10, zIndex: 10 }}>
          <View style={{ flex: 1 }}>
            <TouchableOpacity
              style={[styles.inputBox, { marginBottom: 0 }, activeInput === "qty" && styles.inputFocused, errors.quantity && styles.inputError]}
              activeOpacity={1}
              onPress={() => {
                setActiveInput("qty");
                setUnitOpen(false);
                setTimeout(() => qtyRef.current?.focus(), 50); 
              }}
            >
              <Ionicons name="cube-outline" size={20} color={quantity ? "#16A34A" : "#9CA3AF"} />
              <View style={styles.inputWrapper}>
                {!quantity && activeInput !== "qty" && (
                  <AppText style={styles.placeholder}>{language === "te" ? "పరిమాణం*" : "Quantity*"}</AppText>
                )}
                <TextInput
                  ref={qtyRef}
                  value={quantity}
                  cursorColor="#16A34A"
                  selectionColor="#16A34A40"
                  onChangeText={(txt) => {
                    setQuantity(txt);
                    if (errors.quantity) setErrors({ ...errors, quantity: "" });
                  }}
                  style={[styles.input, { display: (quantity || activeInput === "qty") ? "flex" : "none" }]}
                  keyboardType="numeric"
                  onFocus={() => { setActiveInput("qty"); setUnitOpen(false); }}
                  onBlur={() => setActiveInput(null)}
                />
              </View>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.unitBox} onPress={() => { Keyboard.dismiss(); setUnitOpen(!unitOpen); }}>
            <AppText style={{fontSize: 15, color: "#1F2937", fontFamily: "Mandali"}} language={language}>
              {language === "te" ? unitMapping[unit] : unit}
            </AppText>
            <Ionicons name="chevron-down" size={16} color="#4B5563" />
          </TouchableOpacity>

          {unitOpen && (
            <View style={styles.dropdown}>
              {unitOptions.map((u) => (
                <TouchableOpacity key={u} style={styles.dropdownItem} onPress={() => { setUnit(u); setUnitOpen(false); }}>
                  <AppText language={language}>{language === "te" ? unitMapping[u] : u}</AppText>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        {errors.quantity && <AppText style={[styles.errorText, { marginTop: 4 }]} language={language}>{errors.quantity}</AppText>}

        {/* 💰 RATE BOX */}
        <TouchableOpacity
          style={[styles.inputBox, { marginTop: errors.quantity ? 10 : 16 }, activeInput === "rate" && styles.inputFocused, errors.rate && styles.inputError]}
          activeOpacity={1}
          onPress={() => {
            setActiveInput("rate");
            setUnitOpen(false);
            setTimeout(() => rateRef.current?.focus(), 50);
          }}
        >
          <Ionicons name="cash-outline" size={20} color={rate ? "#16A34A" : "#9CA3AF"} />
          <View style={styles.inputWrapper}>
            {!rate && activeInput !== "rate" && (
              <AppText style={styles.placeholder}>
                {language === "te" ? `ధర (1 ${unitMapping[unit]} కు)*` : `Rate (per 1 ${unit})*`}
              </AppText>
            )}
            <TextInput
              ref={rateRef}
              value={rate}
              cursorColor="#16A34A"
              selectionColor="#16A34A40"
              onChangeText={(txt) => {
                setRate(txt);
                if (errors.rate) setErrors({ ...errors, rate: "" });
              }}
              style={[styles.input, { display: (rate || activeInput === "rate") ? "flex" : "none" }]}
              keyboardType="numeric"
              onFocus={() => { setActiveInput("rate"); setUnitOpen(false); }}
              onBlur={() => setActiveInput(null)}
            />
          </View>
        </TouchableOpacity>
        {errors.rate && <AppText style={styles.errorText} language={language}>{errors.rate}</AppText>}

       {/* 📝 GRADE / DESCRIPTION BOX (WITH MIC & KEYBOARD) 🔥 */}
        <TouchableOpacity 
          activeOpacity={1}
          onPress={() => {
            setActiveInput("desc");
            setUnitOpen(false);
            setTimeout(() => descRef.current?.focus(), 50); // 🔥 కీబోర్డ్ ఓపెన్ అవ్వడానికి
          }}
          style={[styles.inputBox, { marginTop: errors.rate ? 10 : 16 }, activeInput === "desc" && styles.inputFocused]}
        >
          <Ionicons name="pricetag-outline" size={20} color={description ? "#16A34A" : "#9CA3AF"} />
          <View style={styles.inputWrapper}>
            {!description && activeInput !== "desc" && (
              <AppText style={styles.placeholder}>
                {language === "te" ? "రకం / గ్రేడ్ (ఉదా: తాలు, ఏరుపత్తి)" : "Grade / Type (e.g., Thalu)"}
              </AppText>
            )}
            <TextInput
              ref={descRef} // 🔥 కీబోర్డ్ రిఫరెన్స్ యాడ్ చేశాం
              value={description}
              cursorColor="#16A34A"
              selectionColor="#16A34A40"
              onChangeText={(txt) => setDescription(txt)}
              style={[styles.input, { display: (description || activeInput === "desc") ? "flex" : "none", paddingRight: 40 }]}
              onFocus={() => { setActiveInput("desc"); setUnitOpen(false); }}
              onBlur={() => setActiveInput(null)}
            />
          </View>
          {/* 🔥 MIC BUTTON FOR DESCRIPTION */}
          <TouchableOpacity 
            onPress={() => startVoice("desc")} 
          >
            <Ionicons 
              name={voiceTarget === "desc" && isListening ? "mic" : "mic-outline"} 
              size={22} 
              color={voiceTarget === "desc" && isListening ? "#EF4444" : "#9CA3AF"} 
            />
          </TouchableOpacity>
        </TouchableOpacity>

        {/* 💎 TOTAL BOX */}
        <View style={styles.totalBox}>
          <AppText style={styles.totalLabel} language={language}>{language === "te" ? "మొత్తం రాబడి" : "Total Revenue"}</AppText>
          <AppText style={styles.totalValue}>₹ {total.toLocaleString('en-IN')}</AppText>
        </View>

        {/* 💾 SAVE BTN */}
        <TouchableOpacity style={styles.saveBtn} onPress={() => handleSave(false)} disabled={loading} activeOpacity={0.8}>
          <LinearGradient colors={["#2E7D32", "#1B5E20"]} style={styles.saveInner}>
            <AppText style={styles.saveText} language={language}>
              {editId ? (language === "te" ? "సవరించండి" : "Update Sale") : (language === "te" ? "భద్రపరచండి" : "Save Sale")}
            </AppText>
          </LinearGradient>
        </TouchableOpacity>

      </KeyboardAwareScrollView>

      {/* 🟢 LOADER */}
      <AgriLoader visible={loading} type={editId ? "updating" : "saving"} language={language} />

      {/* 🌾 CROP SEARCH MODAL */}
      <Modal visible={modalType === "crop"} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <AppText style={{ fontSize: 18, fontWeight: "600" }} language={language}>{language === "te" ? "పంటను ఎంచుకోండి" : "Select Crop"}</AppText>
              <TouchableOpacity onPress={() => { setModalType(null); setActiveInput(null); ExpoSpeechRecognitionModule.stop(); setIsListening(false); }}>
                <Ionicons name="close-circle" size={30} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBar}>
              <TextInput
                autoFocus
                value={searchText}
                cursorColor="#16A34A"
                selectionColor="#16A34A40"
                placeholderTextColor={"#9CA3AF"}
                onChangeText={setSearchText}
                placeholder={language === "te" ? "పంట పేరు టైప్ చేయండి..." : "Search crop..."}
                style={[styles.searchInput, { fontFamily: 'Mandali' }]}
              />
              <TouchableOpacity onPress={() => startVoice("crop")} style={{ marginLeft: 8, padding: 6, borderRadius: 10, backgroundColor: "#eaedf2" }}>
                <Ionicons name={voiceTarget === "crop" && isListening ? "mic" : "mic-outline"} size={24} color={voiceTarget === "crop" && isListening ? "#EF4444" : "#16A34A"} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={filteredCrops}
              keyboardShouldPersistTaps="handled" 
              ListEmptyComponent={() => {
                  if (modalType === "crop") {
                      return (
                          <View style={{ padding: 20, alignItems: "center" }}>
                              <View style={{ padding: 20, alignItems: 'center' }}>
                                  <Ionicons name="information-circle-outline" size={24} color="#6B7280" style={{ marginBottom: 10 }} />
                                  <AppText style={{ color: "#4B5563", textAlign: "center", fontSize: 15, fontWeight: '500', lineHeight: 22 }}>
                                      {language === "te" ? "మొదట 'నా పొలాలు' విభాగంలో\nపంట వివరాలను నమోదు చేయండి." : "First, register your crop details in the\n'My Fields' section."}
                                  </AppText>
                                  <AppText style={{ color: "#9CA3AF", textAlign: "center", fontSize: 13, marginTop: 8 }}>
                                      {language === "te" ? "అక్కడ జోడించిన పంటలు మాత్రమే ఇక్కడ కనిపిస్తాయి." : "Only crops added there will appear here for selection."}
                                  </AppText>
                                  <TouchableOpacity
                                      activeOpacity={0.85}
                                      onPress={() => { setModalType(null); router.push("/farmer/fields"); }}
                                      style={{ marginTop: 16, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#16A34A", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 }}
                                  >
                                      <Ionicons name="add-circle-outline" size={18} color="#fff" />
                                      <AppText style={{ color: "#fff", fontWeight: "600" }}>
                                          {language === "te" ? "పంట జోడించండి" : "Add Crop"}
                                      </AppText>
                                  </TouchableOpacity>
                              </View>
                          </View>
                      );
                  }
                  return null;
              }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.item} onPress={() => { setCrop(item); setModalType(null); setActiveInput(null); ExpoSpeechRecognitionModule.stop(); setIsListening(false); }}>
                  <AppText style={styles.itemText}>{item}</AppText>
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
              {language === "te" ? "సరిగ్గా ఇదే అమ్మకం (పంట, పరిమాణం, ధర) ఇప్పటికే ఉంది.\n\nమీరు ఖచ్చితంగా మళ్లీ జతచేయాలనుకుంటున్నారా?" : "An exact sale entry (Crop, Quantity, Rate) already exists.\n\nAre you sure you want to add this duplicate entry?"}
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

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6F7F6" },
  inputBox: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderRadius: 12, paddingHorizontal: 15, height: 55, marginBottom: 16,
    borderWidth: 1, borderColor: "#D1D5DB"
  },
  inputFocused: { borderColor: "#16A34A", backgroundColor: "#FFFFFF", elevation: 2 },
  inputError: { borderColor: "#EF4444" },
  errorText: { color: "#EF4444", fontSize: 12, fontFamily: "Mandali", marginTop: -12, marginBottom: 12, marginLeft: 4 },
  inputWrapper: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  input: { flex: 1, fontSize: 16, color: "#1F2937", fontFamily: "Mandali" },
  placeholder: { position: "absolute", fontSize: 16, color: "#9CA3AF", fontFamily: "Mandali" },
  unitBox: { width: 100, height: 55, borderRadius: 12, borderWidth: 1, borderColor: "#D1D5DB", justifyContent: "center", alignItems: "center", flexDirection: "row", gap: 4, backgroundColor: "#fff" },
  dropdown: { position: "absolute", top: 60, right: 0, width: 110, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB", elevation: 5, zIndex: 1000 },
  dropdownItem: { paddingVertical: 12, paddingHorizontal: 15, borderBottomWidth: 0.5, borderBottomColor: "#F3F4F6" },
  totalBox: { marginTop: 10, padding: 18, backgroundColor: "#fff", borderRadius: 16, alignItems: "center", borderWidth: 1, borderColor: "#D1D5DB" },
  totalLabel: { fontSize: 12, color: "#6B7280", textTransform: 'uppercase', letterSpacing: 1 },
  totalValue: { fontSize: 28, fontWeight: "800", color: "#16A34A", marginTop: 4 },
  saveBtn: { marginTop: 30, borderRadius: 16, overflow: "hidden", elevation: 4 },
  saveInner: { height: 58, justifyContent: "center", alignItems: "center" },
  saveText: { color: "white", fontSize: 16, fontWeight: "600" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#fff", height: "70%", borderTopLeftRadius: 25, borderTopRightRadius: 25 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", padding: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', alignItems: "center" },
  modalTitleText: { fontSize: 18, fontWeight: '600', color: '#1F2937' },
  
  searchBar: { flexDirection: "row", margin: 20, backgroundColor: "#F3F4F6", borderRadius: 16, paddingHorizontal: 12, alignItems: "center", borderWidth: 1, borderColor: "#E5E7EB" },
  searchInput: { flex: 1, height: 50, fontSize: 16 },
  item: { padding: 20, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  itemText: { fontSize: 17, fontFamily: "Mandali" },
  cropHintBox: { backgroundColor: "#F0FDF4", padding: 12, borderRadius: 12, marginBottom: 16, flexDirection: 'row', gap: 10, borderLeftWidth: 4, borderLeftColor: '#059669' },
  cropHintText: { flex: 1, fontSize: 13, color: "#166534", lineHeight: 18 },

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