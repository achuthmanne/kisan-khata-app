import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { executeOfflineSafeRead, executeOfflineSafeWrite } from "@/utils/offlineHelper";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import MapView from "react-native-maps";

import AgriLoader from "@/components/AgriLoader";
import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent
} from "expo-speech-recognition";

export default function AddMachine() {
  const router = useRouter();
  const { machineId } = useLocalSearchParams(); 
  const isEditing = !!machineId; 
  const [language, setLanguage] = useState<"te" | "en">("en");
  
  const mapRef = useRef<MapView>(null);

  const [activeInput, setActiveInput] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({}); 
  const [isListening, setIsListening] = useState(false);
  const [voiceTarget, setVoiceTarget] = useState<string | null>(null);
  
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [equipment, setEquipment] = useState("");
  const [operations, setOperations] = useState<string[]>([]);
  // 🔥 SERVICE TYPE
  const [serviceType, setServiceType] = useState<"Rent" | "Work" | "Both" | "">("");
  
  const [modalType1, setModalType1] = useState<"operations" | null>(null);
  const [modalType, setModalType] = useState<"equipment" | null>(null);
  const [searchText, setSearchText] = useState("");
  
  const [statusModal, setStatusModal] = useState<{
    visible: boolean;
    type: "success" | "error" | "warning";
    message: string;
  }>({ visible: false, type: "success", message: "" });
  const [successModal, setSuccessModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  
  const [coords, setCoords] = useState<any>(null);
  const [locationText, setLocationText] = useState(
    language === "te" ? "స్థానాన్ని పొందుతోంది..." : "Fetching location..."
  );
  const [loading, setLoading] = useState(false);

  const [showMapModal, setShowMapModal] = useState(false);

  const nameRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);

  useEffect(() => {
    AsyncStorage.getItem("APP_LANG").then((l) => {
      if (l) setLanguage(l as any);
    });
  }, []);

  useEffect(() => {
    if (isEditing) {
      fetchMachineData();
    }
  }, [machineId]);

  const fetchMachineData = async () => {
    if (!machineId) return;
    try {
      const doc = await executeOfflineSafeRead(firestore().collection("machines").doc(machineId as string));
      const data = doc.data(); 
      if (data) {
        setOwnerName(data.ownerName || "");
        setPhone(data.phone || "");
        setEquipment(data.equipment || "");
        setOperations(data.operations || []);
        setServiceType(data.serviceType || "");
        setLocationText(data.village || "");
        
        if (data.latitude && data.longitude) {
          setCoords({ latitude: data.latitude, longitude: data.longitude });
        }
      }
    } catch (e) {
      console.log("Fetch Error:", e);
    }
  };

  const translateToTelugu = useCallback(async (text: string) => {
    try {
      const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=te&dt=t&q=${encodeURIComponent(text)}`);
      const data = await res.json();
      return data[0][0][0];
    } catch {
      return text;
    }
  }, []);

  const fetchAddressFromCoords = async (lat: number, lon: number) => {
    try {
      setLocationText(language === "te" ? "స్థానాన్ని పొందుతోంది..." : "Fetching location...");
      const address = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
      
      if (!address || address.length === 0) {
        setLocationText(language === "te" ? "లొకేషన్ వివరాలు దొరకలేదు" : "Location details not found");
        return;
      }

      const place = address[0];
      const isPlusCode = (text: string) => /\+/.test(text || "") && /[0-9]/.test(text || "");

      let parts = [];
      if (place.name && !isPlusCode(place.name)) parts.push(place.name);
      else if (place.street && !isPlusCode(place.street)) parts.push(place.street);

      if (place.subregion) parts.push(place.subregion);
      else if (place.city) parts.push(place.city);
      else if (place.district) parts.push(place.district);

      parts = [...new Set(parts)].filter(Boolean);
      let fullLocation = parts.join(", ");
      
      if (!fullLocation) fullLocation = language === "te" ? "లొకేషన్ దొరకలేదు" : "Location not found";

      if (language === "te") {
        try {
          const translated = await translateToTelugu(fullLocation);
          setLocationText(translated || fullLocation);
        } catch {
          setLocationText(fullLocation);
        }
      } else {
        setLocationText(fullLocation);
      }
    } catch (error) {
      setLocationText(language === "te" ? "లొకేషన్ పొందడంలో లోపం" : "Error getting location");
    }
  };

  const fetchLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationText(language === "te" ? "లొకేషన్ అనుమతి ఇవ్వలేదు" : "Location permission denied");
        return;
      }
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        setLocationText(language === "te" ? "GPS ఆఫ్‌లో ఉంది" : "GPS is turned off");
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      setCoords(loc.coords);
      
      mapRef.current?.animateToRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.002,
        longitudeDelta: 0.002,
      }, 1000);

      fetchAddressFromCoords(loc.coords.latitude, loc.coords.longitude);
      if (errors.location) setErrors({ ...errors, location: "" });
    } catch (error) {
      setLocationText(language === "te" ? "లొకేషన్ దొరకలేదు" : "Location not found");
    }
  };

  const handleRegionChangeComplete = (region: any) => {
    setCoords({ latitude: region.latitude, longitude: region.longitude });
    fetchAddressFromCoords(region.latitude, region.longitude);
    if (errors.location) setErrors({ ...errors, location: "" });
  };

  useEffect(() => {
    if (!isEditing) fetchLocation();
  }, [language]);

  const startVoice = async (target: string) => {
    try {
      ExpoSpeechRecognitionModule.stop();
      const res = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!res.granted) return;
      
      setVoiceTarget(target);
      setActiveInput(target);
      setIsListening(true);
      
      ExpoSpeechRecognitionModule.start({
        lang: language === "te" ? "te-IN" : "en-US",
        interimResults: true,
      });
    } catch (e) {
      console.log("Voice error", e);
    }
  };

  useSpeechRecognitionEvent("result", (event) => {
    if (!isListening || !event.results?.length) return;
    
    const text = event.results[0].transcript;
    switch (voiceTarget) {
      case "name": 
        setOwnerName(text); 
        if(errors.ownerName) setErrors({...errors, ownerName: ""});
        break;
      case "phone": 
        setPhone(text.replace(/\D/g, "")); 
        if(errors.phone) setErrors({...errors, phone: ""});
        break;
      case "operations": 
        setSearchText(text); 
        break;
    }
  });

  useSpeechRecognitionEvent("end", () => {
    setIsListening(false);
    setVoiceTarget(null);
  });

  useEffect(() => {
    return () => { ExpoSpeechRecognitionModule.stop(); };
  }, []);

  const equipmentOptions = [
    { en: "Tractor", te: "ట్రాక్టర్" },
    { en: "Mini Tractor / Chota Tractor", te: "మినీ ట్రాక్టర్ / చిన్న ట్రాక్టర్" },
    { en: "Power Tiller", te: "పవర్ టిల్లర్" },
    { en: "Combine Harvester", te: "కంబైన్డ్ హార్వెస్టర్ (కోత మిషన్)" },
    { en: "Paddy Transplanter", te: "వరి నాటు యంత్రం" },
    { en: "Seed Drill", te: "విత్తన గొర్రు (సీడ్ డ్రిల్)" },
    { en: "Tractor Mounted Sprayer / Machine Sprayer", te: "ట్రాక్టర్ స్ప్రేయర్ / యంత్రం స్ప్రేయర్" },
    { en: "Drone Sprayer", te: "డ్రోన్ స్ప్రేయర్" },
    { en: "Thresher", te: "నూర్పిడి యంత్రం (థ్రెషర్)" },
    { en: "Baler", te: "గడ్డి కట్టల మిషన్ (బేలర్)" },
    { en: "JCB / Backhoe", te: "జెసిబి (JCB)" },
    { en: "Bulldozer / Crawler Dozer", te: "డొజర్ / బుల్‌డొజర్ (Dozer)" },
    { en: "Chain Excavator / Poclain", te: "చెయిన్ ఎక్స్కవేటర్ / పొక్లెయిన్ (Poclain)" },
    { en: "Auto Trolley / 3-Wheeler", te: "ఆటో ట్రాలీ / అప్పే ఆటో" },
    { en: "TATA Ace / Mini Truck", te: "టాటా ఏస్ / చిన్న ఏనుగు (Mini Truck)" },
    { en: "Digger / Post Hole Digger", te: "గుంతలు తీసే యంత్రం (డిగ్గర్)" },
    { en: "Laser Land Leveler", te: "లేజర్ ల్యాండ్ లెవెలర్" },
    { en: "Chaff Cutter", te: "గడ్డి కత్తిరించే యంత్రం (చాఫ్ కట్టర్)" },
    { en: "Maize Sheller", te: "మొక్కజొన్న వొలిచే యంత్రం" },
  ];
  
  const equipmentOperationsMap: Record<string, {en: string, te: string}[]> = {
    "Tractor": [
      { en: "Ploughing / Tilling", te: "దున్నడం (దుక్కి)" },
      { en: "Rotavator Work", te: "రోటావేటర్ పని" },
      { en: "Cultivation", te: "గుంటక / గొర్రు తోలడం" },
      { en: "Loading & Transport", te: "లోడింగ్ మరియు రవాణా" },
      { en: "Puddling", te: "దమ్ము చేయడం" }
    ],
    "Mini Tractor / Chota Tractor": [
      { en: "Orchard Ploughing", te: "తోటల్లో దున్నడం" },
      { en: "Spraying", te: "మందు పిచికారీ" },
      { en: "Cultivation", te: "గుంటక తోలడం" },
      { en: "Light Transport", te: "చిన్న సరుకుల రవాణా" }
    ],
    "Power Tiller": [
      { en: "Puddling", te: "దమ్ము చేయడం" },
      { en: "Weeding", te: "కలుపు తీయడం" },
      { en: "Small Bed Preparation", te: "మడులు చేయడం" }
    ],
    "Combine Harvester": [
      { en: "Paddy Harvesting", te: "వరి కోత" },
      { en: "Maize Harvesting", te: "మొక్కజొన్న కోత" },
      { en: "Wheat Harvesting", te: "గోధుమ కోత" }
    ],
    "Paddy Transplanter": [
      { en: "Paddy Transplanting", te: "వరి నాట్లు వేయడం" }
    ],
    "Seed Drill": [
      { en: "Sowing / Seeding", te: "విత్తనాలు వేయడం" },
      { en: "Fertilizer Application", te: "ఎరువులు వేయడం" }
    ],
    "Tractor Mounted Sprayer / Machine Sprayer": [
      { en: "Large Scale Spraying", te: "పెద్ద ఎత్తున మందు పిచికారీ" },
      { en: "Pest & Disease Control", te: "పురుగులు & తెగుళ్ల నివారణ" }
    ],
    "Drone Sprayer": [
      { en: "Nano Urea Spraying", te: "నానో యూరియా స్ప్రేయింగ్" },
      { en: "Pesticide Spraying", te: "మందు పిచికారీ" }
    ],
    "Thresher": [
      { en: "Paddy Threshing", te: "వరి నూర్పిడి" },
      { en: "Maize Shelling", te: "మొక్కజొన్న వొలవడం" },
      { en: "Pulse Threshing", te: "పప్పు దినుసుల నూర్పిడి" }
    ],
    "Baler": [
      { en: "Straw Baling", te: "గడ్డి కట్టలు కట్టడం" },
      { en: "Fodder Collection", te: "పశుగ్రాసం సేకరణ" }
    ],
    "JCB / Backhoe": [
      { en: "Trenching / Digging", te: "కాలువలు / గుంతలు తీయడం" },
      { en: "Bush & Forest Clearing", te: "పొదల శుభ్రత" },
      { en: "Land Levelling", te: "సమతలీకరణ (లెవలింగ్)" },
      { en: "Stump Removal", te: "మొద్దులు తొలగించడం" }
    ],
    "Bulldozer / Crawler Dozer": [
      { en: "Land Clearing & Leveling", te: "భూమి చదును చేయడం" },
      { en: "Pushing Soil & Debris", te: "మట్టి నెట్టడం" }
    ],
    "Chain Excavator / Poclain": [
      { en: "Pond & Canal Digging", te: "చెరువులు/కాలువలు తవ్వడం" },
      { en: "Large Stone Breaking", te: "రాళ్లను తొలగించడం" }
    ],
    "Auto Trolley / 3-Wheeler": [
      { en: "Vegetable & Fruit Transport", te: "కూరగాయలు & పండ్ల రవాణా" },
      { en: "Local Transport (Small Loads)", te: "స్థానిక రవాణా (చిన్న సరుకులు)" }
    ],
    "TATA Ace / Mini Truck": [
      { en: "Crop Transport (Market)", te: "పంటను మార్కెట్‌కి తరలించడం" },
      { en: "Fertilizer & Seed Transport", te: "ఎరువులు & విత్తనాల రవాణా" }
    ],
    "Digger / Post Hole Digger": [
      { en: "Tree Plantation Digging", te: "మొక్కలు నాటడానికి గుంతలు" },
      { en: "Fencing Pole Digging", te: "కంచె రాళ్ల కోసం గుంతలు" }
    ],
    "Laser Land Leveler": [
      { en: "Precision Land Leveling", te: "ఖచ్చితమైన భూమి లెవలింగ్" }
    ],
    "Chaff Cutter": [
      { en: "Grass Cutting", te: "గడ్డి కత్తిరించడం" },
      { en: "Fodder Preparation", te: "పశుగ్రాసం తయారీ" }
    ],
    "Maize Sheller": [
      { en: "Maize Shelling", te: "మొక్కజొన్న వొలవడం" }
    ]
  };

  const getMappedOperations = () => {
    const eqObj = equipmentOptions.find(e => e.en === equipment || e.te === equipment);
    if (!eqObj) return [];
    return equipmentOperationsMap[eqObj.en] || [];
  };

  const baseOperations = getMappedOperations();
  
  const customOperations = operations
    .filter(op => !baseOperations.some(b => b.en === op || b.te === op))
    .map(op => ({ en: op, te: op, isCustom: true }));

  const allAvailableOperations = [...baseOperations, ...customOperations];

  const filteredOperations = allAvailableOperations.filter(item => {
    const value = (language === "te" ? item.te : item.en).toLowerCase().trim();
    return (value || "").includes(searchText.toLowerCase().trim());
  });

  const handleSave = async (bypassDuplicate = false) => {
    if (loading) return;

    const newErrors: any = {};
    if (!ownerName.trim()) newErrors.ownerName = language === "te" ? "యజమాని పేరు నమోదు చేయండి*" : "Enter owner name*";
    
    if (!phone.trim()) {
      newErrors.phone = language === "te" ? "ఫోన్ నంబర్ నమోదు చేయండి*" : "Enter phone number*";
    } else if (!/^[6-9]\d{9}$/.test(phone.trim())) {
      newErrors.phone = language === "te" ? "సరైన ఫోన్ నంబర్ ఇవ్వండి*" : "Enter valid phone number*";
    }

    if (!equipment) newErrors.equipment = language === "te" ? "యంత్రం ఎంచుకోండి*" : "Select equipment*";
    if (operations.length === 0) newErrors.operations = language === "te" ? "కనీసం ఒక పని ఎంచుకోండి*" : "Select at least one operation*";
    
    if (!serviceType) newErrors.serviceType = language === "te" ? "అందుబాటు విధానాన్ని ఎంచుకోండి*" : "Select availability mode*";

    if (!coords) newErrors.location = language === "te" ? "లొకేషన్ దొరకలేదు, దయచేసి మ్యాప్ లో ఎంచుకోండి*" : "Location not found, select on map*";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    const userPhone = await AsyncStorage.getItem("USER_PHONE");
    if (!userPhone) return;

    setLoading(true);

    try {
      const machineData = {
        ownerName: ownerName.trim(),
        phone: phone.trim(),
        equipment,
        operations,
        serviceType, 
        latitude: coords.latitude,
        longitude: coords.longitude,
        village: locationText,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };

      const ref = firestore().collection("machines");

      if (!isEditing && !bypassDuplicate) {
        const duplicateCheck = await executeOfflineSafeRead(ref
          .where("phone", "==", phone.trim())
          .where("equipment", "==", equipment)
          .get());

        if (!duplicateCheck.empty) {
          setLoading(false);
          setShowDuplicateModal(true);
          return;
        }
      }

      if (isEditing) {
        await executeOfflineSafeWrite(ref.doc(machineId as string).update(machineData));
      } else {
        await executeOfflineSafeWrite(ref.add({
          ...machineData,
          userId: userPhone,
          createdAt: firestore.FieldValue.serverTimestamp(),
        }));
      }

      setLoading(false);
      setSuccessModal(true);
    } catch (e) {
      setLoading(false);
      setStatusModal({
        visible: true,
        type: "error",
        message: language === "te" ? "సర్వర్ సమస్య, మళ్ళీ ప్రయత్నించండి." : "Server error, please try again."
      });
    }
  };

  /* ---------------- UI ---------------- */
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <AppHeader
        title={isEditing ? (language === "te" ? "వివరాలు సవరించండి" : "Edit Machine") : (language === "te" ? "యంత్రం జోడించండి" : "Add Machine")}
        subtitle={language === "te" ? "వివరాలు నమోదు చేయండి" : "Enter details"}
        language={language}
      />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.container}>
            
            {/* 👤 NAME INPUT */}
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => { setActiveInput("name"); nameRef.current?.focus(); }}
              style={[styles.inputBox, activeInput === "name" && styles.inputFocused, errors.ownerName && styles.inputError]}
            >
              <Ionicons name="person-outline" size={20} color={ownerName || activeInput === "name" ? "#16A34A" : "#9CA3AF"} />
              <View style={styles.inputWrapper}>
                {!ownerName && activeInput !== "name" && (
                  <AppText style={{ color: "#9CA3AF", fontFamily: "Mandali" }}>{language === "te" ? "యజమాని పేరు*" : "Owner Name*"}</AppText>
                )}
                <TextInput
                  ref={nameRef}
                  value={ownerName}
                  onChangeText={(txt) => { setOwnerName(txt); if (errors.ownerName) setErrors({ ...errors, ownerName: "" }); }}
                  style={[styles.input, { display: (ownerName || activeInput === "name") ? "flex" : "none" }]}
                  cursorColor={'#16A34A'}
                  selectionColor={'#16A34A40'}
                  onFocus={() => setActiveInput("name")}
                  onBlur={() => setActiveInput(null)}
                />
              </View>
              {ownerName && ownerName.trim().length > 0 ? (
                <TouchableOpacity onPress={() => setOwnerName("")} style={styles.micBtn}>
                  <Ionicons name="close-circle" size={24} color="#9CA3AF" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => startVoice("name")} style={styles.micBtn}>
                  <MaterialCommunityIcons name={isListening && voiceTarget === "name" ? "microphone" : "microphone-outline"} size={24} color={isListening && voiceTarget === "name" ? "#EF4444" : (activeInput === "name" ? "#16A34A" : "#6B7280")} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
            {errors.ownerName && <AppText style={styles.errorText} language={language}>{errors.ownerName}</AppText>}

            {/* 📞 PHONE INPUT */}
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => { setActiveInput("phone"); phoneRef.current?.focus(); }}
              style={[styles.inputBox, activeInput === "phone" && styles.inputFocused, errors.phone && styles.inputError]}
            >
              <Ionicons name="call-outline" size={20} color={phone || activeInput === "phone" ? "#16A34A" : "#9CA3AF"} />
              <View style={styles.inputWrapper}>
                {!phone && activeInput !== "phone" && (
                  <AppText style={{ color: "#9CA3AF", fontFamily: "Mandali" }}>{language === "te" ? "ఫోన్ నంబర్*" : "Phone Number*"}</AppText>
                )}
                <TextInput
                  ref={phoneRef}
                  value={phone}
                  onChangeText={(txt) => { setPhone(txt); if (errors.phone) setErrors({ ...errors, phone: "" }); }}
                  cursorColor={'#16A34A'}
                  selectionColor={'#16A34A40'}
                  keyboardType="numeric"
                  maxLength={10}
                  style={[styles.input, { display: (phone || activeInput === "phone") ? "flex" : "none" }]}
                  onFocus={() => setActiveInput("phone")}
                  onBlur={() => setActiveInput(null)}
                />
              </View>
              {phone && phone.trim().length > 0 ? (
                <TouchableOpacity onPress={() => setPhone("")} style={styles.micBtn}>
                  <Ionicons name="close-circle" size={24} color="#9CA3AF" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => startVoice("phone")} style={styles.micBtn}>
                  <MaterialCommunityIcons name={isListening && voiceTarget === "phone" ? "microphone" : "microphone-outline"} size={24} color={isListening && voiceTarget === "phone" ? "#EF4444" : (activeInput === "phone" ? "#16A34A" : "#6B7280")} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
            {errors.phone && <AppText style={styles.errorText} language={language}>{errors.phone}</AppText>}

            {/* 🚜 FIXED EQUIPMENT SELECT */}
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.inputBox, modalType === "equipment" && styles.inputFocused, errors.equipment && styles.inputError]}
              onPress={() => { setModalType("equipment"); setActiveInput("equipment"); if (errors.equipment) setErrors({ ...errors, equipment: "" }); }}
            >
              <MaterialCommunityIcons name="tractor-variant" size={22} color={equipment || modalType === "equipment" ? "#16A34A" : "#9CA3AF"} />
              <View style={styles.inputWrapper}>
                <AppText style={{ color: equipment ? "#1F2937" : "#9CA3AF", fontFamily: "Mandali" }}>
                  {equipment || (language === "te" ? "యంత్రం ఎంచుకోండి*" : "Select Equipment*")}
                </AppText>
              </View>
              <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
            </TouchableOpacity>
            {errors.equipment && <AppText style={styles.errorText} language={language}>{errors.equipment}</AppText>}

            {/* ⚙️ DYNAMIC OPERATIONS */}
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.inputBox, modalType1 === "operations" && styles.inputFocused, errors.operations && styles.inputError]}
              onPress={() => { 
                if(!equipment) {
                  setErrors({...errors, equipment: language === "te" ? "ముందుగా యంత్రాన్ని ఎంచుకోండి" : "Select equipment first"});
                  return;
                }
                setModalType1("operations"); 
                setActiveInput("operations"); 
                if (errors.operations) setErrors({ ...errors, operations: "" }); 
              }}
            >
              <Ionicons name="options-outline" size={20} color={operations.length || modalType1 === "operations" ? "#16A34A" : "#9CA3AF"} />
              <View style={styles.inputWrapper}>
                <AppText style={{ color: operations.length ? "#1F2937" : "#9CA3AF", fontFamily: "Mandali" }}>
                  {operations.length ? `${operations.length} ${language === "te" ? "ఎంపిక చేయబడ్డాయి" : "Selected"}` : (language === "te" ? "పనులు ఎంచుకోండి*" : "Select Operations*")}
                </AppText>
              </View>
              <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
            </TouchableOpacity>
            {errors.operations && <AppText style={styles.errorText} language={language}>{errors.operations}</AppText>}

            {/* SELECTED CHIPS */}
            {operations.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <AppText style={styles.selectedTitle}>{language === "te" ? "ఎంచుకున్న పనులు" : "Selected Operations"}</AppText>
                <View style={styles.chipsContainer}>
                  {operations.map((op, index) => (
                    <View key={index} style={styles.chipBox}>
                      <AppText style={styles.chipText}>{op}</AppText>
                      <TouchableOpacity onPress={() => setOperations(prev => prev.filter(i => i !== op))}>
                        <Ionicons name="close-circle" size={18} color="#166534" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* 🔥 NEW SECTION: RENT OR WORK (SERVICE TYPE) */}
            <View style={{ marginBottom: 20 }}>
              <AppText style={styles.selectedTitle}>
                {language === "te" ? "అందుబాటు విధానం*" : "Availability Mode*"}
              </AppText>
              
              <View style={styles.availRow}>
                {[
                  { id: "Rent", en: "Rent Only", te: "అద్దెకు మాత్రమే", icon: "key-outline" },
                  { id: "Work", en: "Provide Service", te: "పనులకు వెళ్తాం", icon: "cog-outline" },
                  { id: "Both", en: "Rent & Service", te: "రెండింటికి", icon: "swap-horizontal-outline" }
                ].map((opt) => {
                  const isActive = serviceType === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      activeOpacity={0.7}
                      style={[styles.availCard, isActive && styles.availCardActive]}
                      onPress={() => {
                        setServiceType(opt.id as any);
                        if (errors.serviceType) setErrors({ ...errors, serviceType: "" });
                      }}
                    >
                      <Ionicons name={opt.icon as any} size={20} color={isActive ? "#16A34A" : "#6B7280"} />
                      <AppText style={[styles.availText, isActive && styles.availTextActive]}>
                        {language === "te" ? opt.te : opt.en}
                      </AppText>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {errors.serviceType && <AppText style={styles.errorText} language={language}>{errors.serviceType}</AppText>}
            </View>

            {/* 📍 LOCATION */}
            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={() => { setShowMapModal(true); if (errors.location) setErrors({ ...errors, location: "" }); }}
              style={[styles.inputBox, !coords && { borderColor: '#FCA5A5' }, errors.location && styles.inputError]}
            >
              <Ionicons name="location" size={20} color={coords ? "#16A34A" : "#EF4444"} />
              <View style={styles.inputWrapper}>
                <AppText style={{ color: coords ? "#1F2937" : "#EF4444", fontSize: 14, fontFamily: "Mandali" }} numberOfLines={1}>{locationText}</AppText>
              </View>
              <View style={styles.blueMapBtn}>
                <MaterialCommunityIcons name="map-marker-radius" size={20} color="#2563EB" />
              </View>
            </TouchableOpacity>
            {errors.location && <AppText style={styles.errorText} language={language}>{errors.location}</AppText>}

            {/* ⚠️ LOCATION WARNING */}
            <View style={styles.locationNoteBox}>
              <Ionicons name="information-circle-outline" size={16} color="#B91C1C" />
              <AppText style={styles.locationNoteText}>
                {language === "te" ? `గమనిక: ${equipment ? equipment : "మెషీన్"} ఉన్న చోట నుండి మాత్రమే వివరాలను నమోదు చేయండి. లొకేషన్ మార్చుకోవడానికి పైనున్న బ్లూ బటన్ ని నొక్కండి.` : `Note: Add details only when you are at the ${equipment ? equipment : "machine"}'s location. Click the blue map icon above to adjust your location.`}
              </AppText>
            </View>

            {/* SAVE BUTTON */}
            <TouchableOpacity activeOpacity={0.8} style={styles.saveBtn} onPress={() => handleSave(false)}>
              <LinearGradient colors={["#2E7D32", "#1B5E20"]} style={styles.saveGradient}>
                <AppText style={styles.saveText}>{isEditing ? (language === "te" ? "సవరించండి" : "Update Machine") : (language === "te" ? "భద్రపరచండి" : "Save Machine")}</AppText>
              </LinearGradient>
            </TouchableOpacity>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ---------------- MAP MODAL ---------------- */}
      <Modal visible={showMapModal} animationType="slide" transparent={false}>
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          {coords && (
            <MapView
              ref={mapRef}
              style={StyleSheet.absoluteFillObject}
              initialRegion={{ latitude: coords.latitude, longitude: coords.longitude, latitudeDelta: 0.002, longitudeDelta: 0.002 }}
              showsUserLocation={true}
              showsMyLocationButton={false} 
              onRegionChangeComplete={handleRegionChangeComplete}
            />
          )}

          <View style={styles.centerPinWrapper} pointerEvents="none">
            <Ionicons name="location-sharp" size={46} color="#DC2626" />
          </View>

          <SafeAreaView style={styles.mapTopArea}>
            <TouchableOpacity activeOpacity={0.8} onPress={() => setShowMapModal(false)} style={styles.simpleBackBtn}>
              <Ionicons name="chevron-back" size={24} color="#111827" />
            </TouchableOpacity>
          </SafeAreaView>

          <View style={styles.bottomContainer}>
            <TouchableOpacity activeOpacity={0.8} style={styles.simpleLocateBtn} onPress={fetchLocation}>
              <MaterialCommunityIcons name="crosshairs-gps" size={22} color="#2563EB" />
            </TouchableOpacity>

            <View style={styles.minimalBottomCard}>
              <View style={styles.addressRow}>
                <Ionicons name="location" size={24} color="#16A34A" />
                <AppText style={styles.minimalAddress} numberOfLines={2}>{locationText}</AppText>
              </View>
              <TouchableOpacity activeOpacity={0.85} onPress={() => setShowMapModal(false)}>
                <LinearGradient colors={["#2E7D32", "#1B5E20"]} style={styles.minimalConfirmBtn}>
                  <AppText style={styles.minimalConfirmText}>{language === "te" ? "లొకేషన్ నిర్ధారించండి" : "Confirm Location"}</AppText>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 🚜 EQUIPMENT MODAL (Search Bar Removed, Fixed List) */}
      <Modal visible={modalType === "equipment"} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <AppText style={styles.modalTitleText}>{language === "te" ? "యంత్రం ఎంచుకోండి" : "Select Equipment"}</AppText>
              <TouchableOpacity onPress={() => { setModalType(null); setActiveInput(null); }}>
                <Ionicons name="close-circle" size={28} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={equipmentOptions}
              keyExtractor={(item, i) => i.toString()}
              renderItem={({ item }) => {
                const label = language === "te" ? item.te : item.en;
                const isSelected = equipment === label;
                return (
                  <TouchableOpacity
                    style={styles.categoryItem}
                    onPress={() => { 
                      const newEq = label;
                      if(equipment !== newEq) setOperations([]); // Reset operations if equipment changes
                      setEquipment(newEq); 
                      setModalType(null); 
                      setActiveInput(null); 
                    }}
                  >
                    <AppText style={{ color: isSelected ? "#16A34A" : "#1F2937", fontWeight: isSelected ? "600" : "400" }}>{label}</AppText>
                    {isSelected && <Ionicons name="checkmark-circle" size={22} color="#16A34A" />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* ⚙️ OPERATIONS MODAL (Dynamic based on Equipment) */}
      <Modal visible={modalType1 === "operations"} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <AppText style={styles.modalTitleText}>{language === "te" ? "పనులు ఎంచుకోండి" : "Select Operations"}</AppText>
              <TouchableOpacity onPress={() => { setModalType1(null); setActiveInput(null); }}>
                <Ionicons name="close-circle" size={28} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            
            {/* SEARCH BAR WITH CUSTOM ADD BTN (+) */}
            <View style={[styles.searchBar, { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 12, marginTop: 10 }]}>
              <TextInput
                autoFocus
                placeholder={language === "te" ? "టైప్ చేయండి..." : "Type operation..."}
                value={searchText}
                placeholderTextColor="#9CA3AF"
                cursorColor="#16A34A"
                onChangeText={(text) => setSearchText(text)}
                style={[styles.searchInput, { fontFamily: "Mandali", color: "#1F2937" }]}
              />
              
              {/* 🔥 NEW GREEN (+) BUTTON FOR CUSTOM ADD */}
              {searchText.trim().length > 0 && (
                <TouchableOpacity 
                  onPress={() => {
                    const newOp = searchText.trim();
                    if (!operations.includes(newOp)) setOperations(prev => [...prev, newOp]);
                    setSearchText("");
                  }} 
                  style={styles.addCustomBtn}
                >
                  <Ionicons name="add" size={20} color="#fff" />
                </TouchableOpacity>
              )}

              {searchText && searchText.trim().length > 0 ? (
                <TouchableOpacity onPress={() => setSearchText("")} style={styles.voiceBtnSearch}>
                  <Ionicons name="close-circle" size={24} color="#9CA3AF" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => startVoice("operations")} style={styles.voiceBtnSearch}>
                  <MaterialCommunityIcons name={isListening && voiceTarget === "operations" ? "microphone" : "microphone-outline"} size={20} color={isListening && voiceTarget === "operations" ? "#EF4444" : "#16A34A"} />
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={filteredOperations}
              keyExtractor={(item, i) => i.toString()}
              ListEmptyComponent={() => (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <AppText style={{ color: '#9CA3AF' }}>{language === "te" ? "పైన టైప్ చేసి + నొక్కండి" : "Type above and press +"}</AppText>
                </View>
              )}
              renderItem={({ item }) => {
                const label = language === "te" ? item.te : item.en;
                const selected = operations.includes(label);
                return (
                  <TouchableOpacity
                    style={styles.categoryItem}
                    onPress={() => setOperations(prev => selected ? prev.filter(i => i !== label) : [...prev, label])}
                  >
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                      <AppText>{label}</AppText>
                      {(item as any).isCustom && <AppText style={{fontSize: 10, color: '#2563EB', marginLeft: 8}}>(Custom)</AppText>}
                    </View>
                    <Ionicons name={selected ? "checkbox" : "square-outline"} size={22} color={selected ? "#16A34A" : "#9CA3AF"} />
                  </TouchableOpacity>
                );
              }}
            />
            
            {operations.length > 0 && (
              <View style={styles.modalFooter}>
                <TouchableOpacity activeOpacity={0.8} onPress={() => { setModalType1(null); setSearchText(""); setActiveInput(null); }}>
                  <LinearGradient colors={["#2E7D32", "#1B5E20"]} style={styles.modalDoneBtn}>
                    <AppText style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>{language === "te" ? "పూర్తయింది" : "Done"}</AppText>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}

          </View>
        </View>
      </Modal>

      {/* STATUS & SUCCESS MODALS */}
      <Modal visible={statusModal.visible} transparent animationType="fade">
        <View style={styles.statusOverlay}>
          <View style={styles.statusContent}>
            <View style={[styles.iconCircle, { backgroundColor: statusModal.type === "warning" ? "#FFFBEB" : "#F0FDF4" }]}>
              <Ionicons name={statusModal.type === "warning" ? "alert-circle" : "checkmark-circle"} size={50} color={statusModal.type === "warning" ? "#F59E0B" : "#16A34A"} />
            </View>
            <AppText style={styles.statusTitle}>{statusModal.type === "warning" ? (language === "te" ? "గమనిక!" : "Attention!") : (language === "te" ? "విజయం!" : "Success!") }</AppText>
            <AppText style={styles.statusDescription}>{statusModal.message}</AppText>
            <TouchableOpacity activeOpacity={0.8} style={[styles.statusActionBtn, { backgroundColor: statusModal.type === "warning" ? "#F59E0B" : "#16A34A" }]} onPress={() => setStatusModal({ ...statusModal, visible: false })}>
              <AppText style={styles.statusActionText}>{language === "te" ? "సరే, అర్థమైంది" : "OK, Got it"}</AppText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 🔥 DYNAMIC SUCCESS MODAL BASED ON SERVICE TYPE */}
      <Modal visible={successModal} transparent animationType="fade">
        <View style={styles.successOverlay}>
          <View style={styles.successBox}>
            <View style={styles.successIcon}><Ionicons name="checkmark-done-circle" size={60} color="#16A34A" /></View>
            <AppText style={styles.successTitle}>{language === "te" ? "విజయం!" : "Success!"}</AppText>
           <AppText style={styles.successMsg}>
              {isEditing 
                ? (language === "te" 
                    ? "మీ యంత్ర వివరాలు విజయవంతంగా అప్‌డేట్ అయ్యాయి!" 
                    : "Your machine details have been updated successfully!") 
                : (language === "te" 
                    ? "అగ్రి కనెక్ట్ లో మీ యంత్రాన్ని జోడించినందుకు ధన్యవాదాలు! ఇకపై అవసరం ఉన్న రైతులు నేరుగా మీకు ఫోన్ చేసి మాట్లాడతారు." 
                    : "Thank you for adding your machine to AgriConnect! Farmers in need will now call and contact you directly.")
              }
            </AppText>
            <View style={{ width: "100%" }}>
              <TouchableOpacity activeOpacity={0.8} style={[styles.successBtn, { backgroundColor: "#0a7130" }]} onPress={() => { setSuccessModal(false); router.replace("/farmer/bookings"); }}>
                <AppText style={styles.successBtnText}>{language === "te" ? "పూర్తయింది" : "Done"}</AppText>
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
            <AppText style={styles.modalTitleStandardInfo}>
              {language === "te" ? "ఇప్పటికే నమోదు అయి ఉంది!" : "Duplicate Entry!"}
            </AppText>
            <AppText style={styles.modalSubStandard}>
              {language === "te" ? "సరిగ్గా ఇదే మెషీన్ మరియు ఫోన్ నంబర్ తో వివరాలు ఇప్పటికే ఉన్నాయి.\n\nమీరు ఖచ్చితంగా మళ్లీ జతచేయాలనుకుంటున్నారా?" : "An exact machine and phone number entry already exists.\n\nAre you sure you want to add this duplicate entry?"}
            </AppText>
            <View style={styles.modalButtonsStandard}>
              <TouchableOpacity activeOpacity={0.8} style={styles.modalCancelBtnStandard} onPress={() => setShowDuplicateModal(false)}>
                <AppText style={styles.modalCancelTextStandard}>{language === 'te' ? "వద్దు" : "Cancel"}</AppText>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.8} style={styles.modalInfoBtnStandard}
                onPress={() => { setShowDuplicateModal(false); handleSave(true); }}
              >
                <AppText style={styles.modalInfoTextStandard}>{language === 'te' ? "అవును, సేవ్ చేయి" : "Yes, Save"}</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <AgriLoader visible={loading} type="saving" language={language} />
    </SafeAreaView>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6F7F6" },
  scrollContainer: { paddingBottom: 150 },
  container: { padding: 20 },
  
  inputBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#F9FAFB", borderRadius: 12, paddingHorizontal: 15, height: 55, marginBottom: 16, borderWidth: 1, borderColor: "#D1D5DB" },
  inputFocused: { borderColor: "#16A34A", backgroundColor: "#FFFFFF", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  inputError: { borderColor: "#EF4444" },
  errorText: { color: "#EF4444", fontSize: 12, fontFamily: "Mandali", marginTop: -10, marginBottom: 10, marginLeft: 4 },
  inputWrapper: { flex: 1, justifyContent: "center", marginLeft: 10 },
  input: { flex: 1, fontSize: 16, fontFamily: "Mandali", textAlignVertical: "center", includeFontPadding: false },
  
  micBtn: { marginLeft: 10, padding: 4 },
  blueMapBtn: { backgroundColor: '#EFF6FF', padding: 8, borderRadius: 10, marginLeft: 10 },
  
  addCustomBtn: { marginLeft: 10, padding: 6, borderRadius: 10, backgroundColor: "#16A34A", justifyContent: "center", alignItems: "center" },
  voiceBtnSearch: { marginLeft: 10, padding: 6, borderRadius: 10, backgroundColor: "#E5E7EB" },

  // 🔥 NEW AVAILABILITY CARDS
  availRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  availCard: { flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 12, borderWidth: 1, borderColor: "#D1D5DB", backgroundColor: "#F9FAFB" },
  availCardActive: { borderColor: "#16A34A", backgroundColor: "#F0FDF4" },
  availText: { fontSize: 13, color: "#4B5563", marginTop: 6, fontFamily: "Mandali", textAlign: "center" },
  availTextActive: { color: "#166534", fontWeight: "600" },

  saveBtn: { marginTop: 10, borderRadius: 18, overflow: "hidden" },
  saveGradient: { height: 56, justifyContent: "center", alignItems: "center" },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "600" },

  selectedTitle: { fontSize: 13, color: "#6B7280", marginBottom: 6, marginLeft: 4 },
  chipsContainer: { flexDirection: "row", flexWrap: "wrap" },
  chipBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#DCFCE7", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, marginRight: 8, marginBottom: 8 },
  chipText: { fontSize: 13, color: "#166534", marginRight: 6 },
  
  categoryItem: { padding: 18, flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },

  modalHeader: { flexDirection: "row", justifyContent: "space-between", padding: 20, alignItems: "center" },
  modalTitleText: { fontSize: 18, fontWeight: "600" },
  searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: "#F3F4F6", margin: 20, borderRadius: 18, paddingHorizontal: 12, borderWidth: 1, borderColor: "#E5E7EB" },
  searchInput: { flex: 1, height: 50 },
  
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#fff", height: "65%", borderTopLeftRadius: 25, borderTopRightRadius: 25 },
  
  modalFooter: { padding: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6', backgroundColor: '#fff' },
  modalDoneBtn: { height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },

  locationNoteBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', padding: 10, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#FEE2E2', marginHorizontal: 4 },
  locationNoteText: { fontSize: 12, color: '#B91C1C', marginLeft: 6, flex: 1, fontFamily: "Mandali" },

  centerPinWrapper: { position: 'absolute', top: '50%', left: '50%', marginTop: -40, marginLeft: -23, zIndex: 1, elevation: 5, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5 },
  mapTopArea: { position: 'absolute', top: Platform.OS === 'android' ? 40 : 50, left: 20, right: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  simpleBackBtn: { width: 44, height: 44, backgroundColor: '#fff', borderRadius: 22, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 5 },
  bottomContainer: { position: 'absolute', bottom: 0, width: '100%' },
  simpleLocateBtn: { position: 'absolute', bottom: "100%", right: 20, marginBottom: 15, width: 44, height: 44, backgroundColor: '#fff', borderRadius: 22, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 5 },
  
  minimalBottomCard: { width: '100%', backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: Platform.OS === 'ios' ? 35 : 20, elevation: 15, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  addressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
  minimalAddress: { flex: 1, fontSize: 13, color: '#4B5563', lineHeight: 18, fontFamily: "Mandali" },
  minimalConfirmBtn: { 
    paddingVertical: 10, 
    borderRadius: 10, 
    alignItems: 'center', 
    justifyContent: 'center',
    elevation: 3, 
    shadowColor: '#16A34A', 
    shadowOffset: { width: 0, height: 3 }, 
    shadowOpacity: 0.25, 
    shadowRadius: 5 
  },
  minimalConfirmText: { color: '#fff', fontSize: 14, fontWeight: '600', fontFamily: "Mandali" },

  statusOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", padding: 20 },
  statusContent: { width: "100%", maxWidth: 340, backgroundColor: "#fff", borderRadius: 30, padding: 25, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 },
  iconCircle: { width: 90, height: 90, borderRadius: 45, justifyContent: "center", alignItems: "center", marginBottom: 20 },
  statusTitle: { fontSize: 22, fontWeight: "600", color: "#1F2937", marginBottom: 10, fontFamily: "Mandali" },
  statusDescription: { fontSize: 16, textAlign: "center", color: "#6B7280", lineHeight: 24, marginBottom: 25, fontFamily: "Mandali", paddingHorizontal: 10 },
  statusActionBtn: { width: "100%", height: 55, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  statusActionText: { color: "#fff", fontSize: 17, fontWeight: "600", fontFamily: "Mandali" },
  
  successOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", padding: 20 },
  successBox: { width: "100%", maxWidth: 340, backgroundColor: "#fff", borderRadius: 28, padding: 25, alignItems: "center" },
  successIcon: { marginBottom: 15 },
  successTitle: { fontSize: 22, fontWeight: "600", marginBottom: 8 },
  successMsg: { textAlign: "center", color: "#6B7280", marginBottom: 20, lineHeight: 22 },
  successBtn: { height: 50, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  successBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },

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