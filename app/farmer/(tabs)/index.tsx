// app/farmer/(tabs)/index.tsx

import { setDrawer } from "@/assets/stores/drawerStore";
import { useLanguage } from "@/context/LanguageContext";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import firestore from "@react-native-firebase/firestore";
import messaging from "@react-native-firebase/messaging";
import { useFocusEffect } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated, AppState,
  BackHandler,
  Dimensions,
  FlatList,
  InteractionManager,
  Modal,
  RefreshControl, SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
// 🔥 PRO FIX: Use expo-image for faster caching and remote image handling
import { Image } from "expo-image";
import AnimatedReanimated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import AppText from "../../../components/AppText";
const { width } = Dimensions.get("window");

/* ---------------- TRANSLATIONS ---------------- */
const translations = {
  te:{
    morning:"శుభోదయం", afternoon:"శుభ మధ్యాహ్నం", evening:"శుభ సాయంత్రం", night:"శుభ రాత్రి",
    quick:"ముఖ్యమైన సేవలు", all:"అన్ని సేవలు", attendance:"కూలీల హాజరు", payments:"కూలీల చెల్లింపులు",
    sales:"పంట అమ్మకాలు", expenses:"పెట్టుబడి లెక్కలు", crops:"వ్యవసాయ నివేదిక", schemes:"ప్రభుత్వ పథకాలు",
    market:"మార్కెట్ ధరలు", forecast:"వాతావరణం చూడండి", weather: "వాతావరణం",
    machine: "యంత్రాల లెక్కలు", calculator:"క్యాలిక్యులేటర్", booking: "అగ్రి కనెక్ట్",
    fields: "నా పొలాలు", owners: "నా వాహనాలు", reminders: "పనుల అలారం", locker: "అగ్రి లాకర్"
  },
  en:{
    morning:"Good Morning", afternoon:"Good Afternoon", evening:"Good Evening", night:"Good Night",
    quick:"Smart Suggestions", all:"All Services", calculator:"Smart Calculators", attendance:"Workers Attendance",
    payments:"Workers Payment", forecast:"See Forecast", sales:"Crop Sales", expenses:"Farm Expenses",
    crops:"Farm Report", schemes:"Govt Schemes", market:"Market Prices", weather: "Weather",
    machine: "Machinery Accounts", booking: "Agri Connect", fields: "My Fields", owners: "My Vehicles", reminders: "Task Reminders", locker: "Agri Locker"
  }
};

/* 🔥 PAYTM STYLE FLAWLESS SKELETON (100% EXACT REPLICA) 🔥 */
const DashboardSkeleton = ({ width }: { width: number }) => {
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true })
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F6F7F6" }}>
      <StatusBar barStyle="light-content" backgroundColor="#1B5E20" />
      
      <LinearGradient colors={["#1B5E20", "#1B5E20"]} style={{ position: "absolute", top: 0, width: "100%", zIndex: 50, paddingTop: 45, paddingHorizontal: 20, paddingBottom: 5 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Animated.View style={{ width: 50, height: 50, borderRadius: 25, marginRight: 10, backgroundColor: "rgba(255,255,255,0.12)", opacity: pulseAnim }} />
            <View>
              <Animated.View style={{ width: 100, height: 14, borderRadius: 4, marginBottom: 8, backgroundColor: "rgba(255,255,255,0.12)", opacity: pulseAnim }} />
              <Animated.View style={{ width: 140, height: 22, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.12)", opacity: pulseAnim }} />
            </View>
          </View>
          <Animated.View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.12)", opacity: pulseAnim }} />
        </View>
      </LinearGradient>

      <View style={{ flex: 1, paddingTop: 95 }}>
        <View>
          <LinearGradient colors={["#1B5E20","#1B5E20"]} style={{ paddingTop: 28, paddingBottom: 15, paddingHorizontal: 20, justifyContent: "center" }}>
            <View style={{ alignItems: "center", justifyContent: "center" }}>
              <Animated.View style={{ width: width - 40, height: 120, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.1)", opacity: pulseAnim, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" }} />
            </View>
          </LinearGradient>
          
          <View style={{ position: "relative", alignItems: "center" }}>
            <Svg width={width + 40} height={40} viewBox={`0 0 ${width + 40} 40`} style={{ marginTop: -1, alignSelf: "center", marginLeft: -20 }}>
              <Path d={`M0 0 H${width + 40} Q${(width + 40)/2} 40 0 0 Z`} fill="#1B5E20" />
            </Svg>
            <View style={{ flexDirection: "row", justifyContent: "center", position: "absolute", top: 0 }}>
              <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.8)", marginHorizontal: 4, opacity: pulseAnim }} />
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.4)", marginHorizontal: 4 }} />
            </View>
          </View>
        </View>

        {/* Session Card */}
        <Animated.View style={{ width: width - 40, height: 76, borderRadius: 20, marginHorizontal: 20, marginTop: 10, backgroundColor: "#ffffff", opacity: pulseAnim, borderWidth: 1, borderColor: "#E5E7EB" }} />

        {/* Quick Services */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginHorizontal: 20, marginTop: 25, marginBottom: 8 }}>
          <Animated.View style={{ width: 140, height: 22, borderRadius: 6, backgroundColor: "#E5E7EB", opacity: pulseAnim }} />
          <Animated.View style={{ width: 60, height: 24, borderRadius: 14, backgroundColor: "#E5E7EB", opacity: pulseAnim }} />
        </View>
        
        <View style={{ flexDirection: "row", paddingLeft: 20, paddingTop: 0, gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <Animated.View key={i} style={{ width: 120, height: 44, borderRadius: 20, backgroundColor: "#F8F9FA", borderColor: "#E5E7EB", borderWidth: 1, opacity: pulseAnim }} />
          ))}
        </View>

        {/* All Services */}
        <View style={{ flexDirection: "row", alignItems: "center", marginHorizontal: 20, marginTop: 5, marginBottom: 8, gap: 8 }}>
          <Animated.View style={{ width: 110, height: 22, borderRadius: 6, backgroundColor: "#E5E7EB", opacity: pulseAnim }} />
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-start", paddingHorizontal: 20, gap: 14 }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Animated.View key={i} style={{ width: (width - 70) / 3, height: 135, borderRadius: 18, backgroundColor: "#F8FAF9", borderColor: "#E5E7EB", borderWidth: 1, opacity: pulseAnim }} />
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
};

let isAppStarted = false;

