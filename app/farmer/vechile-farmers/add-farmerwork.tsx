//add farmer work
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
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

export default function AddFarmerWork() {
  const acresInputRef = useRef<TextInput>(null);
  const [language, setLanguage] = useState<"te" | "en">("te");

  const [activeInput, setActiveInput] = useState<string | null>(null);
  const [workType, setWorkType] = useState<"time" | "acres" | null>(null);
  const [showTypeModal, setShowTypeModal] = useState(true); 

  const isFocused = useIsFocused();
  const [isListening, setIsListening] = useState(false);
  const [voiceTarget, setVoiceTarget] = useState<"crop" | "work" | "notes" | null>(null); // 🔥 Added exact voice target logic

  const [date, setDate] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [crop, setCrop] = useState("");
  const [work, setWork] = useState("");

  const [modalType, setModalType] = useState<"crop" | "work" | null>(null);
  const [searchText, setSearchText] = useState("");

  const [acres, setAcres] = useState("");
  const [duration, setDuration] = useState("");
  const [unit, setUnit] = useState(language === "te" ? "గంటలు" : "Hrs");
  const [ratePerHour, setRatePerHour] = useState(""); 

  const [hrs, setHrs] = useState("");
  const [mins, setMins] = useState("");
  const hrsInputRef = useRef<TextInput>(null);
  const minsInputRef = useRef<TextInput>(null);
  const rateInputRef = useRef<TextInput>(null); 
  const [saalluCount, setSaalluCount] = useState(""); 
  const [ratePerSaalu, setRatePerSaalu] = useState(""); 
  const saalluInputRef = useRef<TextInput>(null);
  const rateSaaluInputRef = useRef<TextInput>(null);

  const [payableAmount, setPayableAmount] = useState(""); 
  const [advanceAmount, setAdvanceAmount] = useState("0"); 

  const payableInputRef = useRef<TextInput>(null);
  const advanceInputRef = useRef<TextInput>(null);

  const [notes, setNotes] = useState("");

  const [errorModal, setErrorModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [errors, setErrors] = useState<{ [key: string]: string }>({}); // 🔥 Inline Errors State
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const { vehicleId, farmerId } = useLocalSearchParams(); 

  const notesInputRef = useRef<TextInput>(null);

  // Automatic ga Calculation maragane Payable Amount update avvali
  useEffect(() => {
    if (workType === "time") {
      const h = parseFloat(hrs) || 0;
      const m = parseFloat(mins) || 0;
      const r = parseFloat(ratePerHour) || 0;
      const totalInHrs = h + (m / 60);
      setPayableAmount(Math.round(totalInHrs * r).toString());
    } else if (workType === "acres") {
      const count = parseFloat(saalluCount) || 0;
      const rate = parseFloat(ratePerSaalu) || 0;
      setPayableAmount(Math.round(count * rate).toString());
    }
  }, [hrs, mins, ratePerHour, saalluCount, ratePerSaalu, workType]);

  const getCalculationDetails = () => {
    if (workType === "time") {
      const h = parseFloat(hrs) || 0;
      const m = parseFloat(mins) || 0;
      const r = parseFloat(ratePerHour) || 0;

      const totalInHrs = h + (m / 60);
      const totalAmount = totalInHrs * r;

      let calcStep = "";
      if (h > 0 || m > 0) {
        calcStep = language === "te"
          ? `${h} గం ${m} ని × ₹${r}`
          : `${h} hr ${m} min × ₹${r}`;
      }

      return {
        amount: totalAmount.toFixed(0),
        calcStep,
        hasValue: (h > 0 || m > 0) && r > 0
      };
    }

    if (workType === "acres") {
      const s = parseFloat(saalluCount) || 0;
      const r = parseFloat(ratePerSaalu) || 0;
      const total = s * r;

      return {
        amount: total.toFixed(0),
        calcStep: `${s} × ₹${r}`,
        hasValue: s > 0 && r > 0
      };
    }

    return { amount: "0", calcStep: "", hasValue: false };
  };

  const getFinalAmount = () => {
    const p = parseFloat(payableAmount) || 0;
    const a = parseFloat(advanceAmount) || 0;
    const final = p - a;
    return (final < 0 ? 0 : final).toLocaleString('en-IN');
  };

  const cropOptions = [
    { "en": "Acid Lime / Lemon", "te": "నిమ్మ" },
    { "en": "Apple Gourd", "te": "దండకాయ" },
    { "en": "Areca Nut", "te": "పోక చెక్క" },
    { "en": "Banana", "te": "అరటి" },
    { "en": "Bajra / Pearl Millet", "te": "సజ్జలు" },
    { "en": "Beetroot", "te": "బీట్రూట్" },
    { "en": "Bengal Gram / Chickpea", "te": "శనగలు" },
    { "en": "Bhendi / Okra", "te": "బెండకాయ" },
    { "en": "Bitter Gourd", "te": "కాకరకాయ" },
    { "en": "Black Gram / Urad Dal", "te": "మినుములు" },
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
    { "en": "Coconut", "te": "కొబ్బరి" },
    { "en": "Coriander", "te": "కొత్తిమీర" },
    { "en": "Cotton", "te": "పత్తి" },
    { "en": "Cowpea", "te": "బొబ్బర్లు" },
    { "en": "Cucumber", "te": "దోసకాయ" },
    { "en": "Curry Leaves", "te": "కరివేపాకు" },
    { "en": "Drumstick", "te": "ములక్కాయ" },
    { "en": "Flowers / Marigold", "te": "బంతి పూలు" },
    { "en": "Garlic", "te": "వెల్లుల్లి" },
    { "en": "Ginger", "te": "అల్లం" },
    { "en": "Grapes", "te": "ద్రాక్ష" },
    { "en": "Green Chilli", "te": "పచ్చి మిరపకాయ" },
    { "en": "Green Gram / Mung Bean", "te": "పెసలు" },
    { "en": "Groundnut / Peanut", "te": "వేరుశనగ" },
    { "en": "Guava", "te": "జామ" },
    { "en": "Horse Gram", "te": "ఉలవలు" },
    { "en": "Jowar / Sorghum", "te": "జొన్న" },
    { "en": "Jute", "te": "జనుము" },
    { "en": "Maize / Corn", "te": "మొక్కజొన్న" },
    { "en": "Mango", "te": "మామిడి" },
    { "en": "Mesta", "te": "గోగునార" },
    { "en": "Millets / Korra", "te": "కొర్రలు" },
    { "en": "Muskmelon", "te": "కర్బూజా" },
    { "en": "Mustard", "te": "ఆవాలు" },
    { "en": "Oil Palm", "te": "పామాయిల్" },
    { "en": "Onion", "te": "ఉల్లిపాయ" },
    { "en": "Paddy / Rice", "te": "వరి" },
    { "en": "Papaya", "te": "బొప్పాయి" },
    { "en": "Pomegranate", "te": "దానిమ్మ" },
    { "en": "Potato", "te": "బంగాళాదుంప" },
    { "en": "Radish", "te": "ముల్లంగి" },
    { "en": "Ragi / Finger Millet", "te": "రాగులు" },
    { "en": "Red Gram / Pigeon Pea", "te": "కంది" },
    { "en": "Ridge Gourd", "te": "బీరకాయ" },
    { "en": "Sapota", "te": "సపోటా" },
    { "en": "Sesame / Gingelly", "te": "నువ్వులు" },
    { "en": "Snake Gourd", "te": "పొట్లకాయ" },
    { "en": "Soybean", "te": "సోయాబీన్" },
    { "en": "Sugarcane", "te": "చెరకు" },
    { "en": "Sunflower", "te": "పొద్దుతిరుగుడు" },
    { "en": "Tobacco", "te": "పొగాకు" },
    { "en": "Tomato", "te": "టమాటా" },
    { "en": "Turmeric", "te": "పసుపు" },
    { "en": "Watermelon", "te": "పుచ్చకాయ" },
    { "en": "Wheat", "te": "గోధుమ" }
  ];

  const workOptions = [
    { "en": "Bailing (Straw)", "te": "గడ్డి చుట్టలు చుట్టడం (బేలర్)" },
    { "en": "Blade Harrowing (Gorru)", "te": "గొర్రు తోలడం" },
    { "en": "Blade Harrowing", "te": "గుంటక తోలడం" },
    { "en": "Borewell Drilling", "te": "బోరు బావి తవ్వకం" },
    { "en": "Bund Forming", "te": "గట్లు వేయడం" },
    { "en": "Cage Wheel Puddling", "te": "కేజ్ వీల్ దమ్మి (పల్లేరు చక్రాలు)" },
    { "en": "Chaff Cutting", "te": "గడ్డి కత్తిరించడం" },
    { "en": "Combined Harvesting (Paddy)", "te": "వరి కోత (హార్వెస్టర్)" },
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

  // 🔥 EXACT MIC LOGIC FROM FIRST SCREEN
  const handleVoiceInput = async (target: "crop" | "work" | "notes") => {
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
    if (!isFocused) return;
    if (!event.results || event.results.length === 0) return;

    const text = event.results[0].transcript;

    if (voiceTarget === "crop") {
      setCrop(text);
      setSearchText(text);
    } 
    else if (voiceTarget === "work") {
      setWork(text);
      setSearchText(text);
    } 
    else if (voiceTarget === "notes") {
      setNotes((prev) => prev ? prev + " " + text : text);
    }
  });

  useSpeechRecognitionEvent("end", () => {
    setIsListening(false);
    setVoiceTarget(null);
  });

  useEffect(() => {
    return () => {
      ExpoSpeechRecognitionModule.stop();
    };
  }, []);

  /* ---------------- SAVE ---------------- */
  const handleSave = async () => {
    // 🔥 Inline Error Checks
    const newErrors: any = {};
    if (!date) newErrors.date = language === "te" ? "తేదీని ఎంచుకోండి*" : "Select Date*";
    if (!crop) newErrors.crop = language === "te" ? "పంటను ఎంచుకోండి*" : "Select Crop*";
    if (!work) newErrors.work = language === "te" ? "పనిని ఎంచుకోండి*" : "Select Work*";
    
    if (workType === "acres") {
      if (!acres) newErrors.acres = language === "te" ? "ఎకరాలు నమోదు చేయండి*" : "Enter Acres*";
      if (!saalluCount) newErrors.saalluCount = language === "te" ? "సాళ్ల సంఖ్య నమోదు చేయండి*" : "Enter Saallu*";
      if (!ratePerSaalu) newErrors.ratePerSaalu = language === "te" ? "ధరను నమోదు చేయండి*" : "Enter Rate*";
    }

    if (workType === "time") {
      if (!hrs && !mins) newErrors.duration = language === "te" ? "సమయాన్ని నమోదు చేయండి*" : "Enter Duration*";
      if (!ratePerHour) newErrors.ratePerHour = language === "te" ? "ధరను నమోదు చేయండి*" : "Enter Rate*";
    }

    if (!payableAmount) newErrors.payableAmount = language === "te" ? "మొత్తం నమోదు చేయండి*" : "Enter Amount*";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    try {
      setSaving(true);
      await new Promise(resolve => setTimeout(resolve, 0));

      const phone = await AsyncStorage.getItem("USER_PHONE");
      if (!phone || !vehicleId || !farmerId) {
        setSaving(false);
        return;
      }

      const userDoc = await firestore().collection("users").doc(phone).get();
      const activeSession = userDoc.data()?.activeSession;

      if (!activeSession) {
        setSaving(false);
        setErrorMsg(language === "te" ? "సెషన్ కనుగొనబడలేదు!" : "Active session not found!");
        setErrorModal(true);
        return;
      }

      const vId = Array.isArray(vehicleId) ? vehicleId[0] : vehicleId;
      const fId = Array.isArray(farmerId) ? farmerId[0] : farmerId;

      await firestore()
        .collection("users")
        .doc(phone)
        .collection("vehicles")
        .doc(vId)
        .collection("works")
        .doc(fId)
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
          saalluCount: saalluCount.trim(),
          ratePerSaalu: ratePerSaalu.trim(),
          payableAmount: payableAmount.trim(),
          advanceAmount: advanceAmount.trim(),
          finalAmount: getFinalAmount(),
          notes: notes.trim(),
          session: activeSession,
          createdAt: firestore.FieldValue.serverTimestamp()
        });

      setTimeout(() => {
        setSaving(false);
        router.back();
      }, 500); 

    } catch (e) {
      console.log("Save Error: ", e);
      setSaving(false);
      setErrorMsg(language === "te" ? "నెట్వర్క్ లేదా సర్వర్ సమస్య, మళ్లీ ప్రయత్నించండి." : "Something went wrong, please try again.");
      setErrorModal(true);
    }
  };

  useEffect(() => {
    AsyncStorage.getItem("APP_LANG").then((l) => {
      if (l) setLanguage(l as any);
    });
  }, []);

  const options = modalType === "crop" ? cropOptions : workOptions;
  const filteredData = options.filter(item => {
    const value = (language === "te" ? item.te : item.en).toLowerCase().trim();
    return value.includes(searchText.toLowerCase().trim());
  });

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />

      <AppHeader
        title={language === "te" ? "పని నమోదు" : "Add Work"}
        subtitle={language === "te" ? "వివరాలు నమోదు చేయండి" : "Enter details"}
        language={language}
      />

      <ScrollView 
        contentContainerStyle={{ padding: 16, paddingBottom: 300 }} 
        keyboardShouldPersistTaps="handled"
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

        {/* 🌾 CROP */}
        <TouchableOpacity
          activeOpacity={0.7}
          style={[
            styles.inputBox,
            activeInput === "crop" && styles.inputFocused,
            errors.crop && styles.inputError
          ]}
          onPress={() => {
            setModalType("crop");
            setActiveInput("crop");
            if (errors.crop) setErrors({ ...errors, crop: "" });
          }}
        >
          <Ionicons
            name="leaf-outline"
            size={20}
            color={crop || activeInput === "crop" ? "#16A34A" : "#9CA3AF"}
          />
          <View style={styles.inputWrapper}>
            <AppText style={{ color: crop ? "#1F2937" : "#9CA3AF", fontFamily: "Mandali" }}>
              {crop || (language === "te" ? "పంట ఎంచుకోండి*" : "Select Crop*")}
            </AppText>
          </View>
          <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
        </TouchableOpacity>
        {errors.crop && <AppText style={styles.errorText} language={language}>{errors.crop}</AppText>}

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

        {/* 📏 ACRES */}
        {workType === "acres" && (
          <>
            <TouchableOpacity
              activeOpacity={1}
              style={[
                styles.inputBox,
                activeInput === "acres" && styles.inputFocused,
                errors.acres && styles.inputError
              ]}
              onPress={() => {
                setActiveInput("acres");
                acresInputRef.current?.focus();
              }}
            >
              <Ionicons
                name="resize-outline"
                size={20}
                color={acres || activeInput === "acres" ? "#16A34A" : "#9CA3AF"}
              />
              <View style={styles.inputWrapper}>
                {!acres && activeInput !== "acres" && (
                  <AppText style={{ color: "#9CA3AF", fontFamily: "Mandali" }}>
                    {language === "te" ? "ఎకరాలు నమోదు చేయండి*" : "Enter Acres*"}
                  </AppText>
                )}
                <TextInput
                  ref={acresInputRef}
                  value={acres}
                  onChangeText={(txt) => {
                    setAcres(txt);
                    if (errors.acres) setErrors({ ...errors, acres: "" });
                  }}
                  keyboardType="numeric"
                  style={[styles.input, { display: (acres || activeInput === "acres") ? "flex" : "none" }]}
                  cursorColor="#16A34A"
                  selectionColor="#16A34A40"
                  onFocus={() => setActiveInput("acres")}
                  onBlur={() => setActiveInput(null)}
                />
              </View>
              {acres.length > 0 && (
                <AppText style={styles.unitText}>
                  {language === "te" ? "ఎకరాలు" : "Acres"}
                </AppText>
              )}
            </TouchableOpacity>
            {errors.acres && <AppText style={styles.errorText} language={language}>{errors.acres}</AppText>}
          </>
        )}
        
        <View style={styles.divider} />

        {/* 🛠️ CONDITIONAL SECTION BASED ON WORK TYPE */}
        {workType === "time" ? (
          <View>
            <View style={styles.sectionHeader}>
               <AppText style={styles.sectionTitle}>
                  {language === "te" ? "సమయం మరియు ధర" : "Time & Costing"}
               </AppText>
            </View>
          </View>
        ) : (
          <View>
             <View style={styles.sectionHeader}>
              <AppText style={styles.sectionTitle}>
                {language === "te" ? "సాళ్ల వివరాలు & ధర" : "Saallu Details & Rate"}
              </AppText>
            </View>
          </View>
        )}

        {/* 📏 ACRES BASED INPUTS */}
        {workType === "acres" ? (
          <View>
            <View style={{ flexDirection: "row", gap: 12, marginBottom: errors.saalluCount || errors.ratePerSaalu ? 0 : 16 }}>
              {/* LEFT: SAALLU COUNT */}
              <TouchableOpacity
                activeOpacity={1}
                style={[
                  styles.inputBox, 
                  { flex: 1, marginBottom: 0 }, 
                  activeInput === "saallu" && styles.inputFocused,
                  errors.saalluCount && styles.inputError
                ]}
                onPress={() => {
                  setActiveInput("saallu");
                  saalluInputRef.current?.focus();
                }}
              >
                <Ionicons name="list-outline" size={20} color={saalluCount ? "#16A34A" : "#9CA3AF"} />
                <View style={styles.inputWrapper}>
                  {!saalluCount && activeInput !== "saallu" && (
                    <AppText style={{ color: "#9CA3AF", fontSize: 13, fontFamily: "Mandali" }}>
                      {language === "te" ? "ఎన్ని సాళ్లు?*" : "No. of Saallu*"}
                    </AppText>
                  )}
                  <TextInput
                    ref={saalluInputRef}
                    value={saalluCount}
                    onChangeText={(txt) => {
                      setSaalluCount(txt);
                      if (errors.saalluCount) setErrors({ ...errors, saalluCount: "" });
                    }}
                    keyboardType="numeric"
                    cursorColor="#16A34A"
                    selectionColor="#16A34A40"
                    style={[styles.input, { display: (saalluCount || activeInput === "saallu") ? "flex" : "none" }]}
                    onFocus={() => setActiveInput("saallu")}
                    onBlur={() => setActiveInput(null)}
                  />
                </View>
              </TouchableOpacity>

              {/* X SYMBOL */}
              <View style={{ justifyContent: 'center' }}>
                <AppText style={{ fontSize: 18, fontWeight: 'bold', color: '#9CA3AF' }}>×</AppText>
              </View>

              {/* RIGHT: RATE PER SAALU */}
              <TouchableOpacity
                activeOpacity={1}
                style={[
                  styles.inputBox, 
                  { flex: 1.2, marginBottom: 0 }, 
                  activeInput === "rateSaalu" && styles.inputFocused,
                  errors.ratePerSaalu && styles.inputError
                ]}
                onPress={() => {
                  setActiveInput("rateSaalu");
                  rateSaaluInputRef.current?.focus();
                }}
              >
                <Ionicons name="cash-outline" size={20} color={ratePerSaalu ? "#16A34A" : "#9CA3AF"} />
                <View style={styles.inputWrapper}>
                  {!ratePerSaalu && activeInput !== "rateSaalu" && (
                    <AppText style={{ color: "#9CA3AF", fontSize: 13, fontFamily: "Mandali" }}>
                      {language === "te" ? "సాళ్లుకు ధర (₹)*" : "Rate/Saalu (₹)*"}
                    </AppText>
                  )}
                  <TextInput
                    ref={rateSaaluInputRef}
                    value={ratePerSaalu}
                    onChangeText={(txt) => {
                      setRatePerSaalu(txt);
                      if (errors.ratePerSaalu) setErrors({ ...errors, ratePerSaalu: "" });
                    }}
                    keyboardType="numeric"
                    cursorColor="#16A34A"
                    selectionColor="#16A34A40"
                    style={[styles.input, { display: (ratePerSaalu || activeInput === "rateSaalu") ? "flex" : "none" }]}
                    onFocus={() => setActiveInput("rateSaalu")}
                    onBlur={() => setActiveInput(null)}
                  />
                </View>
              </TouchableOpacity>
            </View> 

            {/* Error Message for Saallu/Rate row */}
            {(errors.saalluCount || errors.ratePerSaalu) && (
              <AppText style={[styles.errorText, { marginTop: 4, marginBottom: 16 }]} language={language}>
                {errors.saalluCount || errors.ratePerSaalu}
              </AppText>
            )}

            <View style={{ paddingHorizontal: 4, marginBottom: 5 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                            <Ionicons name="information-circle-outline" size={16} color="#059669" style={{ marginTop: 2 }} />
                            <View style={{ marginLeft: 6, flex: 1 }}>
                              <AppText style={{ fontSize: 13, color: "#166534", lineHeight: 20, fontFamily: "Mandali" }}>
                                {language === "te" 
                                  ? "గమనిక: ఒక ఎకరాను ఒకసారి దున్నితే అది '1 సాలు' కింద లెక్క. ఒకవేళ మీరు 2 ఎకరాల పొలాన్ని 2 సార్లు దున్నితే... ఇక్కడ మొత్తం '4 సాళ్లు' (2 ఎకరాలు × 2 సార్లు) అని నమోదు చేయాలి." 
                                  : "Note: Ploughing 1 acre once equals '1 Saalu'. If you ploughed a 2-acre field 2 times, you should enter '4 Saallu' (2 acres × 2 times) here."}
                              </AppText>
                            </View>
                          </View>
           </View>  
          </View>
        ) : (
          <View>
            {/* 🕒 TIME BASED INPUTS */}
            <View style={{ marginBottom: errors.duration ? 0 : 16 }}>
              <AppText style={styles.label}>
                {language === "te" ? "పని చేసిన సమయం (గంటలు : నిమిషాలు)*" : "Work Duration (Hours : Minutes)*"}
              </AppText>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                {/* HOURS INPUT */}
                <TouchableOpacity
                  activeOpacity={1}
                  style={[
                    styles.inputBox, 
                    { flex: 1, marginBottom: 0 }, 
                    activeInput === "hrs" && styles.inputFocused,
                    errors.duration && styles.inputError
                  ]}
                  onPress={() => {
                    setActiveInput("hrs");
                    hrsInputRef.current?.focus();
                  }}
                >
                  <View style={styles.inputWrapper}>
                    {!hrs && activeInput !== "hrs" && (
                      <AppText style={{ color: "#9CA3AF", fontFamily: "Mandali" }}>00</AppText>
                    )}
                    <TextInput
                      ref={hrsInputRef}
                      value={hrs}
                      onChangeText={(txt) => {
                        setHrs(txt);
                        if (errors.duration) setErrors({ ...errors, duration: "" });
                      }}
                      keyboardType="numeric"
                      maxLength={2}
                      style={[styles.input, { textAlign: 'center', display: (hrs || activeInput === "hrs") ? "flex" : "none" }]}
                      cursorColor="#16A34A"
                      selectionColor="#16A34A40"
                      onFocus={() => setActiveInput("hrs")}
                      onBlur={() => setActiveInput(null)}
                    />
                  </View>
                  <AppText style={{ fontSize: 14, color: "#2E7D32", fontWeight: '600' }}>
                    {language === "te" ? "గం" : "Hrs"}
                  </AppText>
                </TouchableOpacity>

                {/* SEPARATOR */}
                <AppText style={{ fontSize: 24, fontWeight: "bold", color: "#9CA3AF" }}>:</AppText>

                {/* MINUTES INPUT */}
                <TouchableOpacity
                  activeOpacity={1}
                  style={[
                    styles.inputBox, 
                    { flex: 1, marginBottom: 0 }, 
                    activeInput === "mins" && styles.inputFocused,
                    errors.duration && styles.inputError
                  ]}
                  onPress={() => {
                    setActiveInput("mins");
                    minsInputRef.current?.focus();
                  }}
                >
                  <View style={styles.inputWrapper}>
                    {!mins && activeInput !== "mins" && (
                      <AppText style={{ color: "#9CA3AF", fontFamily: "Mandali" }}>00</AppText>
                    )}
                    <TextInput
                      ref={minsInputRef}
                      value={mins}
                      onChangeText={(val) => {
                        if (parseInt(val) < 60 || val === "") setMins(val);
                        if (errors.duration) setErrors({ ...errors, duration: "" });
                      }}
                      keyboardType="numeric"
                      maxLength={2}
                      style={[styles.input, { textAlign: 'center', display: (mins || activeInput === "mins") ? "flex" : "none" }]}
                      cursorColor="#16A34A"
                      selectionColor="#16A34A40"
                      onFocus={() => setActiveInput("mins")}
                      onBlur={() => setActiveInput(null)}
                    />
                  </View>
                  <AppText style={{ fontSize: 14, color: "#2E7D32", fontWeight: '600' }}>
                    {language === "te" ? "నిమి" : "Min"}
                  </AppText>
                </TouchableOpacity>
              </View>
            </View>
            {errors.duration && <AppText style={[styles.errorText, { marginTop: 4, marginBottom: 16 }]} language={language}>{errors.duration}</AppText>}
          </View>
        )}

        {/* 💰 RATE & TOTAL DISPLAY */}
        <View style={{ marginBottom: 16 }}>
          {workType === "time" && (
            <>
              <View style={{ flexDirection: "row", gap: 12 }}>
                {/* LEFT: RATE PER HOUR */}
                <TouchableOpacity
                  activeOpacity={1}
                  style={[
                    styles.inputBox,
                    { flex: 1.5, marginBottom: 0 },
                    activeInput === "rate" && styles.inputFocused,
                    errors.ratePerHour && styles.inputError
                  ]}
                  onPress={() => {
                    setActiveInput("rate");
                    rateInputRef.current?.focus();
                  }}
                >
                  <Ionicons
                    name="cash-outline"
                    size={20}
                    color={ratePerHour || activeInput === "rate" ? "#16A34A" : "#9CA3AF"}
                  />
                  <View style={styles.inputWrapper}>
                    {!ratePerHour && activeInput !== "rate" && (
                      <AppText style={{ color: "#9CA3AF", fontFamily: "Mandali" }}>
                        {language === "te" ? "గంటకు ధర (₹)*" : "Rate per Hr (₹)*"}
                      </AppText>
                    )}
                    <TextInput
                      ref={rateInputRef}
                      value={ratePerHour}
                      onChangeText={(txt) => {
                        setRatePerHour(txt);
                        if (errors.ratePerHour) setErrors({ ...errors, ratePerHour: "" });
                      }}
                      keyboardType="numeric"
                      style={[
                        styles.input,
                        { display: (ratePerHour || activeInput === "rate") ? "flex" : "none" }
                      ]}
                      cursorColor="#16A34A"
                      selectionColor="#16A34A40"
                      onFocus={() => setActiveInput("rate")}
                      onBlur={() => setActiveInput(null)}
                    />
                  </View>
                </TouchableOpacity>

                {/* RIGHT: TOTAL DISPLAY */}
                <View
                  style={[
                    styles.inputBox,
                    { flex: 1, marginBottom: 0, backgroundColor: "#E5E7EB", borderColor: "#D1D5DB" }
                  ]}
                >
                  <View style={[styles.inputWrapper, { marginLeft: 0, alignItems: 'center' }]}>
                    <AppText style={{ fontSize: 11, color: "#6B7280", marginBottom: 2 }}>
                      {language === "te" ? "మొత్తం" : "Total"}
                    </AppText>
                    <AppText style={{ color: "#111827", fontWeight: "bold", fontSize: 16 }}>
                      ₹{getCalculationDetails().amount}
                    </AppText>
                  </View>
                </View>
              </View>
              {errors.ratePerHour && <AppText style={[styles.errorText, { marginTop: 4 }]} language={language}>{errors.ratePerHour}</AppText>}
            </>
          )}

          {/* 🔥 ACRES BASED FULL WIDTH TOTAL */}
          {workType === "acres" && saalluCount && ratePerSaalu && (
            <View
              style={[
                styles.inputBox,
                {
                  justifyContent: "center",
                  alignItems: "center",
                  height: 65,
                  backgroundColor: "#F0FDF4",
                  borderColor: "#BBF7D0"
                }
              ]}
            >
              <View style={{ alignItems: "center" }}>
                <AppText style={{ fontSize: 12, color: "#6B7280" }}>
                  {language === "te" ? "మొత్తం" : "Total Amount"}
                </AppText>
                <AppText style={{ fontSize: 20, fontWeight: "bold", color: "#166534" }}>
                  ₹{(parseFloat(saalluCount) * parseFloat(ratePerSaalu)).toLocaleString('en-IN')}
                </AppText>
              </View>
            </View>
          )}

          {/* 💡 DYNAMIC CALCULATION INFO BOX */}
          {getCalculationDetails().hasValue ? (
            <View style={styles.calculationInfoBox}>
              <View style={styles.infoIconWrapper}>
                <Ionicons name="calculator" size={16} color="#2E7D32" />
              </View>
              
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <AppText style={styles.calcLabel}>
                  {language === "te" ? "లెక్కించిన విధానం:" : "Calculation:"}
                </AppText>
                
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <AppText style={styles.calcStepText}>
                    {getCalculationDetails().calcStep}
                  </AppText>
                  <AppText style={styles.equalSign}> = </AppText>
                  <AppText style={styles.finalCalcAmount}>
                    ₹{getCalculationDetails().amount}
                  </AppText>
                </View>
              </View>
            </View>
          ) : null}
        </View>

        {/* 💳 SECTION 3: BILLING & SETTLEMENT */}
        <View style={styles.divider} />

        <View style={styles.sectionHeader}>
           <AppText style={styles.sectionTitle}>
             {language === "te" ? "చెల్లింపు వివరాలు" : "Billing Details"}
           </AppText>
        </View>

        {/* 💸 BILLING SECTION: PAYABLE - ADVANCE */}
        <View style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            
            {/* LEFT: PAYABLE AMOUNT (AUTO + EDITABLE) */}
            <View style={{ flex: 1 }}>
              <AppText style={styles.label}>
                {language === "te" ? "చెల్లించాల్సిన మొత్తం*" : "Payable Amount*"}
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
            
            {/* MINUS SYMBOL */}
            <Ionicons name="remove" size={24} color="#9CA3AF" style={{ marginTop: 25 }} />

            {/* RIGHT: ADVANCE AMOUNT */}
            <View style={{ flex: 1 }}>
              <AppText style={styles.label}>
                {language === "te" ? "అడ్వాన్స్ (ముందస్తు)" : "Advance"}
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
          
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, marginLeft: 4 }}>
            <Ionicons name="information-circle-outline" size={14} color="#6B7280" />
            <AppText style={{ fontSize: 11, color: "#6B7280", marginLeft: 4 }}>
              {language === "te"
            ? "లెక్కలో తప్పు ఉంటే, మీరు చెల్లించాల్సిన మొత్తం* సవరించుకోవచ్చు."
            : "If the calculated Payable Amount* is incorrect, you can edit it."}
            </AppText>
          </View>
          
          {/* 🏆 FINAL SETTLEMENT BOX */}
          <View style={styles.finalBox}>
            <View>
              <AppText style={{ color: "#fff", opacity: 0.9, fontSize: 13 }}>
                {language === "te" ? "నికర మొత్తం" : "Net Final Amount"}
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
            {language === "te"
              ? "ఇతర వివరాలు (అవసరమైతేనే)" 
              : "Additional Remarks (Optional)"}
          </AppText>

          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.inputBox,
              {
                minHeight: 120,
                alignItems: "flex-start",
                paddingVertical: 14,
                marginBottom: 40
              },
              activeInput === "notes" && styles.inputFocused,
            ]}
            onPress={() => {
              setActiveInput("notes");
              notesInputRef.current?.focus();
            }}
          >
            {/* LEFT ICON */}
            <Ionicons
              name="document-text-outline"
              size={20}
              color={notes || activeInput === "notes" ? "#16A34A" : "#9CA3AF"}
              style={{ marginTop: 4 }}
            />

            {/* TEXT + INPUT */}
            <View style={[styles.inputWrapper, { marginLeft: 12, flex: 1 }]}>
              {/* PLACEHOLDER */}
              {!notes && activeInput !== "notes" && (
                <AppText style={{ color: "#9CA3AF", lineHeight: 22, fontFamily: "Mandali" }}>
                  {language === "te"
                    ? "ఈ పనికి సంబంధించిన మరిన్ని వివరాలు ఇక్కడ రాయండి..."
                    : "Write additional details..."}
                </AppText>
              )}

              {/* TEXT INPUT */}
              <TextInput
                ref={notesInputRef}
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholder={isListening && voiceTarget === "notes" ? (language === "te" ? "వింటున్నాను..." : "Listening...") : ""}
                placeholderTextColor="#EF4444"
                style={[
                  styles.input,
                  {
                    lineHeight: 22,
                    minHeight: 80,
                    textAlignVertical: "top",
                    padding: 0,
                    display: notes || activeInput === "notes" ? "flex" : "none",
                  }
                ]}
                cursorColor="#16A34A"
                selectionColor="#16A34A40"
                onFocus={() => setActiveInput("notes")}
                onBlur={() => setActiveInput(null)}
              />
            </View>

            {/* 🎤 EXACT MIC BUTTON FROM FIRST SCREEN */}
            <TouchableOpacity
              onPress={() => handleVoiceInput("notes")}
              style={styles.micBtn}
            >
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
          style={styles.saveBtn} 
          onPress={handleSave}
          disabled={saving}
        >
          <LinearGradient
            colors={["#2E7D32", "#1B5E20"]}
            style={styles.saveGradient}
          >
            <Ionicons name="save-outline" size={18} color="#fff" />
            <AppText style={styles.saveText}>
              {language === "te" ? "భద్రపరచండి" : "Save Work"}
            </AppText>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

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

      {/* 🎯 INITIAL SELECTION MODAL */}
      <Modal visible={showTypeModal} transparent animationType="fade">
        <View style={styles.typeModalOverlay}>
          <View style={styles.typeModalContent}>
            <AppText style={styles.typeModalTitle}>
              {language === "te" ? "పని రకాన్ని ఎంచుకోండి" : "Select Work Type"}
            </AppText>
            <View style={styles.typeOptionsRow}>
              {/* TIME BASED OPTION */}
              <TouchableOpacity activeOpacity={0.8}
                style={styles.typeOptionCard} 
                onPress={() => {
                  setWorkType("time");
                  setShowTypeModal(false);
                }}
              >
                <View style={[styles.typeIconCircle, { backgroundColor: '#E8F5E9' }]}>
                  <Ionicons name="time" size={32} color="#2E7D32" />
                </View>
                <AppText style={styles.typeOptionText}>
                  {language === "te" ? "గంటల లెక్క" : "Time Based"}
                </AppText>
              </TouchableOpacity>

              {/* ACRES BASED OPTION */}
              <TouchableOpacity activeOpacity={0.8}
                style={styles.typeOptionCard} 
                onPress={() => {
                  setWorkType("acres");
                  setShowTypeModal(false);
                }}
              >
                <View style={[styles.typeIconCircle, { backgroundColor: '#FFF3E0' }]}>
                  <Ionicons name="resize" size={32} color="#EF6C00" />
                </View>
                <AppText style={styles.typeOptionText}>
                  {language === "te" ? "ఎకరాల లెక్క" : "Acre Based"}
                </AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={modalType !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <AppText style={styles.modalTitleText}>
                {modalType === "crop"
                  ? (language === "te" ? "పంట ఎంచుకోండి" : "Select Crop")
                  : (language === "te" ? "పని ఎంచుకోండి" : "Select Work")}
              </AppText>
              <TouchableOpacity onPress={() => {
                setModalType(null);
                setActiveInput(null);
              }}>
                <Ionicons name="close-circle" size={28} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* 🔥 SEARCH + MIC (Exactly like screen 1) */}
            <View style={styles.searchBar}>
              <TextInput
                autoFocus
                value={searchText}
                onChangeText={(text) => {
                  setSearchText(text);
                  modalType === "crop" ? setCrop(text) : setWork(text);
                }}
                placeholder={language === "te" ? "ఇక్కడ రాయండి..." : "Type here..."}
                placeholderTextColor="#9CA3AF"
                cursorColor={'green'}
                style={{ flex: 1, fontSize: 16, fontFamily: "Mandali", color: "#1F2937", paddingVertical: 8 }}
              />
              {searchText.trim().length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    if (modalType === "crop") setCrop(searchText);
                    else setWork(searchText);

                    setModalType(null);
                    setSearchText("");
                    setActiveInput(null);
                  }}
                  style={{ backgroundColor: "#16A34A", borderRadius: 12, padding: 6, marginLeft: 6 }}
                >
                  <Ionicons name="add" size={20} color="#fff" />
                </TouchableOpacity>
              )}
              {/* 🎤 MODAL MIC (Exactly like screen 1) */}
              <TouchableOpacity
                onPress={() => handleVoiceInput(modalType === "crop" ? "crop" : "work")}
                style={{ marginLeft: 10, padding: 6, borderRadius: 10, backgroundColor: "#E5E7EB" }}
              >
                <MaterialCommunityIcons
                  name={isListening && voiceTarget === (modalType === "crop" ? "crop" : "work") ? "microphone" : "microphone-outline"}
                  size={20}
                  color={isListening && voiceTarget === (modalType === "crop" ? "crop" : "work") ? "#EF4444" : "#2E7D32"}
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
                      if (modalType === "crop") setCrop(searchText);
                      else setWork(searchText);

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
                    modalType === "crop" ? setCrop(value) : setWork(value);

                    if (searchText.trim()) {
                      modalType === "crop" ? setCrop(searchText) : setWork(searchText);
                    }

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
      
      <Modal visible={errorModal} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={40} color="#DC2626" />
            <AppText style={styles.errorTitle}>
              {language === "te" 
                ? "ఒక్క నిమిషం!" 
                : "Just a moment!"}
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

      {saving && (
        <AgriLoader visible type="saving" language={language} />
      )}
    </SafeAreaView>
  );
}

