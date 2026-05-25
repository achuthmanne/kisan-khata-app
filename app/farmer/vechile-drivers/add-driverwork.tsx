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
  const { vehicleId, driverId, paymentType, monthlySalary } = useLocalSearchParams(); 

  const dPaymentType = Array.isArray(paymentType) ? paymentType[0] : paymentType || "daily";
  const dMonthlySalary = Array.isArray(monthlySalary) ? monthlySalary[0] : monthlySalary || "0";
  const isMounted = useRef(true); 

  const [language, setLanguage] = useState<"te" | "en">("te");
  const [activeInput, setActiveInput] = useState<string | null>(null);

  const isScreenFocused = useIsFocused();
  const [isListening, setIsListening] = useState(false);
  const [voiceTarget, setVoiceTarget] = useState<"work" | "notes" | "customerName" | null>(null); 

  const [date, setDate] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);

  // 🔥 NEW WORK LOG STATES
  const [customerName, setCustomerName] = useState("");
  const customerNameRef = useRef<TextInput>(null);

  const [workMode, setWorkMode] = useState<"hourly" | "acres">("hourly");
  
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  // 🔥 BREAK TIME STATES
  const [hasBreak, setHasBreak] = useState(false);
  const [breakStartTime, setBreakStartTime] = useState<Date | null>(null);
  const [breakEndTime, setBreakEndTime] = useState<Date | null>(null);
  const [showBreakStartTimePicker, setShowBreakStartTimePicker] = useState(false);
  const [showBreakEndTimePicker, setShowBreakEndTimePicker] = useState(false);

  const [acresWorked, setAcresWorked] = useState("");
  const acresWorkedRef = useRef<TextInput>(null);

  const [work, setWork] = useState("");
  const [modalType, setModalType] = useState<"work" | null>(null);
  const [searchText, setSearchText] = useState("");

  // 🔥 PAYMENT STATES
  const [attendance, setAttendance] = useState<"present" | "half" | "absent">("present");

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

  // 🔥 SMART START TIME LOGIC
  useEffect(() => {
    const fetchLatestEndTime = async () => {
      const vIdStr = Array.isArray(vehicleId) ? vehicleId[0] : vehicleId;
      const dIdStr = Array.isArray(driverId) ? driverId[0] : driverId;

      if (!date || !vIdStr || !dIdStr) return;
      const userPhone = await AsyncStorage.getItem("USER_PHONE");
      if (!userPhone) return;
      
      try {
        const snap = await firestore()
          .collection("users")
          .doc(userPhone)
          .collection("vehicles")
          .doc(vIdStr)
          .collection("drivers")
          .doc(dIdStr)
          .collection("entries")
          .where("date", "==", date)
          .get();

        let latestTime: Date | null = null;
        snap.forEach(doc => {
          const data = doc.data();
          if (data.endTimeRaw) {
             const t = new Date(data.endTimeRaw);
             if (!latestTime || t > latestTime) latestTime = t;
          }
        });

        if (latestTime && isMounted.current) {
          setStartTime(latestTime);
        } else if (!startTime) {
          setStartTime(new Date()); 
        }
      } catch (e) {
        console.log("Error fetching latest end time:", e);
      }
    };
    fetchLatestEndTime();
  }, [date, vehicleId, driverId]);

  // Removed AUTO CALCULATE PAYABLE AMOUNT FOR DAILY DRIVERS since user wants manual input.

  // Simple Final Calculation
  const getFinalAmount = () => {
    if (dPaymentType === "monthly") {
      // For monthly, we only care about advances. Payables are 0.
      return advanceAmount || "0";
    }
    const p = parseFloat(payableAmount) || 0;
    const a = parseFloat(advanceAmount) || 0;
    const final = p - a;
    return (final < 0 ? 0 : final).toLocaleString('en-IN');
  };

  const isBreakTimeValid = () => {
    if (!startTime || !endTime || !breakStartTime || !breakEndTime) return false;
    
    const startMins = startTime.getHours() * 60 + startTime.getMinutes();
    let endMins = endTime.getHours() * 60 + endTime.getMinutes();
    if (endMins < startMins) endMins += 24 * 60;
    
    let bStartMins = breakStartTime.getHours() * 60 + breakStartTime.getMinutes();
    if (bStartMins < startMins) bStartMins += 24 * 60;
    
    let bEndMins = breakEndTime.getHours() * 60 + breakEndTime.getMinutes();
    if (bEndMins < bStartMins) bEndMins += 24 * 60;

    if (bStartMins < startMins || bEndMins > endMins) {
      return false;
    }
    return true;
  };

  const getWorkTimes = () => {
    if (!startTime || !endTime) return { gross: "", break: "", net: "" };
    let diffMs = endTime.getTime() - startTime.getTime();
    if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000; // Overnight
    
    const formatMs = (ms: number) => {
      const hrs = Math.floor(ms / (1000 * 60 * 60));
      const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
      return `${hrs}h ${mins}m`;
    };

    const gross = formatMs(diffMs);
    let breakStr = "";
    let netStr = gross;

    if (hasBreak && breakStartTime && breakEndTime) {
      if (!isBreakTimeValid()) {
        return { 
          gross, 
          break: language === "te" ? "తప్పు సమయం" : "Invalid", 
          net: language === "te" ? "తప్పు సమయం" : "Invalid" 
        };
      }

      let breakDiff = breakEndTime.getTime() - breakStartTime.getTime();
      if (breakDiff < 0) breakDiff += 24 * 60 * 60 * 1000;
      breakStr = formatMs(breakDiff);

      let netMs = diffMs - breakDiff;
      if (netMs < 0) netMs = 0;
      netStr = formatMs(netMs);
    }

    return { gross, break: breakStr, net: netStr };
  };

  const calculateTotalHoursStr = () => getWorkTimes().net;

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

  const handleVoiceInput = async (target: "work" | "notes" | "customerName") => {
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
    else if (voiceTarget === "customerName") {
      setCustomerName(text);
    }
  });

  useSpeechRecognitionEvent("end", () => {
    if (isMounted.current) {
      setIsListening(false);
      setVoiceTarget(null);
    }
  });

  const executeSave = async (activeSession: string, phone: string, vId: string, dId: string) => {
    
    let entryData: any = {
      date,
      customerName: customerName.trim(),
      work: work.trim(),
      notes: notes.trim(),
      paymentStatus: "pending", 
      session: activeSession,
      createdAt: firestore.FieldValue.serverTimestamp()
    };

    if (dPaymentType === "monthly") {
      entryData = {
        ...entryData,
        attendance,
        advanceAmount: advanceAmount.trim(),
        finalAmount: getFinalAmount(), // which is just advance for monthly
        workMode: attendance === "absent" ? null : workMode,
      };
      
      if (attendance !== "absent") {
        if (workMode === "hourly") {
          entryData.startTimeRaw = startTime ? startTime.toISOString() : null;
          entryData.endTimeRaw = endTime ? endTime.toISOString() : null;
          entryData.hasBreak = hasBreak;
          if (hasBreak) {
            entryData.breakStartTimeRaw = breakStartTime ? breakStartTime.toISOString() : null;
            entryData.breakEndTimeRaw = breakEndTime ? breakEndTime.toISOString() : null;
          }
          entryData.totalHoursStr = calculateTotalHoursStr();
        } else {
          entryData.acresWorked = acresWorked.trim();
        }
      }
    } else {
      // Daily Driver
      entryData = {
        ...entryData,
        workMode,
        payableAmount: payableAmount.trim(),
        advanceAmount: advanceAmount.trim(),
        finalAmount: getFinalAmount(),
      };
      
      if (workMode === "hourly") {
        entryData.startTimeRaw = startTime ? startTime.toISOString() : null;
        entryData.endTimeRaw = endTime ? endTime.toISOString() : null;
        entryData.hasBreak = hasBreak;
        if (hasBreak) {
          entryData.breakStartTimeRaw = breakStartTime ? breakStartTime.toISOString() : null;
          entryData.breakEndTimeRaw = breakEndTime ? breakEndTime.toISOString() : null;
        }
        entryData.totalHoursStr = calculateTotalHoursStr();
      } else {
        entryData.acresWorked = acresWorked.trim();
      }
    }

    await firestore()
      .collection("users")
      .doc(phone)
      .collection("vehicles")
      .doc(vId)
      .collection("drivers") 
      .doc(dId)
      .collection("entries")
      .add(entryData);

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
    
    if (dPaymentType === "monthly" && attendance === "absent") {
       // Only date and advance are relevant
    } else {
       if (!work) newErrors.work = language === "te" ? "పనిని ఎంచుకోండి*" : "Select Work*";
       if (!customerName) newErrors.customerName = language === "te" ? "రైతు పేరు రాయండి*" : "Enter Customer Name*";
       if (workMode === "hourly" && (!startTime || !endTime)) {
         newErrors.time = language === "te" ? "సమయం ఎంచుకోండి*" : "Select Time*";
       }
       if (workMode === "hourly" && hasBreak && (!breakStartTime || !breakEndTime)) {
         newErrors.breakTime = language === "te" ? "బ్రేక్ సమయం ఎంచుకోండి*" : "Select Break Time*";
       } else if (workMode === "hourly" && hasBreak && breakStartTime && breakEndTime && startTime && endTime) {
          if (!isBreakTimeValid()) {
            newErrors.breakTime = language === "te" ? "బ్రేక్ సమయం పని మొదలైన, ముగిసిన సమయాల మధ్యలోనే ఉండాలి*" : "Break time must be between work start and end*";
          }
        }
       if (workMode === "acres" && !acresWorked) {
         newErrors.acresWorked = language === "te" ? "ఎకరాలు రాయండి*" : "Enter Acres*";
       }
    }

    if (dPaymentType === "daily" && (!payableAmount || payableAmount === "0" || payableAmount === "")) {
      newErrors.payableAmount = language === "te" ? "కూలి నమోదు చేయండి*" : "Enter Wage*";
    }

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
          .get();

        let isDuplicate = false;
        
        duplicateCheck.forEach(doc => {
           const d = doc.data();
           let matches = (d.work || "") === work.trim() && (d.customerName || "") === customerName.trim();
           
           const isSameTime = (raw1: string | null, date2: Date | null) => {
               if (!raw1 && !date2) return true;
               if (!raw1 || !date2) return false;
               const d1 = new Date(raw1);
               return d1.getHours() === date2.getHours() && d1.getMinutes() === date2.getMinutes();
           };

           if (matches) {
               if (dPaymentType === "monthly") {
                   if (d.attendance !== attendance) matches = false;
                   if (attendance === "absent") {
                       // No cutting fields in this form
                   } else {
                       if (d.workMode !== workMode) matches = false;
                       if (workMode === "hourly") {
                           if (!isSameTime(d.startTimeRaw, startTime) || !isSameTime(d.endTimeRaw, endTime)) matches = false;
                       } else if (workMode === "acres") {
                           if ((d.acresWorked || "") !== acresWorked.trim()) matches = false;
                       }
                   }
               } else {
                   if (d.workMode !== workMode) matches = false;
                   if (workMode === "hourly") {
                       if (!isSameTime(d.startTimeRaw, startTime) || !isSameTime(d.endTimeRaw, endTime)) matches = false;
                   } else if (workMode === "acres") {
                       if ((d.acresWorked || "") !== acresWorked.trim()) matches = false;
                   }
               }
           }
           if (matches) isDuplicate = true;
        });

        if (isDuplicate) {
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
          <Ionicons name="calendar-outline" size={20} color={date || activeInput === "date" ? "#16A34A" : "#9CA3AF"} />
          <View style={styles.inputWrapper}>
            <AppText style={{ color: date ? "#1F2937" : "#9CA3AF", fontFamily: "Mandali" }}>
              {date || (language === "te" ? "తేదీ ఎంచుకోండి*" : "Select Date*")}
            </AppText>
          </View>
        </TouchableOpacity>
        {errors.date && <AppText style={styles.errorText} language={language}>{errors.date}</AppText>}

        {!(dPaymentType === "monthly" && attendance === "absent") && (
          <>
            {/* 👤 CUSTOMER NAME */}
            <TouchableOpacity
              activeOpacity={1}
              style={[
                styles.inputBox,
                activeInput === "customerName" && styles.inputFocused,
                errors.customerName && styles.inputError
              ]}
              onPress={() => {
                setActiveInput("customerName");
                customerNameRef.current?.focus();
                if (errors.customerName) setErrors({ ...errors, customerName: "" });
              }}
            >
              <Ionicons name="person-outline" size={20} color={customerName || activeInput === "customerName" ? "#16A34A" : "#9CA3AF"} />
              <View style={[styles.inputWrapper, { marginLeft: 10, flex: 1 }]}>
                <TextInput
                  ref={customerNameRef}
                  value={customerName}
                  onChangeText={setCustomerName}
                  placeholder={language === "te" ? "రైతు పేరు*" : "Customer Name*"}
                  placeholderTextColor="#9CA3AF"
                  style={styles.input}
                  cursorColor="#16A34A"
                  selectionColor="#16A34A40"
                  onFocus={() => setActiveInput("customerName")}
                  onBlur={() => setActiveInput(null)}
                />
              </View>
              <TouchableOpacity onPress={() => handleVoiceInput("customerName")} style={styles.micBtn}>
                <Ionicons
                  name={isListening && voiceTarget === "customerName" ? "mic" : "mic-outline"}
                  size={24}
                  color={isListening && voiceTarget === "customerName" ? "#EF4444" : (activeInput === "customerName" ? "#16A34A" : "#6B7280")}
                />
              </TouchableOpacity>
            </TouchableOpacity>
            {errors.customerName && <AppText style={styles.errorText} language={language}>{errors.customerName}</AppText>}

            {/* ⚙️ WORK MODE (HOURLY OR ACRES) */}
            <View style={{ marginBottom: 16 }}>
              <AppText style={styles.label}>
                {language === "te" ? "పని ఎలా జరిగింది?*" : "Work Mode*"}
              </AppText>
              <View style={styles.segmentedControl}>
                <TouchableOpacity
                  style={[styles.segmentBtn, workMode === "hourly" && styles.segmentActive]}
                  onPress={() => setWorkMode("hourly")}
                >
                  <AppText style={[styles.segmentText, workMode === "hourly" && styles.segmentTextActive]}>
                    {language === "te" ? "గంటల లెక్క" : "Hourly"}
                  </AppText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segmentBtn, workMode === "acres" && styles.segmentActive]}
                  onPress={() => setWorkMode("acres")}
                >
                  <AppText style={[styles.segmentText, workMode === "acres" && styles.segmentTextActive]}>
                    {language === "te" ? "ఎకరాల లెక్క" : "Acres"}
                  </AppText>
                </TouchableOpacity>
              </View>
            </View>

            {/* ⏰ TIME OR ACRES INPUT */}
            {workMode === "hourly" ? (
              <View style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
                  <View style={{ flex: 1 }}>
                    <AppText style={styles.label}>{language === "te" ? "పని మొదలైన సమయం*" : "Start Time*"}</AppText>
                    <TouchableOpacity
                      style={[styles.inputBox, errors.time && styles.inputError, { marginBottom: 0 }]}
                      onPress={() => { setShowStartTimePicker(true); if(errors.time) setErrors({...errors, time: ""}); }}
                    >
                      <Ionicons name="time-outline" size={20} color={startTime ? "#16A34A" : "#9CA3AF"} />
                      <AppText style={{ marginLeft: 8, color: startTime ? "#1F2937" : "#9CA3AF", flex: 1, fontFamily: "Mandali" }}>
                        {startTime ? startTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "--:--"}
                      </AppText>
                    </TouchableOpacity>
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText style={styles.label}>{language === "te" ? "పని ముగిసిన సమయం*" : "End Time*"}</AppText>
                    <TouchableOpacity
                      style={[styles.inputBox, errors.time && styles.inputError, { marginBottom: 0 }]}
                      onPress={() => { setShowEndTimePicker(true); if(errors.time) setErrors({...errors, time: ""}); }}
                    >
                      <Ionicons name="time-outline" size={20} color={endTime ? "#16A34A" : "#9CA3AF"} />
                      <AppText style={{ marginLeft: 8, color: endTime ? "#1F2937" : "#9CA3AF", flex: 1, fontFamily: "Mandali" }}>
                        {endTime ? endTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "--:--"}
                      </AppText>
                    </TouchableOpacity>
                  </View>
                </View>
                
                {/* BREAK TIME LOGIC */}
                {!hasBreak ? (
                  <TouchableOpacity style={{ alignSelf: "flex-start", paddingVertical: 5 }} onPress={() => setHasBreak(true)}>
                    <AppText style={{ color: "#3B82F6", fontWeight: "600", fontFamily: "Mandali", fontSize: 16 }}>
                      {language === "te" ? "+ బ్రేక్ సమయం జోడించండి (ఆప్షనల్)" : "+ Add Break Time (Optional)"}
                    </AppText>
                  </TouchableOpacity>
                ) : (
                  <View style={{ backgroundColor: "#EFF6FF", padding: 12, borderRadius: 12, marginBottom: 10 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
                      <AppText style={{ color: "#1D4ED8", fontWeight: "600", fontFamily: "Mandali", fontSize: 16 }}>
                        {language === "te" ? "బ్రేక్ సమయం" : "Break Time"}
                      </AppText>
                      <TouchableOpacity onPress={() => { setHasBreak(false); setBreakStartTime(null); setBreakEndTime(null); }}>
                        <Ionicons name="close-circle" size={24} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <AppText style={styles.label}>{language === "te" ? "బ్రేక్ మొదలైన సమయం*" : "Break Start*"}</AppText>
                        <TouchableOpacity
                          style={[styles.inputBox, errors.breakTime && styles.inputError, { marginBottom: 0, height: 45, backgroundColor: "#fff" }]}
                          onPress={() => { setShowBreakStartTimePicker(true); if(errors.breakTime) setErrors({...errors, breakTime: ""}); }}
                        >
                          <Ionicons name="cafe-outline" size={18} color={breakStartTime ? "#16A34A" : "#9CA3AF"} />
                          <AppText style={{ marginLeft: 8, color: breakStartTime ? "#1F2937" : "#9CA3AF", flex: 1, fontFamily: "Mandali", fontSize: 14 }}>
                            {breakStartTime ? breakStartTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "--:--"}
                          </AppText>
                        </TouchableOpacity>
                      </View>
                      <View style={{ flex: 1 }}>
                        <AppText style={styles.label}>{language === "te" ? "బ్రేక్ ముగిసిన సమయం*" : "Break End*"}</AppText>
                        <TouchableOpacity
                          style={[styles.inputBox, errors.breakTime && styles.inputError, { marginBottom: 0, height: 45, backgroundColor: "#fff" }]}
                          onPress={() => { setShowBreakEndTimePicker(true); if(errors.breakTime) setErrors({...errors, breakTime: ""}); }}
                        >
                          <Ionicons name="cafe-outline" size={18} color={breakEndTime ? "#16A34A" : "#9CA3AF"} />
                          <AppText style={{ marginLeft: 8, color: breakEndTime ? "#1F2937" : "#9CA3AF", flex: 1, fontFamily: "Mandali", fontSize: 14 }}>
                            {breakEndTime ? breakEndTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "--:--"}
                          </AppText>
                        </TouchableOpacity>
                      </View>
                    </View>
                    {errors.breakTime && <AppText style={styles.errorText} language={language}>{errors.breakTime}</AppText>}
                  </View>
                )}

                {startTime && endTime && (
                  <View style={{ marginTop: 5, padding: 12, backgroundColor: "#F0FDF4", borderRadius: 12, borderWidth: 1, borderColor: "#BBF7D0" }}>
                    {(() => {
                      const times = getWorkTimes();
                      return (
                        <View style={{ gap: 4 }}>
                          {times.break ? (
                             <>
                               <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                                 <AppText style={{ color: "#4B5563", fontFamily: "Mandali" }}>{language === "te" ? "మొత్తం సమయం:" : "Total Time:"}</AppText>
                                 <AppText style={{ color: "#1F2937", fontWeight: "600", fontFamily: "Mandali" }}>{times.gross}</AppText>
                               </View>
                               <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                                 <AppText style={{ color: "#EF4444", fontFamily: "Mandali" }}>{language === "te" ? "బ్రేక్ తీసుకున్న సమయం (-):" : "Break Time (-):"}</AppText>
                                 <AppText style={{ color: "#EF4444", fontWeight: "600", fontFamily: "Mandali" }}>{times.break}</AppText>
                               </View>
                               <View style={{ height: 1, backgroundColor: "#BBF7D0", marginVertical: 4 }} />
                               <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                                 <AppText style={{ color: "#16A34A", fontWeight: "600", fontFamily: "Mandali", fontSize: 16 }}>{language === "te" ? "పని చేసిన అసలు సమయం:" : "Actual Work Time:"}</AppText>
                                 <AppText style={{ color: "#16A34A", fontWeight: "bold", fontFamily: "Mandali", fontSize: 16 }}>{times.net}</AppText>
                               </View>
                             </>
                          ) : (
                             <View style={{ flexDirection: "row", alignItems: "center" }}>
                               <Ionicons name="time" size={20} color="#16A34A" />
                               <AppText style={{ color: "#16A34A", fontWeight: "600", fontFamily: "Mandali", fontSize: 16, marginLeft: 8 }}>
                                 {language === "te" ? `మొత్తం పని: ${times.net}` : `Total Work: ${times.net}`}
                               </AppText>
                             </View>
                          )}
                        </View>
                      );
                    })()}
                  </View>
                )}

              </View>
            ) : (
              <View style={{ marginBottom: 16 }}>
                <AppText style={styles.label}>{language === "te" ? "ఎన్ని ఎకరాలు?*" : "How many acres?*"}</AppText>
                <TouchableOpacity
                  activeOpacity={1}
                  style={[styles.inputBox, { marginBottom: 0 }, activeInput === "acres" && styles.inputFocused, errors.acresWorked && styles.inputError]}
                  onPress={() => { setActiveInput("acres"); acresWorkedRef.current?.focus(); if(errors.acresWorked) setErrors({...errors, acresWorked: ""}); }}
                >
                  <TextInput
                    ref={acresWorkedRef}
                    value={acresWorked}
                    onChangeText={setAcresWorked}
                    keyboardType="numeric"
                    placeholder="0.0"
                    placeholderTextColor="#9CA3AF"
                    style={styles.input}
                    cursorColor="#16A34A"
                    onFocus={() => setActiveInput("acres")}
                    onBlur={() => setActiveInput(null)}
                  />
                </TouchableOpacity>
              </View>
            )}
            {errors.time && <AppText style={styles.errorText} language={language}>{errors.time}</AppText>}
            {errors.acresWorked && <AppText style={styles.errorText} language={language}>{errors.acresWorked}</AppText>}

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
                  {work || (language === "te" ? "పని రకం ఎంచుకోండి*" : "Select Work Type*")}
                </AppText>
              </View>
              <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
            </TouchableOpacity>
            {errors.work && <AppText style={styles.errorText} language={language}>{errors.work}</AppText>}
          </>
        )}

        {/* 💳 SECTION 2: BILLING & SETTLEMENT */}
        <View style={styles.divider} />

        <View style={styles.sectionHeader}>
           <AppText style={styles.sectionTitle}>
             {language === "te" ? "డ్రైవర్ కి లెక్క" : "Driver Payment"}
           </AppText>
        </View>

        {dPaymentType === "monthly" ? (
          <>
            <View style={{ marginBottom: 16 }}>
              <AppText style={styles.label}>
                {language === "te" ? "హాజరు*" : "Attendance*"}
              </AppText>
              <View style={styles.segmentedControl}>
                <TouchableOpacity
                  style={[styles.segmentBtn, attendance === "present" && styles.segmentActive]}
                  onPress={() => setAttendance("present")}
                >
                  <AppText style={[styles.segmentText, attendance === "present" && styles.segmentTextActive]}>
                    {language === "te" ? "పూర్తి రోజు" : "Present"}
                  </AppText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segmentBtn, attendance === "half" && styles.segmentActive]}
                  onPress={() => setAttendance("half")}
                >
                  <AppText style={[styles.segmentText, attendance === "half" && styles.segmentTextActive]}>
                    {language === "te" ? "సగం రోజు" : "Half Day"}
                  </AppText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segmentBtn, attendance === "absent" && styles.segmentActive]}
                  onPress={() => setAttendance("absent")}
                >
                  <AppText style={[styles.segmentText, attendance === "absent" && styles.segmentTextActive]}>
                    {language === "te" ? "సెలవు" : "Absent"}
                  </AppText>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ marginBottom: 16 }}>
              <AppText style={styles.label}>
                {language === "te" ? "ఈరోజు ఇచ్చిన అడ్వాన్స్/చిల్లర (₹)" : "Advance Paid Today (₹)"}
              </AppText>
              <TouchableOpacity
                activeOpacity={1}
                style={[styles.inputBox, activeInput === "advance" && styles.inputFocused]}
                onPress={() => { setActiveInput("advance"); advanceInputRef.current?.focus(); }}
              >
                <TextInput
                  ref={advanceInputRef}
                  value={advanceAmount}
                  onChangeText={setAdvanceAmount}
                  keyboardType="numeric"
                  placeholder="0"
                  style={styles.input}
                  cursorColor="#16A34A"
                  onFocus={() => setActiveInput("advance")}
                  onBlur={() => setActiveInput(null)}
                />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <View style={{ flexDirection: "row", marginBottom: 0 }}>
              <View style={{ flex: 1 }}>
                <AppText style={styles.label}>
                  {language === "te" ? "డ్రైవర్ కూలి (₹)*" : "Driver Wage (₹)*"}
                </AppText>
                <TouchableOpacity
                  activeOpacity={1}
                  style={[styles.inputBox, activeInput === "payable" && styles.inputFocused, errors.payableAmount && styles.inputError]}
                  onPress={() => { setActiveInput("payable"); payableInputRef.current?.focus(); if(errors.payableAmount) setErrors({...errors, payableAmount: ""}); }}
                >
                  <TextInput
                    ref={payableInputRef}
                    value={payableAmount}
                    onChangeText={(txt) => {
                       setPayableAmount(txt);
                       if(errors.payableAmount) setErrors({...errors, payableAmount: ""});
                    }}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#9CA3AF"
                    style={styles.input}
                    cursorColor="#16A34A"
                    onFocus={() => setActiveInput("payable")}
                    onBlur={() => setActiveInput(null)}
                  />
                </TouchableOpacity>
                {errors.payableAmount && <AppText style={styles.errorText} language={language}>{errors.payableAmount}</AppText>}
              </View>

              <View style={{ justifyContent: "center", alignItems: "center", marginHorizontal: 6, marginTop: 20 }}>
                <AppText style={{ fontSize: 24, fontWeight: "600", color: "#6B7280", fontFamily: "Mandali" }}>-</AppText>
              </View>

              <View style={{ flex: 1 }}>
                <AppText style={styles.label}>
                  {language === "te" ? "అడ్వాన్స్ ఇస్తే రాయండి (-)" : "Advance Paid (-)"}
                </AppText>
                <TouchableOpacity
                  activeOpacity={1}
                  style={[styles.inputBox, { marginBottom: 0 }, activeInput === "advance" && styles.inputFocused]}
                  onPress={() => { setActiveInput("advance"); advanceInputRef.current?.focus(); }}
                >
                  <TextInput
                    ref={advanceInputRef}
                    value={advanceAmount}
                    onChangeText={setAdvanceAmount}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#9CA3AF"
                    style={styles.input}
                    cursorColor="#16A34A"
                    onFocus={() => setActiveInput("advance")}
                    onBlur={() => setActiveInput(null)}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.finalBox}>
              <View>
                <AppText style={{ color: "#fff", opacity: 0.9, fontSize: 13, fontFamily: "Mandali" }}>
                  {language === "te" ? `డ్రైవర్ కి ఇవ్వాల్సిన బ్యాలెన్స్` : `Balance Amount (Total)`}
                </AppText>
                <AppText style={{ color: "#fff", fontSize: 24, fontWeight: "600", marginTop: 4 }}>
                  ₹{getFinalAmount()}
                </AppText>
              </View>
              <Ionicons name="wallet" size={40} color="rgba(255,255,255,0.4)" />
            </View>
          </>
        )}

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
          value={date ? new Date(date.split('-').reverse().join('-')) : new Date()}
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

      {/* ⏰ START TIME PICKER */}
      {showStartTimePicker && (
        <DateTimePicker
          value={startTime || new Date()}
          mode="time"
          display="default"
          onChange={(event, selectedTime) => {
            setShowStartTimePicker(false);
            if (selectedTime) setStartTime(selectedTime);
          }}
        />
      )}

      {/* ⏰ END TIME PICKER */}
      {showEndTimePicker && (
        <DateTimePicker
          value={endTime || startTime || new Date()}
          mode="time"
          display="default"
          onChange={(event, selectedTime) => {
            setShowEndTimePicker(false);
            if (selectedTime) setEndTime(selectedTime);
          }}
        />
      )}

      {/* ☕ BREAK START TIME PICKER */}
      {showBreakStartTimePicker && (
        <DateTimePicker
          value={breakStartTime || startTime || new Date()}
          mode="time"
          display="default"
          onChange={(event, selectedTime) => {
            setShowBreakStartTimePicker(false);
            if (selectedTime) setBreakStartTime(selectedTime);
          }}
        />
      )}

      {/* ☕ BREAK END TIME PICKER */}
      {showBreakEndTimePicker && (
        <DateTimePicker
          value={breakEndTime || breakStartTime || new Date()}
          mode="time"
          display="default"
          onChange={(event, selectedTime) => {
            setShowBreakEndTimePicker(false);
            if (selectedTime) setBreakEndTime(selectedTime);
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
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentActive: {
    backgroundColor: "#166534",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 }
  },
  segmentText: {
    fontFamily: "Mandali",
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500"
  },
  segmentTextActive: {
    color: "#ffffff",
    fontWeight: "600"
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
    marginTop: 2,
    marginBottom: 12,
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
    marginTop: 0,
    marginBottom: 20,
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