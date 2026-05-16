import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent
} from "expo-speech-recognition";
import React, { useCallback, useEffect, useRef, useState } from "react";
// 🔥 MapView & Region Imports
import MapView, { Region } from "react-native-maps";

import {
  FlatList,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

import AgriLoader from "@/components/AgriLoader";
import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";
import AppEmptyState from "@/components/AppEmptyState";

const getLocalImage = (type: string) => {
  if (!type) return require("@/assets/images/John-deere-Tractors..jpg");
  const t = type.toLowerCase();
  if (t.includes("mini tractor") || t.includes("మినీ ట్రాక్టర్")) return require("@/assets/images/mini.webp");
  if (t.includes("power tiller") || t.includes("పవర్ టిల్లర్")) return require("@/assets/images/tiller.avif");
  if (t.includes("combine harvester") || t.includes("కంబైన్డ్ హార్వెస్టర్") || t.includes("కోత మిషన్")) return require("@/assets/images/harvester.jpg");
  if (t.includes("paddy transplanter") || t.includes("వరి నాటు యంత్రం")) return require("@/assets/images/vari.png");
  if (t.includes("seed drill") || t.includes("విత్తన గొర్రు") || t.includes("సీడ్ డ్రిల్")) return require("@/assets/images/seeddrill.jpg");
  if (t.includes("tata") || t.includes("ace") || t.includes("ఏస్") || t.includes("ఏనుగు") || t.includes("mini truck")) return require("@/assets/images/tataace.jpg"); 
  if (t.includes("sprayer") || t.includes("స్ప్రేయర్")) return require("@/assets/images/sprayer.jpg");
  if (t.includes("tractor") || t.includes("ట్రాక్టర్")) return require("@/assets/images/John-deere-Tractors..jpg");
  if (t.includes("dozer") || t.includes("డొజర్") || t.includes("bulldozer")) return require("@/assets/images/dozer.avif"); 
  if (t.includes("drone sprayer") || t.includes("డ్రోన్ స్ప్రేయర్")) return require("@/assets/images/drone.jpg");
  if (t.includes("thresher") || t.includes("నూర్పిడి యంత్రం") || t.includes("థ్రెషర్")) return require("@/assets/images/tresher.jpg");
  if (t.includes("baler") || t.includes("గడ్డి కట్టల మిషన్") || t.includes("బేలర్")) return require("@/assets/images/baler.jpg");
  if (t.includes("jcb") || t.includes("జెసిబి") || t.includes("backhoe")) return require("@/assets/images/jcb.webp");
  if (t.includes("auto") || t.includes("ఆటో") || t.includes("trolley") || t.includes("ట్రాలీ") || t.includes("ape") || t.includes("అప్పే")) return require("@/assets/images/auto.webp"); 
  if (t.includes("excavator") || t.includes("poclain") || t.includes("పొక్లెయిన్") || t.includes("ఎక్స్కవేటర్") || t.includes("హిటాచి")) return require("@/assets/images/chain.jpg"); 
  if (t.includes("tipper") || t.includes("టిప్పర్")) return require("@/assets/images/tataace.jpg");
  if (t.includes("digger") || t.includes("గుంతలు తీసే యంత్రం")) return require("@/assets/images/digger.jpg");
  if (t.includes("laser land leveler") || t.includes("లేజర్ ల్యాండ్ లెవెలర్")) return require("@/assets/images/laser.jpg");
  if (t.includes("chaff cutter") || t.includes("గడ్డి కత్తిరించే యంత్రం")) return require("@/assets/images/chaff.jpg");
  if (t.includes("maize sheller") || t.includes("మొక్కజొన్న వొలిచే యంత్రం")) return require("@/assets/images/maize.jpg");
  return require("@/assets/images/John-deere-Tractors..jpg");
};

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

const radiusOptions = [2, 5, 10, 20, 50];

export default function FindMachines() {
  const router = useRouter();
  const [language, setLanguage] = useState<"te" | "en">("en");
  const [coords, setCoords] = useState<any>(null);
  const [locationText, setLocationText] = useState("");
  const [loading, setLoading] = useState(true);
  const [translatedData, setTranslatedData] = useState<any>({});
  
  // 🔥 Map Reference for Zomato style animation
  const mapRef = useRef<MapView>(null);

  const [equipment, setEquipment] = useState("");
  const [searchText, setSearchText] = useState("");
  const [selectedEq, setSelectedEq] = useState(""); 
  const [radius, setRadius] = useState(10);
  const [modalType, setModalType] = useState<"equipment" | "radius" | null>(null);
  const [allMachines, setAllMachines] = useState<any[]>([]);
  const [showAll, setShowAll] = useState(false); 
  const [results, setResults] = useState<any[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [voiceTarget, setVoiceTarget] = useState<"equipment" | null>(null);

  const [showMapModal, setShowMapModal] = useState(false);

  useEffect(() => {
    if (language !== "te") {
      setTranslatedData({});
      return;
    }

    const translateAll = async () => {
      let newData: any = {};
      for (let item of results) {
        try {
          const translatedEquipment = await translateToTelugu(item.equipment || "");
          const translatedOwner = await translateToTelugu(item.ownerName || "");
          const translatedVillage = await translateToTelugu(item.village || "");
          const translatedOps = await Promise.all(
            (item.operations || []).map((op: string) => translateToTelugu(op))
          );
          newData[item.id] = { equipment: translatedEquipment, ownerName: translatedOwner, village: translatedVillage, operations: translatedOps };
        } catch {
          newData[item.id] = item;
        }
      }
      setTranslatedData(newData);
    };

    translateAll();
  }, [results, language]);

  useEffect(() => {
    if (!coords) return;
    let filtered = allMachines;
    if (selectedEq && !showAll) {
      filtered = filtered.filter(m => m.equipment === selectedEq);
    }
    const final = filtered.map(m => ({
      ...m,
      distance: getDistance(coords.latitude, coords.longitude, m.latitude, m.longitude)
    })).filter(m => m.distance <= radius).sort((a, b) => a.distance - b.distance);
    setResults(final);
  }, [coords, selectedEq, radius, allMachines, showAll]); 

  useEffect(() => {
    (async () => {
      const l = await AsyncStorage.getItem("APP_LANG");
      const lang = l ? (l as "te" | "en") : "en";
      setLanguage(lang);
    })();
  }, []);

  useEffect(() => {
    if (!language) return;
    fetchLocation();
  }, [language]); 

  const translateToTelugu = useCallback(async (text: string) => {
    try {
      const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=te&dt=t&q=${encodeURIComponent(text)}`);
      const data = await res.json();
      return data[0][0][0];
    } catch {
      return text;
    }
  }, []);

  /* ---------------- ZOMATO LEVEL LOCATION LOGIC ---------------- */
  const fetchAddressFromCoords = async (lat: number, lon: number) => {
    try {
      setLocationText(language === "te" ? "లొకేషన్ వెతుకుతోంది..." : "Fetching...");
      const address = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
      
      if (!address || address.length === 0) {
        setLocationText(language === "te" ? "లొకేషన్ వివరాలు దొరకలేదు" : "Location details not found");
        return;
      }

      const place = address[0];
      
      // 🔥 అల్ట్రా లాజిక్: "2x 2u u+" లాంటి Plus Codes ని డిలీట్ చేయడం కోసం Regex
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
      setLocationText(language === "te" ? "లొకేషన్ దొరకలేదు" : "Location not found");
    }
  };

  const fetchLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationText("PERMISSION_DENIED");
        return;
      }
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        setLocationText("GPS_OFF");
        return;
      }
      
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      setCoords(loc.coords);
      
      // 🔥 Zomato Style Map Fly Animation
      mapRef.current?.animateToRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.002,
        longitudeDelta: 0.002,
      }, 1000);

      fetchAddressFromCoords(loc.coords.latitude, loc.coords.longitude); 
      
    } catch (error) {
      console.error(error);
      setLocationText(language === "te" ? "లొకేషన్ దొరకలేదు" : "Location not found");
    }
  };

  const handleRegionChangeComplete = (region: any) => {
    setCoords({ latitude: region.latitude, longitude: region.longitude });
    fetchAddressFromCoords(region.latitude, region.longitude);
  };

  const startVoice = async () => {
    try {
      ExpoSpeechRecognitionModule.stop();
      const res = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!res.granted) return;
      setVoiceTarget("equipment");
      setIsListening(true);
      ExpoSpeechRecognitionModule.start({ lang: language === "te" ? "te-IN" : "en-US", interimResults: true });
    } catch (e) {
      console.log("Voice error", e);
    }
  };

  useSpeechRecognitionEvent("result", (event) => {
    if (!isListening) return;
    if (!event.results?.length) return;
    const text = event.results[0].transcript;
    if (voiceTarget === "equipment" && modalType === "equipment") {
      setSearchText(text);
    }
  });

  useSpeechRecognitionEvent("end", () => {
    setIsListening(false);
    setVoiceTarget(null);
  });

  useEffect(() => {
    return () => { ExpoSpeechRecognitionModule.stop(); };
  }, []);

  const handleOpenMap = () => {
    if (coords) {
      setShowMapModal(true); 
    } else {
      fetchLocation();
    }
  };

  const handleGetDirections = (lat: number, lon: number) => {
    const androidUrl = `google.navigation:q=${lat},${lon}`;
    const iosUrl = `maps://app?daddr=${lat},${lon}`;
    const universalUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;

    if (Platform.OS === 'android') {
      Linking.canOpenURL(androidUrl).then(supported => {
        if (supported) Linking.openURL(androidUrl);
        else Linking.openURL(universalUrl);
      });
    } else if (Platform.OS === 'ios') {
      Linking.canOpenURL(iosUrl).then(supported => {
        if (supported) Linking.openURL(iosUrl);
        else Linking.openURL(universalUrl);
      });
    } else {
      Linking.openURL(universalUrl);
    }
  };

  useEffect(() => {
    const unsub = firestore().collection("machines").onSnapshot(snap => {
      setAllMachines(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const openSettings = () => {
    if (Platform.OS === 'ios') Linking.openURL('app-settings:');
    else Linking.openSettings();
  };

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  // 🔥 DYNAMIC SERVICE MESSAGES LOGIC 🔥
  const getServiceDetails = (type: string, lang: string) => {
    if (type === "Rent") {
      return {
        text: lang === "te" ? "కేవలం అద్దెకు మాత్రమే అందుబాటులో ఉంది" : "Available for Rent Only",
        icon: "key-outline",
        color: "#D97706", // Amber
        bg: "#FFFBEB"
      };
    }
    if (type === "Work") {
      return {
        text: lang === "te" ? "పొలం పనులు చేసిపెట్టబడును" : "Available for Farm Services",
        icon: "cog-outline",
        color: "#2563EB", // Blue
        bg: "#EFF6FF"
      };
    }
    if (type === "Both") {
      return {
        text: lang === "te" ? "అద్దెకు మరియు పనులకు అందుబాటులో ఉంది" : "Available for Rent & Farm Services",
        icon: "swap-horizontal-outline",
        color: "#7C3AED", // Purple
        bg: "#F5F3FF"
      };
    }
    return null; 
  };

  const ShimmerCard = () => (
    <View style={[styles.card, { height: 400, opacity: 0.6 }]}>
      <View style={{ width: '100%', height: 280, backgroundColor: '#E5E7EB' }} />
      <View style={{ padding: 18 }}>
        <View style={{ width: '60%', height: 20, backgroundColor: '#E5E7EB', borderRadius: 4, marginBottom: 12 }} />
        <View style={{ width: '40%', height: 14, backgroundColor: '#E5E7EB', borderRadius: 4, marginBottom: 15 }} />
        <View style={styles.divider} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
          <View style={{ width: '45%', height: 40, backgroundColor: '#E5E7EB', borderRadius: 10 }} />
          <View style={{ width: '45%', height: 40, backgroundColor: '#E5E7EB', borderRadius: 10 }} />
        </View>
      </View>
    </View>
  );

  const renderItem = ({ item }: any) => {
    const serviceInfo = getServiceDetails(item.serviceType, language);

    return (
      <View style={styles.card}>
        <View style={styles.imageWrapper}>
          <Image source={getLocalImage(item.equipment)} style={styles.image} />
          <View style={styles.distBadge}>
            <Ionicons name="navigate" size={12} color="#fff" />
            <AppText style={styles.distText}>
              {item.distance.toFixed(1)} {language === "te" ? "కి.మీ దూరంలో" : "KM Away"}
            </AppText>
          </View>
        </View>
        <View style={[styles.content, { borderWidth: 1, borderBottomEndRadius: 20, borderColor: "#E5E7EB" }]}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <AppText style={styles.cardTitle}>{item.equipment}</AppText>
              <View style={styles.ownerRow}>
                <Ionicons name="person-circle" size={16} color="#6B7280" />
                <AppText style={styles.ownerText}>
                  {language === "te" ? translatedData[item.id]?.ownerName || item.ownerName : item.ownerName}
                </AppText>
              </View>
            </View>
          </View>

          {/* 🔥 DYNAMIC SERVICE TYPE MESSAGE 🔥 */}
          {serviceInfo && (
            <View style={[styles.serviceRow, { backgroundColor: serviceInfo.bg, borderColor: serviceInfo.color + '40' }]}>
              <Ionicons name={serviceInfo.icon as any} size={16} color={serviceInfo.color} />
              <AppText style={[styles.serviceText, { color: serviceInfo.color }]}>
                {serviceInfo.text}
              </AppText>
            </View>
          )}

          <View style={styles.infoRow}>
            <Ionicons name="location-sharp" size={16} color="#16A34A" />
            <AppText style={styles.infoText}>
              {language === "te" ? translatedData[item.id]?.village || item.village : item.village}
            </AppText>
          </View>
          <View style={styles.tagWrapper}>
            {item.operations?.slice(0, 3).map((op: string, i: number) => (
              <View key={i} style={styles.tag}>
                <AppText style={styles.tagText}>{op}</AppText>
              </View>
            ))}
          </View>
          <View style={styles.divider} />
          
          {/* 🔥 FOOTER ROW */}
          <View style={styles.footerActionRow}>
            <View style={styles.phoneContainer}>
              <AppText style={styles.phoneLabel}>
                {language === "te" ? "ఫోన్ నంబర్" : "Contact Number"}
              </AppText>
              <AppText style={styles.phoneValue}>{item.phone}</AppText>
            </View>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TouchableOpacity 
                activeOpacity={0.8} 
                style={styles.iconBtn} 
                onPress={() => handleGetDirections(item.latitude, item.longitude)}
              >
                <MaterialCommunityIcons name="directions-fork" size={22} color="#2563EB" />
              </TouchableOpacity>

              <TouchableOpacity 
                activeOpacity={0.8} 
                style={styles.callIconBtn} 
                onPress={() => Linking.openURL(`tel:${item.phone}`)}
              >
                <LinearGradient colors={["#16A34A", "#15803D"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.callGradientIcon}>
                  <Ionicons name="call-outline" size={20} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <AppHeader
        title={language === "te" ? "యంత్రాలు కనుగొనండి" : "Find Machines"}
        subtitle={language === "te" ? "వ్యవసాయాన్ని సులువు చేసుకోండి" : "Making farming easier for you"}
        language={language}
      />

      <View style={styles.filterContainer}>
        <View style={[styles.locationWrapper, { borderColor: (locationText.includes(",") || !["PERMISSION_DENIED", "GPS_OFF"].includes(locationText)) ? '#16A34A' : '#EF4444' }]}>
          <Ionicons name="location" size={20} color={(locationText.includes(",") || !["PERMISSION_DENIED", "GPS_OFF"].includes(locationText)) ? "#16A34A" : "#EF4444"} />
          <AppText style={[styles.locationInput, { color: (locationText.includes(",") || !["PERMISSION_DENIED", "GPS_OFF"].includes(locationText)) ? '#374151' : '#EF4444' }]} numberOfLines={1}>
            {locationText === "PERMISSION_DENIED" ? (language === "te" ? "అనుమతి ఇవ్వలేదు" : "Permission Denied") : locationText === "GPS_OFF" ? (language === "te" ? "GPS ఆఫ్ లో ఉంది" : "GPS is Off") : locationText ? locationText : (language === "te" ? "మీ ప్రాంతం కోసం వెతుకుతోంది..." : "Fetching your location...")}
          </AppText>
          <TouchableOpacity onPress={handleOpenMap}>
            <View style={styles.blueMapBtn}>
              <MaterialCommunityIcons name="map-marker-radius" size={20} color={(locationText.includes(",") || !["PERMISSION_DENIED", "GPS_OFF"].includes(locationText)) ? "#2563EB" : "#EF4444"} />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.rowFilters}>
          <TouchableOpacity activeOpacity={0.7} style={[styles.filterBtn, { flex: 2 }]} onPress={() => setModalType("equipment")}>
            <MaterialCommunityIcons name="tractor" size={18} color="#2E7D32" />
            <AppText style={styles.btnText} numberOfLines={1}>{selectedEq || (language === "te" ? "యంత్రం" : "Equipment")}</AppText>
            <Ionicons name="chevron-down" size={14} color="#9CA3AF" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterBtn, { flex: 1 }]} onPress={() => setModalType("radius")}>
            <MaterialCommunityIcons name="radius-outline" size={18} color="#2E7D32" />
            <AppText style={styles.btnText}>{radius} {language === "te" ? "కి.మీ" : "KM"}</AppText>
            <Ionicons name="chevron-down" size={14} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 🔥 GLOBAL EMPTY STATES HANDLING 🔥 */}
      {locationText === "PERMISSION_DENIED" ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <AppEmptyState
            iconName="lock-closed-outline"
            title={language === "te" ? "లొకేషన్ అనుమతి అవసరం" : "Location Permission Required"}
            subtitle={language === "te" ? "మీకు దగ్గరలో ఉన్న యంత్రాలను చూపించడానికి లొకేషన్ పర్మిషన్ ఇవ్వండి." : "Please enable location permission in settings to see nearby machines."}
            onRetry={openSettings}
            retryText={language === "te" ? "సెట్టింగ్స్ కి వెళ్ళండి" : "Open Settings"}
            language={language}
          />
        </View>
      ) : locationText === "GPS_OFF" ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <AppEmptyState
            iconName="location-outline"
            title={language === "te" ? "GPS ఆఫ్ లో ఉంది" : "GPS is Switched Off"}
            subtitle={language === "te" ? "దగ్గరలోని యంత్రాలను చూపించడానికి GPS ఆన్ చేయండి." : "Please turn on GPS to see nearby machines."}
            onRetry={fetchLocation}
            retryText={language === "te" ? "మళ్ళీ ప్రయత్నించండి" : "Try Again"}
            language={language}
          />
        </View>
      ) : !coords ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <AppEmptyState
            iconName="compass-outline"
            title={language === "te" ? "లొకేషన్ వెతుకుతోంది..." : "Fetching Location..."}
            subtitle={language === "te" ? "దగ్గరలోని యంత్రాలను చూపించడానికి మీ లొకేషన్ అవసరం. దయచేసి వేచి ఉండండి." : "Please wait while we determine your current location."}
            language={language}
          />
        </View>
      ) : loading ? (
        <View style={{ padding: 16 }}><ShimmerCard /><ShimmerCard /><ShimmerCard /></View>
      ) : results.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <AppEmptyState
            iconName="tractor-outline"
            title={language === "te" ? "యంత్రాలు ఏమీ దొరకలేదు!" : "No Machines Found!"}
            subtitle={language === "te" ? "మీరు ఎంచుకున్న దూరంలో ప్రస్తుతానికి ఏ యంత్రాలు లేవు. దూరాన్ని పెంచి చూడండి." : "No machines found in this radius. Try increasing the distance."}
            language={language}
          />
        </View>
      ) : (
        <View style={{ flex: 1 }}> 
          {(selectedEq && (showAll || allMachines.length > results.length)) && (
            <TouchableOpacity activeOpacity={0.8} style={[styles.seeAllBtn, showAll && styles.activeSeeAll]} onPress={() => setShowAll(!showAll)}>
              <Ionicons name={showAll ? "chevron-up-circle" : "apps-sharp"} size={18} color="#fff" />
              <AppText style={[styles.seeAllText, { color: "#fff" }]}>
                {showAll ? (language === "te" ? "ఎంచుకున్నవి మాత్రమే చూడండి" : "Show Selected Only") : (language === "te" ? `మిగిలిన అన్ని యంత్రాలను చూడండి (${allMachines.length})` : `See All Other Machines (${allMachines.length})`)}
              </AppText>
            </TouchableOpacity>
          )}
          <FlatList data={results} renderItem={renderItem} keyExtractor={item => item.id} contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false} />
        </View>
      )}

      {/* SWIGGY STYLE DRAGGABLE MAP */}
      <Modal visible={showMapModal} animationType="fade" transparent={false}>
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          {coords && (
            <MapView
              ref={mapRef}
              style={StyleSheet.absoluteFillObject}
              initialRegion={{ latitude: coords.latitude, longitude: coords.longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 }}
              showsUserLocation={true} showsMyLocationButton={false} onRegionChangeComplete={handleRegionChangeComplete} 
            />
          )}
          <View style={styles.centerPinWrapper} pointerEvents="none"><Ionicons name="location-sharp" size={46} color="#DC2626" /></View>
          <SafeAreaView style={styles.mapTopArea}>
            <TouchableOpacity activeOpacity={0.8} onPress={() => setShowMapModal(false)} style={styles.simpleBackBtn}>
              <Ionicons name="chevron-back" size={24} color="#111827" />
            </TouchableOpacity>
          </SafeAreaView>
          <TouchableOpacity activeOpacity={0.8} style={styles.simpleLocateBtn} onPress={fetchLocation}>
            <MaterialCommunityIcons name="crosshairs-gps" size={22} color="#111827" />
          </TouchableOpacity>
          <View style={styles.minimalBottomCard}>
            <View style={styles.addressRow}>
              <Ionicons name="location" size={24} color="#16A34A" />
              <AppText style={styles.minimalAddress} numberOfLines={2}>{locationText}</AppText>
            </View>
            <TouchableOpacity activeOpacity={0.85}  onPress={() => setShowMapModal(false)}>
              <LinearGradient colors={["#2E7D32", "#1B5E20"]} style={styles.minimalConfirmBtn}>
              <AppText style={styles.minimalConfirmText}>{language === "te" ? "నిర్ధారించండి" : "Confirm"}</AppText>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* EQUIPMENT MODAL */}
      <Modal visible={modalType === "equipment"} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <AppText style={styles.modalTitleText}>{language === "te" ? "యంత్రం ఎంచుకోండి" : "Select Equipment"}</AppText>
              <TouchableOpacity onPress={() => { setShowAll(false); setModalType(null); setSearchText(""); }}>
                <Ionicons name="close-circle" size={28} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            <View style={[styles.searchBar, { flexDirection: "row", alignItems: "center" }]}>
              <TextInput value={searchText} onChangeText={setSearchText} placeholder={language === "te" ? "వెతకండి..." : "Search..."} placeholderTextColor="#9CA3AF" cursorColor="green" selectionColor="green" style={{ flex: 1, height: 50, fontFamily: "Mandali", color: "#1F2937" }} />
              <TouchableOpacity onPress={startVoice} style={{ marginLeft: 10, padding: 6, borderRadius: 10, backgroundColor: "#e5e7eb" }}>
                <MaterialCommunityIcons name={isListening ? "microphone" : "microphone-outline"} size={20} color={isListening ? "#EF4444" : "#2E7D32"} />
              </TouchableOpacity>
            </View>
            <FlatList data={equipmentOptions.filter(item => (language === "te" ? item.te : item.en).toLowerCase().includes(searchText.toLowerCase()))} keyExtractor={(item, i) => i.toString()} renderItem={({ item }) => (
              <TouchableOpacity style={styles.categoryItem} onPress={() => { setSelectedEq(language === "te" ? item.te : item.en); setModalType(null); setSearchText(""); }}>
                <AppText>{language === "te" ? item.te : item.en}</AppText>
                {selectedEq === (language === "te" ? item.te : item.en) && <Ionicons name="checkmark-circle" size={20} color="#16A34A" />}
              </TouchableOpacity>
            )} />
          </View>
        </View>
      </Modal>

      {/* RADIUS MODAL */}
      <Modal visible={modalType === "radius"} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalType(null)}>
          <View style={[styles.modalContent, { height: 'auto', paddingBottom: 30 }]}>
            <View style={styles.modalHeader}><AppText style={styles.modalTitleText}>{language === "te" ? "దూరం ఎంచుకోండి" : "Select Distance"}</AppText></View>
            <View style={styles.radiusGrid}>
              {radiusOptions.map((opt) => (
                <TouchableOpacity key={opt} style={[styles.radiusOption, radius === opt && styles.activeRadius]} onPress={() => { setRadius(opt); setModalType(null); }}>
                  <AppText style={[styles.radiusText, radius === opt && styles.activeRadiusText]}>{opt} {language === "te" ? "కి.మీ" : "KM"}</AppText>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <AgriLoader visible={loading} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6F7F6" },

  // 🔥 ZOMATO MAP STYLES
  mapTopArea: { position: 'absolute', top: Platform.OS === 'android' ? 40 : 50, left: 20 },
  simpleBackBtn: { width: 44, height: 44, backgroundColor: '#fff', borderRadius: 22, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 5 },
  simpleLocateBtn: { position: 'absolute', bottom: 160, right: 20, width: 48, height: 48, backgroundColor: '#fff', borderRadius: 24, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 5 },
  minimalBottomCard: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: Platform.OS === 'ios' ? 35 : 20, elevation: 15, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  centerPinWrapper: { position: 'absolute', top: '50%', left: '50%', marginTop: -40, marginLeft: -23, zIndex: 1, elevation: 5, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5 },

  blueMapBtn: { backgroundColor: '#EFF6FF', padding: 8, borderRadius: 10, marginLeft: 10 },
  addressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 },
  minimalAddress: { flex: 1, fontSize: 15, color: '#374151', lineHeight: 22, fontFamily: "Mandali" },
  minimalConfirmBtn: { backgroundColor: '#16A34A', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  minimalConfirmText: { color: '#fff', fontSize: 16, fontWeight: '600', fontFamily: "Mandali" },
  
  filterContainer: { padding: 16, backgroundColor: '#fff', borderBottomLeftRadius: 24, borderBottomRightRadius: 24, elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, zIndex: 10 },
  locationWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 12, height: 52, borderRadius: 15, borderWidth: 1.5, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  locationInput: { flex: 1, fontSize: 14, color: '#374151', fontWeight: '600' },
  card: { backgroundColor: "#fff", borderRadius: 24, marginBottom: 20, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 12, borderWidth: 1, borderColor: "#F3F4F6" },
  imageWrapper: { width: "100%", height: 280, position: 'relative' },
  image: { width: "100%", height: "100%", resizeMode: "cover" },
  distBadge: { position: 'absolute', top: 15, right: 15, backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 5 },
  distText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 12 },
  
  footerActionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  phoneContainer: { flex: 1 },
  phoneLabel: { fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  phoneValue: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  
  iconBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#BFDBFE' },
  callIconBtn: { width: 44, height: 44, borderRadius: 12, overflow: 'hidden', elevation: 2, shadowColor: '#16A34A', shadowOpacity: 0.3, shadowRadius: 5 },
  callGradientIcon: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  content: { padding: 18 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 19, fontWeight: "600", color: "#1F2937" },
  ownerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 5 },
  ownerText: { fontSize: 14, color: '#6B7280', fontWeight: '500' },

  // 🔥 NEW SERVICE ROW STYLES
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    gap: 6,
    alignSelf: 'flex-start'
  },
  serviceText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: "Mandali",
  },

  infoRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  infoText: { fontSize: 14, color: "#4B5563", fontWeight: '500' },
  tagWrapper: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  tag: { backgroundColor: '#F0FDF4', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#DCFCE7' },
  tagText: { fontSize: 11, color: '#166534', fontWeight: '600' },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", padding: 20, alignItems: "center" },
  modalTitleText: { fontSize: 18, fontWeight: "600" },
  searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: "#F3F4F6", margin: 20, borderRadius: 18, paddingHorizontal: 12, borderWidth: 1, borderColor: "#E5E7EB" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#fff", height: "60%", borderTopLeftRadius: 25, borderTopRightRadius: 25 },
  rowFilters: { flexDirection: 'row', gap: 10 },
  filterBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 12, height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', justifyContent: 'space-between' },
  btnText: { fontSize: 13, fontWeight: '600', color: '#374151', flex: 1, marginLeft: 8 },
  radiusGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 20, gap: 12, justifyContent: 'center' },
  radiusOption: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', minWidth: '28%', alignItems: 'center' },
  activeRadius: { backgroundColor: '#DCFCE7', borderColor: '#16A34A' },
  radiusText: { fontSize: 14, fontWeight: '600', color: '#4B5563' },
  activeRadiusText: { color: '#166534' },
  categoryItem: { padding: 18, flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b6b06', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 15, marginHorizontal: 16, marginTop: 15, gap: 8, borderWidth: 1, borderColor: '#16A34A' },
  activeSeeAll: { backgroundColor: '#0b6b06' },
  seeAllText: { fontSize: 16, fontWeight: '600', fontFamily: "Mandali" },
});