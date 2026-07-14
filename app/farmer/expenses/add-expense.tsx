// app/farmer/add-expenses.tsx

import { Ionicons } from "@expo/vector-icons";
import { executeOfflineSafeRead, executeOfflineSafeWrite, executeOfflineSafeFetch } from "@/utils/offlineHelper";

import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Keyboard,
  Modal, SafeAreaView, StatusBar,
  StyleSheet, TextInput, TouchableOpacity, View
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view"; // 🔥 PRO FIX: Smooth keyboard scrolling

import AgriLoader from "@/components/AgriLoader";
import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";
import { useIsFocused } from "@react-navigation/native";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";

// URL params helper
const getStr = (val: string | string[] | undefined) => (Array.isArray(val) ? val[0] : val || "");

export default function AddExpense() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const isScreenFocused = useIsFocused();
  const isMounted = useRef(true); // 🔥 PRO FIX: Complete leak prevention

  const editId = getStr(params.editId);

  // 🔥 INSTANT DATA LOAD FROM PARAMS
  const [crop, setCrop] = useState(getStr(params.crop));
  const [category, setCategory] = useState(getStr(params.category));
  const [amount, setAmount] = useState(getStr(params.amount));
  
  const [userCrops, setUserCrops] = useState<string[]>([]);
  
  // 🔥 States for Modal & Info Boxes
  const [modalType, setModalType] = useState<"crop" | "cat" | null>(null);
  const [searchText, setSearchText] = useState("");
  const [showLabourInfo, setShowLabourInfo] = useState(false);
  const [showRentInfo, setShowRentInfo] = useState(false);
  const [showTractorInfo, setShowTractorInfo] = useState(false); 
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState<"te" | "en">("te");
  
  const [activeInput, setActiveInput] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({}); 
  
  const [isListening, setIsListening] = useState(false);
  const [voiceTarget, setVoiceTarget] = useState<"modal" | null>(null);
  const [activeSession, setActiveSession] = useState("");
  
  const amtRef = useRef<TextInput>(null);

  const getCurrentSession = () => {
    const now = new Date();
    const year = now.getFullYear();
    const startYear = now.getMonth() >= 5 ? year : year - 1;
    return `${startYear}-${(startYear + 1).toString().slice(-2)}`;
  };

  // 🔥 FIXED REAL-WORLD FARMING CATEGORIES (NO CUSTOM ADDITIONS FOR CHART STABILITY)
