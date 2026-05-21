// add-driverwork.tsx (Simplified & Practical)
import AgriLoader from "@/components/AgriLoader";
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
  Modal,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

export default function AddDriverWork() {
  const router = useRouter();
  const { vehicleId, driverId } = useLocalSearchParams(); 
  const isMounted = useRef(true); 

  const [language, setLanguage] = useState<"te" | "en">("te");
  const [activeInput, setActiveInput] = useState<string | null>(null);

  const isScreenFocused = useIsFocused();
  const [isListening, setIsListening] = useState(false);
  const [voiceTarget, setVoiceTarget] = useState<"work" | "notes" | null>(null); 

  const [date, setDate] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [work, setWork] = useState("");
  const [modalType, setModalType] = useState<"work" | null>(null);
  const [searchText, setSearchText] = useState("");

  // 🔥 Simplified Financial States
  const [payableAmount, setPayableAmount] = useState(""); 
  const [advanceAmount, setAdvanceAmount] = useState("0"); 
  const payableInputRef = useRef<TextInput>(null);
  const advanceInputRef = useRef<TextInput>(null);

  const [notes, setNotes] = useState("");
  const notesInputRef = useRef<TextInput>(null);

  const [errorModal, setErrorModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [saving, setSaving] = useState(false);
  
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    isMounted.current = true;
    AsyncStorage.getItem("APP_LANG").then((l) => {
      if (l && isMounted.current) setLanguage(l as any);
    });

    return () => {
      isMounted.current = false;
      ExpoSpeechRecognitionModule.stop();
    };
  }, []);

  // Simple Final Calculation
  const getFinalAmount = () => {
    const p = parseFloat(payableAmount) || 0;
    const a = parseFloat(advanceAmount) || 0;
    const final = p - a;
    return (final < 0 ? 0 : final).toLocaleString('en-IN');
  };

  const workOptions = [
    { "en": "Driving / Daily Wage", "te": "రోజు కూలి" },
    { "en": "Bailing (Straw)", "te": "గడ్డి చుట్టలు చుట్టడం (బేలర్)" },
    { "en": "Blade Harrowing (Gorru)", "te": "గొర్రు తోలడం" },
    { "en": "Blade Harrowing", "te": "గుంటక తోలడం" },
    { "en": "Borewell Drilling", "te": "బోరు బావి తవ్వకం" },
    { "en": "Bund Forming", "te": "గట్లు వేయడం" },
    { "en": "Cage Wheel Puddling", "te": "కేజ్ వీల్ దమ్మి (పల్లేరు చక్రాలు)" },
    { "en": "Chaff Cutting", "te": "గడ్డి కత్తిరించడం" },
    { "en": "Combine Harvesting (Paddy)", "te": "వరి కోత (హార్వెస్టర్)" },
    { "en": "Corn Shelling", "te": "మొక్కజొన్న వలుపు" },
    { "en": "Cultivator Ploughing", "te": "కల్టివేటర్ దుక్కి" },
    { "en": "Digging (Earth)", "te": "జేసీబీ మట్టి పని (JCB/Excavator)" },
    { "en": "Disc Harrowing", "te": "డిస్క్ హారో దున్నడం" },
    { "en": "Ditching / Trenching", "te": "కాలువలు / గుంతలు తీయడం" },
    { "en": "Drone Spraying", "te": "డ్రోన్ పిచికారీ" },
    { "en": "Fruit Plucking", "te": "పండ్ల కోత" },
    { "en": "Ginning (Cotton)", "te": "పత్తి గిన్నింగ్" },
    { "en": "Grass Cutting", "te": "గడ్డి కోయడం" },
    { "en": "Inter-Cultivation (Sallu)", "te": "అంతరకృషి (సళ్లు తోలడం)" },
    { "en": "Land Leveling (Gorru)", "te": "సదును గొర్రు (లెవలింగ్)" },
    { "en": "Laser Land Leveling", "te": "లేజర్ లెవలింగ్" },
    { "en": "MB Ploughing", "te": "మడక దుక్కి (పెద్ద నాగలి)" },
    { "en": "Mud Spraying", "te": "బురద పిచికారీ" },
    { "en": "Multi-Crop Threshing", "te": "నూర్పిడి (థ్రెషర్)" },
    { "en": "Paddy Nursery Sowing", "te": "వరి నారు పోయడం" },
    { "en": "Paddy Reaping", "te": "వరి కోత (రీపర్)" },
    { "en": "Paddy Transplanting", "te": "వరి నాటు మిషన్" },
    { "en": "Power Weeding", "te": "పవర్ వీడర్ కలుపు తీయడం" },
    { "en": "Pumping Water", "te": "నీరు తోడటం (ఇంజన్/మోటార్)" },
    { "en": "Rotavator Puddling", "te": "రోటవేటర్ దమ్మి / దుక్కి" },
    { "en": "Seed Drilling / Sowing", "te": "విత్తనం వేయడం (సీడ్ డ్రిల్)" },
    { "en": "Shredding (Stalks)", "te": "చెత్తను పొడి చేయడం (ష్రెడ్డర్)" },
    { "en": "Sugarcane Loading", "te": "చెరకు లోడింగ్" },
    { "en": "Tipping / Transport", "te": "ట్రాక్టర్ రవాణా (ట్రిప్పింగ్)" },
    { "en": "Tractor Spraying", "te": "ట్రాక్టర్ పిచికారీ" }
  ];

  const handleVoiceInput = async (target: "work" | "notes") => {
    setVoiceTarget(target);
    const res = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!res.granted) return;

    setIsListening(true);
    ExpoSpeechRecognitionModule.start({
      lang: language === "te" ? "te-IN" : "en-US",
      interimResults: true,
    });
  };

  useSpeechRecognitionEvent("result", (event) => {
    if (!isScreenFocused || !isMounted.current) return;
    if (!event.results || event.results.length === 0) return;

    const text = event.results[0].transcript;
    if (voiceTarget === "work") {
      setWork(text);
      setSearchText(text);
    } 
    else if (voiceTarget === "notes") {
      setNotes((prev) => prev ? prev + " " + text : text);
    }
  });

  useSpeechRecognitionEvent("end", () => {
    if (isMounted.current) {
      setIsListening(false);
      setVoiceTarget(null);
    }
  });

  const executeSave = async (activeSession: string, phone: string, vId: string, dId: string) => {
    await firestore()
      .collection("users")
      .doc(phone)
      .collection("vehicles")
      .doc(vId)
      .collection("drivers") 
      .doc(dId)
      .collection("entries")
      .add({
        date,
        work: work.trim(),
        workType: "fixed", // Just marking as fixed wage for backend clarity
        payableAmount: payableAmount.trim(),
        advanceAmount: advanceAmount.trim(),
        finalAmount: getFinalAmount(),
        notes: notes.trim(),
        paymentStatus: "pending", 
        session: activeSession,
        createdAt: firestore.FieldValue.serverTimestamp()
      });

    setTimeout(() => {
      if (isMounted.current) {
        setSaving(false);
        router.back();
      }
    }, 500);
  };

  const handleSave = async (bypassDuplicate = false) => {
    if (saving) return;

    const newErrors: any = {};
    if (!date) newErrors.date = language === "te" ? "తేదీని ఎంచుకోండి*" : "Select Date*";
    if (!work) newErrors.work = language === "te" ? "పనిని ఎంచుకోండి*" : "Select Work*";
    if (!payableAmount) newErrors.payableAmount = language === "te" ? "కూలి మొత్తం నమోదు చేయండి*" : "Enter Wage Amount*";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    try {
      setSaving(true);
      const phone = await AsyncStorage.getItem("USER_PHONE");
      if (!phone || !vehicleId || !driverId) {
        if (isMounted.current) {
            setSaving(false);
            setErrorMsg(language === "te" ? "సరైన డ్రైవర్ లేదా వాహనం ఐడి లేదు" : "Invalid Driver or Vehicle ID");
            setErrorModal(true);
        }
        return;
      }

      const userDoc = await firestore().collection("users").doc(phone).get();
      const activeSession = userDoc.data()?.activeSession;

      if (!activeSession) {
        if (isMounted.current) {
          setSaving(false);
          setErrorMsg(language === "te" ? "సెషన్ కనుగొనబడలేదు!" : "Active session not found!");
          setErrorModal(true);
        }
        return;
      }

      const vId = Array.isArray(vehicleId) ? vehicleId[0] : vehicleId;
      const dId = Array.isArray(driverId) ? driverId[0] : driverId;

      if (!bypassDuplicate) {
        const duplicateCheck = await firestore()
          .collection("users")
          .doc(phone)
          .collection("vehicles")
          .doc(vId)
          .collection("drivers")
          .doc(dId)
          .collection("entries")
          .where("session", "==", activeSession)
          .where("date", "==", date)
          .where("work", "==", work.trim())
          .get();

        if (!duplicateCheck.empty) {
          if (isMounted.current) {
            setSaving(false);
            setShowDuplicateModal(true); 
          }
          return;
        }
      }

      await executeSave(activeSession, phone, vId, dId);

    } catch (e) {
      console.log("Save Error: ", e);
      if (isMounted.current) {
        setSaving(false);
        setErrorMsg(language === "te" ? "నెట్వర్క్ లేదా సర్వర్ సమస్య, మళ్లీ ప్రయత్నించండి." : "Something went wrong, please try again.");
        setErrorModal(true);
      }
    }
  };

  const filteredData = workOptions.filter(item => {
    const value = (language === "te" ? item.te : item.en).toLowerCase().trim();
    return value.includes(searchText.toLowerCase().trim());
  });

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />

      <AppHeader
        title={language === "te" ? "పని నమోదు (డ్రైవర్)" : "Add Work (Driver)"}
        subtitle={language === "te" ? "వివరాలు నమోదు చేయండి" : "Enter details"}
        language={language}
      />

      <KeyboardAwareScrollView 
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }} 
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        showsVerticalScrollIndicator={false}
      >
  
        {/* 📋 SECTION 1: WORK DETAILS */}
        <View style={styles.sectionHeader}>
           <AppText style={styles.sectionTitle}>
             {language === "te" ? "పని వివరాలు" : "Work Details"}
           </AppText>
        </View>

        {/* 📅 DATE */}
        <TouchableOpacity
          activeOpacity={0.8}
          style={[
            styles.inputBox,
            activeInput === "date" && styles.inputFocused,
            errors.date && styles.inputError
          ]}
          onPress={() => {
            setActiveInput("date");
            setShowDatePicker(true);
            if (errors.date) setErrors({ ...errors, date: "" });
          }}
        >
          <Ionicons
            name="calendar-outline"
            size={20}
            color={date || activeInput === "date" ? "#16A34A" : "#9CA3AF"}
          />
          <View style={styles.inputWrapper}>
            <AppText style={{ color: date ? "#1F2937" : "#9CA3AF", fontFamily: "Mandali" }}>
              {date || (language === "te" ? "తేదీ ఎంచుకోండి*" : "Select Date*")}
            </AppText>
          </View>
        </TouchableOpacity>
        {errors.date && <AppText style={styles.errorText} language={language}>{errors.date}</AppText>}

        {/* 🛠 WORK */}
        <TouchableOpacity
          activeOpacity={0.7}
          style={[
            styles.inputBox,
            activeInput === "work" && styles.inputFocused,
            errors.work && styles.inputError
          ]}
          onPress={() => {
            setModalType("work");
            setActiveInput("work");
            if (errors.work) setErrors({ ...errors, work: "" });
          }}
        >
          <MaterialCommunityIcons
            name="tractor"
            size={20}
            color={work || activeInput === "work" ? "#16A34A" : "#9CA3AF"}
          />
          <View style={styles.inputWrapper}>
            <AppText style={{ color: work ? "#1F2937" : "#9CA3AF", fontFamily: "Mandali" }}>
              {work || (language === "te" ? "పని ఎంచుకోండి*" : "Select Work*")}
            </AppText>
          </View>
          <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
        </TouchableOpacity>
        {errors.work && <AppText style={styles.errorText} language={language}>{errors.work}</AppText>}

        {/* 💳 SECTION 2: BILLING & SETTLEMENT */}
        <View style={styles.divider} />

        <View style={styles.sectionHeader}>
           <AppText style={styles.sectionTitle}>
             {language === "te" ? "కూలి మరియు అడ్వాన్స్" : "Wage & Advance"}
           </AppText>
        </View>

        <View style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <AppText style={styles.label}>
                {language === "te" ? "కూలి మొత్తం (₹)*" : "Wage Amount (₹)*"}
              </AppText>
              <TouchableOpacity
                activeOpacity={1}
                style={[
                  styles.inputBox, 
                  { marginBottom: 5 }, 
                  activeInput === "payable" && styles.inputFocused,
                  errors.payableAmount && styles.inputError
                ]}
                onPress={() => {
                  setActiveInput("payable");
                  payableInputRef.current?.focus();
                }}
              >
                <TextInput
                  ref={payableInputRef}
                  value={payableAmount}
                  onChangeText={(txt) => {
                    setPayableAmount(txt);
                    if (errors.payableAmount) setErrors({ ...errors, payableAmount: "" });
                  }}
                  keyboardType="numeric"
                  style={styles.input}
                  cursorColor="#16A34A"
                  selectionColor="#16A34A40"
                  onFocus={() => setActiveInput("payable")}
                  onBlur={() => setActiveInput(null)}
                />
              </TouchableOpacity>
              {errors.payableAmount && <AppText style={[styles.errorText, { marginTop: 0, marginBottom: 5 }]} language={language}>{errors.payableAmount}</AppText>}
            </View>
            
            <Ionicons name="remove" size={24} color="#9CA3AF" style={{ marginTop: 25 }} />

            <View style={{ flex: 1 }}>
              <AppText style={styles.label}>
                {language === "te" ? "అడ్వాన్స్ (ముందస్తు)" : "Advance Paid"}
              </AppText>
              <TouchableOpacity
                activeOpacity={1}
                style={[
                  styles.inputBox, 
                  { marginBottom: 5 }, 
                  activeInput === "advance" && styles.inputFocused
                ]}
                onPress={() => {
                  setActiveInput("advance");
                  advanceInputRef.current?.focus();
                }}
              >
                <TextInput
                  ref={advanceInputRef}
                  value={advanceAmount}
                  onChangeText={setAdvanceAmount}
                  keyboardType="numeric"
                  style={styles.input}
                  cursorColor="#16A34A"
                  selectionColor="#16A34A40"
                  onFocus={() => setActiveInput("advance")}
                  onBlur={() => setActiveInput(null)}
                />
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.finalBox}>
            <View>
              <AppText style={{ color: "#fff", opacity: 0.9, fontSize: 13 }}>
                {language === "te" ? "ఇవ్వాల్సిన బ్యాలెన్స్" : "Net Balance to Pay"}
              </AppText>
              <AppText style={{ color: "#fff", fontSize: 22, fontWeight: "bold" }}>
                ₹{getFinalAmount()}
              </AppText>
            </View>
            <Ionicons name="checkmark-done-circle" size={40} color="rgba(255,255,255,0.4)" />
          </View>
        </View>

        {/* 📝 REMARKS / NOTES */}
        <View style={{ marginBottom: 20 }}>
          <AppText style={styles.label}>
            {language === "te" ? "ఇతర వివరాలు (అవసరమైతేనే)" : "Additional Remarks (Optional)"}
          </AppText>

          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.inputBox,
              { minHeight: 120, alignItems: "flex-start", paddingVertical: 14, marginBottom: 20 },
              activeInput === "notes" && styles.inputFocused,
            ]}
            onPress={() => {
              setActiveInput("notes");
              notesInputRef.current?.focus();
            }}
          >
            <Ionicons
              name="document-text-outline"
              size={20}
              color={notes || activeInput === "notes" ? "#16A34A" : "#9CA3AF"}
              style={{ marginTop: 4 }}
            />
            <View style={[styles.inputWrapper, { marginLeft: 12, flex: 1 }]}>
              {!notes && activeInput !== "notes" && (
                <AppText style={{ color: "#9CA3AF", lineHeight: 22, fontFamily: "Mandali" }}>
                  {language === "te" ? "ఈ పనికి సంబంధించిన మరిన్ని వివరాలు ఇక్కడ రాయండి..." : "Write additional details..."}
                </AppText>
              )}
              <TextInput
                ref={notesInputRef}
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholder={isListening && voiceTarget === "notes" ? (language === "te" ? "వింటున్నాను..." : "Listening...") : ""}
                placeholderTextColor="#EF4444"
                style={[
                  styles.input,
                  { lineHeight: 22, minHeight: 80, textAlignVertical: "top", padding: 0, display: notes || activeInput === "notes" ? "flex" : "none" }
                ]}
                cursorColor="#16A34A"
                selectionColor="#16A34A40"
                onFocus={() => setActiveInput("notes")}
                onBlur={() => setActiveInput(null)}
              />
            </View>
            <TouchableOpacity onPress={() => handleVoiceInput("notes")} style={styles.micBtn}>
              <Ionicons
                name={isListening && voiceTarget === "notes" ? "mic" : "mic-outline"}
                size={24}
                color={isListening && voiceTarget === "notes" ? "#EF4444" : (activeInput === "notes" ? "#16A34A" : "#6B7280")}
              />
            </TouchableOpacity>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          activeOpacity={0.85} 
          style={[styles.saveBtn, {marginTop: 50}]} 
          onPress={() => handleSave(false)}
          disabled={saving}
        >
          <LinearGradient colors={["#2E7D32", "#1B5E20"]} style={styles.saveGradient}>
            <Ionicons name="save-outline" size={18} color="#fff" />
            <AppText style={styles.saveText}>
              {language === "te" ? "భద్రపరచండి" : "Save Work"}
            </AppText>
          </LinearGradient>
        </TouchableOpacity>
      </KeyboardAwareScrollView>

      {/* 📅 DATE PICKER */}
      {showDatePicker && (
        <DateTimePicker
          value={new Date()}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            setActiveInput(null);
            if (selectedDate) {
              const d = selectedDate.getDate().toString().padStart(2, "0");
              const m = (selectedDate.getMonth() + 1).toString().padStart(2, "0");
              const y = selectedDate.getFullYear();
              setDate(`${d}-${m}-${y}`);
            }
          }}
        />
      )}

      {/* 🔥 DUPLICATE ENTRY WARNING MODAL 🔥 */}
      <Modal visible={showDuplicateModal} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.modalOverlayStandard}>
          <View style={styles.modalContentStandard}>
            <View style={styles.modalIconBgStandardInfo}>
              <Ionicons name="copy-outline" size={36} color="#3B82F6" />
            </View>
            <AppText style={styles.modalTitleStandardInfo} language={language}>
              {language === "te" ? "ఇప్పటికే నమోదు అయి ఉంది!" : "Duplicate Work Entry!"}
            </AppText>
            <AppText style={styles.modalSubStandard} language={language}>
              {language === "te" 
                ? "ఈ తేదీన, ఇదే పని వివరాలతో రికార్డు ఇప్పటికే ఉంది.\n\nమీరు ఖచ్చితంగా ఈ పనిని మళ్లీ జతచేయాలనుకుంటున్నారా?" 
                : "An entry with the same date and work already exists.\n\nAre you sure you want to add this duplicate work entry?"}
            </AppText>
            <View style={styles.modalButtonsStandard}>
              <TouchableOpacity activeOpacity={0.8}
                style={styles.modalCancelBtnStandard}
                onPress={() => setShowDuplicateModal(false)}
              >
                <AppText style={styles.modalCancelTextStandard} language={language}>
                  {language === 'te' ? "వద్దు" : "Cancel"}
                </AppText>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.8}
                style={styles.modalInfoBtnStandard}
                onPress={() => {
                  setShowDuplicateModal(false);
                  handleSave(true); // Bypass duplicate check on force save!
                }}
              >
                <AppText style={styles.modalInfoTextStandard} language={language}>
                  {language === 'te' ? "అవును, సేవ్ చేయి" : "Yes, Save"}
                </AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* WORK DROPDOWN MODAL */}
      <Modal visible={modalType !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <AppText style={styles.modalTitleText}>
                {language === "te" ? "పని ఎంచుకోండి" : "Select Work"}
              </AppText>
              <TouchableOpacity onPress={() => {
                setModalType(null);
                setActiveInput(null);
              }}>
                <Ionicons name="close-circle" size={28} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBar}>
              <TextInput
                autoFocus
                value={searchText}
                onChangeText={(text) => setSearchText(text)}
                placeholder={language === "te" ? "ఇక్కడ రాయండి..." : "Type here..."}
                placeholderTextColor="#9CA3AF"
                cursorColor={'green'}
                style={{ flex: 1, fontSize: 16, fontFamily: "Mandali", color: "#1F2937", paddingVertical: 8 }}
              />
              {searchText.trim().length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setWork(searchText);
                    setModalType(null);
                    setSearchText("");
                    setActiveInput(null);
                  }}
                  style={{ backgroundColor: "#16A34A", borderRadius: 12, padding: 6, marginLeft: 6 }}
                >
                  <Ionicons name="add" size={20} color="#fff" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => handleVoiceInput("work")}
                style={{ marginLeft: 10, padding: 6, borderRadius: 10, backgroundColor: "#E5E7EB" }}
              >
                <MaterialCommunityIcons
                  name={isListening && voiceTarget === "work" ? "microphone" : "microphone-outline"}
                  size={20}
                  color={isListening && voiceTarget === "work" ? "#EF4444" : "#2E7D32"}
                />
              </TouchableOpacity>
            </View>
            <FlatList
              data={filteredData}
              keyExtractor={(item, index) => `${item.en}-${index}`}
              ListEmptyComponent={() =>
                searchText.trim().length > 0 ? (
                  <TouchableOpacity
                    style={[styles.categoryItem, { alignItems: "center" }]}
                    onPress={() => {
                      setWork(searchText);
                      setModalType(null);
                      setSearchText("");
                      setActiveInput(null);
                    }}
                  >
                    <AppText style={{ color: '#16A34A', fontWeight: '600' }}>
                      {language === "te" ? `"${searchText}" ని చేర్చండి +` : `Add "${searchText}" +`}
                    </AppText>
                  </TouchableOpacity>
                ) : null
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.categoryItem}
                  onPress={() => {
                    const value = language === "te" ? item.te : item.en;
                    setWork(value);
                    setModalType(null);
                    setSearchText("");
                    setActiveInput(null);
                  }}
                >
                  <AppText>
                    {language === "te" ? item.te : item.en}
                  </AppText>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
      
      {/* ERROR MESSAGE MODAL */}
      <Modal visible={errorModal} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={40} color="#DC2626" />
            <AppText style={styles.errorTitle}>
              {language === "te" ? "ఒక్క నిమిషం!" : "Just a moment!"}
            </AppText>
            <AppText style={styles.errorMsg}>
              {errorMsg}
            </AppText>
            <TouchableOpacity activeOpacity={0.8}
              style={styles.okBtn}
              onPress={() => setErrorModal(false)}
            >
              <AppText style={{ color: "#fff" }}>
                {language === 'te' ? "సరే" : "OK"}
              </AppText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {saving && <AgriLoader visible type="saving" language={language} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6F7F6" },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end"
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    height: "75%"
  },
  label: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 6,
    marginLeft: 4,
    fontWeight: "500"
  },
  finalBox: {
    backgroundColor: "#2E7D32",
    borderRadius: 18,
    padding: 20,
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 20,
    alignItems: "center"
  },
  modalTitleText: {
    fontSize: 18,
    fontWeight: "600"
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    margin: 20,
    borderRadius: 18,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB"
  },
  searchInput: {
    height: 50
  },
  categoryItem: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6"
  },
  sectionHeader: {
    marginTop: 10,
    marginBottom: 12,
    paddingLeft: 4,
    borderLeftWidth: 4,
    borderLeftColor: "#2E7D32",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#4B5563",
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 20,
    marginHorizontal: 10
  },
  saveBtn: {
    marginTop: 20,
    marginBottom: 40,
    borderRadius: 18,
    overflow: "hidden",
    elevation: 6,
    shadowColor: "#1B5E20",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  saveGradient: {
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  saveText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600"
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999
  },
  errorBox: {
    width: "85%",
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    elevation: 10
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 10
  },
  errorMsg: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 6,
    textAlign: "center"
  },
  okBtn: {
    marginTop: 15,
    backgroundColor: "#DC2626",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  
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