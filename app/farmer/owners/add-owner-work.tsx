// app/farmer/owner-work/add-owner-work.tsx (or wherever your file is)

import AgriLoader from "@/components/AgriLoader";
import { executeOfflineSafeRead, executeOfflineSafeWrite, executeOfflineSafeFetch } from "@/utils/offlineHelper";

import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import firestore from "@react-native-firebase/firestore";
import { useIsFocused } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Keyboard,
  Modal,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

export default function AddOwnerWork() {
  const acresInputRef = useRef<TextInput>(null);
  const [language, setLanguage] = useState<"te" | "en">("te");
  const [activeSession, setActiveSession] = useState("");

  const [activeInput, setActiveInput] = useState<string | null>(null);
  const [workType, setWorkType] = useState<"time" | "acres" | null>(null);
  const [showTypeModal, setShowTypeModal] = useState(true); 

  const isFocused = useIsFocused();
  const [isListening, setIsListening] = useState(false);
  const [voiceTarget, setVoiceTarget] = useState<"crop" | "work" | "notes" | null>(null);

  const [date, setDate] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [crop, setCrop] = useState("");
  const [work, setWork] = useState("");

  const [modalType, setModalType] = useState<"crop" | "work" | null>(null);
  const [searchText, setSearchText] = useState("");

  const [acres, setAcres] = useState("");
  
  // 🔥 TIME BASED
  const [hrs, setHrs] = useState("");
  const [mins, setMins] = useState("");
  const [ratePerHour, setRatePerHour] = useState(""); 
  const hrsInputRef = useRef<TextInput>(null);
  const minsInputRef = useRef<TextInput>(null);
  const rateInputRef = useRef<TextInput>(null); 

  // 🔥 ACRES / SAALLU BASED
  const [ratePerAcre, setRatePerAcre] = useState(""); 
  const rateAcreInputRef = useRef<TextInput>(null);

  const [saalluCount, setSaalluCount] = useState(""); 
  const [ratePerSaalu, setRatePerSaalu] = useState(""); 
  const saalluInputRef = useRef<TextInput>(null);
  const rateSaaluInputRef = useRef<TextInput>(null);

  const [payableAmount, setPayableAmount] = useState(""); 
  const [advanceAmount, setAdvanceAmount] = useState("0"); 

  const payableInputRef = useRef<TextInput>(null);
  const advanceInputRef = useRef<TextInput>(null);

  const [notes, setNotes] = useState("");
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [errorModal, setErrorModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [errors, setErrors] = useState<{ [key: string]: string }>({}); 
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  
  const { ownerId } = useLocalSearchParams(); 

  const notesInputRef = useRef<TextInput>(null);
  const isMounted = useRef(true); 

  // 🔥 FETCH CROPS FROM FIELDS
  const [userCrops, setUserCrops] = useState<string[]>([]);
  const [userCropAcresMap, setUserCropAcresMap] = useState<Record<string, number>>({});

  useEffect(() => {
    isMounted.current = true;
    const loadUserCrops = async () => {
      const phone = await AsyncStorage.getItem("USER_PHONE");
      if (!phone) return;

      const userDoc = await executeOfflineSafeRead(firestore().collection("users").doc(phone));
      const activeSession = userDoc.data()?.activeSession;
      if (!activeSession) return; 
      if (isMounted.current) setActiveSession(activeSession);

      const landsSnap = await executeOfflineSafeRead(firestore().collection("users").doc(phone).collection("lands").where("session", "==", activeSession));
      const landsMap: any = {};
      landsSnap.forEach((doc: any) => { landsMap[doc.id] = doc.data().nickname; });

      const snap = await executeOfflineSafeRead(firestore()
        .collection("users")
        .doc(phone)
        .collection("fields")
        .where("session", "==", activeSession) 
        );

      const set = new Set<string>();
      const map: Record<string, number> = {};
      snap.forEach((doc: any) => {
        const data = doc.data();
        if (data.crop) {
          const nick = landsMap[data.landId] || data.nickname;
          const formatted = nick ? `${data.crop} - ${nick}` : data.crop;
          set.add(formatted);
          const ac = parseFloat(data.acres) || 0;
          if (!map[formatted]) map[formatted] = 0;
          map[formatted] += ac;
        }
      });
      if (isMounted.current) {
        setUserCrops(Array.from(set));
        setUserCropAcresMap(map);
      }
    };
    loadUserCrops();

    return () => {
      isMounted.current = false;
    };
  }, []);

  const getCurrentSession = () => {
    const now = new Date();
    const year = now.getFullYear();
    const startYear = now.getMonth() >= 5 ? year : year - 1;
    return `${startYear}-${(startYear + 1).toString().slice(-2)}`;
  };

  // 🔥 NEW CALCULATION LOGIC
  useEffect(() => {
    if (workType === "time") {
      const h = parseFloat(hrs) || 0;
      const m = parseFloat(mins) || 0;
      const r = parseFloat(ratePerHour) || 0;
      const totalInHrs = h + (m / 60);
      setPayableAmount(Math.round(totalInHrs * r).toString());
    } else if (workType === "acres") {
      if (ratePerAcre) {
        // 🔥 Rate Per Acre Logic
        const a = parseFloat(acres) || 0;
        const r = parseFloat(ratePerAcre) || 0;
        setPayableAmount(Math.round(a * r).toString());
      } else {
        // 🔥 Saallu Logic
        const count = parseFloat(saalluCount) || 0;
        const rate = parseFloat(ratePerSaalu) || 0;
        setPayableAmount(Math.round(count * rate).toString());
      }
    }
  }, [hrs, mins, ratePerHour, acres, ratePerAcre, saalluCount, ratePerSaalu, workType]);

  const getCalculationDetails = () => {
    if (workType === "time") {
      const h = parseFloat(hrs) || 0;
      const m = parseFloat(mins) || 0;
      const r = parseFloat(ratePerHour) || 0;
      const totalInHrs = h + (m / 60);
      const totalAmount = totalInHrs * r;

      return {
        amount: totalAmount.toFixed(0),
        calcStep: language === "te" ? `${h} గం ${m} ని × ₹${r}` : `${h} hr ${m} min × ₹${r}`,
        hasValue: (h > 0 || m > 0) && r > 0
      };
    }

    if (workType === "acres") {
      if (ratePerAcre) {
        const a = parseFloat(acres) || 0;
        const r = parseFloat(ratePerAcre) || 0;
        return {
          amount: (a * r).toFixed(0),
          calcStep: language === "te" ? `${a} ఎకరాలు × ₹${r}` : `${a} Acres × ₹${r}`,
          hasValue: a > 0 && r > 0
        };
      } else {
        const s = parseFloat(saalluCount) || 0;
        const r = parseFloat(ratePerSaalu) || 0;
        return {
          amount: (s * r).toFixed(0),
          calcStep: language === "te" ? `${s} సాళ్లు × ₹${r}` : `${s} Saallu × ₹${r}`,
          hasValue: s > 0 && r > 0
        };
      }
    }

    return { amount: "0", calcStep: "", hasValue: false };
  };

  const getFinalAmount = () => {
    const p = parseFloat(payableAmount) || 0;
    const a = parseFloat(advanceAmount) || 0;
    const final = p - a;
    return (final < 0 ? 0 : final).toLocaleString('en-IN');
  };

const workOptions = [
    { "en": "Combine Harvesting (Paddy)", "te": "వరి కోత (హార్వెస్టర్)" },
    { "en": "MB Ploughing", "te": "మడక దుక్కి (పెద్ద నాగలి)" },
    { "en": "Cultivator Ploughing", "te": "కల్టివేటర్ దుక్కి" },
    { "en": "Rotavator", "te": "రోటవేటర్" },
    { "en": "Blade Harrowing (Gorru)", "te": "గొర్రు తోలడం" },
    { "en": "Disc Harrow", "te": "డిస్క్ హారో" },
    { "en": "Leveler / Blade", "te": "లెవలింగ్ / బ్లేడ్" },
    { "en": "Seed Drilling", "te": "విత్తనాలు వేయడం" },
    { "en": "Bund Forming (Gattu)", "te": "గట్టు వేయడం" },
    { "en": "Post Hole Digger", "te": "గుంతలు తీయడం (పోస్ట్ హోల్)" },
    { "en": "Maize Shelling", "te": "మొక్కజొన్న వొలవడం" },
    { "en": "Paddy Threshing", "te": "వరి నూర్పిడి" },
    { "en": "Machine Spraying", "te": "మెషిన్ ద్వారా మందు కొట్టడం" },
    { "en": "Drip Pipe Laying", "te": "డ్రిప్ పైపులు పరచడం" },
    { "en": "Trolley / Transport", "te": "ట్రాలీ / రవాణా" },
    { "en": "Other Machine Work", "te": "ఇతర యంత్రం పని" },
];


  const handleVoiceInput = async (target: "crop" | "work" | "notes") => {
    setVoiceTarget(target);
    const res = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!res.granted) return;
    setIsListening(true);
    ExpoSpeechRecognitionModule.start({ lang: language === "te" ? "te-IN" : "en-US", interimResults: true });
  };

  useSpeechRecognitionEvent("result", (event) => {
    if (!isFocused) return;
    if (!event.results || event.results.length === 0) return;
    const text = event.results[0].transcript;
    if (voiceTarget === "crop") { setCrop(text); setSearchText(text); } 
    else if (voiceTarget === "work") { setWork(text); setSearchText(text); } 
    else if (voiceTarget === "notes") { setNotes((prev) => prev ? prev + " " + text : text); }
  });

  useSpeechRecognitionEvent("end", () => {
    setIsListening(false);
    setVoiceTarget(null);
  });

  useEffect(() => {
    return () => ExpoSpeechRecognitionModule.stop();
  }, []);

  /* ---------------- SAVE (DUPLICATE CHECK) ---------------- */
  const handleSave = async () => {
    if (saving) return;
    Keyboard.dismiss(); 

    const newErrors: any = {};
    if (!date) newErrors.date = language === "te" ? "తేదీని ఎంచుకోండి*" : "Select Date*";
    if (!crop) newErrors.crop = language === "te" ? "పంటను ఎంచుకోండి*" : "Select Crop*";
    if (!work) newErrors.work = language === "te" ? "పనిని ఎంచుకోండి*" : "Select Work*";
    
    if (workType === "acres") {
      if (!acres) {
        newErrors.acres = language === "te" ? "ఎకరాలు నమోదు చేయండి*" : "Enter Acres*";
      } else if (crop && userCropAcresMap[crop]) {
        const maxAcres = userCropAcresMap[crop];
        if (parseFloat(acres) > maxAcres) {
          newErrors.acres = language === "te" 
            ? `ఎకరాలు దాటింది! (గరిష్టం: ${maxAcres})*` 
            : `Exceeded limit! (Max: ${maxAcres})*`;
        }
      }
      // 🔥 EITHER Rate Per Acre OR Saallu Details MUST be filled
      if (!ratePerAcre && (!saalluCount || !ratePerSaalu)) {
        newErrors.rateError = language === "te" ? "దయచేసి ఎకరాల లెక్క లేదా సాళ్ల లెక్క ధర నమోదు చేయండి*" : "Please enter Rate per Acre OR Saallu Details*";
      }
    }

    if (workType === "time") {
      if (!hrs && !mins) newErrors.duration = language === "te" ? "సమయాన్ని నమోదు చేయండి*" : "Enter Duration*";
      if (!ratePerHour) newErrors.ratePerHour = language === "te" ? "ధరను నమోదు చేయండి*" : "Enter Rate*";
    }

    if (!payableAmount || payableAmount === "0") newErrors.payableAmount = language === "te" ? "మొత్తం నమోదు చేయండి*" : "Enter Amount*";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    try {
      setSaving(true);
      const phone = await AsyncStorage.getItem("USER_PHONE");
      const userDoc = await executeOfflineSafeRead(firestore().collection("users").doc(phone!));
      const activeSession = userDoc.data()?.activeSession;
      const oId = Array.isArray(ownerId) ? ownerId[0] : ownerId;

      if (!activeSession) { setSaving(false); return; }

      const existingSnap = await executeOfflineSafeRead(firestore()
        .collection("users").doc(phone!)
        .collection("owners").doc(oId)
        .collection("entries")
        .where("session", "==", activeSession)
        .where("date", "==", date) 
        );

      let isDuplicate = false;
      existingSnap.forEach((doc: any) => {
        const d = doc.data();
        if (d.crop === crop.trim() && d.work === work.trim()) {
          if (workType === "acres" && d.acres === acres.trim()) isDuplicate = true;
          else if (workType === "time") isDuplicate = true;
        }
      });

      if (isDuplicate) {
        setSaving(false);
        setShowDuplicateModal(true); 
        return;
      }

      await executeSave();

    } catch (e) {
      console.log("Check Error: ", e);
      setSaving(false);
    }
  };

  /* ---------------- FINAL EXECUTE SAVE ---------------- */
  const executeSave = async () => {
    try {
      setShowDuplicateModal(false);
      setSaving(true);

      const phone = await AsyncStorage.getItem("USER_PHONE");
      const userDoc = await executeOfflineSafeRead(firestore().collection("users").doc(phone!));
      const activeSession = userDoc.data()?.activeSession;
      const oId = Array.isArray(ownerId) ? ownerId[0] : ownerId;

      await executeOfflineSafeWrite(firestore()
        .collection("users").doc(phone!)
        .collection("owners").doc(oId)
        .collection("entries")
        .add({
          date,
          crop: crop.trim(),
          work: work.trim(),
          acres: acres.trim(),
          workType,
          hrs: hrs.trim(),
          mins: mins.trim(),
          ratePerHour: ratePerHour.trim(),
          ratePerAcre: ratePerAcre.trim(), // 🔥 NEW
          saalluCount: saalluCount.trim(),
          ratePerSaalu: ratePerSaalu.trim(),
          payableAmount: payableAmount.trim(),
          advanceAmount: advanceAmount.trim(),
          finalAmount: getFinalAmount(),
          notes: notes.trim(),
          paymentStatus: "pending", 
          session: activeSession,
          createdAt: firestore.FieldValue.serverTimestamp()
        }));

      setTimeout(() => {
        if (isMounted.current) {
          setSaving(false);
          router.back();
        }
      }, 500); 

    } catch (e) {
      console.log("Save Error: ", e);
      setSaving(false);
    }
  };

  useEffect(() => {
    AsyncStorage.getItem("APP_LANG").then((l) => {
      if (l && isMounted.current) setLanguage(l as any);
    });
  }, []);

  const filteredCrops = userCrops.filter(c => c.toLowerCase().includes(searchText.toLowerCase().trim()));
  const filteredWorks = workOptions.filter(item => {
    const value = (language === "te" ? item.te : item.en).toLowerCase().trim();
    return value.includes(searchText.toLowerCase().trim());
  });

  const listData = modalType === "crop"
    ? filteredCrops.map(c => ({ id: c, label: c }))
    : filteredWorks.map(w => ({ id: w.en, label: language === "te" ? w.te : w.en }));

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />

      <AppHeader
        title={language === "te" ? "పని నమోదు" : "Add Work"}
        subtitle={language === "te" ? "వివరాలు నమోదు చేయండి" : "Enter details"}
        language={language}
      />

      <KeyboardAwareScrollView 
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }} 
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
              <AppText style={{ fontSize: 14, color: "#92400E", fontWeight: "600", marginBottom: 2 }} language={language}>
                {language === "te" ? "పాత సాగు సంవత్సరం" : "Old Active Season"}
              </AppText>
              <AppText style={{ fontSize: 13, color: "#92400E", lineHeight: 18 }} language={language}>
                {language === "te" 
                  ? `మీరు పాత సాగు సంవత్సరం (${activeSession}) లో యజమాని పని వివరాలు నమోదు చేస్తున్నారు.` 
                  : `You are adding owner work to an older season (${activeSession}).`}
              </AppText>
            </View>
          </View>
        )}
  
        {/* 📋 SECTION 1: WORK DETAILS */}
        <View style={styles.sectionHeader}>
           <AppText style={styles.sectionTitle}>
             {language === "te" ? "పని వివరాలు" : "Work Details"}
           </AppText>
        </View>

        {/* 📅 DATE */}
        <TouchableOpacity activeOpacity={0.8} style={[styles.inputBox, activeInput === "date" && styles.inputFocused, errors.date && styles.inputError]} onPress={() => { setActiveInput("date"); setShowDatePicker(true); if (errors.date) setErrors({ ...errors, date: "" }); }}>
          <Ionicons name="calendar-outline" size={20} color={date || activeInput === "date" ? "#16A34A" : "#9CA3AF"} />
          <View style={styles.inputWrapper}>
            <AppText style={{ color: date ? "#1F2937" : "#9CA3AF", fontFamily: "Mandali" }}>{date || (language === "te" ? "తేదీ ఎంచుకోండి*" : "Select Date*")}</AppText>
          </View>
        </TouchableOpacity>
        {errors.date && <AppText style={styles.errorText} language={language}>{errors.date}</AppText>}

        {/* 🌾 CROP */}
        <TouchableOpacity activeOpacity={0.7} style={[styles.inputBox, activeInput === "crop" && styles.inputFocused, errors.crop && styles.inputError]} onPress={() => { setModalType("crop"); setActiveInput("crop"); setSearchText(""); if (errors.crop) setErrors({ ...errors, crop: "" }); }}>
          <Ionicons name="leaf-outline" size={20} color={crop || activeInput === "crop" ? "#16A34A" : "#9CA3AF"} />
          <View style={styles.inputWrapper}>
            <AppText style={{ color: crop ? "#1F2937" : "#9CA3AF", fontFamily: "Mandali" }}>{crop || (language === "te" ? "పంట ఎంచుకోండి*" : "Select Crop*")}</AppText>
          </View>
          <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
        </TouchableOpacity>
        {errors.crop && <AppText style={styles.errorText} language={language}>{errors.crop}</AppText>}

        {/* 🛠 WORK */}
        <TouchableOpacity activeOpacity={0.7} style={[styles.inputBox, activeInput === "work" && styles.inputFocused, errors.work && styles.inputError]} onPress={() => { setModalType("work"); setActiveInput("work"); setSearchText(""); if (errors.work) setErrors({ ...errors, work: "" }); }}>
          <MaterialCommunityIcons name="tractor" size={20} color={work || activeInput === "work" ? "#16A34A" : "#9CA3AF"} />
          <View style={styles.inputWrapper}>
            <AppText style={{ color: work ? "#1F2937" : "#9CA3AF", fontFamily: "Mandali" }}>{work || (language === "te" ? "పని ఎంచుకోండి*" : "Select Work*")}</AppText>
          </View>
          <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
        </TouchableOpacity>
        {errors.work && <AppText style={styles.errorText} language={language}>{errors.work}</AppText>}

        {/* 📏 ACRES */}
        {workType === "acres" && (
          <>
            <TouchableOpacity activeOpacity={1} style={[styles.inputBox, activeInput === "acres" && styles.inputFocused, errors.acres && styles.inputError]} onPress={() => { setActiveInput("acres"); acresInputRef.current?.focus(); }}>
              <Ionicons name="resize-outline" size={20} color={acres || activeInput === "acres" ? "#16A34A" : "#9CA3AF"} />
              <View style={styles.inputWrapper}>
                {!acres && activeInput !== "acres" && (<AppText style={{ color: "#9CA3AF", fontFamily: "Mandali" }}>{language === "te" ? "ఎకరాలు నమోదు చేయండి*" : "Enter Acres*"}</AppText>)}
                <TextInput ref={acresInputRef} value={acres} onChangeText={(txt) => { setAcres(txt); if (errors.acres) setErrors({ ...errors, acres: "" }); }} keyboardType="numeric" style={[styles.input, { display: (acres || activeInput === "acres") ? "flex" : "none" }]} cursorColor="#16A34A" selectionColor="#16A34A40" onFocus={() => setActiveInput("acres")} onBlur={() => setActiveInput(null)} />
              </View>
              {acres.length > 0 && (<AppText style={styles.unitText}>{language === "te" ? "ఎకరాలు" : "Acres"}</AppText>)}
            </TouchableOpacity>
            {errors.acres && <AppText style={styles.errorText} language={language}>{errors.acres}</AppText>}
          </>
        )}
        
        <View style={styles.divider} />

        {/* 🛠️ CONDITIONAL SECTION BASED ON WORK TYPE */}
        <View style={styles.sectionHeader}>
          <AppText style={styles.sectionTitle}>
            {language === "te" ? "ధర వివరాలు" : "Rate Details"}
          </AppText>
        </View>

        {/* 📏 ACRES / SAALLU MUTUALLY EXCLUSIVE INPUTS */}
        {workType === "acres" ? (
          <View style={{ marginBottom: errors.rateError ? 0 : 16 }}>
            
            {/* --- OPTION 1: RATE PER ACRE --- */}
            <AppText style={styles.label}>
              {language === "te" ? "ఎకరాల లెక్క (హార్వెస్టర్ / వరికోత మిషన్)" : "Per Acre Based (Harvester / etc.)"}
            </AppText>
            <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
              <View style={[styles.inputBox, { flex: 1, marginBottom: 0, backgroundColor: "#F3F4F6", borderColor: "#E5E7EB" }]}>
                <Ionicons name="resize-outline" size={18} color="#9CA3AF" />
                <View style={styles.inputWrapper}>
                  <AppText style={{ color: acres ? "#111827" : "#9CA3AF", fontSize: 16, fontWeight: "600" }}>
                    {acres || "0"} <AppText style={{fontSize: 12}}>{language === "te" ? "ఎకరాలు" : "Acres"}</AppText>
                  </AppText>
                </View>
              </View>
              
              <View style={{ justifyContent: 'center' }}>
                <AppText style={{ fontSize: 18, fontWeight: 'bold', color: '#9CA3AF' }}>×</AppText>
              </View>

              <TouchableOpacity activeOpacity={1}
                style={[styles.inputBox, { flex: 1.2, marginBottom: 0 }, activeInput === "rateAcre" && styles.inputFocused, errors.rateError && !ratePerAcre && styles.inputError]}
                onPress={() => { setActiveInput("rateAcre"); rateAcreInputRef.current?.focus(); }}
              >
                <Ionicons name="cash-outline" size={20} color={ratePerAcre ? "#16A34A" : "#9CA3AF"} />
                <View style={styles.inputWrapper}>
                  {!ratePerAcre && activeInput !== "rateAcre" && (
                    <AppText style={{ color: "#9CA3AF", fontSize: 13, fontFamily: "Mandali" }}>{language === "te" ? "ఎకరాకు ధర (₹)" : "Rate/Acre (₹)"}</AppText>
                  )}
                  <TextInput
                    ref={rateAcreInputRef} value={ratePerAcre}
                    onChangeText={(txt) => {
                      setRatePerAcre(txt);
                      setSaalluCount(""); setRatePerSaalu("");
                      if (errors.rateError) setErrors({ ...errors, rateError: "" });
                    }}
                    keyboardType="numeric" cursorColor="#16A34A" selectionColor="#16A34A40"
                    style={[styles.input, { display: (ratePerAcre || activeInput === "rateAcre") ? "flex" : "none" }]}
                    onFocus={() => setActiveInput("rateAcre")} onBlur={() => setActiveInput(null)}
                  />
                </View>
              </TouchableOpacity>
            </View>

            {/* --- OR DIVIDER --- */}
            <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 16}}>
              <View style={{flex: 1, height: 1, backgroundColor: '#E5E7EB'}}/>
              <AppText style={{marginHorizontal: 10, color: '#6B7280', fontSize: 14, fontWeight: '600'}}>{language === 'te' ? "లేదా" : "OR"}</AppText>
              <View style={{flex: 1, height: 1, backgroundColor: '#E5E7EB'}}/>
            </View>

            {/* --- OPTION 2: SAALLU BASED --- */}
            <AppText style={styles.label}>
              {language === "te" ? "సాళ్ల లెక్క (దుక్కి / గొర్రు / గుంటక)" : "Saallu Based (Ploughing / etc.)"}
            </AppText>
            <View style={{ flexDirection: "row", gap: 12, marginBottom: 8 }}>
              <TouchableOpacity activeOpacity={1}
                style={[styles.inputBox, { flex: 1, marginBottom: 0 }, activeInput === "saallu" && styles.inputFocused, errors.rateError && !saalluCount && styles.inputError]}
                onPress={() => { setActiveInput("saallu"); saalluInputRef.current?.focus(); }}
              >
                <Ionicons name="list-outline" size={20} color={saalluCount ? "#16A34A" : "#9CA3AF"} />
                <View style={styles.inputWrapper}>
                  {!saalluCount && activeInput !== "saallu" && (
                    <AppText style={{ color: "#9CA3AF", fontSize: 13, fontFamily: "Mandali" }}>{language === "te" ? "సాళ్ల సంఖ్య" : "No. Saallu"}</AppText>
                  )}
                  <TextInput
                    ref={saalluInputRef} value={saalluCount}
                    onChangeText={(txt) => {
                      setSaalluCount(txt);
                      setRatePerAcre(""); 
                      if (errors.rateError) setErrors({ ...errors, rateError: "" });
                    }}
                    keyboardType="numeric" cursorColor="#16A34A" selectionColor="#16A34A40"
                    style={[styles.input, { display: (saalluCount || activeInput === "saallu") ? "flex" : "none" }]}
                    onFocus={() => setActiveInput("saallu")} onBlur={() => setActiveInput(null)}
                  />
                </View>
              </TouchableOpacity>

              <View style={{ justifyContent: 'center' }}>
                <AppText style={{ fontSize: 18, fontWeight: 'bold', color: '#9CA3AF' }}>×</AppText>
              </View>

              <TouchableOpacity activeOpacity={1}
                style={[styles.inputBox, { flex: 1.2, marginBottom: 0 }, activeInput === "rateSaalu" && styles.inputFocused, errors.rateError && !ratePerSaalu && styles.inputError]}
                onPress={() => { setActiveInput("rateSaalu"); rateSaaluInputRef.current?.focus(); }}
              >
                <Ionicons name="cash-outline" size={20} color={ratePerSaalu ? "#16A34A" : "#9CA3AF"} />
                <View style={styles.inputWrapper}>
                  {!ratePerSaalu && activeInput !== "rateSaalu" && (
                    <AppText style={{ color: "#9CA3AF", fontSize: 13, fontFamily: "Mandali" }}>{language === "te" ? "సాళ్లుకు ధర (₹)" : "Rate/Saalu (₹)"}</AppText>
                  )}
                  <TextInput
                    ref={rateSaaluInputRef} value={ratePerSaalu}
                    onChangeText={(txt) => {
                      setRatePerSaalu(txt);
                      setRatePerAcre("");
                      if (errors.rateError) setErrors({ ...errors, rateError: "" });
                    }}
                    keyboardType="numeric" cursorColor="#16A34A" selectionColor="#16A34A40"
                    style={[styles.input, { display: (ratePerSaalu || activeInput === "rateSaalu") ? "flex" : "none" }]}
                    onFocus={() => setActiveInput("rateSaalu")} onBlur={() => setActiveInput(null)}
                  />
                </View>
              </TouchableOpacity>
            </View> 

            {errors.rateError && (<AppText style={[styles.errorText, { marginTop: 4, marginBottom: 10 }]} language={language}>{errors.rateError}</AppText>)}

            <View style={{ paddingHorizontal: 4, marginTop: 5 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <Ionicons name="information-circle-outline" size={16} color="#059669" style={{ marginTop: 2 }} />
                <View style={{ marginLeft: 6, flex: 1 }}>
                  <AppText style={{ fontSize: 13, color: "#166534", lineHeight: 20, fontFamily: "Mandali" }}>
                    {language === "te" ? `గమనిక: మీ ${acres || 'మొత్తం'} ఎకరాలకు కలిపి సాళ్లు వేయాలి (ఉదా: 2 ఎకరాలు × 2 సార్లు = 4 సాళ్లు).` : `Note: Enter total Saallu for your ${acres || 'total'} acres combined (Ex: 2 Acres × 2 Times = 4 Saallu).`}
                  </AppText>
                </View>
              </View>
           </View>  
          </View>

        ) : (
          <View>
            {/* 🕒 TIME BASED INPUTS */}
            <View style={{ marginBottom: errors.duration ? 0 : 16 }}>
              <AppText style={styles.label}>{language === "te" ? "పని చేసిన సమయం (గంటలు : నిమిషాలు)*" : "Work Duration (Hours : Minutes)*"}</AppText>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <TouchableOpacity activeOpacity={1} style={[styles.inputBox, { flex: 1, marginBottom: 0 }, activeInput === "hrs" && styles.inputFocused, errors.duration && styles.inputError]} onPress={() => { setActiveInput("hrs"); hrsInputRef.current?.focus(); }}>
                  <View style={styles.inputWrapper}>
                    {!hrs && activeInput !== "hrs" && (<AppText style={{ color: "#9CA3AF" }}>00</AppText>)}
                    <TextInput ref={hrsInputRef} value={hrs} onChangeText={(txt) => { setHrs(txt); if (errors.duration) setErrors({ ...errors, duration: "" }); }} keyboardType="numeric" maxLength={2} style={[styles.input, { textAlign: 'center', display: (hrs || activeInput === "hrs") ? "flex" : "none" }]} cursorColor="#16A34A" selectionColor="#16A34A40" onFocus={() => setActiveInput("hrs")} onBlur={() => setActiveInput(null)} />
                  </View>
                  <AppText style={{ fontSize: 14, color: "#2E7D32", fontWeight: '600' }}>{language === "te" ? "గం" : "Hrs"}</AppText>
                </TouchableOpacity>

                <AppText style={{ fontSize: 24, fontWeight: "bold", color: "#9CA3AF" }}>:</AppText>

                <TouchableOpacity activeOpacity={1} style={[styles.inputBox, { flex: 1, marginBottom: 0 }, activeInput === "mins" && styles.inputFocused, errors.duration && styles.inputError]} onPress={() => { setActiveInput("mins"); minsInputRef.current?.focus(); }}>
                  <View style={styles.inputWrapper}>
                    {!mins && activeInput !== "mins" && (<AppText style={{ color: "#9CA3AF" }}>00</AppText>)}
                    <TextInput ref={minsInputRef} value={mins} onChangeText={(val) => { if (parseInt(val) < 60 || val === "") setMins(val); if (errors.duration) setErrors({ ...errors, duration: "" }); }} keyboardType="numeric" maxLength={2} style={[styles.input, { textAlign: 'center', display: (mins || activeInput === "mins") ? "flex" : "none" }]} cursorColor="#16A34A" selectionColor="#16A34A40" onFocus={() => setActiveInput("mins")} onBlur={() => setActiveInput(null)} />
                  </View>
                  <AppText style={{ fontSize: 14, color: "#2E7D32", fontWeight: '600' }}>{language === "te" ? "నిమి" : "Min"}</AppText>
                </TouchableOpacity>
              </View>
            </View>
            {errors.duration && <AppText style={[styles.errorText, { marginTop: 4, marginBottom: 16 }]} language={language}>{errors.duration}</AppText>}

            <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
              <TouchableOpacity activeOpacity={1} style={[styles.inputBox, { flex: 1.5, marginBottom: 0 }, activeInput === "rate" && styles.inputFocused, errors.ratePerHour && styles.inputError]} onPress={() => { setActiveInput("rate"); rateInputRef.current?.focus(); }}>
                <Ionicons name="cash-outline" size={20} color={ratePerHour || activeInput === "rate" ? "#16A34A" : "#9CA3AF"} />
                <View style={styles.inputWrapper}>
                  {!ratePerHour && activeInput !== "rate" && (<AppText style={{ color: "#9CA3AF", fontFamily: "Mandali" }}>{language === "te" ? "గంటకు ధర (₹)*" : "Rate per Hr (₹)*"}</AppText>)}
                  <TextInput ref={rateInputRef} value={ratePerHour} onChangeText={(txt) => { setRatePerHour(txt); if (errors.ratePerHour) setErrors({ ...errors, ratePerHour: "" }); }} keyboardType="numeric" style={[styles.input, { display: (ratePerHour || activeInput === "rate") ? "flex" : "none" }]} cursorColor="#16A34A" selectionColor="#16A34A40" onFocus={() => setActiveInput("rate")} onBlur={() => setActiveInput(null)} />
                </View>
              </TouchableOpacity>
            </View>
            {errors.ratePerHour && <AppText style={[styles.errorText, { marginTop: 4 }]} language={language}>{errors.ratePerHour}</AppText>}
          </View>
        )}

        {/* 💡 DYNAMIC CALCULATION INFO BOX */}
        {getCalculationDetails().hasValue ? (
          <View style={styles.calculationInfoBox}>
            <View style={styles.infoIconWrapper}>
              <Ionicons name="calculator" size={16} color="#2E7D32" />
            </View>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <AppText style={styles.calcLabel}>{language === "te" ? "లెక్కించిన విధానం:" : "Calculation:"}</AppText>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <AppText style={styles.calcStepText}>{getCalculationDetails().calcStep}</AppText>
                <AppText style={styles.equalSign}> = </AppText>
                <AppText style={styles.finalCalcAmount}>₹{getCalculationDetails().amount}</AppText>
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.divider} />
        <View style={styles.sectionHeader}><AppText style={styles.sectionTitle}>{language === "te" ? "చెల్లింపు వివరాలు" : "Billing Details"}</AppText></View>

        <View style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <AppText style={styles.label}>{language === "te" ? "చెల్లించాల్సిన మొత్తం*" : "Payable Amount*"}</AppText>
              <TouchableOpacity activeOpacity={1} style={[styles.inputBox, { marginBottom: 5 }, activeInput === "payable" && styles.inputFocused, errors.payableAmount && styles.inputError]} onPress={() => { setActiveInput("payable"); payableInputRef.current?.focus(); }}>
                <TextInput ref={payableInputRef} value={payableAmount} onChangeText={(txt) => { setPayableAmount(txt); if (errors.payableAmount) setErrors({ ...errors, payableAmount: "" }); }} keyboardType="numeric" style={styles.input} cursorColor="#16A34A" selectionColor="#16A34A40" onFocus={() => setActiveInput("payable")} onBlur={() => setActiveInput(null)} />
              </TouchableOpacity>
              {errors.payableAmount && <AppText style={[styles.errorText, { marginTop: 0, marginBottom: 5 }]} language={language}>{errors.payableAmount}</AppText>}
            </View>
            <Ionicons name="remove" size={24} color="#9CA3AF" style={{ marginTop: 25 }} />
            <View style={{ flex: 1 }}>
              <AppText style={styles.label}>{language === "te" ? "అడ్వాన్స్ (ముందస్తు)" : "Advance"}</AppText>
              <TouchableOpacity activeOpacity={1} style={[styles.inputBox, { marginBottom: 5 }, activeInput === "advance" && styles.inputFocused]} onPress={() => { setActiveInput("advance"); advanceInputRef.current?.focus(); }}>
                <TextInput ref={advanceInputRef} value={advanceAmount} onChangeText={setAdvanceAmount} keyboardType="numeric" style={styles.input} cursorColor="#16A34A" selectionColor="#16A34A40" onFocus={() => setActiveInput("advance")} onBlur={() => setActiveInput(null)} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, marginLeft: 4 }}>
            <Ionicons name="information-circle-outline" size={14} color="#6B7280" />
            <AppText style={{ fontSize: 11, color: "#6B7280", marginLeft: 4 }}>{language === "te" ? "లెక్కలో తప్పు ఉంటే, మొత్తం* సవరించుకోవచ్చు." : "If calculated Amount* is incorrect, edit it."}</AppText>
          </View>
          
          <View style={styles.finalBox}>
            <View>
              <AppText style={{ color: "#fff", opacity: 0.9, fontSize: 13 }}>{language === "te" ? "నికర మొత్తం" : "Net Final Amount"}</AppText>
              <AppText style={{ color: "#fff", fontSize: 22, fontWeight: "bold" }}>₹{getFinalAmount()}</AppText>
            </View>
            <Ionicons name="checkmark-done-circle" size={40} color="rgba(255,255,255,0.4)" />
          </View>
        </View>

        <View style={{ marginBottom: 20 }}>
          <AppText style={styles.label}>{language === "te" ? "ఇతర వివరాలు (అవసరమైతేనే)" : "Additional Remarks (Optional)"}</AppText>
          <TouchableOpacity activeOpacity={1} style={[styles.inputBox, { minHeight: 120, alignItems: "flex-start", paddingVertical: 14, marginBottom: 20 }, activeInput === "notes" && styles.inputFocused]} onPress={() => { setActiveInput("notes"); notesInputRef.current?.focus(); }}>
            <Ionicons name="document-text-outline" size={20} color={notes || activeInput === "notes" ? "#16A34A" : "#9CA3AF"} style={{ marginTop: 4 }} />
            <View style={[styles.inputWrapper, { marginLeft: 12, flex: 1 }]}>
              {!notes && activeInput !== "notes" && (<AppText style={{ color: "#9CA3AF", lineHeight: 22, fontFamily: "Mandali" }}>{language === "te" ? "మరిన్ని వివరాలు ఇక్కడ రాయండి..." : "Write additional details..."}</AppText>)}
              <TextInput ref={notesInputRef} value={notes} onChangeText={setNotes} multiline placeholder={isListening && voiceTarget === "notes" ? (language === "te" ? "వింటున్నాను..." : "Listening...") : ""} placeholderTextColor="#EF4444" style={[styles.input, { lineHeight: 22, minHeight: 80, textAlignVertical: "top", padding: 0, display: notes || activeInput === "notes" ? "flex" : "none" }]} cursorColor="#16A34A" selectionColor="#16A34A40" onFocus={() => setActiveInput("notes")} onBlur={() => setActiveInput(null)} />
            </View>
            {notes && notes.trim().length > 0 ? (
              <TouchableOpacity onPress={() => setNotes("")} style={styles.micBtn}>
                <Ionicons name="close-circle" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => handleVoiceInput("notes")} style={styles.micBtn}>
                <Ionicons name={isListening && voiceTarget === "notes" ? "mic" : "mic-outline"} size={24} color={isListening && voiceTarget === "notes" ? "#EF4444" : (activeInput === "notes" ? "#16A34A" : "#6B7280")} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity activeOpacity={0.85} style={[styles.saveBtn, {marginTop: 50}]} onPress={handleSave} disabled={saving}>
          <LinearGradient colors={["#2E7D32", "#1B5E20"]} style={styles.saveGradient}>
            <Ionicons name="save-outline" size={18} color="#fff" />
            <AppText style={styles.saveText}>{language === "te" ? "భద్రపరచండి" : "Save Work"}</AppText>
          </LinearGradient>
        </TouchableOpacity>
      </KeyboardAwareScrollView>

      {/* 📅 DATE PICKER */}
      {showDatePicker && (
        <DateTimePicker value={new Date()} mode="date" display="default" onChange={(event, selectedDate) => { setShowDatePicker(false); setActiveInput(null); if (selectedDate) { const d = selectedDate.getDate().toString().padStart(2, "0"); const m = (selectedDate.getMonth() + 1).toString().padStart(2, "0"); const y = selectedDate.getFullYear(); setDate(`${d}-${m}-${y}`); } }} />
      )}

      {/* 🎯 INITIAL SELECTION MODAL */}
      <Modal visible={showTypeModal} transparent animationType="fade">
        <View style={styles.typeModalOverlay}>
          <View style={styles.typeModalContent}>
            <AppText style={styles.typeModalTitle}>{language === "te" ? "పని రకాన్ని ఎంచుకోండి" : "Select Work Type"}</AppText>
            <View style={styles.typeOptionsRow}>
              <TouchableOpacity activeOpacity={0.8} style={styles.typeOptionCard} onPress={() => { setWorkType("time"); setShowTypeModal(false); }}>
                <View style={[styles.typeIconCircle, { backgroundColor: '#E8F5E9' }]}><Ionicons name="time" size={32} color="#2E7D32" /></View>
                <AppText style={styles.typeOptionText}>{language === "te" ? "గంటల లెక్క" : "Time Based"}</AppText>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.8} style={styles.typeOptionCard} onPress={() => { setWorkType("acres"); setShowTypeModal(false); }}>
                <View style={[styles.typeIconCircle, { backgroundColor: '#FFF3E0' }]}><Ionicons name="resize" size={32} color="#EF6C00" /></View>
                <AppText style={styles.typeOptionText}>{language === "te" ? "ఎకరాల లెక్క" : "Acre Based"}</AppText>
              </TouchableOpacity>
            </View>
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
              {language === "te" ? "ఇదివరకే నమోదు చేశారు!" : "Already Exists!"}
            </AppText>
            <AppText style={styles.modalSubStandard} language={language}>
              {language === "te" ? `మీరు ఇదే తేదీన, ఇదే పంటపై, ఇదే పనిని ఇదివరకే నమోదు చేశారు.\n\nఇది రెండవసారి (మరో సెషన్ లో) చేసిన పనా?` : `An entry with the same Date, Crop, and Work already exists.\n\nIs this a second session for the same day?`}
            </AppText>
            <View style={styles.modalButtonsStandard}>
              <TouchableOpacity activeOpacity={0.8} style={styles.modalCancelBtnStandard} onPress={() => setShowDuplicateModal(false)}>
                <AppText style={styles.modalCancelTextStandard} language={language}>{language === "te" ? "వద్దు" : "Cancel"}</AppText>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.8} style={styles.modalInfoBtnStandard} onPress={executeSave}>
                <AppText style={styles.modalInfoTextStandard} language={language}>{language === "te" ? "పర్వాలేదు, చేర్చు" : "Add Anyway"}</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 🔥 MAIN SELECTION MODAL (CROP/WORK) */}
      <Modal visible={modalType !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <AppText style={styles.modalTitleText}>{modalType === "crop" ? (language === "te" ? "పంట ఎంచుకోండి" : "Select Crop") : (language === "te" ? "పని ఎంచుకోండి" : "Select Work")}</AppText>
              <TouchableOpacity onPress={() => { setModalType(null); setSearchText(""); setActiveInput(null); }}><Ionicons name="close-circle" size={28} color="#9CA3AF" /></TouchableOpacity>
            </View>

            <View style={styles.searchBar}>
              <TextInput autoFocus value={searchText} onChangeText={(text) => setSearchText(text)} placeholder={language === "te" ? "ఇక్కడ రాయండి..." : "Type here..."} placeholderTextColor="#9CA3AF" cursorColor={'#16A34A'} style={{ flex: 1, fontSize: 16, fontFamily: "Mandali", color: "#1F2937", paddingVertical: 8 }} />
              {searchText.trim().length > 0 && modalType === "work" && (
                <TouchableOpacity onPress={() => { setWork(searchText); setModalType(null); setSearchText(""); setActiveInput(null); }} style={{ backgroundColor: "#16A34A", borderRadius: 12, padding: 6, marginLeft: 6 }}>
                  <Ionicons name="add" size={20} color="#fff" />
                </TouchableOpacity>
              )}
              {searchText.length > 0 ? (
                 <TouchableOpacity onPress={() => setSearchText("")} style={{ marginLeft: 10, padding: 6, borderRadius: 10 }}><Ionicons name="close-circle" size={22} color="#9CA3AF" /></TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => handleVoiceInput(modalType === "crop" ? "crop" : "work")} style={{ marginLeft: 10, padding: 6, borderRadius: 10, backgroundColor: "#E5E7EB" }}>
                  <MaterialCommunityIcons name={isListening && voiceTarget === (modalType === "crop" ? "crop" : "work") ? "microphone" : "microphone-outline"} size={20} color={isListening && voiceTarget === (modalType === "crop" ? "crop" : "work") ? "#EF4444" : "#2E7D32"} />
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={listData} keyExtractor={(item, index) => `${item.id}-${index}`} keyboardShouldPersistTaps="handled"
              ListEmptyComponent={() => {
                if (modalType === "crop") {
                  return (
                    <View style={{ padding: 20, alignItems: "center" }}>
                      <View style={{ padding: 20, alignItems: 'center' }}>
                        <Ionicons name="information-circle-outline" size={24} color="#6B7280" style={{ marginBottom: 10 }} />
                        <AppText style={{ color: "#4B5563", textAlign: "center", fontSize: 15, fontWeight: '500', lineHeight: 22 }}>{language === "te" ? "మొదట 'పొలాలు' విభాగంలో\nపంట వివరాలను నమోదు చేయండి." : "First, register your crop details in the\n'Fields' section."}</AppText>
                        <AppText style={{ color: "#9CA3AF", textAlign: "center", fontSize: 13, marginTop: 8 }}>{language === "te" ? "అక్కడ జోడించిన పంటలు మాత్రమే ఇక్కడ కనిపిస్తాయి." : "Only crops added there will appear here for selection."}</AppText>
                        <TouchableOpacity activeOpacity={0.85} onPress={() => { setModalType(null); setSearchText(""); router.push("/farmer/fields"); }} style={{ marginTop: 16, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#16A34A", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 }}>
                          <Ionicons name="add-circle-outline" size={18} color="#fff" />
                          <AppText style={{ color: "#fff", fontWeight: "600" }}>{language === "te" ? "పంట జోడించండి" : "Add Crop"}</AppText>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                } 
                if (modalType === "work" && searchText.trim().length > 0) {
                  return (
                    <TouchableOpacity style={[styles.categoryItem, { alignItems: "center" }]} onPress={() => { setWork(searchText); setModalType(null); setSearchText(""); setActiveInput(null); }}>
                      <AppText style={{ color: '#16A34A', fontWeight: '600' }}>{language === "te" ? `"${searchText}" ని చేర్చండి +` : `Add "${searchText}" +`}</AppText>
                    </TouchableOpacity>
                  );
                }
                return null;
              }}
              renderItem={({ item }) => {
                return (
                  <TouchableOpacity style={styles.categoryItem} onPress={() => { if (modalType === "crop") setCrop(item.label); else setWork(item.label); setModalType(null); setSearchText(""); setActiveInput(null); }}>
                    <AppText>{item.label}</AppText>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
      
      <Modal visible={errorModal} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={40} color="#DC2626" />
            <AppText style={styles.errorTitle}>{language === "te" ? "ఒక్క నిమిషం!" : "Just a moment!"}</AppText>
            <AppText style={styles.errorMsg}>{errorMsg}</AppText>
            <TouchableOpacity activeOpacity={0.8} style={styles.okBtn} onPress={() => setErrorModal(false)}>
              <AppText style={{ color: "#fff" }}>{language === 'te' ? "సరే" : "OK"}</AppText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {saving && (<AgriLoader visible type="saving" language={language} />)}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6F7F6" },
  inputBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#F9FAFB", borderRadius: 12, paddingHorizontal: 15, height: 55, marginBottom: 16, borderWidth: 1, borderColor: "#D1D5DB" },
  inputFocused: { borderColor: "#16A34A", backgroundColor: "#FFFFFF", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  inputError: { borderColor: "#EF4444" },
  errorText: { color: "#EF4444", fontSize: 12, fontFamily: "Mandali", marginTop: -10, marginBottom: 10, marginLeft: 4 },
  micBtn: { marginLeft: 10, padding: 4 },
  calcNote: { fontSize: 11, color: "#2E7D32", marginTop: 6, marginLeft: 4, fontStyle: 'italic', opacity: 0.8 },
  inputWrapper: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  input: { flex: 1, fontSize: 16, color: "#1F2937", fontFamily: "Mandali", textAlignVertical: "center", includeFontPadding: false },
  unitText: { fontSize: 14, color: "#2E7D32", fontWeight: "600", backgroundColor: "#E8F5E9", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, overflow: 'hidden' },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#fff", borderTopLeftRadius: 25, borderTopRightRadius: 25, height: "75%" },
  label: { fontSize: 12, color: "#6B7280", marginBottom: 6, marginLeft: 4, fontWeight: "500" },
  finalBox: { backgroundColor: "#2E7D32", borderRadius: 18, padding: 20, marginTop: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", padding: 20, alignItems: "center" },
  modalTitleText: { fontSize: 18, fontWeight: "600" },
  searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: "#F3F4F6", margin: 20, marginTop: 0, borderRadius: 18, paddingHorizontal: 12, borderWidth: 1, borderColor: "#E5E7EB" },
  searchInput: { height: 50 },
  categoryItem: { padding: 20, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  sectionHeader: { marginTop: 10, marginBottom: 12, paddingLeft: 4, borderLeftWidth: 4, borderLeftColor: "#2E7D32" },
  sectionTitle: { fontSize: 18, fontWeight: "600", color: "#4B5563", textTransform: "uppercase", letterSpacing: 0.5 },
  divider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 20, marginHorizontal: 10 },
  calculationInfoBox: { backgroundColor: "#E8F5E9", borderRadius: 12, padding: 12, marginTop: 8, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#C8E6C9", borderStyle: 'dashed' },
  infoIconWrapper: { backgroundColor: "#fff", padding: 6, borderRadius: 8, marginRight: 10 },
  calcLabel: { fontSize: 12, color: "#4B5563", fontWeight: "500" },
  calcStepText: { fontSize: 13, color: "#374151", fontWeight: "600" },
  equalSign: { fontSize: 14, color: "#9CA3AF", marginHorizontal: 4 },
  finalCalcAmount: { fontSize: 14, color: "#2E7D32", fontWeight: "700" },
  typeModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", padding: 20 },
  typeModalContent: { backgroundColor: "#fff", borderRadius: 25, padding: 25, width: '100%', alignItems: 'center' },
  typeModalTitle: { fontSize: 20, fontWeight: '600', color: '#1F2937', marginBottom: 25 },
  typeOptionsRow: { flexDirection: 'row', gap: 20, justifyContent: 'center' },
  typeOptionCard: { flex: 1, backgroundColor: '#F9FAFB', borderRadius: 20, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  typeIconCircle: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  typeOptionText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  saveBtn: { marginTop: 20, marginBottom: 40, borderRadius: 18, overflow: "hidden", elevation: 6, shadowColor: "#1B5E20", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 8 },
  saveGradient: { height: 56, justifyContent: "center", alignItems: "center", flexDirection: "row", gap: 8 },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
  errorBox: { width: "80%", backgroundColor: "#fff", borderRadius: 18, padding: 20, alignItems: "center" },
  errorTitle: { fontSize: 16, fontWeight: "600", marginTop: 10 },
  errorMsg: { fontSize: 13, color: "#6B7280", marginTop: 6, textAlign: "center" },
  okBtn: { marginTop: 15, backgroundColor: "#DC2626", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  modalBox: { width: "80%", backgroundColor: "#fff", borderRadius: 18, padding: 24, alignItems: "center", elevation: 10 },
  iconBg: { width: 64, height: 64, borderRadius: 32, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  deleteConfirmBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center" },

  // UNIFIED PREMIUM MODAL CLASSES (DUPLICATE BLUE INFO THEME)
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