const categoryOptions = [
      { en: "Seeds", te: "విత్తనాలు" },
      { en: "Fertilizers", te: "ఎరువులు" },
      { en: "Pesticides / Sprays", te: "పురుగుల మందులు / స్ప్రేలు" },
      { en: "Tractor / Machinery", te: "ట్రాక్టర్ / యంత్రాలు" },
      { en: "Daily Labour", te: "కూలీలు / రోజువారీ పనివారు" },
      { en: "Transport / Auto", te: "రవాణా / ఆటో కిరాయి" },
      { en: "Water / Motor Repair", te: "నీటి పారుదల / మోటార్ రిపేర్లు" },
      { en: "Electricity Bill", te: "కరెంట్ బిల్లు" },
      { en: "Bags / Packaging", te: "సంచులు / ప్యాకింగ్ ఖర్చులు" },
      { en: "Storage / Godown", te: "కోల్డ్ స్టోరేజ్ / గోడౌన్" },
      { en: "Hamali / Loading", te: "హమాలీ / లోడింగ్ ఖర్చులు" },
      { en: "Land Lease / Rent", te: "భూమి కౌలు" },
      { en: "Loan Interest", te: "అప్పుల వడ్డీ" },
      { en: "Crop Insurance", te: "పంట భీమా" },
      { en: "Market Commission", te: "మార్కెట్ కమిషన్" },
      { en: "Other Expenses", te: "ఇతర ఖర్చులు" }
  ];

  const isLabourCategory = (text: string) => text.includes("కూలీలు") || text.includes("Labour");
  const isRentCategory = (text: string) => text.includes("కౌలు") || text.includes("Lease");
  const isTractorCategory = (text: string) => text.includes("ట్రాక్టర్") || text.includes("Tractor");

  useEffect(() => {
    isMounted.current = true;
    const loadSession = async () => {
      const session = await AsyncStorage.getItem("ACTIVE_SESSION");
      if (session) {
        if (typeof isMounted !== 'undefined' && isMounted && !isMounted.current) {
           setActiveSession(session);
        } else if (typeof isMounted !== 'undefined' && isMounted.current) {
           setActiveSession(session);
        } else {
           setActiveSession(session);
        }
      } else {
        const phone = await AsyncStorage.getItem("USER_PHONE");
        if (phone) {
          const doc = await executeOfflineSafeRead(firestore().collection("users").doc(phone), true);
          setActiveSession(doc.data()?.activeSession || "");
        }
      }
    };
    loadSession();

    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    const loadUserCrops = async () => {
      const phone = await AsyncStorage.getItem("USER_PHONE");
      if (!phone) return;

      const landsSnap = await executeOfflineSafeRead(firestore().collection("users").doc(phone).collection("lands").where("session", "==", activeSession), true);
      const landsMap: any = {};
      landsSnap.forEach((doc: any) => { landsMap[doc.id] = doc.data().nickname; });

      const snap = await executeOfflineSafeRead(firestore()
        .collection("users")
        .doc(phone)
        .collection("fields")
        .where("session", "==", activeSession), true
        );

      const set = new Set<string>();
      snap.forEach((doc: any) => {
        const d = doc.data();
        if (d.crop) {
          const nick = landsMap[d.landId] || d.nickname;
          const formatted = nick ? `${d.crop} - ${nick}` : d.crop;
          set.add(formatted);
        }
      });

      if (isMounted.current) setUserCrops(Array.from(set));
    };

    if (activeSession) {
      loadUserCrops();
    }
  }, [activeSession]);

  useEffect(() => {
    if (editId) {
      setShowLabourInfo(isLabourCategory(category));
      setShowRentInfo(isRentCategory(category));
      setShowTractorInfo(isTractorCategory(category)); 
    }
  }, [editId, category]);

  useEffect(() => {
      AsyncStorage.getItem("APP_LANG").then(l => { if (l && isMounted.current) setLanguage(l as any); });
  }, []);

  const handlePick = (val: string) => {
    Keyboard.dismiss(); 
    if (modalType === "crop") {
      if (!userCrops.includes(val)) return;
      setCrop(val);
      setModalType(null);
      if (errors.crop) setErrors({ ...errors, crop: "" });
      setSearchText("");
      return;
    }

    setCategory(val);
    setModalType(null);
    setSearchText("");
    if (errors.category) setErrors({ ...errors, category: "" });

    setShowLabourInfo(isLabourCategory(val));
    setShowRentInfo(isRentCategory(val));
    setShowTractorInfo(isTractorCategory(val));
  };

  useEffect(() => {
    if (modalType !== null) {
      setSearchText("");
    } else {
      ExpoSpeechRecognitionModule.stop();
      setIsListening(false);
      setVoiceTarget(null);
    }
  }, [modalType]);

  const options = modalType === "crop" ? userCrops.map(c => ({ en: c, te: c })) : categoryOptions;

  const filteredData = options.filter(item => {
    const value = (language === "te" ? item.te : item.en).toLowerCase().trim();
    return (value || "").includes(searchText.toLowerCase().trim());
  });

  const handleSave = async (bypassDuplicate = false) => {
      if (loading) return; 
      Keyboard.dismiss(); 
      
      const newErrors: any = {};
      if (!crop.trim()) newErrors.crop = language === "te" ? "పంటను ఎంచుకోండి*" : "Select Crop Name*";
      if (!category.trim()) newErrors.category = language === "te" ? "ఖర్చు రకాన్ని ఎంచుకోండి*" : "Select Category*";
      if (!amount) newErrors.amount = language === "te" ? "మొత్తం నమోదు చేయండి*" : "Enter Amount*";

      if (Object.keys(newErrors).length > 0) {
          setErrors(newErrors);
          return;
      }
      setErrors({});

      const phone = await AsyncStorage.getItem("USER_PHONE");
      if (!phone || !activeSession) {
        if (isMounted.current) setLoading(false);
        return;
      }

      setLoading(true);
      const data = {
        crop: crop.trim(),
        category: category.trim(),
        amount: Number(amount),
        session: activeSession, 
        createdAt: firestore.FieldValue.serverTimestamp()
      };

      try {
          const ref = firestore().collection("users").doc(phone).collection("expenses");

          if (!editId && !bypassDuplicate) {
            const duplicateCheck = await executeOfflineSafeRead(ref
              .where("crop", "==", data.crop)
              .where("category", "==", data.category)
              .where("amount", "==", data.amount)
              .where("session", "==", activeSession), true);

            if (!duplicateCheck.empty) {
              if (isMounted.current) {
                setLoading(false);
                setShowDuplicateModal(true);
              }
              return;
            }
          }

          if (editId) {
            await executeOfflineSafeWrite(ref.doc(editId as string).update(data));
          } else {
            await executeOfflineSafeWrite(ref.add(data));
          }

          if (isMounted.current) router.back();
      } catch (e) {
        console.log("Expense save error:", e);
      } finally {
        if (isMounted.current) setLoading(false);
      }
  };

  const startVoice = async () => {
    try {
      ExpoSpeechRecognitionModule.stop(); 
      const res = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!res.granted) return;

      setVoiceTarget("modal");
      setIsListening(true);

      ExpoSpeechRecognitionModule.start({
        lang: language === "te" ? "te-IN" : "en-US",
        interimResults: true,
      });
    } catch (e) {
      console.log("voice error", e);
    }
  };

  useSpeechRecognitionEvent("result", (event) => {
    if (!isListening) return;
    if (!event.results?.length) return;

    const text = event.results[0].transcript.replace(/[.,?!]/g, "").trim();
    if (voiceTarget === "modal" && modalType !== null) {
      setSearchText(text);
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
    return () => { ExpoSpeechRecognitionModule.stop(); };
  }, [isScreenFocused]);

  return (
      <SafeAreaView style={styles.safe}>
          <StatusBar barStyle="light-content" />
          <AppHeader
              title={editId ? (language === "te" ? "ఖర్చు మార్చు" : "Edit Expense") : (language === "te" ? "ఖర్చు చేర్చండి" : "Add Expense")}
              subtitle={language === "te" ? "వివరాలు నమోదు చేయండి" : "Enter details"}
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
                        ? `మీరు పాత సాగు సంవత్సరం (${activeSession}) లో ఖర్చు వివరాలు నమోదు చేస్తున్నారు.` 
                        : `You are adding an expense to an older season (${activeSession}).`}
                    </AppText>
                  </View>
                </View>
              )}
              
              {/* 🌾 CROP NAME SELECTOR */}
              <TouchableOpacity 
                  activeOpacity={1}
                  style={[styles.inputBox, activeInput === "crop" && styles.inputFocused, errors.crop && styles.inputError]}
                  onPress={() => { setModalType("crop"); setActiveInput("crop"); }}
              >
                  <Ionicons name="leaf-outline" size={20} color={crop ? "#DC2626" : "#9CA3AF"} />
                  <View style={styles.inputWrapper}>
                      <AppText style={{ color: crop ? "#1F2937" : "#9CA3AF", fontSize: 16, fontFamily: "Mandali" }}>
                          {crop || (language === "te" ? "పంట పేరును ఎంచుకోండి*" : "Select Crop Name*")}
                      </AppText>
                  </View>
                  <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
              </TouchableOpacity>
              {errors.crop && <AppText style={styles.errorText} language={language}>{errors.crop}</AppText>}

              {/* 📂 CATEGORY SELECTOR */}
              <TouchableOpacity 
                  activeOpacity={1}
                  style={[styles.inputBox, activeInput === "cat" && styles.inputFocused, errors.category && styles.inputError]}
                  onPress={() => { setModalType("cat"); setActiveInput("cat"); }}
              >
                  <Ionicons name="grid-outline" size={20} color={category ? "#DC2626" : "#9CA3AF"} />
                  <View style={styles.inputWrapper}>
                      <AppText style={{ color: category ? "#1F2937" : "#9CA3AF", fontSize: 16, fontFamily: "Mandali" }}>
                          {category || (language === "te" ? "ఖర్చు రకాన్ని ఎంచుకోండి*" : "Select Category*")}
                      </AppText>
                  </View>
                  <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
              </TouchableOpacity>
              {errors.category && <AppText style={styles.errorText} language={language}>{errors.category}</AppText>}

              {/* 💰 AMOUNT INPUT */}
              <TouchableOpacity 
                activeOpacity={1}
                onPress={() => { setActiveInput("amt"); amtRef.current?.focus(); }}
                style={[styles.inputBox, activeInput === "amt" && styles.inputFocused, errors.amount && styles.inputError]}
              >
                  <Ionicons name="cash-outline" size={20} color={amount ? "#DC2626" : "#9CA3AF"} />
                  <View style={styles.inputWrapper}>
                      {!amount && activeInput !== "amt" && (
                          <AppText style={styles.customPlaceholder}>
                              {language === "te" ? "ఖర్చు చేసిన మొత్తం*" : "Amount Spent*"}
                          </AppText>
                      )}
                      <TextInput
                          ref={amtRef}
                          value={amount}
                          cursorColor="#DC2626"
                          selectionColor="#DC262640"
                          onChangeText={(txt) => { setAmount(txt); if(errors.amount) setErrors({...errors, amount: ""}); }}
                          style={[styles.input, { display: (amount || activeInput === "amt") ? "flex" : "none" }]}
                          keyboardType="numeric"
                          onFocus={() => setActiveInput("amt")}
                          onBlur={() => setActiveInput(null)}
                      />
                  </View>
              </TouchableOpacity>
              {errors.amount && <AppText style={styles.errorText} language={language}>{errors.amount}</AppText>}

              {/* LABOUR INFO NOTE */}
              {showLabourInfo && (
                <View style={styles.infoBox}>
                  <Ionicons name="information-circle-outline" size={18} color="#F59E0B" />
                  <AppText style={styles.infoText} language={language}>
                    {language === "te"
                      ? "గమనిక: మీరు 'కూలీల ఖాతా' ఫీచర్ వాడుతుంటే, ఆ ఖర్చులు ఆటోమేటిక్ గా లెక్కించబడతాయి. ఒకవేళ విడిగా బయట కూలీలకు డబ్బులు ఇస్తే ఇక్కడ రాసుకోవచ్చు."
                      : "Note: If you use the 'Labour Account' feature, those costs sync automatically. You can add separate daily wage payments here."}
                  </AppText>
                </View>
              )}

              {/* RENT/KAVULU INFO NOTE */}
              {showRentInfo && (
                <View style={[styles.infoBox, { borderColor: "#F87171", backgroundColor: "#FEF2F2" }]}>
                  <Ionicons name="alert-circle-outline" size={18} color="#DC2626" />
                  <AppText style={[styles.infoText, { color: "#991B1B" }]} language={language}>
                    {language === "te"
                      ? "భూమి కౌలు (Lease) వివరాలు 'నా పొలాలు' (My Fields) విభాగంలో నమోదు చేస్తే బాగుంటుంది. ఇతరత్రా అద్దెలు అయితే ఇక్కడ రాసుకోవచ్చు."
                      : "It is recommended to add Land Lease/Rent in the 'My Fields' section. You can add other rental expenses here."}
                  </AppText>
                </View>
              )}

              {/* 🔥 TRACTOR AUTO-SYNC INFO NOTE 🔥 */}
              {showTractorInfo && (
                <View style={[styles.infoBox, { borderColor: "#93C5FD", backgroundColor: "#EFF6FF" }]}>
                  <Ionicons name="sync-circle-outline" size={20} color="#2563EB" />
                  <AppText style={[styles.infoText, { color: "#1E3A8A" }]} language={language}>
                    {language === "te"
                      ? "గమనిక: 'కిరాయి పనులు' ఫీచర్ లో లాక్ చేసిన ట్రాక్టర్ ఖర్చులు ఆటోమేటిక్ గా ఇక్కడికి వస్తాయి. విడిగా యంత్రాలకు అద్దె చెల్లిస్తే ఇక్కడ నమోదు చేయండి."
                      : "Note: Expenses locked in 'Rental Works' sync automatically. Add separate manual machinery payments here."}
                  </AppText>
                </View>
              )}
              
              {/* SAVE BUTTON */}
              <TouchableOpacity style={styles.saveBtn} onPress={() => handleSave(false)} activeOpacity={0.9} disabled={loading}>
                  <LinearGradient colors={["#DC2626", "#991B1B"]} style={styles.saveGradient}>
                      <AppText style={styles.saveText}>
                          {editId ? (language === "te" ? "ఖర్చు సవరించండి" : "Update Expense") : (language === "te" ? "ఖర్చు భద్రపరచండి" : "Save Expense")}
                      </AppText>
                  </LinearGradient>
              </TouchableOpacity>
          </KeyboardAwareScrollView>

          {/* 🛠 HYBRID SELECTION MODAL */}
          <Modal visible={modalType !== null} animationType="slide" transparent>
              <View style={styles.modalOverlay}>
                  <View style={styles.modalContent}>
                      <View style={styles.modalHeader}>
                          <AppText style={styles.modalTitleText}>
                              {modalType === "crop" 
                                  ? (language === "te" ? "పంటను ఎంచుకోండి" : "Select Crop") 
                                  : (language === "te" ? "ఖర్చు రకాన్ని ఎంచుకోండి" : "Select Category")}
                          </AppText>
                          <TouchableOpacity onPress={() => { setModalType(null); setActiveInput(null); }}>
                              <Ionicons name="close-circle" size={28} color="#9CA3AF" />
                          </TouchableOpacity>
                      </View>

                      {/* ⌨️ TYPING / SEARCH AREA */}
                      <View style={styles.searchBar}>
                          <TextInput 
                              cursorColor="#DC2626"
                              placeholder={language === "te" ? "ఇక్కడ టైప్ చేయండి..." : "Type here..."}
                              style={[styles.searchInput, {fontFamily: 'Mandali'}]}
                              value={searchText}
                              placeholderTextColor={"black"}
                              onChangeText={(text) => setSearchText(text)}
                              onSubmitEditing={() => {
                                if (searchText.trim().length > 0 && modalType === "crop") handlePick(searchText);
                              }}
                          />
                          {/* 🔥 FIXED PATTERN: NO ADD CUSTOM BUTTON FOR FIXED CATEGORIES */}
                          {modalType === "crop" && searchText.trim().length > 0 && !filteredData.length && (
                            <TouchableOpacity
                              onPress={() => handlePick(searchText)}
                              style={{ backgroundColor: "#DC2626", borderRadius: 12, padding: 6, marginLeft: 6 }}
                            >
                              <Ionicons name="add" size={20} color="#fff" />
                            </TouchableOpacity>
                          )}
                          {searchText && searchText.toString().trim().length > 0 ? (
                            <TouchableOpacity onPress={() => setSearchText('')} style={{ marginLeft: 8, padding: 6, borderRadius: 10, backgroundColor: "#eaedf2" }}>
                              <Ionicons name="close-circle" size={24} color="#9CA3AF" />
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity onPress={startVoice} style={{ marginLeft: 8, padding: 6, borderRadius: 10, backgroundColor: "#eaedf2" }}>
                              <Ionicons name={isListening ? "mic" : "mic-outline"} size={24} color={isListening ? "#EF4444" : "#157c3e"} />
                            </TouchableOpacity>
                          )}
                      </View>

                      {/* 📜 LIST AREA */}
                      <FlatList
                          data={filteredData}
                          keyboardShouldPersistTaps="handled" 
                          keyExtractor={(item, index) => index.toString()}
                          contentContainerStyle={{ paddingBottom: 30 }}
                          ListEmptyComponent={() => {
                            if (modalType === "crop") {
                              return (
                                <View style={{ padding: 20, alignItems: "center" }}>
                                  <View style={{ padding: 20, alignItems: 'center' }}>
                                    <Ionicons name="information-circle-outline" size={24} color="#6B7280" style={{ marginBottom: 10 }} />
                                    <AppText style={{ color: "#4B5563", textAlign: "center", fontSize: 15, fontWeight: '500', lineHeight: 22 }}>
                                      {language === "te" ? "మొదట 'పొలాలు' విభాగంలో\nపంట వివరాలను నమోదు చేయండి." : "First, register your crop details in the\n'Fields' section."}
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
                            
                            // 🔥 CATEGORY EMPTY STATE
                            return (
                                <View style={{ padding: 20, alignItems: "center" }}>
                                  <AppText style={{ color: "#9CA3AF", fontFamily: "Mandali", fontSize: 14 }}>
                                    {language === "te" ? "ఈ పేరుతో ఖర్చు రకం లేదు. 'ఇతర ఖర్చులు' ఎంచుకోండి." : "Category not found. Please select 'Other Expenses'."}
                                  </AppText>
                                </View>
                            );
                          }}
                          renderItem={({ item }) => (
                              <TouchableOpacity 
                                  style={styles.categoryItem} 
                                  onPress={() => handlePick(language === "te" ? item.te : item.en)}
                              >
                                  <AppText style={styles.categoryItemText}>
                                      {language === "te" ? item.te : item.en}
                                  </AppText>
                                  <Ionicons name="chevron-forward" size={16} color="#E5E7EB" />
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
              {language === "te" ? "సరిగ్గా ఇదే ఖర్చు (పంట, రకం, మొత్తం) ఇప్పటికే ఉంది.\n\nమీరు ఖచ్చితంగా మళ్లీ జతచేయాలనుకుంటున్నారా?" : "An exact expense entry (Crop, Category, Amount) already exists.\n\nAre you sure you want to add this duplicate entry?"}
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

          <AgriLoader visible={loading} type="saving" language={language} />
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6F7F6" },
  container: { padding: 20, flexGrow: 1, paddingBottom: 40 },
  
  inputBox: { 
      flexDirection: "row", alignItems: "center", backgroundColor: "#F9FAFB", 
      borderRadius: 12, paddingHorizontal: 15, height: 55, marginBottom: 16, 
      borderWidth: 1, borderColor: "#D1D5DB" 
  },
  inputFocused: { 
      borderColor: "#DC2626", 
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
  customPlaceholder: {
      position: 'absolute',
      fontSize: 16,
      color: "#9CA3AF",
      fontFamily: "Mandali"
  },
  
  saveBtn: { marginTop: 10, borderRadius: 18, overflow: "hidden", elevation: 4 },
  saveGradient: { height: 56, justifyContent: "center", alignItems: "center" },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: 'white', borderTopLeftRadius: 25, borderTopRightRadius: 25, height: '75%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalTitleText: { fontSize: 18, fontWeight: '600', color: '#1F2937' },
  
  searchBar: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', 
    margin: 20, borderRadius: 18, paddingHorizontal: 12, borderWidth: 1, borderColor: '#E5E7EB'
  },
  searchInput: { flex: 1, height: 54, fontSize: 16, color: '#1F2937' },
  
  categoryItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  categoryItemText: { fontSize: 16, color: '#374151' },
  
  infoBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "#FFFBEB", borderRadius: 14, padding: 12,
    marginTop: -6, marginBottom: 10, borderWidth: 1, borderColor: "#FDE68A"
  },
  infoText: {
    flex: 1, fontSize: 13, color: "#92400E", lineHeight: 18, fontFamily: "Mandali"
  },
  option: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9"
  },

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