// 🔥 EXACT STYLES FROM FIRST SCREEN 
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
  calcNote: {
    fontSize: 11,
    color: "#2E7D32",
    marginTop: 6,
    marginLeft: 4,
    fontStyle: 'italic',
    opacity: 0.8
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
  unitText: {
    fontSize: 14,
    color: "#2E7D32",
    fontWeight: "600",
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: 'hidden'
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
  calculationInfoBox: {
    backgroundColor: "#E8F5E9",
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#C8E6C9",
    borderStyle: 'dashed',
  },
  infoIconWrapper: {
    backgroundColor: "#fff",
    padding: 6,
    borderRadius: 8,
    marginRight: 10,
  },
  calcLabel: {
    fontSize: 12,
    color: "#4B5563",
    fontWeight: "500",
  },
  calcStepText: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "600",
  },
  equalSign: {
    fontSize: 14,
    color: "#9CA3AF",
    marginHorizontal: 4,
  },
  finalCalcAmount: {
    fontSize: 14,
    color: "#2E7D32",
    fontWeight: "700",
  },
  typeModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20
  },
  typeModalContent: {
    backgroundColor: "#fff",
    borderRadius: 25,
    padding: 25,
    width: '100%',
    alignItems: 'center'
  },
  typeModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 25
  },
  typeOptionsRow: {
    flexDirection: 'row',
    gap: 20,
    justifyContent: 'center'
  },
  typeOptionCard: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  typeIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12
  },
  typeOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151'
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
    alignItems: "center"
  },
  errorBox: {
    width: "80%",
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 20,
    alignItems: "center"
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
    paddingVertical: 10,
    borderRadius: 10
  },
});