export default function Dashboard() {
  const router = useRouter();
  const quickRef = useRef<FlatList>(null); 
  const scrollY = useRef(new Animated.Value(0)).current; 
  const [loading, setLoading] = useState(true);
  
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  // 🔥 NEW STATE FOR PROFILE IMAGE
  const [profilePic, setProfilePic] = useState<string | null>(null);

  const { language } = useLanguage();

  const [city, setCity] = useState(language === "te" ? "లోడ్ అవుతోంది..." : "Loading...");
  const [temp, setTemp] = useState<number | null>(null);
  const [weather, setWeather] = useState("");
  const [humidity, setHumidity] = useState<number | null>(null);
  const [wind, setWind] = useState<number | null>(null);
  const [refreshing,setRefreshing] = useState(false);
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  const [scrollForward,setScrollForward] = useState(true);
  const [quickServices, setQuickServices] = useState<any[]>([]);
  const [activeHeaderCard,setActiveHeaderCard] = useState(0);
  const [prices,setPrices] = useState<any[]>([]);
  const [priceLoading,setPriceLoading] = useState(true);
  const [notifCount, setNotifCount] = useState(0);
  const headerCardRef = useRef<any>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [weatherType, setWeatherType] = useState("");
  const [activeSession, setActiveSession] = useState("");
  
  const ADMIN_PHONE = "8121648629"; 
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessionModal, setSessionModal] = useState(false);
  const [oldSessionModal, setOldSessionModal] = useState(false);
  const [allSessions, setAllSessions] = useState<string[]>([]);
  const t = translations[language as "te" | "en"];
  
  const CACHE_KEY = "WEATHER_CACHE";
  const CACHE_TIME = 5 * 60 * 1000; 
  const PRICE_CACHE_KEY = "PRICE_CACHE";
  const PRICE_CACHE_TIME = 2 * 60 * 1000; 
  const LOCATION_CACHE_KEY = "LOCATION_CACHE";
  const LOCATION_CACHE_TIME = 15 * 60 * 1000; 

  /* ---------------- ICONS ---------------- */
  const icons = {
    attendance: require("../../../assets/images/user-check.png"),
    payments: require("../../../assets/images/secured-payment.png"),
    sales: require("../../../assets/images/cash-flow.png"),
    expenses: require("../../../assets/images/ex.png"),
    crops: require("../../../assets/images/r.png"),
    schemes: require("../../../assets/images/distribution.png"),
    market: require("../../../assets/images/forecast-analytics.png"),
    weather:require("../../../assets/images/a.png"),
    machine:require("../../../assets/images/tractor.png"),
    calculator:require("../../../assets/images/calc.png"),
    booking:require("../../../assets/images/link.png"),
    fields:require("../../../assets/images/farm.png"),
    owners: require("../../../assets/images/key.png"),
    reminders: require("../../../assets/images/notification.png"),
    locker: require("../../../assets/images/padlock.png")
  };
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const swipeShared = useSharedValue(0);
  const priceShared = useSharedValue(0);

  /* ---------------- BACK BUTTON BLOCKER ---------------- */
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => true; 
      const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => backHandler.remove();
    }, [])
  );

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected ?? false);
    });
    return () => unsubscribe();
  }, []);

  // 🔥 PRO FIX: Safe Firebase Snapshot Listener with useFocusEffect for instant sync
  useFocusEffect(
    React.useCallback(() => {
      let isMounted = true;
      let unsubscribeFunc: any;

      const fetchNotifications = async () => {
        const phone = await AsyncStorage.getItem("USER_PHONE");
        if (!phone || !isMounted) return;

        const unsub = firestore()
          .collection("notifications")
          .onSnapshot(async snap => {
            if (!isMounted) return;
            
            try {
              const userDoc = await firestore().collection("users").doc(phone).get();
              const userState = userDoc.data()?.state;
              
              const hiddenSnap = await firestore().collection("users").doc(phone).collection("hiddenNotifications").get();
              const hiddenIds = hiddenSnap.docs.map(d => d.id);

              const seenSnap = await firestore().collection("users").doc(phone).collection("seenNotifications").get();
              const seenIds = seenSnap.docs.map(d => d.id);

              let count = 0;
              const now = new Date();
              const normalize = (s:any) => (s || "").trim().toLowerCase();
              
              snap.forEach(doc => {
                const data = doc.data();
                if (hiddenIds.includes(doc.id)) return;
                
                let deleteTime = null;
                if (data.deleteAt && typeof data.deleteAt.toDate === "function") {
                  deleteTime = data.deleteAt.toDate();
                }
                if (deleteTime && now > deleteTime) return;

                if (data.userId === "all") {}
                else if (data.state) { if (normalize(data.state) !== normalize(userState)) return; }
                else if (data.userId) { if (data.userId !== phone) return; }
                else { return; }

                if (!seenIds.includes(doc.id)) { count++; }
              });
              
              if (isMounted) setNotifCount(count);
            } catch (e) {
              console.log("Notification fetch error", e);
            }
          });

        return unsub;
      };

      fetchNotifications().then(unsub => { unsubscribeFunc = unsub; });

      return () => {
        isMounted = false;
        if (unsubscribeFunc) unsubscribeFunc();
      };
    }, [])
  );

  useEffect(() => {
    setDrawer(false);
  }, []);

  useEffect(() => {
    async function saveToken() {
      const token = await messaging().getToken();
      const phone = await AsyncStorage.getItem("USER_PHONE");
      if (phone) {
        await firestore().collection("users").doc(phone).set({ fcmToken: token }, { merge: true });
      }
    }
    saveToken();

    const unsubscribe = messaging().onTokenRefresh(async token => {
      const phone = await AsyncStorage.getItem("USER_PHONE");
      if (phone) {
        await firestore().collection("users").doc(phone).set({ fcmToken: token }, { merge: true });
      }
    });

    return unsubscribe;
  }, []);

  /* ---------------- QUICK SERVICES ---------------- */
  const getServices = () => [
    { service: "fields", title: t.fields, icon: icons.fields, screen: "/farmer/fields" },
    { service: "attendance", title: t.attendance, icon: icons.attendance, screen: "/farmer/mestri" },
    { service: "payments", title: t.payments, icon: icons.payments, screen: "/farmer/mestripayments" },
    { service: "machine", title: t.machine, icon: icons.machine, screen: "/farmer/owners" },
    { service: "expenses", title: t.expenses, icon: icons.expenses, screen: "/farmer/expenses" },
    { service: "sales", title: t.sales, icon: icons.sales, screen: "/farmer/sales" },
    { service: "crops", title: t.crops, icon: icons.crops, screen: "/farmer/summary" },
    { service: "owners", title: t.owners, icon: icons.owners, screen: "/farmer/vechiles" },
    { service: "weather", title: t.weather, icon: icons.weather, screen: "/farmer/weather" },
    { service: "market", title: t.market, icon: icons.market, screen: "/farmer/market" },
    { service: "locker", title: t.locker, icon: icons.locker, screen: "/farmer/locker" },
    { service: "reminders", title: t.reminders, icon: icons.reminders, screen: "/farmer/reminders" },
    { service: "calculator", title: t.calculator, icon: icons.calculator, screen: "/farmer/calculators" },
    { service: "schemes", title: t.schemes, icon: icons.schemes, screen: "/farmer/schemes" },
    { service: "booking", title: t.booking, icon: icons.booking, screen: "/farmer/bookings" },
  ];
  const services = useMemo(() => getServices(), [language]);
  
  const calculateQuick = async () => {
    const usage = await AsyncStorage.getItem("SERVICE_USAGE");
    let sorted = services;

    if(usage){
      const data = JSON.parse(usage);
      sorted = [...services].sort((a,b)=>{
        return (data[b.service] || 0) - (data[a.service] || 0);
      });
    }

    const hour = new Date().getHours();
    let priority:string[] = [];

    if (hour >= 5 && hour < 10) priority = ["weather", "attendance", "market"];
    else if (hour >= 10 && hour < 16) priority = ["fields", "sales", "payments"];
    else if (hour >= 16 && hour < 21) priority = ["expenses", "machine", "booking"];
    else priority = ["crops", "schemes", "calculator"];

    sorted.sort((a,b)=>{
      if(priority.includes(a.service)) return -1;
      if(priority.includes(b.service)) return 1;
      return 0;
    });

    setQuickServices(sorted.slice(0,5));
  };

  useEffect(()=>{
    calculateQuick();
  },[language]);


  useFocusEffect(
    React.useCallback(()=>{
      loadUser();
    },[])
  );

  // 🔥 PRO FIX 1: Performance fix for Clock & FIXED Weekday issue (Short names)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString(language === "te" ? "te-IN" : "en-IN", { hour: "2-digit", minute: "2-digit" }));
      // 🔥 Changed "long" to "short" to prevent overlap issues
      setDate(now.toLocaleDateString(language === "te" ? "te-IN" : "en-IN", { weekday: "short", day: "numeric", month: "short" }));
    };
    
    updateTime(); 
    const interval = setInterval(updateTime, 10000); 
    return () => clearInterval(interval);
  }, [language]);

  useEffect(()=>{
    Animated.timing(fadeAnim,{ toValue:1, duration:900, useNativeDriver:true }).start();
  },[]);

  useEffect(()=>{
    swipeShared.value = withRepeat(
      withSequence(
        withTiming(10, { duration: 700, easing: Easing.linear }),
        withTiming(0, { duration: 700, easing: Easing.linear })
      ),
      -1, // infinite loop
      false
    );
  },[]);

  useEffect(()=>{
    const interval = setInterval(()=>{
      const next = activeHeaderCard === 1 ? 0 : 1;
      headerCardRef.current?.scrollToIndex({ index:next, animated:true });
      setActiveHeaderCard(next);
    },4000);
    return ()=>clearInterval(interval);
  },[activeHeaderCard]);

  useEffect(()=>{
    // We use a quick jump for the reset so it looks seamless
    priceShared.value = withRepeat(
      withSequence(
        withTiming(-60, { duration: 2500, easing: Easing.linear }),
        withTiming(0, { duration: 0 })
      ),
      -1,
      false
    );
  },[]);

  const swipeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: swipeShared.value }]
  }));

  const priceAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: priceShared.value }]
  }));

  const onRefresh = async () => {
    setRefreshing(true);
    await getLocationWeather();
    await fetchPrices();
    await loadUser(); // 🔥 Sync user profile details during refresh
    await new Promise(resolve => setTimeout(resolve,800));
    setRefreshing(false);
  };

  /* ---------------- USER (🔥 PRODUCTION SMOOTH LOAD) ---------------- */
  const loadUser = async () => {
    const startTime = Date.now(); 

    try {
      const phone = await AsyncStorage.getItem("USER_PHONE");
      const cachedName = await AsyncStorage.getItem("USER_NAME");
      const cachedImage = await AsyncStorage.getItem("USER_IMAGE"); // 🔥 Check for cached image
      
      if (cachedName) {
        setName(cachedName);
      }
      if (cachedImage) {
        setProfilePic(cachedImage);
      }

      if (!phone) {
        setLoading(false);
        return;
      }
      
      if (phone === ADMIN_PHONE) {
         setIsAdmin(true);
      }
      
      await fetchAllSessions(phone);
      const doc = await firestore().collection("users").doc(phone).get();
      const data = doc.data();

      // Set Name
      if (data?.name && data.name !== cachedName) {
        setName(data.name);
        await AsyncStorage.setItem("USER_NAME", data.name);
      } 

      // 🔥 Set Profile Image dynamically
      if (data?.profileImage) {
        setProfilePic(data.profileImage);
        await AsyncStorage.setItem("USER_IMAGE", data.profileImage);
      } else {
        setProfilePic(null);
        await AsyncStorage.removeItem("USER_IMAGE");
      }
      
      // Set Role for Default Image logic
      if (data?.role) {
        setRole(data.role);
      }

      const current = getCurrentSession();
      if (!isAppStarted) {
        await firestore().collection("users").doc(phone).set({ activeSession: current, lastAutoUpgrade: current }, { merge: true });
        setActiveSession(current);
        isAppStarted = true;
      } else if (!data?.activeSession || data?.lastAutoUpgrade !== current) {
        await firestore().collection("users").doc(phone).set({ activeSession: current, lastAutoUpgrade: current }, { merge: true });
        setActiveSession(current);
      } else {
        setActiveSession(data.activeSession);
      }
    } catch (e) {
      console.log(e);
    } finally {
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, 600 - elapsedTime);

      setTimeout(() => {
        setLoading(false);
      }, remainingTime);
    }
  };

  /* ---------------- EFFECTS (🔥 INTERACTION MANAGER) ---------------- */
  useFocusEffect(
    React.useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        loadUser();
      });
      return () => task.cancel();
    }, [])
  );

  const cityMap: Record<string, string> = {
    "Adilabad": "ఆదిలాబాద్", "Bhadradri Kothagudem": "భద్రాద్రి కొత్తగూడెం", "Hanumakonda": "హన్మకొండ", "Hyderabad": "హైదరాబాద్", "Jagtial": "జగిత్యాల", "Jangaon": "జనగామ", "Jayashankar Bhupalpally": "జయశంకర్ భూపాలపల్లి", "Jogulamba Gadwal": "జోగులాంబ గద్వాల్", "Kamareddy": "కామారెడ్డి", "Karimnagar": "కరీంనగర్", "Khammam": "ఖమ్మం", "Kumuram Bheem Asifabad": "కుమురం భీమ్ ఆసిఫాబాద్", "Mahabubabad": "మహబూబాబాద్", "Mahabubnagar": "మహబూబ్‌నగర్", "Mancherial": "మంచిర్యాల", "Medak": "మెదక్", "Medchal Malkajgiri": "మేడ్చల్ మల్కాజిగిరి", "Mulugu": "ములుగు", "Nagarkurnool": "నాగర్ కర్నూల్", "Nalgonda": "నల్గొండ", "Narayanpet": "నారాయణపేట", "Nirmal": "నిర్మల్", "Nizamabad": "నిజామాబాద్", "Peddapalli": "పెద్దపల్లి", "Rajanna Sircilla": "రాజన్న సిరిసిల్ల", "Rangareddy": "రంగారెడ్డి", "Sangareddy": "సంగారెడ్డి", "Siddipet": "సిద్ధిపేట", "Suryapet": "సూర్యాపేట", "Vikarabad": "వికారాబాద్", "Wanaparthy": "వనపర్తి", "Warangal": "వరంగల్", "Yadadri Bhuvanagiri": "యాదాద్రి భువనగిరి",
    "Alluri Sitharama Raju": "అల్లూరి సీతారామరాజు", "Anakapalli": "అనకాపల్లి", "Anantapur": "అనంతపురం", "Annamayya": "అన్నమయ్య", "Bapatla": "బాపట్ల", "Chittoor": "చిత్తూరు", "East Godavari": "తూర్పు గోదావరి", "Eluru": "ఏలూరు", "Guntur": "గుంటూరు", "Kakinada": "కాకినాడ", "Konaseema": "కోనసీమ", "Krishna": "కృష్ణా", "Kurnool": "కర్నూలు", "Manyam": "మన్యం", "Nandyal": "నంద్యాల", "NTR": "ఎన్టీఆర్", "Palnadu": "పల్నాడు", "Prakasam": "ప్రకాశం", "Nellore": "నెల్లూరు", "Sri Sathya Sai": "శ్రీ సత్యసాయి", "Srikakulam": "శ్రీకాకుళం", "Tirupati": "తిరుపతి", "Visakhapatnam": "విశాఖపట్నం", "Vizianagaram": "విజయనగరం", "West Godavari": "పశ్చిమ గోదావరి", "YSR Kadapa": "వైఎస్ఆర్ కడప", "Vijayawada": "విజయవాడ",
    "Secunderabad": "సికింద్రాబాద్", "Gajwel": "గజ్వేల్", "Sircilla": "సిరిసిల్ల", "Proddatur": "ప్రొద్దుటూరు", "Hindupur": "హిందూపూర్", "Madanapalle": "మదనపల్లి", "Adoni": "ఆదోని", "Tenali": "తెనాలి"
  };

  const translateToTelugu = async (text: string) => {
    if (!text) return "లొకేషన్";
    if (cityMap[text]) return cityMap[text]; 
    try {
      const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=te&dt=t&q=${encodeURIComponent(text)}`);
      const data = await res.json();
      return data[0][0][0];
    } catch { return text; }
  };

  const getCurrentSession = () => {
    const now = new Date();
    const year = now.getFullYear();
    const startYear = now.getMonth() >= 5 ? year : year - 1;
    return `${startYear}-${(startYear + 1).toString().slice(-2)}`;
  };

  const getSessionList = () => {
    const current = getCurrentSession();
    const startYear = parseInt(current.split("-")[0]);
    return [
      `${startYear - 2}-${(startYear - 1).toString().slice(-2)}`,
      `${startYear - 1}-${(startYear).toString().slice(-2)}`,
      current
    ];
  };

  const sessions = getSessionList();
  const oldestSession = sessions[0]; 
  const oldSessions = allSessions.filter(s => parseInt(s.split("-")[0]) < parseInt(oldestSession.split("-")[0]));

  const fetchAllSessions = async (phone:string) => {
    const snap = await firestore().collection("users").doc(phone).collection("fields").get();
    const sessionsSet = new Set<string>();
    snap.forEach(doc => {
      const data = doc.data();
      if (data.session) sessionsSet.add(data.session);
    });
    const sorted = Array.from(sessionsSet).sort((a, b) => parseInt(b.split("-")[0]) - parseInt(a.split("-")[0]));
    setAllSessions(sorted);
  };

  /* ---------------- WEATHER ---------------- */
  const formatWeather = (raw: string, language: string) => {
    const w = raw.toLowerCase();
    if (w.includes("thunderstorm") || w.includes("storm") || w.includes("lightning")) return { text: language === "te" ? "పిడుగులతో కూడిన వర్షం" : "Thunderstorm Warning", type: "storm" };
    if (w.includes("rain") || w.includes("drizzle") || w.includes("shower")) {
      if (w.includes("heavy") || w.includes("extreme") || w.includes("very heavy")) return { text: language === "te" ? "భారీ వర్షం" : "Heavy Rainfall", type: "rain" };
      if (w.includes("light") || w.includes("drizzle")) return { text: language === "te" ? "చిరుజల్లులు" : "Light Drizzle", type: "rain" };
      return { text: language === "te" ? "వర్షం" : "Rainy Weather", type: "rain" };
    }
    if (w.includes("cloud") || w.includes("overcast")) {
      if (w.includes("few") || w.includes("scattered") || w.includes("broken")) return { text: language === "te" ? "పాక్షికంగా మబ్బులు" : "Partly Cloudy", type: "cloud" };
      return { text: language === "te" ? "మబ్బులుగా ఉంది" : "Overcast/Cloudy", type: "cloud" };
    }
    if (w.includes("haze") || w.includes("mist") || w.includes("fog") || w.includes("smoke")) return { text: language === "te" ? "పొగమంచు / మసక" : "Hazy & Misty", type: "haze" };
    if (w.includes("clear") || w.includes("sun") || w.includes("hot")) return { text: language === "te" ? "ఎండ / నిర్మలం" : "Clear Sunny Sky", type: "clear" };
    if (w.includes("wind") || w.includes("gale") || w.includes("tornado") || w.includes("squall")) return { text: language === "te" ? "బలమైన గాలులు" : "High Wind Alert", type: "wind" };
    if (w.includes("snow") || w.includes("sleet")) return { text: language === "te" ? "మంచు కురుస్తోంది" : "Snowfall", type: "snow" };
    return { text: raw, type: "default" };
  };

  /* ---------------- WEATHER & LOCATION ---------------- */
  const getLocationWeather = async () => {
    if (!isOnline) {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        setCity(parsed.city); setTemp(parsed.temp); setWeather(parsed.weather); setHumidity(parsed.humidity); setWind(parsed.wind);
      }
      return;
    }

    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < CACHE_TIME && parsed.language === language) {
          setCity(parsed.city); setTemp(parsed.temp); setWeather(parsed.weather); setHumidity(parsed.humidity); setWind(parsed.wind);
          return; 
        }
      }

      let latitude; let longitude;
      
      const locCache = await AsyncStorage.getItem(LOCATION_CACHE_KEY);
      if (locCache) {
        const parsed = JSON.parse(locCache);
        if (Date.now() - parsed.timestamp < LOCATION_CACHE_TIME) {
          latitude = parsed.latitude; longitude = parsed.longitude;
        }
      }

      if (!latitude || !longitude) {
        let { status } = await Location.requestForegroundPermissionsAsync();
        
        if (status !== 'granted') {
          setCity(language === "te" ? "లొకేషన్ అనుమతి లేదు" : "Location Denied");
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced, 
        });
        
        latitude = location.coords.latitude; 
        longitude = location.coords.longitude;
        
        await AsyncStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify({ latitude, longitude, timestamp: Date.now() }));
      }

      const res = await fetch(`https://getweather-pdetykgfaq-uc.a.run.app?lat=${latitude}&lon=${longitude}`);
      if (!res.ok) throw new Error("Weather API failed");
      const data = await res.json();

      let osCity = "";
      try {
        const geo = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (geo && geo.length > 0) {
          const g = geo[0];
          osCity = g.name || g.street || g.city || g.subregion || g.district || "";
        }
      } catch (e) {}

      let finalCity = osCity || data.name;
      if (language === "te") finalCity = await translateToTelugu(finalCity);

      setCity(finalCity);
      
      const tempVal = data?.main?.temp;
      if (tempVal !== undefined) setTemp(Math.round(tempVal));
      
      const rawWeather = data.weather?.[0]?.description?.toLowerCase() || "clear";
      const result = formatWeather(rawWeather, language);

      setWeather(result.text); setWeatherType(result.type); setHumidity(data.main?.humidity); setWind(data.wind?.speed);

      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ 
        city: finalCity, temp: Math.round(tempVal), weather: result.text, 
        humidity: data.main?.humidity, wind: data.wind?.speed, timestamp: Date.now(), language: language 
      }));

    } catch (e) {
      console.log("Weather Error:", e);
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        setCity(parsed.city); setTemp(parsed.temp); setWeather(parsed.weather); setHumidity(parsed.humidity); setWind(parsed.wind);
      } else {
        setCity(language === "te" ? "డేటా రాలేదు" : "Data Failed");
      }
    }
  };

  const fetchPrices = async () => {
    if (!isOnline) {
      const cached = await AsyncStorage.getItem(PRICE_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed.data)) {
          setPrices(parsed.data.slice(0,3)); 
        }
        setPriceLoading(false);
      }
      return;
    }
    try {
      const cached = await AsyncStorage.getItem(PRICE_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < PRICE_CACHE_TIME && Array.isArray(parsed.data)) {
          setPrices(parsed.data.slice(0,3)); setPriceLoading(false); return;
        }
      }
      setPriceLoading(true);
      const res = await fetch("https://us-central1-agrisnap-9b487.cloudfunctions.net/getPrices");
      if (!res.ok) throw new Error("Price API failed");
      const data = await res.json();

      if (Array.isArray(data)) {
        const sorted = data.sort((a: any, b: any) => new Date(b.arrival_date).getTime() - new Date(a.arrival_date).getTime());
        const grouped: any = {};
        sorted.forEach((item: any) => {
          if (!grouped[item.commodity]) grouped[item.commodity] = [];
          grouped[item.commodity].push(item);
        });

        const finalPrices = Object.keys(grouped).map((key) => {
          const items = grouped[key];
          return { ...items[0], prevPrice: items[1]?.modal_price || items[0].modal_price };
        });

        setPrices(finalPrices.slice(0,3));
        await AsyncStorage.setItem(PRICE_CACHE_KEY, JSON.stringify({ data: finalPrices, timestamp: Date.now() }));
      }
    } catch (e) {
      const cached = await AsyncStorage.getItem(PRICE_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed.data)) setPrices(parsed.data.slice(0,3));
      }
    } finally {
      setPriceLoading(false);
    }
  };

  const getTrend = (current: number, prev: number) => {
    if (current > prev) return "up";
    if (current < prev) return "down";
    return "same";
  };

  const [fontsLoaded] = useFonts({
    Mandali: require("../../../assets/fonts/Mandali-Regular.ttf")
  });

  if(!fontsLoaded) return null;

  useEffect(() => {
    let weatherInterval: any;
    let priceInterval: any;

    const start = () => {
      getLocationWeather();
      fetchPrices();
      weatherInterval = setInterval(getLocationWeather, 300000); 
      priceInterval = setInterval(fetchPrices, 120000); 
    };

    const stop = () => {
      if (weatherInterval) clearInterval(weatherInterval);
      if (priceInterval) clearInterval(priceInterval);
    };

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") start();
      else stop();
    });

    InteractionManager.runAfterInteractions(() => {
       start();
    });

    return () => {
      stop();
      sub.remove();
    };
  }, [language]);
  
  const handleServiceClick = async (screen:string,service:string,index:number)=>{
    try{
      const usage = await AsyncStorage.getItem("SERVICE_USAGE");
      let data = usage ? JSON.parse(usage) : {};
      data[service] = (data[service] || 0) + 1;
      await AsyncStorage.setItem("SERVICE_USAGE",JSON.stringify(data));
    }catch(e){console.log(e);}

    if(quickServices && quickServices.length > 0 && index >= 0 && index < quickServices.length){
      quickRef.current?.scrollToIndex({ index, animated:true });
    }
    router.push(screen as any);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if(hour >= 5 && hour < 12) return t.morning;
    if(hour >= 12 && hour < 17) return t.afternoon;
    if(hour >= 17 && hour < 21) return t.evening;
    return t.night;
  };

  const getGreetingIcon = () => {
    const hour = new Date().getHours();
    if(hour >= 5 && hour < 12) return "sunny-outline";
    if(hour >= 12 && hour < 17) return "partly-sunny-outline";
    if(hour >= 17 && hour < 21) return "cloudy-night-outline";
    return "moon-outline";
  };

  const getWeatherIcon = () => {
    if (weatherType === "cloud") return require("../../../assets/images/clouds.png");
    if (weatherType === "rain") return require("../../../assets/images/heavy-rain.png");
    if (weatherType === "storm") return require("../../../assets/images/thunder.png");
    if (weatherType === "clear") return require("../../../assets/images/sun.png");
    if (weatherType === "haze") return require("../../../assets/images/haze.png");
    if (weatherType === "snow") return require("../../../assets/images/snowy.png"); 
    if (weatherType === "wind") return require("../../../assets/images/windy.png"); 
    return require("../../../assets/images/we.png");
  };

  // 🔥 DETERMINE DEFAULT AVATAR DYNAMICALLY
  const getDefaultAvatar = () => {
    const isFarmer = role?.toLowerCase() === "farmer" || role === "రైతు";
    const isMestri = role?.toLowerCase() === "mestri" || role === "మేస్త్రీ";
    if (isFarmer) return require("../../../assets/images/farmer.png");
    if (isMestri) return require("../../../assets/images/kuli.png");
    return require("../../../assets/images/default.jpg");
  };

  /* ---------------- CONDITIONAL LOADING UI ---------------- */
  if (loading) {
    return <DashboardSkeleton width={width} />;
  }

  /* ---------------- MAIN UI ---------------- */
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />

      {/* BODY */}
     <LinearGradient colors={["#1B5E20", "#1B5E20"]} style={styles.stickyTop}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.profileRow} onPress={() => setDrawer(true)} activeOpacity={0.8}>
            
            {/* 🔥 PROFILE IMAGE LOGIC APPLIED HERE */}
            <Image 
              source={profilePic ? { uri: profilePic } : getDefaultAvatar()} 
              style={styles.profileImage} 
              contentFit="cover" // Important for rounded remote images
            />

            <View>
              <Animated.View style={[styles.greetRow, { opacity:fadeAnim, transform:[{translateY:fadeAnim.interpolate({inputRange:[0,1],outputRange:[-12,0]})}] }]}>
                <Ionicons name={getGreetingIcon()} size={18} color="#C8E6C9" />
                <AppText style={styles.greet} language={language}>{getGreeting()}</AppText>
              </Animated.View>
              <AppText style={[styles.name, language === "en" && { fontWeight: "600", marginTop: -8 }, language === "te" && { fontFamily: "Mandali", marginTop: -8}]} language={language} numberOfLines={1} ellipsizeMode="tail">
                {name || "Farmer"}
              </AppText>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.notifyBtn} activeOpacity={0.8} onPress={() => router.push("/farmer/notifications")}>
            <Ionicons name="notifications-outline" size={22} color="white" />
            {notifCount > 0 && (
              <View style={styles.badge}>
                <AppText style={styles.badgeText}>{notifCount > 9 ? "9+" : notifCount}</AppText>
              </View>
            )}
          </TouchableOpacity>
        </View>
     </LinearGradient>

    <Animated.ScrollView
      onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingTop: 95 }}
      refreshControl={ <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#2E7D32"]} tintColor="#2E7D32" /> }
    >
      <Animated.View>
        <View>
          <LinearGradient colors={["#1B5E20","#1B5E20"]} style={styles.header}>
          {!isOnline && (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: "rgba(239, 68, 68, 0.12)", borderColor: "rgba(239, 68, 68, 0.4)", borderWidth: 1, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginBottom: 12, gap: 8, alignSelf: "flex-start" }}>
              <View>
                <AppText style={{ color: "#EF4444", fontSize: 13, fontWeight: "600", letterSpacing: 0.5 }} language={language}>
                  {language === "te" ? "ఇంటర్నెట్ లేదు | పాత డేటా కనిపిస్తోంది" : "Offline | Using cached data"}
                </AppText>
              </View>
            </View>
          )}

          {/* HEADER CAROUSEL */}
          <View style={styles.headerCarousel}>
            <FlatList
              ref={headerCardRef}
              data={[{type:"weather"},{type:"market"}]}
              horizontal
              pagingEnabled
              snapToInterval={width}
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item,index)=>index.toString()}
              onMomentumScrollEnd={(e)=>{
                const index = Math.round(e.nativeEvent.contentOffset.x / (width - 40));
                setActiveHeaderCard(index);
              }}
              onScrollToIndexFailed={(info) => {
                const wait = new Promise(resolve => setTimeout(resolve, 500));
                wait.then(() => {
                  headerCardRef.current?.scrollToIndex({ index: info.index, animated: true });
                });
              }}
              renderItem={({item})=>{
                if(item.type==="weather"){
                  return(
                    <View style={{ width: width - 40, alignSelf:"center" }}>
                      <TouchableOpacity style={styles.headerGlassCard} onPress={()=>router.push("/farmer/weather")} activeOpacity={0.9}>
                        <View style={styles.weatherLeft}>
                          <View style={styles.locationRow}>
                            <Ionicons name="location-outline" size={16} color="white"/>
                            {/* 🔥 PRO FIX 2: Truncate long city names to prevent overflow */}
                            <AppText style={styles.city} language={language} numberOfLines={1} ellipsizeMode="tail">{city}</AppText>
                          </View>
                          <AppText style={styles.date} language={language}>{date} | {time}</AppText>
                          <View style={styles.weatherRow}>
                            <Animated.Image source={getWeatherIcon()} style={ styles.weatherIcon} />
                            <AppText style={styles.weatherText} language={language}>{weather}</AppText>
                          </View>
                          <View style={styles.rightTopSection}>
                            <View style={styles.forecastRow}>
                              <AppText style={styles.openText} language={language}>{t.forecast}</AppText>
                              <AnimatedReanimated.View style={[styles.swipeIcon, swipeAnimatedStyle]}>
                                <Ionicons name="arrow-forward-outline" size={16} color="#ffffff"/>
                              </AnimatedReanimated.View>
                            </View>
                            <AppText style={styles.temp} language={language}>{temp ?? "--"}°C</AppText>
                          </View>
                        </View>
                      </TouchableOpacity>
                    </View>
                  )}
                return(
                  <View style={{ width: width - 40, alignSelf:"center" }}>
                    <TouchableOpacity style={[styles.headerGlassCard,{flexDirection:"column"}]} onPress={()=>router.push("/farmer/market")} activeOpacity={0.9}>
                      <View style={styles.marketHeaderRow}>
                        <View style={styles.marketTitleRow}>
                          <Ionicons name="analytics-outline" size={16} color="white" />
                          <AppText style={styles.marketTitle} language={language}>{language==="te" ? "పంట ధరలు" : "Crop Prices"}</AppText>
                        </View>
                        <View style={styles.marketSeeMore}>
                          <AppText style={styles.openText} language={language}>{language==="te" ? "ఇంకా చూడండి" : "See More"}</AppText>
                          <AnimatedReanimated.View style={[styles.swipeIcon, swipeAnimatedStyle]}>
                            <Ionicons name="arrow-forward-outline" size={16} color="#ffffff"/>
                          </AnimatedReanimated.View>
                        </View>
                      </View>
                      <View style={{height:80,overflow:"hidden",marginTop:4}}>
                        <AnimatedReanimated.View style={priceAnimatedStyle}>
                          {priceLoading ? (
                            <View style={styles.priceLoadingBox}>
                              <Animated.View><Ionicons name="sync-outline" size={18} color="white"/></Animated.View>
                              <AppText style={styles.priceLoadingText} language={language}>{language==="te" ? "ధరలు పొందుతున్నాం..." : "Fetching Prices..."}</AppText>
                            </View>
                          ) : (
                            <>
                              {prices.length === 0 && !priceLoading && (
                                <AppText style={{ color: "white", textAlign: "center" }}>{language === "te" ? "డేటా లేదు" : "No data available"}</AppText>
                              )}
                              {prices.map((item:any,index:number)=>{
                                const trend = getTrend(item.modal_price, item.prevPrice);
                                return(
                                  <View key={index} style={styles.marketRow}>
                                    <View style={styles.marketLeft}>
                                      <AppText style={styles.crop} language={language} numberOfLines={1} ellipsizeMode="tail">{(item.commodity || "").replace(/\(.*?\)/g,"")}</AppText>
                                      <AppText style={styles.marketName} language={language} numberOfLines={1} ellipsizeMode="tail">{item.market} | {item.arrival_date?.slice(0,5) || ""}</AppText>
                                    </View>
                                    <View style={styles.marketRight}>
                                      <AppText style={styles.price} language={language}>₹{Number(item.modal_price).toLocaleString("en-IN")}</AppText>
                                      {trend==="up" && (<Ionicons name="arrow-up" size={16} color="#22c55e"/>)}
                                      {trend==="down" && (<Ionicons name="arrow-down" size={16} color="#ef4444"/>)}
                                    </View>
                                  </View>
                                )
                              })}
                            </>
                          )}
                        </AnimatedReanimated.View>
                      </View>
                    </TouchableOpacity>
                  </View>
                )
              }}
            />
          </View>
        </LinearGradient>

        <View style={{ position: "relative", alignItems: "center" }}>
          <Svg width={width + 40} height={40} viewBox={`0 0 ${width + 40} 40`} style={[styles.headerSvg, { marginLeft: -20 }]}>
            <Path d={`M0 0 H${width + 40} Q${(width + 40)/2} 40 0 0 Z`} fill="#1B5E20" />
          </Svg>
          <View style={[styles.headerDots, { position: "absolute", top: 0 }]}>
            <View style={[styles.headerDot, activeHeaderCard===0 && styles.headerDotActive]}/>
            <View style={[styles.headerDot, activeHeaderCard===1 && styles.headerDotActive]}/>
          </View>
        </View>
      </View>
    </Animated.View>

    {/* 🔥 ACTIVE SESSION CARD */}
    <TouchableOpacity style={styles.sessionMainContainer} onPress={() => setSessionModal(true)} activeOpacity={0.85}>
      <View style={styles.sessionContent}>
        <View style={[styles.iconWrapper, { marginBottom: 0, marginRight: 14, padding: 10 }]}>
          <Ionicons name="calendar-outline" size={24} color="#2E7D32" />
        </View>
        <View>
          <AppText style={styles.sessionLabel}>{language === "te" ? "ప్రస్తుత సాగు సంవత్సరం" : "Active Season"}</AppText>
          <AppText style={styles.sessionValue}>{activeSession || "Set Season"}</AppText>
        </View>
      </View>
      
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={styles.changeBtn}>
          <Ionicons name="swap-horizontal" size={16} color="#4B5563" />
          <AppText style={styles.changeBtnText} language={language}>{language === "te" ? "మార్చు" : "Change"}</AppText>
        </View>
        
        {isAdmin && (
          <TouchableOpacity style={[styles.notifyBtn, { marginRight: 0, backgroundColor: "rgba(234, 179, 8, 0.15)", padding: 8 }]} activeOpacity={0.8} onPress={() => router.push("/farmer/schemes/admin-scheme" as any)}>
            <Ionicons name="shield-checkmark" size={20} color="#FBBF24" />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>

    {/* QUICK SERVICES */}
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { fontFamily: "Mandali" }]}>{t.quick}</Text>
      <TouchableOpacity style={styles.swipeContainer} onPress={()=>{ 
          if(quickServices && quickServices.length > 0) {
            const targetIndex = scrollForward ? Math.min(3, quickServices.length - 1) : 0;
            quickRef.current?.scrollToIndex({ index: targetIndex, animated: true }); 
            setScrollForward(!scrollForward); 
          }
        }}>
        <Text style={[styles.swipeText, { fontFamily: "Mandali" }]}>{language === "te" ? "మరిన్ని" : "Swipe"}</Text>
        <AnimatedReanimated.View style={[styles.swipeIcon, swipeAnimatedStyle]}>
          <Ionicons name={scrollForward ? "chevron-forward-outline" : "chevron-back-outline"} size={16} color="#9CA3AF" />
        </AnimatedReanimated.View>
      </TouchableOpacity>
    </View>

    <FlatList
      ref={quickRef}
      data={quickServices}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(item: any)=>item.service}
      contentContainerStyle={{ paddingLeft:20, paddingRight:10, paddingTop:0, paddingBottom: 0 }}
      snapToAlignment="start"
      decelerationRate="fast"
      snapToInterval={(width - 60) / 3 + 10}
      onScrollToIndexFailed={(info) => {
        const wait = new Promise(resolve => setTimeout(resolve, 500));
        wait.then(() => {
          quickRef.current?.scrollToIndex({ index: info.index, animated: true });
        });
      }}
      renderItem={({item,index}: any)=>(
        <TouchableOpacity style={styles.smartChip} onPress={()=>handleServiceClick(item.screen,item.service,index)} activeOpacity={0.85}>
          <View style={styles.smartIconCircle}>
            <Image source={item.icon} style={styles.smartChipIcon}/>
          </View>
          <AppText style={styles.smartChipText} language={language}>{item.title}</AppText>
        </TouchableOpacity>
      )}
    />
    
   {/* ALL SERVICES */}
    <View style={[styles.sectionHeader, { marginTop: 5 }]}>
      <Text style={[styles.sectionTitle, { fontFamily: "Mandali" }]}>
        {t.all}
      </Text>
    </View>

    <View style={styles.grid}>
      {getServices().map((item, index) => (
        <TouchableOpacity key={item.service} style={styles.gridCard} onPress={() => handleServiceClick(item.screen,item.service,index)} activeOpacity={0.75}>
          <View style={styles.iconWrapper}>
            <Image source={item.icon} style={styles.cardIcon} />
          </View>
          
          <View style={styles.cardTextContainer}>
            <AppText style={styles.cardText} language={language} numberOfLines={2}>
              {item.title}
            </AppText>
          </View>
          
        </TouchableOpacity>
      ))}
    </View>

    <Modal visible={sessionModal} transparent animationType="slide">
      <View style={{ flex:1, backgroundColor:"rgba(0,0,0,0.4)", justifyContent:"flex-end" }}>
        <View style={{ backgroundColor:"#fff", padding:20, borderTopLeftRadius:20, borderTopRightRadius:20 }}>
          <View style={styles.modalHeader}>
            <AppText style={styles.sectionTitle}>{language === "te" ? "సంవత్సరం ఎంచుకోండి" : "Select Season"}</AppText>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setSessionModal(false)}>
              <Ionicons name="close" size={16} color="#1F2937" />
            </TouchableOpacity>
          </View>
          {sessions.map((s)=>(
            <TouchableOpacity key={s} style={{ padding:14, borderRadius:12, backgroundColor: activeSession === s ? "#DCFCE7" : "#F3F4F6", marginBottom:10 }} onPress={async ()=>{
                const phone = await AsyncStorage.getItem("USER_PHONE");
                await firestore().collection("users").doc(phone!).update({ activeSession: s });
                setActiveSession(s);
                setSessionModal(false);
              }}>
              <AppText style={{fontSize:16,fontWeight:"600"}}>{s}</AppText>
            </TouchableOpacity>
          ))}
          {oldSessions.length > 0 && (
            <TouchableOpacity style={{ padding:14, borderRadius:12, backgroundColor:"#E0F2FE", marginTop:10 }} onPress={() => { setSessionModal(false); setOldSessionModal(true); }}>
              <AppText style={{textAlign:"center",fontWeight:"600"}}>{language === "te" ? "పాత డేటా చూడండి" : "View Old Data"}</AppText>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>

    <Modal visible={oldSessionModal} transparent animationType="slide">
      <View style={{ flex:1, backgroundColor:"rgba(0,0,0,0.4)", justifyContent:"flex-end" }}>
        <View style={{ backgroundColor:"#fff", padding:20, borderTopLeftRadius:20, borderTopRightRadius:20 }}>
          <View style={styles.modalHeader}>
            <AppText style={styles.sectionTitle}>{language === "te" ? "పాత సీజన్లు" : "Old Sessions"}</AppText>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setOldSessionModal(false)}>
              <Ionicons name="close" size={16} color="#1F2937" />
            </TouchableOpacity>
          </View>
          {/* 🔥 PRO FIX 3: ScrollView for many old sessions preventing off-screen modal issues */}
          <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
            {oldSessions.map((s)=>(
              <TouchableOpacity key={s} style={{ padding:14, borderRadius:12, backgroundColor:"#F3F4F6", marginBottom:10 }} onPress={async ()=>{
                  const phone = await AsyncStorage.getItem("USER_PHONE");
                  await firestore().collection("users").doc(phone!).update({ activeSession: s });
                  setActiveSession(s);
                  setOldSessionModal(false);
                }}>
                <AppText style={{fontSize:16,fontWeight:"600"}}>{s}</AppText>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>

    </Animated.ScrollView>
  </SafeAreaView>
  );
}

/* ---------------- STYLES ---------------- */
const styles = StyleSheet.create({
  safe:{ flex:1, backgroundColor:"#F6F7F6" },
  header:{ paddingTop:28, paddingBottom:15, paddingHorizontal:20, justifyContent:"center" },
  headerCarousel:{ alignItems:"center", justifyContent:"center" },
  headerSvg:{ marginTop:-1, alignSelf:"center" },
  stickyTop: { position: "absolute", top: 0, width: "100%", zIndex: 50, paddingTop: 45, paddingHorizontal: 20, paddingBottom: 5 },
  headerRow:{ flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginBottom:5 },
  profileRow:{ flexDirection:"row", alignItems:"center", flexShrink: 1 },
  profileImage:{ width:50, height:50, borderRadius:25, marginRight:10 },
  avatar:{ width:70, height:70, borderRadius:35, backgroundColor:"#16A34A", justifyContent:"center", alignItems:"center", elevation:5 },
  avatarText:{ color:"#fff", fontSize:26, fontWeight:"bold" },
  name:{ color:"white", fontSize:22, includeFontPadding:false, textAlignVertical:"center", flexShrink: 1 },
  notifyBtn:{ backgroundColor:"rgba(255,255,255,0.2)", padding:10, borderRadius:12 },
  headerGlassCard:{ width:"100%", height:120, backgroundColor:"rgba(255,255,255,0.22)", borderRadius:22, paddingVertical:16, paddingHorizontal:16, flexDirection:"row", justifyContent:"space-between", borderWidth:1, borderColor:"rgba(255,255,255,0.35)" },
  drawerItem:{ flexDirection:"row", alignItems:"center", paddingVertical:14, borderBottomWidth:0.5, borderColor:"#E5E7EB", gap:12 },
  drawerText:{ fontSize:15, fontWeight:"600", color:"#1F2937" },
  openText:{ color:"white", fontSize:12, opacity:0.9 },
  weatherCard:{ marginTop:30, backgroundColor:"rgba(255,255,255,0.22)", borderRadius:22, padding:18, flexDirection:"row", justifyContent:"space-between", borderWidth:1, borderColor:"rgba(255,255,255,0.35)" },
  locationRow:{ flexDirection:"row", alignItems:"center", paddingRight: 5, flexShrink: 1 },
  city:{ flexShrink: 1, color:"white", fontSize:16, fontWeight:"600", marginLeft:6, includeFontPadding: false, lineHeight: 22, marginTop: -2 },
  date:{ color:"rgba(255,255,255,0.8)", fontSize:14, marginTop:5 },
  greetRow:{ flexDirection:"row", alignItems:"center", gap:6 },
  rightTopSection:{ position:"absolute", right:8, alignItems:"flex-end" },
  forecastRow:{ flexDirection:"row", alignItems:"center", marginBottom:4 },
  greet:{ color:"#C8E6C9", fontSize:14, fontWeight:"600" },
  weatherRow:{ flexDirection:"row", alignItems:"center" },
  weatherIcon:{ width:30, height:30, marginRight:6 },
  weatherLeft:{ flex:1, paddingRight: 110 },
  weatherRight:{ justifyContent:"center", alignItems:"center" },
  weatherText:{ color:"white", fontSize:15, marginRight:1, flexShrink:1, includeFontPadding: false, lineHeight: 20, marginTop: 6 },
  temp:{ color:"white", fontSize:55, fontWeight:"bold", marginRight: -6 },
  headerDots:{ flexDirection:"row", justifyContent:"center", marginTop:0 },
  badge: { position: "absolute", top: -8, right: -8, width: 22, height: 22, borderRadius: 11, backgroundColor: "#EF4444", justifyContent: "center", alignItems: "center", borderWidth: 2.5, borderColor: "#1B5E20" },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700", textAlign: "center", includeFontPadding: false, textAlignVertical: "center" },
  headerDot:{ width:8, height:8, borderRadius:4, backgroundColor:"rgba(255,255,255,0.4)", marginHorizontal:4 },
  headerDotActive:{ backgroundColor:"white" },
  marketRow:{ flexDirection:"row", alignItems:"center", justifyContent:"space-between", paddingVertical:8, borderBottomWidth:0.5, borderBottomColor:"rgba(255,255,255,0.15)" },
  marketLeft:{ flex:1 },
  marketHeaderRow:{ flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginBottom:8, marginTop: -5 },
  marketTitleRow:{ flexDirection:"row", alignItems:"center", gap:6 },
  priceLoadingBox:{ flexDirection:"row", alignItems:"center", justifyContent:"center", gap:6, marginTop:10 },
  priceLoadingText:{ color:"white", fontSize:13, opacity:0.9 },
  marketTitle:{ color:"white", fontSize:16, fontWeight:"600" },
  marketSeeMore:{ flexDirection:"row", alignItems:"center", gap:4 },
  marketRight:{ flexDirection:"row", alignItems:"center", justifyContent:"flex-end", minWidth:80, paddingLeft: 10 },
  crop:{ color:"white", fontSize:15, fontWeight:"700", flexShrink: 1 },
  marketName:{ color:"rgba(255,255,255,0.75)", fontSize:11, marginTop:2, flexShrink: 1 },
  price:{ color:"white", fontSize:16, fontWeight:"bold", marginRight:6 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15 },
  closeBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: "#E5E7EB", justifyContent: "center", alignItems: "center" },
  sessionMainContainer: { marginHorizontal: 20, marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 20, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8 },
  sessionContent: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  sessionLabel: { fontSize: 13, color: '#6B7280', marginBottom: 2, fontFamily: "Mandali" },
  sessionValue: { fontSize: 18, fontWeight: '700', color: '#111827' },
  changeBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#F3F4F6", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, gap: 6 },
  changeBtnText: { fontSize: 13, fontWeight: "600", color: "#4B5563", includeFontPadding: false },
  sectionHeader:{ flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginHorizontal:20, marginTop:25, marginBottom: 8 },
  sessionBox: { marginHorizontal: 20, marginTop: 10, marginBottom: 10, backgroundColor: "#ffffff", padding: 14, borderRadius: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderColor: "#E5E7EB" },
  sectionTitle:{ fontSize:20, color:"#1F2937", fontFamily: "Mandali" },
  sectionDivider:{ flex:1, height:1, backgroundColor:"#E5E7EB", marginLeft:10 },
  swipeContainer:{ flexDirection:"row", alignItems:"center", backgroundColor:"#F3F4F6", paddingHorizontal:10, paddingVertical:4, borderRadius:14 },
  swipeText:{ fontSize:12, color:"#6B7280", fontWeight:"500", marginHorizontal:4 },
  swipeIcon:{ justifyContent:"center", alignItems:"center" },
  quickScroll:{ paddingLeft:20, paddingRight:10, paddingTop:15 },
  gridCard: { 
    width: (width - 70) / 3, 
    minHeight: 135, 
    backgroundColor: "#F8FAF9", 
    borderColor: "#E5E7EB", 
    borderRadius: 18, 
    paddingTop: 16, 
    paddingHorizontal: 8, 
    paddingBottom: 10, 
    alignItems: "center", 
    borderWidth: 1 
  },
  iconWrapper: { 
    backgroundColor: "#E8F5E9", 
    padding: 12, 
    borderRadius: 16, 
    marginBottom: 2, 
    justifyContent: "center", 
    alignItems: "center" 
  },
  cardTextContainer: {
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 2, 
  },
  cardText: { 
    fontFamily: "Mandali", 
    fontSize: 13, 
    fontWeight: "600", 
    color: "#1F2937", 
    textAlign: "center", 
    includeFontPadding: false, 
    lineHeight: 24 
  },
  grid:{ flexDirection:"row", flexWrap:"wrap", justifyContent:"flex-start", paddingHorizontal:20, paddingBottom: 10, marginBottom: 20, gap:14 },
  cardIcon:{ width:22, height:22, tintColor:"#2E7D32", resizeMode:"contain" },
  smartCard:{ flexDirection:"row", alignItems:"center", paddingVertical:12, paddingHorizontal:16, borderTopColor:"rgba(255,255,255,0.6)", borderRadius:20, marginRight:12, marginBottom:10, borderWidth:1, borderColor:"rgba(255,255,255,0.35)", shadowColor:"#000", shadowOpacity:0.12, shadowRadius:10, elevation:5 },
  smartChip:{ flexDirection:"row", alignItems:"center", backgroundColor:"#F8F9FA", paddingVertical:9, paddingHorizontal:14, borderRadius:20, minHeight: 36, marginRight:12, marginBottom:8, borderWidth:1, borderColor:"#E5E7EB" },
  smartChipIcon:{ width:16, height:16, tintColor:"#2E7D32", resizeMode:"contain" },
  smartChipText:{ fontSize:13, fontWeight:"600", color:"#1F2937", letterSpacing:0.2 },
  smartIconCircle:{ width:26, height:26, borderRadius:13, backgroundColor:"#E8F5E9", justifyContent:"center", alignItems:"center", marginRight:8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', backgroundColor: 'white', borderRadius: 25, padding: 25, alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: '500', color: '#e2431f', marginVertical: 10 },
  modalTitle1: { fontSize: 20, fontWeight: '500', color: '#187012', marginVertical: 10 },
  modalSub: { textAlign: 'center', color: '#64748B', marginBottom: 25, lineHeight: 20 },
  modalButtons: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center' },
  confirmBtn: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: '#EF4444', alignItems: 'center' },
  cancelText: { color: '#64748B', fontWeight: '500' },
  confirmText: { color: 'white', fontWeight: '500' },
  iconBg: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#f5e8e8", justifyContent: "center", alignItems: "center", marginBottom: 10 }
});