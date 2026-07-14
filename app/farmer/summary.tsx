// app/farmer/summary/index.tsx

import AppEmptyState from "@/components/AppEmptyState";
import { executeOfflineSafeRead, executeOfflineSafeWrite, executeOfflineSafeFetch } from "@/utils/offlineHelper";
import NetInfo from "@react-native-community/netinfo";

import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";
import { LOGO_BASE64 } from "@/constants/logoBase64";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import * as MediaLibrary from 'expo-media-library';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import ViewShot from "react-native-view-shot";

import { memo, useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Image,
  Modal,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Platform,
  TouchableOpacity,
  View
} from "react-native";
import ShimmerPlaceholder from "react-native-shimmer-placeholder";
import Svg, { Circle } from "react-native-svg";

// 🔥 PRO FIX: Alias Reanimated so it doesn't clash with standard Animated
import Reanimated, { Easing as ReanimatedEasing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';

/* ---------------- 🔥 60FPS UI-THREAD ANIMATED CIRCLE (REANIMATED) ---------------- */
const ReanimatedCircle = Reanimated.createAnimatedComponent(Circle);

const CropProgressCircle = memo(({ percent, displayText, color }: { percent: number; displayText: string; color: string }) => {
  const radius = 30;
  const size = 80;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  // 🔥 Shared value runs strictly on the Native UI thread
  const progress = useSharedValue(0);

  useEffect(() => {
    // Reset to 0 if needed, then glide to the target percentage
    progress.value = 0; 
    progress.value = withTiming(percent, {
      duration: 1500, // Premium smooth duration
      easing: ReanimatedEasing.bezier(0.25, 0.1, 0.25, 1), 
    });
  }, [percent]);

  // 🔥 This recalculates the SVG path instantly on the GPU without asking JavaScript
  const animatedProps = useAnimatedProps(() => {
    const strokeDashoffset = circumference - (circumference * progress.value) / 100;
    return {
      strokeDashoffset,
    };
  });

  return (
    <View style={styles.circleWrap}>
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke="#F1F5F9"
          strokeWidth="6"
          fill="none"
        />
        <ReanimatedCircle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth="6"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps} 
          strokeLinecap="round"
          rotation="-90"
          origin={`${center},${center}`}
        />
      </Svg>
      <View style={styles.circleCenter}>
        <AppText style={[styles.circleText, { color, fontWeight: '700' }]}>
          {displayText}%
        </AppText>
      </View>
    </View>
  );
});

/* ---------------- 🔥 KISAN KHATA 5-TIER PRO REPORT CARD LOGIC ---------------- */
const getRankAndTier = (phone: string, totalFarmers: number, profit: number, totalCost: number) => {
   const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;
   let tierId = 5;
   let tierName = "నవ రైతు";
   let tierColor = ["#10B981", "#047857"];
   let badge = "🌱";
   let remarksTe = "కిసాన్ ఖాతా కుటుంబంలోకి సుస్వాగతం! మీ వ్యవసాయ ఖర్చులు, ఆదాయాలను క్రమం తప్పకుండా నమోదు చేసుకుంటూ లాభాల వైపు పయనించండి.";
   let remarksEn = "Welcome to the Kisan Khata family! Keep recording your daily expenses and income regularly to steer towards success.";

   if (roi > 40) { 
     tierId = 1; 
     tierName = "ఆదర్శ రైతు"; 
     tierColor = ["#F59E0B", "#B45309"]; 
     badge = "🏆"; 
     remarksTe = "అద్భుతమైన పెట్టుబడి ప్రణాళిక మరియు అపారమైన లాభాలు సాధించారు. మీ వ్యవసాయ విధానం తోటి రైతులకు ఆదర్శం!";
     remarksEn = "Outstanding profits with excellent investment planning. Your farming methods are a model for fellow farmers!";
   }
   else if (roi > 15) { 
     tierId = 2; 
     tierName = "ప్రగతిశీల రైతు"; 
     tierColor = ["#3B82F6", "#1D4ED8"]; 
     badge = "🥈"; 
     remarksTe = "మంచి ప్రణాళికతో లాభాల బాటలో పయనిస్తున్నారు. కొద్దిగా పెట్టుబడి ఖర్చులు తగ్గించుకుంటే త్వరలోనే 'ఆదర్శ రైతు' కాగలరు!";
     remarksEn = "On the track of profits with good planning. A small reduction in inputs can soon make you a 'Model Farmer'!";
   }
   else if (roi > 0) { 
     tierId = 3; 
     tierName = "కష్టజీవి"; 
     tierColor = ["#F97316", "#C2410C"]; 
     badge = "🥉"; 
     remarksTe = "మీ నిరంతర శ్రమతో సాగును విజయవంతం చేశారు. పెట్టుబడి ఖర్చులు నియంత్రించుకుంటే ఇంకా మంచి లాభాలు సాధించవచ్చు.";
     remarksEn = "Farmed successfully with your relentless hard work. Keeping a closer check on costs will help yield higher profits.";
   }
   else if (totalCost > 0 && roi <= 0) { 
     tierId = 4; 
     tierName = "పోరాట యోధుడు"; 
     tierColor = ["#8B5CF6", "#6D28D9"]; 
     badge = "🛡️"; 
     remarksTe = "మార్కెట్ ఒడిదుడుకులు, పెరిగిన ఖర్చుల వల్ల నష్టాలు వచ్చినా నిలబడ్డారు. తదుపరి పంటకు ఖర్చులు తగ్గించుకుని లాభాలు సాధిస్తారని ఆశిస్తున్నాము!";
     remarksEn = "Stood strong despite losses from high costs/market drops. We hope you reduce expenses and secure profits in the next crop!";
   }

   let hash = 0;
   if (phone) {
     for (let i = 0; i < phone.length; i++) {
        hash = phone.charCodeAt(i) + ((hash << 5) - hash);
     }
   }
   
   const absHash = Math.abs(hash);
   let minRank = 1;
   let maxRank = Math.max(2, totalFarmers);
   
   if (tierId === 1) { maxRank = Math.max(1, Math.floor(totalFarmers * 0.10)); }
   else if (tierId === 2) { minRank = Math.max(1, Math.floor(totalFarmers * 0.10)); maxRank = Math.max(minRank, Math.floor(totalFarmers * 0.30)); }
   else if (tierId === 3) { minRank = Math.max(1, Math.floor(totalFarmers * 0.30)); maxRank = Math.max(minRank, Math.floor(totalFarmers * 0.60)); }
   else if (tierId === 4) { minRank = Math.max(1, Math.floor(totalFarmers * 0.60)); maxRank = Math.max(minRank, Math.floor(totalFarmers * 0.90)); }
   else { minRank = Math.max(1, Math.floor(totalFarmers * 0.90)); }

   const rank = minRank + (absHash % Math.max(1, (maxRank - minRank)));

   return { rank, tierId, tierName, tierColor, badge, roi: Math.round(roi), remarksTe, remarksEn };
};

const KisanKhataReportCard = ({ userName, phone, language, totalFarmers, stateFarmers, userState, profit, totalCost, cropCount, profileImage, role }: any) => {
  const getDefaultImage = () => {
    return require('../../assets/images/default.avif');
  };
  const viewShotRef = useRef<any>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const overall = getRankAndTier(phone + "overall", totalFarmers, profit, totalCost);
  const stateData = getRankAndTier(phone + userState, stateFarmers, profit, totalCost);
  
  const stateFullNameTe = userState === "AP" ? "ఆంధ్రప్రదేశ్" : "తెలంగాణ";
  const stateFullNameEn = userState === "AP" ? "Andhra Pradesh" : "Telangana";
  const stateDisplay = language === "te" ? stateFullNameTe : stateFullNameEn;

  const captureAndShare = async () => {
    setIsCapturing(true);
    setTimeout(async () => {
      if (viewShotRef.current) {
        try {
          const uri = await viewShotRef.current.capture();
          await Sharing.shareAsync(uri, { dialogTitle: 'Share Kisan Khata Rank' });
        } catch (e) {
          console.error(e);
        } finally {
          setIsCapturing(false);
        }
      } else {
        setIsCapturing(false);
      }
    }, 100);
  };

  const saveToGallery = async () => {
    if (viewShotRef.current) {
      if (isDownloading) return;
      setIsDownloading(true);
      setIsCapturing(true);
      setTimeout(async () => {
        try {
          const { status } = await MediaLibrary.requestPermissionsAsync();
          if (status !== 'granted') {
            setIsDownloading(false);
            setIsCapturing(false);
            return;
          }
          const uri = await viewShotRef.current.capture();
          await MediaLibrary.saveToLibraryAsync(uri);
          setDownloadSuccess(true);
          setTimeout(() => {
              setDownloadSuccess(false);
          }, 2500);
        } catch (e) {
          console.error(e);
        } finally {
          setIsDownloading(false);
          setIsCapturing(false);
        }
      }, 100);
    }
  };

  return (
    <View style={{ marginHorizontal: 20, marginBottom: 10 }}>
      <ViewShot ref={viewShotRef} options={{ format: "png", quality: 1.0 }} style={{ backgroundColor: "#F8FAFC", borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "#E2E8F0" }}>
        
        {/* TOP: Brand Logo */}
        <View style={{ flexDirection: "row", paddingTop: 10, paddingLeft: 12, paddingBottom: 0, alignItems: "center" }}>
          <Image source={require('./../../assets/images/logonobg.png')} style={{ width: 50, height: 50, resizeMode: "contain", marginLeft: -4 }} />
          <AppText style={{ fontSize: 18, fontWeight: "600", color: "#16A34A", marginLeft: 2 }}>Kisan Khata</AppText>
        </View>

        {/* PROFILE INFO */}
        <View style={{ alignItems: "center", paddingVertical: 10 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "#E2E8F0", justifyContent: "center", alignItems: "center", marginBottom: 8, borderWidth: 2, borderColor: overall.tierColor[0], overflow: "hidden" }}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={{ width: "100%", height: "100%", resizeMode: "cover" }} />
            ) : (
              <Image source={getDefaultImage()} style={[{ width: "100%", height: "100%", resizeMode: "cover" }, !profileImage && { transform: [{ scale: 1.25 }] }]} />
            )}
          </View>
          <AppText style={{ fontSize: 20, fontWeight: "600", color: "#1E293B" }}>{userName}</AppText>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, backgroundColor: "#F1F5F9", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
            <Ionicons name="location-sharp" size={12} color="#64748B" />
            <AppText style={{ fontSize: 12, color: "#64748B", marginLeft: 4, fontWeight: "600" }}>{stateDisplay}</AppText>
          </View>
        </View>

        {/* DOUBLE RANK & TIER (STACKED VERTICALLY) */}
        <View style={{ marginHorizontal: 15, borderRadius: 12, overflow: "hidden", marginVertical: 10 }}>
          <LinearGradient colors={overall.tierColor as any} style={{ padding: 15, alignItems: "center" }}>
            
            <View style={{ width: "100%", marginBottom: 15 }}>
               {/* State Rank Row */}
               <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <AppText style={{ fontSize: 13, color: "rgba(255,255,255,0.9)", fontWeight: "600", letterSpacing: 0.5 }}>
                    {language === "te" ? `${stateFullNameTe} ర్యాంక్` : `${stateFullNameEn.toUpperCase()} RANK`}
                  </AppText>
                  <View style={{ flexDirection: "row", alignItems: "baseline" }}>
                    <AppText style={{ fontSize: 22, fontWeight: "600", color: "#FFF" }}>{stateData.rank.toLocaleString('en-IN')}</AppText>
                    <AppText style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginLeft: 4 }}> / {stateFarmers.toLocaleString('en-IN')}</AppText>
                  </View>
               </View>

               <View style={{ width: "100%", height: 1, backgroundColor: "rgba(255,255,255,0.2)", marginBottom: 12 }} />

               {/* Overall Rank Row */}
               <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <AppText style={{ fontSize: 13, color: "rgba(255,255,255,0.9)", fontWeight: "600", letterSpacing: 0.5 }}>
                    {language === "te" ? "సమగ్ర ర్యాంక్" : "OVERALL RANK"}
                  </AppText>
                  <View style={{ flexDirection: "row", alignItems: "baseline" }}>
                    <AppText style={{ fontSize: 22, fontWeight: "600", color: "#FFF" }}>{overall.rank.toLocaleString('en-IN')}</AppText>
                    <AppText style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginLeft: 4 }}> / {totalFarmers.toLocaleString('en-IN')}</AppText>
                  </View>
               </View>
            </View>

            <View style={{ backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, flexDirection: "row", alignItems: "center", marginTop: 5 }}>
              <AppText style={{ fontSize: 18, marginRight: 6 }}>{overall.badge}</AppText>
              <AppText style={{ color: "#FFF", fontWeight: "600", fontSize: 16 }}>{overall.tierName}</AppText>
            </View>
          </LinearGradient>
        </View>

        {/* STATS */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 20 }}>
          <View style={{ alignItems: "center", flex: 1 }}>
            <AppText style={{ fontSize: 11, color: "#64748B", textTransform: "uppercase", fontWeight: "600" }}>{language === "te" ? "పెట్టుబడి రాబడి" : "ROI"}</AppText>
            <AppText style={{ fontSize: 16, fontWeight: "600", color: "#0F172A", marginTop: 4 }}>{overall.roi}%</AppText>
          </View>
          <View style={{ width: 1, backgroundColor: "#E2E8F0", height: "80%", alignSelf: "center" }} />
          <View style={{ alignItems: "center", flex: 1 }}>
            <AppText style={{ fontSize: 11, color: "#64748B", textTransform: "uppercase", fontWeight: "600" }}>{language === "te" ? "పంటలు" : "CROPS"}</AppText>
            <AppText style={{ fontSize: 16, fontWeight: "600", color: "#0F172A", marginTop: 4 }}>{cropCount}</AppText>
          </View>
          <View style={{ width: 1, backgroundColor: "#E2E8F0", height: "80%", alignSelf: "center" }} />
          <View style={{ alignItems: "center", flex: 1 }}>
            <AppText style={{ fontSize: 11, color: "#64748B", textTransform: "uppercase", fontWeight: "600" }}>{language === "te" ? "స్టేటస్" : "STATUS"}</AppText>
            <Ionicons name="shield-checkmark" size={18} color="#16A34A" style={{ marginTop: 4 }} />
          </View>
        </View>

        {/* DIVIDER */}
        <View style={{ height: 1, backgroundColor: "#E2E8F0", marginHorizontal: 15, marginBottom: 15 }} />

        {/* DIVISIONS INFO & REMARKS */}
        <View style={{ paddingHorizontal: 15, paddingBottom: 15 }}>
          {/* TIER LEVEL INDICATOR */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <AppText style={{ fontSize: 12, fontWeight: "600", color: "#64748B" }}>
              {language === "te" ? "విభాగం వివరాలు" : "Division Details"}
            </AppText>
            <AppText style={{ fontSize: 12, fontWeight: "600", color: overall.tierColor[0] }}>
              {language === "te" ? `${overall.tierId}వ విభాగం` : `Tier ${overall.tierId}`}
            </AppText>
          </View>

          {/* TIER PROGRESS DOTS */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 15, paddingHorizontal: 5 }}>
            {[1, 2, 3, 4, 5].map((tId) => {
              const isActive = tId === overall.tierId;
              let tName = "";
              let tColor = "#94A3B8";
              if (tId === 1) { tName = language === "te" ? "ఆదర్శ" : "Model"; tColor = "#F59E0B"; }
              else if (tId === 2) { tName = language === "te" ? "ప్రగతిశీల" : "Progressive"; tColor = "#3B82F6"; }
              else if (tId === 3) { tName = language === "te" ? "కష్టజీవి" : "Worker"; tColor = "#F97316"; }
              else if (tId === 4) { tName = language === "te" ? "యోధుడు" : "Warrior"; tColor = "#8B5CF6"; }
              else { tName = language === "te" ? "నవ" : "New"; tColor = "#10B981"; }

              return (
                <View key={tId} style={{ alignItems: "center", flex: 1 }}>
                  <View style={{ 
                    width: isActive ? 12 : 8, 
                    height: isActive ? 12 : 8, 
                    borderRadius: isActive ? 6 : 4, 
                    backgroundColor: isActive ? tColor : "#CBD5E1",
                    borderWidth: isActive ? 2 : 0,
                    borderColor: "#FFF",
                    shadowColor: isActive ? tColor : "transparent",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.3,
                    shadowRadius: 2,
                    elevation: isActive ? 3 : 0,
                  }} />
                  <AppText style={{ 
                    fontSize: 9, 
                    color: isActive ? tColor : "#64748B", 
                    fontWeight: isActive ? "600" : "500",
                    marginTop: 4 
                  }}>
                    {tName}
                  </AppText>
                </View>
              );
            })}
          </View>

          {/* TEACHER REMARKS BOX */}
          {!isCapturing && (
            <View style={{ 
              backgroundColor: "#F8FAFC", 
              borderRadius: 12, 
              padding: 12, 
              borderWidth: 1,
              borderColor: "#E2E8F0",
              borderLeftWidth: 4, 
              borderLeftColor: overall.tierColor[0] 
            }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                <Ionicons name="chatbubble-ellipses-outline" size={14} color={overall.tierColor[0]} />
                <AppText style={{ fontSize: 11, fontWeight: "600", color: "#475569", marginLeft: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  {language === "te" ? "కిసాన్ ఖాతా అభిప్రాయం" : "Kisan Khata Remarks"}
                </AppText>
              </View>
              <AppText style={{ fontSize: 12.5, color: "#334155", lineHeight: 18, fontStyle: "italic", fontWeight: "500" }}>
                "{language === "te" ? overall.remarksTe : overall.remarksEn}"
              </AppText>
            </View>
          )}
        </View>

      </ViewShot>

      {/* ACTION BUTTONS (outside ViewShot - won't appear in captured image) */}
      <View style={{ flexDirection: "row", marginTop: 15, gap: 10 }}>
        <TouchableOpacity 
          activeOpacity={0.8} 
          onPress={captureAndShare} 
          style={{ 
            flex: 1,
            backgroundColor: '#F0FDF4', 
            padding: 14, 
            borderRadius: 12, 
            borderWidth: 1, 
            borderColor: '#BBF7D0', 
            flexDirection: 'row', 
            alignItems: 'center', 
            justifyContent: 'center'
          }}
        >
          <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
          <AppText style={{ color: "#16A34A", fontWeight: "600", fontSize: 14, marginLeft: 8 }}>{language === "te" ? "షేర్ చేయండి" : "Share"}</AppText>
        </TouchableOpacity>

        <TouchableOpacity 
          activeOpacity={0.8} 
          onPress={saveToGallery} 
          disabled={isDownloading || downloadSuccess}
          style={{ 
            flex: 1,
            backgroundColor: downloadSuccess ? '#D1FAE5' : '#F0F9FF', 
            padding: 14, 
            borderRadius: 12, 
            borderWidth: 1, 
            borderColor: downloadSuccess ? '#6EE7B7' : '#BAE6FD', 
            flexDirection: 'row', 
            alignItems: 'center', 
            justifyContent: 'center',
            opacity: isDownloading ? 0.7 : 1
          }}
        >
          <Ionicons name={downloadSuccess ? "checkmark-circle" : (isDownloading ? "hourglass-outline" : "download-outline")} size={22} color={downloadSuccess ? "#059669" : "#0EA5E9"} />
          <AppText style={{ color: downloadSuccess ? "#047857" : "#0369A1", fontWeight: "600", fontSize: 14, marginLeft: 8 }}>
            {downloadSuccess 
              ? (language === "te" ? "సేవ్ అయింది!" : "Saved!") 
              : isDownloading 
                ? (language === "te" ? "డౌన్‌లోడ్..." : "Downloading...") 
                : (language === "te" ? "డౌన్‌లోడ్" : "Download")}
          </AppText>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function SummaryScreen() {
  const [language, setLanguage] = useState<"te" | "en">("te");
  const [loading, setLoading] = useState(true);
  const [crops, setCrops] = useState<any>({});
  const [summary, setSummary] = useState({ expense: 0, labour: 0, income: 0, profit: 0, rent: 0 });
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [userName, setUserName] = useState("Farmer");
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [role, setRole] = useState("");
  const [typedName, setTypedName] = useState("");
  const [showEmptyModal, setShowEmptyModal] = useState(false);
  const [totalFarmers, setTotalFarmers] = useState(50000); 
  const [stateFarmers, setStateFarmers] = useState(25000); 
  const [userState, setUserState] = useState("AP");
  const [userPhone, setUserPhone] = useState("");
  const [aiState, setAIState] = useState<"idle" | "loading" | "result">("idle");
  const total = summary.expense + summary.labour + summary.rent + summary.income;
  const expensePercent = total ? (summary.expense / total) * 100 : 0;
  const labourPercent = total ? (summary.labour / total) * 100 : 0;
  const rentPercent = total ? (summary.rent / total) * 100 : 0;
  const incomePercent = total ? (summary.income / total) * 100 : 0;
  
  const [barWidth, setBarWidth] = useState(0);

  // 🔐 LOCK SYSTEM STATES
  const [isLocked, setIsLocked] = useState(false);
  const [unlockDate, setUnlockDate] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [showUnlockAnim, setShowUnlockAnim] = useState(false);
  const [sessionStr, setSessionStr] = useState('');
  const [sessionExpiryDays, setSessionExpiryDays] = useState(0);
  const [reloadKey, setReloadKey] = useState(0); // triggers data fetch after unlock
  
  const lockPulseAnim = useRef(new Animated.Value(1)).current;
  const lockRotateAnim = useRef(new Animated.Value(0)).current;
  
  const unlockOpacity = useRef(new Animated.Value(0)).current;
  const unlockScale = useRef(new Animated.Value(0.85)).current;
  const freshUnlockRef = useRef(false); // true only when user just tapped "View Results"
  
  // 🔥 NEW ICON ANIMATION STATES
  const unlockIconPulse = useRef(new Animated.Value(1)).current;
  const lockTurnAnim = useRef(new Animated.Value(0)).current; 
  const [unlockStateIcon, setUnlockStateIcon] = useState<any>('lock-closed');

  // 🔥 బటన్ నొక్కినప్పుడు మాత్రమే ఈ ఫంక్షన్ రన్ అయ్యి శాశ్వతంగా లాక్ ఓపెన్ చేస్తుంది
  const handleUnlockResults = async () => {
    freshUnlockRef.current = true; // 🏆 TIER_COLOR save only this one time
    await AsyncStorage.setItem(`USER_UNLOCKED_${sessionStr}`, 'true');
    try {
      const phone = await AsyncStorage.getItem("USER_PHONE");
      if (phone) {
        await executeOfflineSafeWrite(firestore().collection("users").doc(phone).update({
          viewedRankCardSession: sessionStr
        }));
      }
    } catch (e) {
      console.log("Error updating rank card view", e);
    }
    setShowUnlockAnim(false);
    setIsLocked(false);
    setReloadKey(k => k + 1);
  };

  useEffect(() => {
    setAIState("idle");
  }, []);

  // 🔐 COUNTDOWN TIMER
  useEffect(() => {
    if (!unlockDate || !isLocked) return;
    const tick = () => {
      const now = new Date();
      const diff = unlockDate.getTime() - now.getTime();
      if (diff <= 0) { setIsLocked(false); return; }
      setCountdown({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [unlockDate, isLocked]);

  // 🔐 LOCK PULSE + WOBBLE ANIMATION
  useEffect(() => {
    if (!isLocked) return;
    // Pulse
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(lockPulseAnim, { toValue: 1.08, duration: 1400, useNativeDriver: true }),
        Animated.timing(lockPulseAnim, { toValue: 1, duration: 1400, useNativeDriver: true }),
      ])
    );
    pulse.start();
    // Wobble: shake every 3.5s
    const wobble = Animated.loop(
      Animated.sequence([
        Animated.delay(3500),
        Animated.timing(lockRotateAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.timing(lockRotateAnim, { toValue: -1, duration: 240, useNativeDriver: true }),
        Animated.timing(lockRotateAnim, { toValue: 0.7, duration: 120, useNativeDriver: true }),
        Animated.timing(lockRotateAnim, { toValue: -0.7, duration: 120, useNativeDriver: true }),
        Animated.timing(lockRotateAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      ])
    );
    wobble.start();
    return () => { pulse.stop(); wobble.stop(); };
  }, [isLocked]);

  // 🎉 UNLOCK ANIMATION LOGIC
  useEffect(() => {
    if (!showUnlockAnim) {
      setUnlockStateIcon('lock-closed'); // Reset
      return;
    }

    // 1. Overlay Fade In
    Animated.parallel([
      Animated.timing(unlockOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(unlockScale, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
    ]).start();

    // 2. Lock Jiggle (Key turning effect) -> Then Open -> Then Pulse
    Animated.sequence([
      Animated.delay(500),
      Animated.timing(lockTurnAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(lockTurnAnim, { toValue: -1, duration: 160, useNativeDriver: true }),
      Animated.timing(lockTurnAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
    ]).start(() => {
      // 3. Pop Open!
      setUnlockStateIcon('lock-open');
      unlockIconPulse.setValue(0.3); // Start small for pop effect
      
      Animated.spring(unlockIconPulse, { toValue: 1, friction: 4, tension: 100, useNativeDriver: true }).start(() => {
        // 4. Continuous gentle pulse
        Animated.loop(
          Animated.sequence([
            Animated.timing(unlockIconPulse, { toValue: 1.15, duration: 1200, useNativeDriver: true }),
            Animated.timing(unlockIconPulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
          ])
        ).start();
      });
    });

  }, [showUnlockAnim]);

  useEffect(() => {
    if (!userName) return; 
    let index = 0;
    setTypedName("");
    const interval = setInterval(() => {
      if (index < userName.length) {
        const char = userName.charAt(index); 
        setTypedName((prev) => prev + char);
        index++;
      } else {
        clearInterval(interval);
      }
    }, 80);
    return () => clearInterval(interval);
  }, [userName]);

  const handleAIClick = () => {
    if (aiState !== "idle") return; 
    setAIState("loading");
    setTimeout(() => {
      setAIState("result");
    }, 3000); 
  };

  const AnimatedAIItem = ({ text, index }: any) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(20)).current;

    useEffect(() => {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        delay: index * 400, 
        useNativeDriver: true, // 🔥 PRO FIX: MUST BE TRUE for Opacity
      }).start();

      Animated.timing(translateY, {
        toValue: 0,
        duration: 500,
        delay: index * 150,
        useNativeDriver: true, // 🔥 PRO FIX: MUST BE TRUE for Transform
      }).start();
    }, [fadeAnim, translateY, index]);

    return (
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY }] }}>
        <View style={styles.aiCard}>
          <View style={styles.aiBullet} />
          <AppText style={styles.aiText}>{text}</AppText>
        </View>
      </Animated.View>
    );
  };

  /* ---------------- 🔥 ULTRA HD PROFESSIONAL PDF GENERATOR (BUG FIX) ---------------- */
  const exportProfessionalPDF = async (existingInsights: string[]) => {
    try {
      // 🔥 Fix: Using hardcoded Base64 logo to guarantee rendering on all Android devices
      const logoBase64 = LOGO_BASE64;
      
      const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

      // 🔥 Fix 2: Remove Emojis safely (Android PDF writer crashes if it encounters complex emojis)
      // ఇది ఎమోజీలని మాత్రమే తీసేస్తుంది, తెలుగు/ఇంగ్లీష్ అక్షరాలని సేఫ్ గా ఉంచుతుంది.
      const cleanEmoji = (txt: string) => txt.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDD10-\uDDFF])/g, '').trim();

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Kisan Khata Farm Report</title>
            <style>
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; background-color: #ffffff; margin: 0; }
              .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #16A34A; padding-bottom: 20px; margin-bottom: 30px; }
              .logo-container { display: flex; align-items: center; gap: 5px; }
              .logo-img { width: 65px; height: 80px; object-fit: contain; display: block; }
              .brand-text-container { display: flex; flex-direction: column; justify-content: center; }
              .brand-title { font-size: 32px; font-weight: 800; color: #166534; margin: 0; letter-spacing: -0.5px; line-height: 1.1; }
              .brand-sub { font-size: 13px; color: #64748b; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
              .report-meta { text-align: right; }
              .meta-title { font-size: 22px; font-weight: bold; color: #0f172a; margin: 0 0 5px 0; }
              .meta-date { font-size: 13px; color: #64748b; margin: 0; }
              .meta-farmer { font-size: 14px; font-weight: bold; color: #334155; margin-top: 5px; }
              .ai-section { background-color: #F0FDF4; border-left: 4px solid #16A34A; padding: 20px 25px; border-radius: 0 12px 12px 0; margin-bottom: 35px; }
              .ai-title { color: #166534; font-size: 18px; font-weight: bold; margin-bottom: 15px; display: flex; align-items: center; gap: 8px; }
              .ai-tip { font-size: 14px; color: #1e293b; margin-bottom: 10px; padding-left: 20px; position: relative; }
              .ai-tip::before { content: "•"; position: absolute; left: 0; font-size: 16px; color: #16A34A; top: 0px; } /* 🔥 Changed to safe bullet */
              .dashboard { display: flex; justify-content: space-between; margin-bottom: 35px; gap: 20px; }
              .card { flex: 1; padding: 20px; border-radius: 12px; background-color: #F8FAFC; border: 1px solid #E2E8F0; text-align: center; }
              .card-label { font-size: 12px; color: #64748b; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
              .card-value { font-size: 24px; font-weight: 800; margin-top: 8px; color: #0F172A; }
              .val-profit { color: #166534; }
              .val-loss { color: #DC2626; }
              h2 { font-size: 20px; color: #0f172a; margin-bottom: 15px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; display: inline-block; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
              th { background-color: #F1F5F9; color: #334155; padding: 14px; text-align: left; font-size: 13px; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #CBD5E1; }
              td { padding: 14px; border-bottom: 1px solid #E2E8F0; font-size: 14px; color: #1e293b; }
              tr:nth-child(even) { background-color: #FAFAFA; }
              .crop-name { font-weight: bold; color: #0f172a; }
              .profit { color: #166534; font-weight: bold; }
              .loss { color: #DC2626; font-weight: bold; }
              .status-badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: bold; margin-left: 6px; }
              .status-complete { background-color: #DCFCE7; color: #166534; border: 1px solid #BBF7D0; }
              .status-pending { background-color: #FEF3C7; color: #92400E; border: 1px solid #FDE68A; }
              .footer { margin-top: 50px; text-align: center; border-top: 1px solid #E2E8F0; padding-top: 20px; }
              .footer-brand { font-size: 14px; font-weight: bold; color: #166534; }
              .footer-tag { font-size: 12px; color: #64748b; margin-top: 5px; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="logo-container">
                <img src="${logoBase64}" class="logo-img" />
                <div class="brand-text-container">
                  <h1 class="brand-title">Kisan Khata</h1>
                  <p class="brand-sub">The Digital Farm Ledger</p>
                </div>
              </div>
              <div class="report-meta">
                <h2 class="meta-title">Financial Report</h2>
                <p class="meta-date">${today} | ${time}</p>
                <p class="meta-farmer">Prepared for ${userName}</p>
              </div>
            </div>

            <div class="ai-section">
              <div class="ai-title">Kisan Khata Smart Insights</div>
              ${existingInsights && existingInsights.length > 0 
                ? existingInsights.map(insight => `<div class="ai-tip">${cleanEmoji(insight)}</div>`).join('') 
                : '<div class="ai-tip">Sufficient data is not available to generate deep insights yet. Please log more records.</div>'
              }
            </div>

            <div class="dashboard">
              <div class="card">
                <div class="card-label">Total Revenue</div>
                <div class="card-value val-profit">₹ ${(summary.income || 0).toLocaleString('en-IN')}</div>
              </div>
              <div class="card">
                <div class="card-label">Total Expenses</div>
                <div class="card-value">₹ ${((summary.expense || 0) + (summary.labour || 0) + (summary.rent || 0)).toLocaleString('en-IN')}</div>
              </div>
              <div class="card" style="border-color: ${summary.profit >= 0 ? '#16A34A' : '#DC2626'}; background-color: ${summary.profit >= 0 ? '#F0FDF4' : '#FEF2F2'};">
                <div class="card-label" style="color: ${summary.profit >= 0 ? '#166534' : '#991B1B'};">Net Result</div>
                <div class="card-value ${summary.profit >= 0 ? 'val-profit' : 'val-loss'}">
                  ${summary.profit >= 0 ? '+' : '-'} ₹ ${Math.abs(summary.profit || 0).toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            <h2>Crop-wise Breakdown</h2>
            <table>
              <thead>
                <tr>
                  <th>Crop Name</th>
                  <th>Yield/Acres</th>
                  <th>Total Cost</th>
                  <th>Revenue</th>
                  <th>Net Profit/Loss</th>
                </tr>
              </thead>
              <tbody>
                ${Object.keys(crops).map(key => {
                  const c = crops[key];
                  const totalCost = (c.expense || 0) + (c.labour || 0) + (c.rent || 0);
                  const isComplete = c.acres > 0 && c.expense > 0 && c.labour > 0 && c.quantity > 0 && c.income > 0;
                  return `
                    <tr>
                      <td>
                        <span class="crop-name">${key}</span>
                        <span class="status-badge ${isComplete ? 'status-complete' : 'status-pending'}">${isComplete ? 'Complete' : 'Pending'}</span>
                      </td>
                      <td>${c.quantity || 0} ${getUnitLabel(c.unit)}<br><span style="font-size: 11px; color: #64748b;">${c.acres || 0} Acres</span></td>
                      <td>₹ ${totalCost.toLocaleString('en-IN')}</td>
                      <td>₹ ${(c.income || 0).toLocaleString('en-IN')}</td>
                      <td class="${c.profit >= 0 ? 'profit' : 'loss'}">
                        ${c.profit >= 0 ? '+' : '-'} ₹ ${Math.abs(c.profit || 0).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>

            <div class="footer">
              <div class="footer-brand">Kisan Khata App</div>
              <div class="footer-tag">Certified Digital Farm Ledger & Management Solution</div>
              <div style="font-size: 10px; color: #94a3b8; margin-top: 8px;">Generated securely via Kisan Khata © ${new Date().getFullYear()}</div>
            </div>
          </body>
        </html>
      `;

      // 🔥 Fix 3: Removed setTimeout to ensure error handling works properly
      const { uri } = await Print.printToFileAsync({ 
        html: htmlContent, 
        margins: { left: 20, right: 20, top: 30, bottom: 30 } 
      });
      await Sharing.shareAsync(uri);

    } catch (error) { 
      console.error("PDF Generation Error:", error); 
    }
  };

  const handleDownloadPDF = () => {
    if (isEmpty) {
      setShowEmptyModal(true);
      return;
    }
    exportProfessionalPDF(suggestions);
  };

  const round = (num: number) => Math.round(num);
  const e = round(expensePercent);
  const l = round(labourPercent);
  const r = round(rentPercent);
  const i = round(incomePercent);

  const diff = 100 - (e + l + r + i);
  const finalIncomePercent = i + diff;
  const totalExpenses = summary.expense + summary.labour + summary.rent;
  const isEmpty = Object.keys(crops).length === 0;

  // 🔥 EXACT UI SHIMMER — mirrors real summary layout perfectly
  const SummaryShimmer = () => {
    const S = ShimmerPlaceholder as any;
    const G = LinearGradient;
    return (
      <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
        {/* ── BAR SECTION (mirrors stickyBox) ── */}
        <View style={{ marginHorizontal: 16, marginTop: 14, backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' }}>
          {[1, 2, 3, 4].map(i => (
            <View key={i} style={{ marginBottom: i < 4 ? 18 : 0 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <S LinearGradient={G} style={{ width: 10, height: 10, borderRadius: 5 }} />
                  <S LinearGradient={G} style={{ width: 110, height: 13, borderRadius: 6 }} />
                </View>
                <S LinearGradient={G} style={{ width: 70, height: 13, borderRadius: 6 }} />
              </View>
              <S LinearGradient={G} style={{ width: '100%', height: 8, borderRadius: 4 }} />
            </View>
          ))}
        </View>

        {/* ── CROP CARDS ── */}
        {[1, 2].map(ci => (
          <View key={ci} style={[styles.card, { position: 'relative', paddingVertical: 20 }]}>
            {/* status pill */}
            <S LinearGradient={G} style={{ position: 'absolute', top: 16, right: 16, width: 68, height: 22, borderRadius: 11 }} />
            {/* sidebar */}
            <View style={{ width: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'stretch', marginRight: 16 }} />
            {/* left content */}
            <View style={{ flex: 1, paddingRight: 12 }}>
              <S LinearGradient={G} style={{ width: '58%', height: 18, borderRadius: 6, marginBottom: 8 }} />
              <S LinearGradient={G} style={{ width: '32%', height: 13, borderRadius: 5, marginBottom: 14 }} />
              {/* one badge */}
              <S LinearGradient={G} style={{ width: 115, height: 26, borderRadius: 8, marginBottom: 14 }} />
              {/* text rows — just 3, more gap */}
              {[82, 68, 78].map((w, idx) => (
                <S key={idx} LinearGradient={G} style={{ width: `${w}%`, height: 12, borderRadius: 5, marginBottom: 10 }} />
              ))}
              <S LinearGradient={G} style={{ width: '42%', height: 14, borderRadius: 6, marginTop: 4 }} />
            </View>
            {/* right circle */}
            <View style={{ justifyContent: 'center', alignItems: 'center', width: 80, marginTop: 16 }}>
              <S LinearGradient={G} style={{ width: 72, height: 72, borderRadius: 36 }} />
            </View>
          </View>
        ))}

        {/* ── FOOTER GRADIENT CARD ── */}
        <View style={{ marginHorizontal: 16, marginTop: 10, borderRadius: 20, overflow: 'hidden' }}>
          <S LinearGradient={G} style={{ width: '100%', height: 160, borderRadius: 20 }} />
        </View>
      </View>
    );
  };

  useEffect(() => {
    if (!loading && !isEmpty) {

    }
  }, [loading, isEmpty]);

  // 🔥 HIGHLY ACCURATE & FRIENDLY RULE-BASED AI
  const generateSmartInsights = (cropMap: any, totalInc: number) => {
    const insights: string[] = [];
    const cropEntries = Object.entries(cropMap);
    
    if (cropEntries.length === 0) {
      insights.push(language === "te" ? "👋 మీ వ్యవసాయ వివరాలను నమోదు చేయండి. మీ డేటా ఆధారంగా నేను లోతైన విశ్లేషణ అందిస్తాను." : "👋 Please enter your farm details. I will provide a deep analysis based on your data.");
      setSuggestions(insights);
      return;
    }

    const globalTotalExp = summary.expense + summary.labour + summary.rent;
    const globalProfit = summary.profit;
    const globalROI = globalTotalExp > 0 ? (globalProfit / globalTotalExp) * 100 : 0;

    cropEntries.forEach(([name, data]: any) => {
      const d = data;
      const totalCropCost = d.expense + d.labour + d.rent;
      const profitMargin = d.income > 0 ? (d.profit / d.income) * 100 : 0;
      const labourRatio = totalCropCost > 0 ? (d.labour / totalCropCost) * 100 : 0;
      
      const isPending = d.acres === 0 || d.expense === 0 || d.labour === 0 || d.quantity === 0 || d.income === 0;

      if (isPending) {
        let missing = [];
        if (d.acres === 0) missing.push(language === "te" ? "విస్తీర్ణం (Acres)" : "Acres");
        if (d.expense === 0) missing.push(language === "te" ? "సాగు ఖర్చులు" : "Other Expenses");
        if (d.labour === 0) missing.push(language === "te" ? "కూలీ ఖర్చులు" : "Labour Expenses");
        if (d.quantity === 0) missing.push(language === "te" ? "దిగుబడి పరిమాణం" : "Yield Quantity");
        if (d.income === 0) missing.push(language === "te" ? "అమ్మకం ఆదాయం" : "Sales Income");

        insights.push(language === "te" 
          ? `📝 ${name}: మీ లెక్కలు ఇంకా పెండింగ్ లో ఉన్నాయి. దయచేసి ${missing.join(", ")} నమోదు చేయండి.` 
          : `📝 ${name}: Records pending. Please add: ${missing.join(", ")}.`);
      }

      // 🔥 Accurate Per Acre Yield Logic
      if (d.quantity > 0 && d.acres > 0) {
        const yieldPerAcre = d.quantity / d.acres;
        insights.push(language === "te" 
          ? `🌾 ${name}: మీకు ఎకరాకు సగటున ${yieldPerAcre.toFixed(1)} ${getUnitLabel(d.unit)} దిగుబడి వస్తోంది.` 
          : `🌾 ${name}: Your average yield is ${yieldPerAcre.toFixed(1)} ${d.unit} per acre.`);
      }

      // 🔥 Friendly Rent Reminder
      if (d.rent === 0 && d.acres > 0) {
        insights.push(language === "te"
          ? `🏠 ${name}: మీరు కౌలు వివరాలు నమోదు చేయలేదు. ఒకవేళ మీరు కౌలు చెల్లిస్తుంటే దాన్ని కలపండి, సొంత పొలం అయితే అవసరం లేదు.`
          : `🏠 ${name}: Rent is not recorded. If you pay lease/rent, please add it. If it's your own land, you can ignore this.`);
      }

      if (labourRatio > 55) {
        insights.push(language === "te" 
          ? `👷 ${name}: కూలీల ఖర్చు విపరీతంగా ఉంది (${Math.round(labourRatio)}%). వీలైతే యంత్రాలను వాడండి.` 
          : `👷 ${name}: Excessive labour cost (${Math.round(labourRatio)}%). Explore automation or machinery.`);
      }

      if (d.profit < 0 && !isPending) {
        insights.push(language === "te" 
          ? `🛑 ${name} నష్టంలో ఉంది (-₹${Math.abs(d.profit)}). దీనికి ప్రధాన కారణం ${d.rent > d.expense ? 'అధిక కౌలు' : 'ఎక్కువ పెట్టుబడి'} కావచ్చు.` 
          : `🛑 ${name} is in loss (-₹${Math.abs(d.profit)}). Main reason might be ${d.rent > d.expense ? 'high rent' : 'high input costs'}.`);
      } else if (profitMargin < 15 && d.income > 0 && !isPending) {
        insights.push(language === "te" 
          ? `📉 ${name} లాభం చాలా తక్కువగా ఉంది. మార్కెట్ ధరలు పెరిగే వరకు స్టాక్ దాచుకోవడం మంచిది.` 
          : `📉 ${name} has thin margins. Consider holding stock if you expect price hikes.`);
      }
    });

    if (globalROI > 50) {
      insights.push(language === "te" ? "🔥 అద్భుతం! మీ ఫామ్ 50% పైగా లాభంతో నడుస్తోంది." : "🔥 Amazing! Your farm is yielding over 50% ROI.");
    } else if (globalROI < 0 && globalTotalExp > 0) {
      insights.push(language === "te" ? "🆘 మీ మొత్తం ఫామ్ నష్టాల్లో ఉంది. ఖర్చులను అదుపు చేయండి." : "🆘 Overall farm is in loss. Focus on cost reduction.");
    }

    if (cropEntries.length >= 3) {
      insights.push(language === "te" ? "✅ మీరు వివిధ రకాల పంటలు వేసి రిస్క్ తగ్గించుకున్నారు. ఇది మంచి పద్ధతి." : "✅ Good diversification! Growing multiple crops helps balance market risks.");
    }

    const uniqueInsights = [...new Set(insights)];
    setSuggestions(uniqueInsights.slice(0, 10)); 
  };

  useEffect(() => {
    let isMounted = true;

    // 🔥 CASE-INSENSITIVE KEY MATCHING HELPER
    const getExistingKey = (map: any, newKey: string) => {
      const lowerKey = newKey.trim().toLowerCase();
      const found = Object.keys(map).find(k => k.toLowerCase().trim() === lowerKey);
      return found || newKey.trim();
    };

    const loadData = async () => {
      const phone = await AsyncStorage.getItem("USER_PHONE");
      const lang = await AsyncStorage.getItem("APP_LANG");
      if (lang && isMounted) setLanguage(lang as any);
      if (!phone) return;
      if (isMounted) setUserPhone(phone);
      
      const userDoc = await executeOfflineSafeRead(firestore().collection("users").doc(phone), true);
      const activeSession = userDoc.data()?.activeSession;
      const uState = (userDoc.data()?.state || "ap").toLowerCase() === "telangana" ? "Telangana" : "AP";
      if (isMounted) {
        setUserState(uState);
        setProfileImage(userDoc.data()?.profileImage || null);
        setRole(userDoc.data()?.role || "");
      }
      if (!activeSession) { if (isMounted) setLoading(false); return; }

      // 🔐 LOCK SYSTEM: Session "2024-25" → unlocks May 1, 2025
      const endYearShort = parseInt(activeSession.split('-')[1]);
      const sessionEndYear = endYearShort + 2000;
      const unlock = new Date(sessionEndYear, 4, 1, 0, 0, 0); // May 1
      const nowDate = new Date();
      const isDateLocked = nowDate < unlock; // మే 1 కంటే ముందు ఉంటే

      const unlockKey = `USER_UNLOCKED_${activeSession}`;
      const hasUserUnlocked = await AsyncStorage.getItem(unlockKey);

      if (isMounted) {
        setUnlockDate(unlock);
        setSessionStr(activeSession);
      }

      if (isDateLocked) {
        // ఇంకా May 1 రాలేదు — lock state set చేసి data fetch continue
        if (isMounted) setIsLocked(true);
      } else if (hasUserUnlocked !== 'true') {
        // May 1 వచ్చింది, user ఇంకా "View Results" నొక్కలేదు
        if (isMounted) { setIsLocked(true); setShowUnlockAnim(true); }
      } else {
        // Fully unlocked → results fetch
        if (isMounted) {
          setIsLocked(false);
          const expiry = new Date(sessionEndYear, 5, 1);
          const daysLeft = Math.ceil((expiry.getTime() - nowDate.getTime()) / (1000 * 60 * 60 * 24));
          setSessionExpiryDays(Math.max(0, daysLeft));
        }
      }

      // ✅ ALWAYS fetch data — to check if empty (empty state > lock screen)
      if (isMounted) setLoading(true);

      try {
        // Fetch real-time total farmers count from Firebase!
        // But count() doesn't work offline! So we check NetInfo first
        const netState = await NetInfo.fetch();
        const isOffline = netState.isConnected === false || netState.isInternetReachable === false;
        
        if (!isOffline) {
          try {
            const [usersCountSnap, stateCountSnap] = await Promise.all([
              firestore().collection("users").count().get(),
              firestore().collection("users").where("state", "==", uState.toLowerCase()).count().get()
            ]);
            
            if (isMounted) {
               if (usersCountSnap.data().count > 0) setTotalFarmers(usersCountSnap.data().count);
               if (stateCountSnap.data().count > 0) setStateFarmers(stateCountSnap.data().count);
            }
          } catch (e) {
            console.log("Count query failed", e);
          }
        }

        const [expSnap, salesSnap, paySnap, fieldsSnap] = await Promise.all([
          executeOfflineSafeRead(firestore().collection("users").doc(phone).collection("expenses").where("session", "==", activeSession), true),
          executeOfflineSafeRead(firestore().collection("users").doc(phone).collection("sales").where("session", "==", activeSession), true),
          executeOfflineSafeRead(firestore().collection("users").doc(phone).collection("payments").where("session", "==", activeSession), true),
          executeOfflineSafeRead(firestore().collection("users").doc(phone).collection("fields").where("session", "==", activeSession), true)
        ]);
        
        if (!isMounted) return;

        const cropMap: any = {};
        let totalExp = 0, totalLab = 0, totalInc = 0, totalRent = 0;

        const unitToKg: any = { gms: 0.001, kg: 1, quintal: 100, ton: 1000 };
        
        // 🔥 PRO FIX: Handle Name Object (te/en) safely without breaking UI
        const rawName = userDoc.data()?.name;
        let finalName = "Farmer";
        if (typeof rawName === 'object' && rawName !== null) {
          finalName = rawName[language] || rawName.en || rawName.te || "Farmer";
        } else if (typeof rawName === 'string' && rawName.trim() !== "") {
          finalName = rawName;
        } else {
          finalName = language === "te" ? "రైతు" : "Farmer";
        }
        setUserName(finalName);
        
        expSnap.forEach((doc: any) => {
          const d = doc.data();
          const rawCrop = d.crop || "Others";
          const crop = getExistingKey(cropMap, rawCrop);
          const amt = typeof d.amount === "number" ? d.amount : Number(d.amount) || 0;
          totalExp += amt;
          if (!cropMap[crop]) cropMap[crop] = { expense: 0, labour: 0, income: 0, totalKg: 0, unitStats: {}, acres: 0, rent: 0, quantity: 0 };
          cropMap[crop].expense += amt;
        });

        paySnap.forEach((doc: any) => {
          const d = doc.data();
          const rawCrop = d.crop || "Others";
          const crop = getExistingKey(cropMap, rawCrop);
          const amt = Number(d.totalAmount) || 0;
          totalLab += amt;
          if (!cropMap[crop]) cropMap[crop] = { expense: 0, labour: 0, income: 0, totalKg: 0, unitStats: {}, acres: 0, rent: 0, quantity: 0 };
          cropMap[crop].labour += amt;
        });

        salesSnap.forEach((doc: any) => {
          const d = doc.data();
          const rawCrop = d.crop || "Others";
          const crop = getExistingKey(cropMap, rawCrop);
          const amt = Number(d.total) || 0;
          const qty = Number(d.quantity) || 0;
          const unitMap: any = { ton: "ton", tons: "ton", kg: "kg", quintal: "quintal", gms: "gms" };
          const unit = unitMap[(d.unit || "kg").toLowerCase()] || "kg";
          totalInc += amt;
          if (!cropMap[crop]) cropMap[crop] = { expense: 0, labour: 0, income: 0, totalKg: 0, unitStats: {}, acres: 0, rent: 0, quantity: 0 };
          cropMap[crop].income += amt;
          
          const weightInKg = qty * (unitToKg[unit] || 1);
          cropMap[crop].totalKg = (cropMap[crop].totalKg || 0) + weightInKg;
          cropMap[crop].unitStats[unit] = (cropMap[crop].unitStats[unit] || 0) + 1;
        });

        // 🔥 PERFECTLY SYNCHRONIZED COMPOSITE KEY MATCHING LOGIC
        fieldsSnap.forEach((doc: any) => {
          const d = doc.data();
          const baseCrop = d.crop || "Others";
          const nickname = d.nickname || "";
          
          const rawCropKey = nickname ? `${baseCrop} - ${nickname}` : baseCrop;
          const cropKey = getExistingKey(cropMap, rawCropKey);

          const rent = Number(d.rent) || 0;
          const acres = Number(d.acres) || 0;

          if (!cropMap[cropKey]) cropMap[cropKey] = { expense: 0, labour: 0, income: 0, totalKg: 0, unitStats: {}, acres: 0, rent: 0, quantity: 0 };
          cropMap[cropKey].acres += acres;
          if (d.type === "rent") {
            totalRent += rent;
            cropMap[cropKey].rent += rent;
          }
        });

        Object.keys(cropMap).forEach(key => {
          const c = cropMap[key];
          let bestUnit = "kg";
          let maxCount = 0;
          if (c.unitStats) {
            Object.entries(c.unitStats).forEach(([u, count]: any) => {
              if (count > maxCount) {
                maxCount = count;
                bestUnit = u;
              }
            });
          }
          const factor = unitToKg[bestUnit] || 1;
          c.quantity = factor ? parseFloat((c.totalKg / factor).toFixed(2)) : 0;
          c.unit = bestUnit; 
          c.profit = c.income - (c.expense + c.labour + c.rent);
        });

        // 🔥 Remove crops that have absolutely zero financial or yield activity
        const filteredCropMap: any = {};
        Object.keys(cropMap).forEach(key => {
          const c = cropMap[key];
          const totalActivity = c.expense + c.labour + c.rent + c.income + c.quantity;
          if (totalActivity > 0) {
            filteredCropMap[key] = c;
          }
        });

        setSummary({
          expense: totalExp, labour: totalLab, income: totalInc, rent: totalRent,
          profit: totalInc - (totalExp + totalLab + totalRent)
        });
        setCrops(filteredCropMap);
        setTimeout(() => { if (isMounted) generateSmartInsights(filteredCropMap, totalInc); }, 300);

        // 🏆 SAVE TIER COLOR — only on fresh unlock, never for old sessions or returning visits
        if (freshUnlockRef.current) {
          const totalCostCalc = totalExp + totalLab + totalRent;
          const profitCalc = totalInc - totalCostCalc;
          const roiCalc = totalCostCalc > 0 ? (profitCalc / totalCostCalc) * 100 : 0;
          let tColor = '#10B981';
          if (roiCalc > 40) tColor = '#F59E0B';
          else if (roiCalc > 15) tColor = '#3B82F6';
          else if (roiCalc > 0) tColor = '#F97316';
          else if (totalCostCalc > 0) tColor = '#8B5CF6';
          await AsyncStorage.setItem('TIER_COLOR', tColor);
          freshUnlockRef.current = false; // reset — won't overwrite again
        }

      } catch (e) { console.log(e); } finally { if (isMounted) setLoading(false); }
    };
    loadData();
    return () => { isMounted = false; };
  }, [language, reloadKey]);

  const isProfit = summary.profit >= 0;

  const getUnitLabel = (unit: string) => {
    if (language === "te") {
      switch (unit) {
        case "kg": return "కిలోలు";
        case "tons": return "టన్నులు";
        case "quintal": return "క్వింటాళ్లు";
        case "bags": return "బ్యాగులు";
        default: return unit;
      }
    }
    return unit;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      {(!isLocked || isEmpty) && (
        <AppHeader 
          title={language === "te" ? "సారాంశం" : "Summary"} 
          subtitle={language === "te" ? "వ్యవసాయ నివేదిక" : "Farm Report"} 
          language={language} 
        />
      )}

      {loading ? (
        <SummaryShimmer />
      ) : isEmpty ? (
        // ✅ NO DATA → empty state (highest priority, even if May 1 passed)
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <AppEmptyState
            iconName="analytics-outline"
            title={language === "te" ? "ఇంకా విశ్లేషణ లేదు" : "No Summary Yet"}
            subtitle={language === "te" ? "ఖర్చులు మరియు అమ్మకాలు నమోదు చేస్తే ఇక్కడ పూర్తి నివేదిక కనిపిస్తుంది" : "Add expenses and sales to view complete farm insights"}
            language={language}
          />
        </View>
      ) : isLocked ? (
        // 🔐 LOCK SCREEN - 3 CIRCLE DESIGN
        <View style={{ flex: 1, backgroundColor: '#060D17' }}>
          <LinearGradient colors={['#060D17', '#0A1F10', '#060D17']} style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 }}>

            {/* 🔥 NEW POSITION: RESPONSIVE FLOATING SESSION BADGE */}
            <View style={{ 
              position: 'absolute', 
              top: Platform.OS === 'ios' ? 65 : 45, // ఆపిల్ కి, ఆండ్రాయిడ్ కి కరెక్ట్ గా కెమెరా కింద సెట్ అవుతుంది
              backgroundColor: 'rgba(22,163,74,0.1)', 
              borderRadius: 20, 
              paddingHorizontal: 16, 
              paddingVertical: 8, 
              borderWidth: 1, 
              borderColor: 'rgba(22,163,74,0.3)', 
              flexDirection: 'row', 
              alignItems: 'center', 
              gap: 6 
            }}>
              <Ionicons name="calendar-outline" size={14} color="#4ADE80" />
              <AppText style={{ color: '#4ADE80', fontSize: 13, fontWeight: '600' }}>
                {sessionStr} {language === 'te' ? 'సీజన్' : 'Season'}
              </AppText>
            </View>

            {/* Circle 1 - largest, faintest (absolute bg) */}
            <View style={{ position: 'absolute', width: 340, height: 340, borderRadius: 170, backgroundColor: 'rgba(22,163,74,0.05)', alignSelf: 'center', top: '10%' }} />
            {/* Circle 2 - medium (absolute bg) */}
            <View style={{ position: 'absolute', width: 230, height: 230, borderRadius: 115, backgroundColor: 'rgba(22,163,74,0.08)', alignSelf: 'center', top: '14%' }} />

            {/* Circle 3 - Static Background Container */}
            <View style={{ 
              width: 140, 
              height: 140, 
              borderRadius: 70, 
              backgroundColor: 'rgba(22,163,74,0.16)', 
              justifyContent: 'center', 
              alignItems: 'center', 
              borderWidth: 1.5, 
              borderColor: 'rgba(22,163,74,0.4)', 
              shadowColor: '#16A34A', 
              shadowOpacity: 0.3, 
              shadowRadius: 20,
              marginBottom: 40 // 🔥 సీజన్ బ్యాడ్జ్ ఇక్కడి నుంచి తీసేసాం కాబట్టి గ్యాప్ ఇచ్చాను
            }}>
              {/* 🔥 Animated Icon (Only the Lock moves now) */}
              <Animated.View style={{
                transform: [
                  { scale: lockPulseAnim },
                  { rotate: lockRotateAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-14deg', '0deg', '14deg'] }) }
                ]
              }}>
                <Ionicons name="lock-closed" size={60} color="#4ADE80" />
              </Animated.View>
            </View>

            <AppText style={{ color: '#F1F5F9', fontSize: 24, fontWeight: '600', textAlign: 'center', marginBottom: 6 }}>
              {language === 'te' ? 'మీ ఫలితాలు' : 'Your Results'}
            </AppText>
            <AppText style={{ color: '#94A3B8', fontSize: 14, textAlign: 'center', marginBottom: 6 }}>
              {language === 'te' ? 'ఈ తేదీన విడుదల అవుతాయి' : 'will be released on'}
            </AppText>
            <AppText style={{ color: '#4ADE80', fontSize: 20, fontWeight: '600', marginBottom: 36 }}>
              {language === 'te' ? `మే 1, ${unlockDate?.getFullYear()}` : `May 1, ${unlockDate?.getFullYear()}`}
            </AppText>

            {/* Countdown */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 44 }}>
              {[
                { val: String(countdown.days).padStart(2, '0'), label: language === 'te' ? 'రోజులు' : 'Days' },
                { val: String(countdown.hours).padStart(2, '0'), label: language === 'te' ? 'గంటలు' : 'Hrs' },
                { val: String(countdown.minutes).padStart(2, '0'), label: language === 'te' ? 'నిమిషాలు' : 'Mins' },
                { val: String(countdown.seconds).padStart(2, '0'), label: language === 'te' ? 'సెకన్లు' : 'Secs' },
              ].map((item, i) => (
                <View key={i} style={{ alignItems: 'center' }}>
                  <View style={{ 
                    width: 72, 
                    height: 72, 
                    borderRadius: 14, 
                    backgroundColor: 'rgba(255,255,255,0.06)', 
                    borderWidth: 1, 
                    borderColor: 'rgba(22,163,74,0.25)', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    marginBottom: 6,
                    paddingHorizontal: 4 // 🔥 టెక్స్ట్ గోడలకి తగలకుండా
                  }}>
                    <AppText 
                      numberOfLines={1} 
                      adjustsFontSizeToFit={true} // 🔥 బాక్స్ సైజుకి తగ్గట్టు ఆటోమేటిక్ గా ఫాంట్ తగ్గుతుంది
                      style={{ 
                        color: '#FFFFFF', 
                        // 🔥 99 దాటితే సైజు 22, లేకపోతే 26
                        fontSize: item.val.length > 2 ? 22 : 26, 
                        fontWeight: '600' 
                      }}>
                      {item.val}
                    </AppText>
                  </View>
                  <AppText style={{ color: '#475569', fontSize: 10 }}>{item.label}</AppText>
                </View>
              ))}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.04)', padding: 12, borderRadius: 12 }}>
              <Ionicons name="information-circle-outline" size={16} color="#475569" />
              <AppText style={{ color: '#64748B', fontSize: 13 }}>
                {language === 'te' ? 'డేటా నమోదు చేయడం కొనసాగించండి' : 'Continue entering your farm data'}
              </AppText>
        </View>
        </LinearGradient>
        </View>
      ) : (
        <FlatList
          data={Object.keys(crops)}
          keyExtractor={(item: string, index: number) => item + index.toString()}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.stickyBox}>
              {[
                { label: language === "te" ? "ఇతర ఖర్చులు" : "Other Expenses", val: summary.expense, color: "#3B82F6", percent: expensePercent },
                { label: language === "te" ? "కూలీ ఖర్చులు" : "Labour Expenses", val: summary.labour, color: "#F59E0B", percent: labourPercent },
                { label: language === "te" ? "కౌలు ఖర్చులు" : "Field Rent", val: summary.rent, color: "#8B5CF6", percent: rentPercent },
                { label: language === "te" ? "మొత్తం ఆదాయం" : "Total Income", val: summary.income, color: "#16A34A", percent: incomePercent },
              ].filter(item => item.val > 0).map((item, idx) => (
                  <View key={idx} style={styles.barItem}>
                    <View style={styles.barTopRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={[styles.statusDot, { backgroundColor: item.color }]} />
                        <AppText style={styles.barLabel}>{item.label}</AppText>
                      </View>
                      <AppText style={[styles.barValue, { color: item.color }]}>₹{item.val.toLocaleString("en-IN")}</AppText>
                    </View>
                    <View style={styles.barBg} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}>
                      <View 
                        style={[
                          styles.barFill,
                          { backgroundColor: item.color, alignSelf: "flex-start", width: `${item.percent || 0}%` },
                        ]}
                      />
                    </View>
                  </View>
                ))}
            </View>
          }
         renderItem={({ item }: { item: string }) => {
            const c = crops[item];
            const profitPercent = c.income > 0 ? ( (c.profit || 0) / c.income ) * 100 : (c.profit < 0 ? -100 : 0); 
            const finalPercent = Math.min(Math.max(Math.abs(profitPercent), 0), 100);
            let color = profitPercent < 0 ? "#DC2626" : (profitPercent <= 20 ? "#F59E0B" : "#16A34A");

            // 🔥 STATUS LOGIC
            const isComplete = c.acres > 0 && c.expense > 0 && c.labour > 0 && c.quantity > 0 && c.income > 0;

            // 🌾 UNIFIED CROP NAME + ACRES PARSE (one place, consistent everywhere)
            const cropTitle = item;
            const effectiveAcres = c.acres || 0;

            return (
              <View style={styles.card}>
                
                {/* 🔥 ABSOLUTE STATUS PILL (PERFECT TOP-RIGHT ALIGNMENT) */}
                <View style={[styles.statusPill, { 
                  position: "absolute", 
                  top: 14, 
                  right: 14, 
                  backgroundColor: isComplete ? "#DCFCE7" : "#FEF2F2", 
                  borderColor: isComplete ? "#BBF7D0" : "#FECACA",
                  zIndex: 10
                }]}>
                  <Ionicons name={isComplete ? "checkmark-circle" : "alert-circle"} size={12} color={isComplete ? "#166534" : "#991B1B"} />
                  <AppText style={[styles.statusPillText, { color: isComplete ? "#166534" : "#991B1B" }]}>
                    {isComplete ? (language === "te" ? "పూర్తయింది" : "Complete") : (language === "te" ? "పెండింగ్" : "Pending")}
                  </AppText>
                </View>

                <View style={[styles.sideBar, { backgroundColor: color }]} />
                
                {/* ⬅️ LEFT SIDE: CROP INFO */}
                <View style={{ flex: 1, paddingRight: 10 }}>

                  {/* Crop Name */}
                  <AppText style={[styles.cropName, { marginBottom: 2 }]} numberOfLines={3}>
                    {cropTitle}
                  </AppText>

                  {/* Acres — always on second line, consistent */}
                  {effectiveAcres > 0 ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                      <Ionicons name="expand-outline" size={12} color="#64748B" />
                      <AppText style={{ fontSize: 13, color: '#64748B', fontWeight: '500', marginLeft: 4 }}>
                        {effectiveAcres} {language === 'te' ? 'ఎకరాలు' : 'Acres'}
                      </AppText>
                    </View>
                  ) : (
                    <View style={{ marginBottom: 6 }} />
                  )}

                  <AppText style={styles.row}>{language === "te" ? "పరిమాణం" : "Quantity"}: {c.quantity} {getUnitLabel(c.unit)}</AppText>

                  {/* Per Acre badges — reuse effectiveAcres */}
                  {effectiveAcres > 0 && (
                    <>
                      {c.quantity > 0 && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, marginBottom: 4, backgroundColor: '#F0FDF4', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#BBF7D0' }}>
                          <Ionicons name="leaf-outline" size={11} color="#16A34A" />
                          <AppText style={{ fontSize: 11, color: '#15803D', fontWeight: '600', marginLeft: 4 }}>
                            {language === "te"
                              ? `ఎకరానికి: ${(c.quantity / effectiveAcres).toFixed(2)} ${getUnitLabel(c.unit)}`
                              : `Per Acre: ${(c.quantity / effectiveAcres).toFixed(2)} ${getUnitLabel(c.unit)}`}
                          </AppText>
                        </View>
                      )}
                      {c.income > 0 && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#BFDBFE' }}>
                          <Ionicons name="cash-outline" size={11} color="#2563EB" />
                          <AppText style={{ fontSize: 11, color: '#1D4ED8', fontWeight: '600', marginLeft: 4 }}>
                            {language === "te"
                              ? `ఎకరానికి ఆదాయం: ₹${Math.round(c.income / effectiveAcres).toLocaleString('en-IN')}`
                              : `Income/Acre: ₹${Math.round(c.income / effectiveAcres).toLocaleString('en-IN')}`}
                          </AppText>
                        </View>
                      )}
                    </>
                  )}

                  <AppText style={styles.row}>{language === "te" ? "ఇతర ఖర్చులు" : "Other Expense"}: ₹{c.expense.toLocaleString("en-IN")}</AppText>
                  <AppText style={styles.row}>{language === "te" ? "కూలీ ఖర్చులు" : "Labour Expenses"}: ₹{c.labour.toLocaleString("en-IN")}</AppText>
                  {c.rent > 0 && <AppText style={styles.row}>{language === "te" ? "కౌలు ఖర్చులు" : "Field Rent"}: ₹{c.rent.toLocaleString("en-IN")}</AppText>}
                  <AppText style={styles.row}>{language === "te" ? "మొత్తం ఆదాయం" : "Total Income"}: ₹{c.income.toLocaleString("en-IN")}</AppText>
                  
                  {c.profit !== undefined && !isNaN(c.profit) && c.profit !== 0 && (
                    <AppText style={[styles.profitText, { color }]}>
                      {c.profit > 0 ? (language === "te" ? "వచ్చిన లాభం" : "Profit Gained") : (language === "te" ? "పోయిన నష్టం" : "Loss Incurred")}: ₹{Math.abs(c.profit).toLocaleString("en-IN")}
                    </AppText>
                  )}
                </View>

                {/* ➡️ RIGHT SIDE: PROGRESS CIRCLE */}
                <View style={{ justifyContent: "center", alignItems: "center", width: 80, marginTop: 20 }}>
                  <CropProgressCircle percent={finalPercent} displayText={Math.abs(finalPercent).toFixed(0)} color={color} />
                </View>

              </View>
            );
          }}
          ListFooterComponent={
            <>
              {/* ⏳ SESSION EXPIRY BANNER — info only, no action */}
              {sessionExpiryDays > 0 && sessionExpiryDays <= 60 && (
                <View style={{ marginHorizontal: 20, marginBottom: 16, marginTop: 4, backgroundColor: '#FFF7ED', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#FED7AA' }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFEDD5', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                    <Ionicons name="time-outline" size={22} color="#F97316" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText style={{ color: '#EA580C', fontSize: 13, fontWeight: '600' }}>
                      {language === 'te'
                        ? `సీజన్ మారడానికి ${sessionExpiryDays} రోజులు మాత్రమే!`
                        : `Only ${sessionExpiryDays} days left in this season!`}
                    </AppText>
                    <AppText style={{ color: '#9A3412', fontSize: 11, marginTop: 2 }}>
                      {language === 'te' ? 'కింద PDF డౌన్‌లోడ్ చేసి డేటా భద్రపరచుకోండి' : 'Download the PDF below to save your data'}
                    </AppText>
                  </View>
                </View>
              )}

              <LinearGradient colors={isProfit ? ["#14532d", "#052e16"] : ["#7f1d1d", "#450a0a"]} style={styles.topCard}>
                <View style={styles.rowBetween}>
                  <View style={styles.glassBox}>
                    <Ionicons name="cash-outline" size={18} color="#86EFAC" />
                    <AppText style={styles.glassLabel}>{language === "te" ? "మొత్తం ఆదాయం" : "Total Income"}</AppText>
                    <AppText style={styles.glassValue}>₹ {summary.income.toLocaleString("en-IN")}</AppText>
                  </View>
                  <View style={styles.glassBox}>
                    <Ionicons name="wallet-outline" size={18} color="#FCA5A5" />
                    <AppText style={styles.glassLabel}>{language === "te" ? "మొత్తం ఖర్చులు" : "Total Expenses"}</AppText>
                    <AppText style={styles.glassValue}>₹ {totalExpenses.toLocaleString("en-IN")}</AppText>
                  </View>
                </View>
                <View style={styles.divider} />
                <View style={styles.resultBox}>
                  <Ionicons name={isProfit ? "trending-up" : "trending-down"} size={22} color="#fff" />
                  <AppText style={styles.resultTitle}>{isProfit ? (language === "te" ? "లాభం" : "PROFIT") : (language === "te" ? "నష్టం" : "LOSS")}</AppText>
                </View>
                <AppText style={styles.resultAmount}>{isProfit ? `+ ₹${summary.profit.toLocaleString("en-IN")}` : `- ₹${Math.abs(summary.profit).toLocaleString("en-IN")}`}</AppText>
              </LinearGradient>

              {/* SECTION LABEL - FARM REPORT */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 8, marginTop: 4 }}>
                <View style={{ width: 4, height: 18, backgroundColor: '#DC2626', borderRadius: 2, marginRight: 8 }} />
                <AppText style={{ fontSize: 15, fontWeight: '600', color: '#DC2626' }}>
                  {language === 'te' ? 'వ్యవసాయ నివేదిక' : 'Farm Report'}
                </AppText>
              </View>

              {/* PDF DOWNLOAD BUTTON */}
              <TouchableOpacity 
                activeOpacity={0.8} 
                onPress={handleDownloadPDF} 
                style={{ 
                  marginHorizontal: 20, 
                  marginBottom: 20,
                  backgroundColor: '#FEF2F2', 
                  padding: 14, 
                  borderRadius: 12, 
                  borderWidth: 1, 
                  borderColor: '#FECACA', 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  justifyContent: 'center'
                }}
              >
                <Ionicons name="document-text" size={24} color="#DC2626" />
                <AppText style={{ color: "#DC2626", fontWeight: "600", fontSize: 16, marginLeft: 10 }}>
                  {language === "te" ? "PDF డౌన్‌లోడ్ చేసుకోండి" : "Download PDF Report"}
                </AppText>
              </TouchableOpacity>

              {/* SECTION LABEL - KISAN KHATA RANK CARD */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 4 }}>
                <View style={{ width: 4, height: 18, backgroundColor: '#16A34A', borderRadius: 2, marginRight: 8 }} />
                <AppText style={{ fontSize: 15, fontWeight: '600', color: '#16A34A' }}>
                  {language === 'te' ? 'కిసాన్ ఖాతా ర్యాంక్ కార్డ్' : 'Kisan Khata Rank Card'}
                </AppText>
              </View>

              {/* 🏆 PRO REPORT CARD */}
              <KisanKhataReportCard 
                userName={userName} 
                phone={userPhone} 
                language={language} 
                totalFarmers={totalFarmers} 
                stateFarmers={stateFarmers}
                userState={userState}
                profit={summary.profit} 
                totalCost={totalExpenses} 
                cropCount={Object.keys(crops).length} 
                profileImage={profileImage}
                role={role}
              />

              {/* AI CARD */}
              <TouchableOpacity activeOpacity={0.85} onPress={handleAIClick} style={styles.aiSmartCard}>
                <LinearGradient colors={["#065F46", "#10B981", "#6EE7B7"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.aiSmartInner}>
                  <View style={styles.aiSmartIcon}>
                    <MaterialCommunityIcons name="leaf" size={26} color="#fff" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <AppText style={styles.aiSmartTitle}>{language === "te" ? `${typedName} గారు,` : `${typedName},`}</AppText>
                    <AppText style={styles.aiSmartSub}>
                      {aiState === "idle" && (language === "te" ? "మీ పంటపై స్మార్ట్ విశ్లేషణ చూడండి" : "Tap to view smart farm analysis")}
                      {aiState === "loading" && (language === "te" ? "విశ్లేషణ జరుగుతోంది..." : "Analyzing your farm...")}
                      {aiState === "result" && (language === "te" ? "మీ రిపోర్ట్ సిద్ధంగా ఉంది" : "Your report is ready")}
                    </AppText>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>

              {/* RESULT */}
              {aiState === "result" && (
                <View style={styles.aiContainer}>
                  <View style={styles.aiHeader}>
                    <Ionicons name="bulb" size={20} color="#F59E0B" />
                    <AppText style={styles.aiTitle}>{language === "te" ? "KISAN KHATA స్మార్ట్ సూచనలు" : "SMART INSIGHTS"}</AppText>
                  </View>
                  {suggestions.map((s, i) => (
                    <AnimatedAIItem key={i} text={s} index={i} />
                  ))}
                </View>
              )}
            </>
          }
        />
      )}

      {/* 🎉 UNLOCK ANIMATION OVERLAY */}
      {showUnlockAnim && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, justifyContent: 'center', alignItems: 'center' }}>
          <LinearGradient colors={['#060D17', '#0D2B1A']} style={StyleSheet.absoluteFillObject} />
          <Animated.View style={{ opacity: unlockOpacity, transform: [{ scale: unlockScale }], alignItems: 'center', paddingHorizontal: 32 }}>
            
            {/* 🔥 REALISTIC UNLOCK ANIMATION */}
            <View style={{ width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(22,163,74,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 28, borderWidth: 2.5, borderColor: '#16A34A' }}>
              <Animated.View style={{ 
                transform: [
                  { scale: unlockIconPulse },
                  { rotate: lockTurnAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-15deg', '0deg', '15deg'] }) }
                ] 
              }}>
                <Ionicons name={unlockStateIcon} size={64} color="#4ADE80" />
              </Animated.View>
            </View>

            <AppText style={{ color: '#F1F5F9', fontSize: 28, fontWeight: '600', textAlign: 'center', marginBottom: 10 }}>
              {language === 'te' ? '🎉 ఫలితాలు సిద్ధంగా ఉన్నాయి!' : '🎉 Results are Ready!'}
            </AppText>
            <AppText style={{ color: '#94A3B8', fontSize: 15, textAlign: 'center', marginBottom: 12 }}>
              {language === 'te' ? 'మీ వార్షిక వ్యవసాయ నివేదిక సిద్ధంగా ఉంది' : 'Your annual farm report is ready to view'}
            </AppText>
           <AppText style={{ color: '#64748B', fontSize: 13, textAlign: 'center', marginBottom: 44 }}>
              {language === 'te' 
                ? `${sessionStr} సీజన్ - మే 1, ${unlockDate?.getFullYear()}` 
                : `Season ${sessionStr} • May 1, ${unlockDate?.getFullYear()}`}
            </AppText>

            {/* 🔥 NEW VIEW RESULTS BUTTON WITH ARROW ICON */}
            <TouchableOpacity
              onPress={handleUnlockResults} 
              activeOpacity={0.85}
              style={{ 
                backgroundColor: '#16A34A', 
                paddingHorizontal: 36, 
                paddingVertical: 16, 
                borderRadius: 18, 
                shadowColor: '#16A34A', 
                shadowOpacity: 0.4, 
                shadowRadius: 16, 
                elevation: 8,
                flexDirection: 'row', 
                alignItems: 'center',
                gap: 8 
              }}
            >
              <AppText style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '600' }}>
                {language === 'te' ? 'ఫలితాలు చూడండి' : 'View My Results'}
              </AppText>
              <Ionicons name="arrow-forward-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>

          </Animated.View>
        </View>
      )}

      {/* 🔥 EMPTY PDF MODAL */}
      <Modal visible={showEmptyModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.emptyModalContent}>
            <View style={styles.emptyModalIconBox}>
              <Ionicons name="document-text-outline" size={36} color="#DC2626" />
            </View>
            <AppText style={styles.emptyModalTitle}>
              {language === "te" ? "నివేదిక ఖాళీగా ఉంది" : "Report is Empty"}
            </AppText>
            <AppText style={styles.emptyModalSub}>
              {language === "te" 
                ? "PDF జనరేట్ చేయడానికి మీ వ్యవసాయ డేటా ఏమీ లేదు. దయచేసి ముందుగా కొన్ని ఖర్చులు లేదా ఆదాయ వివరాలను నమోదు చేయండి." 
                : "There is no farm data to generate a PDF. Please enter some expenses or income details first."}
            </AppText>
            <TouchableOpacity activeOpacity={0.7} style={styles.emptyModalBtn} onPress={() => setShowEmptyModal(false)}>
              <AppText style={styles.emptyModalBtnText}>
                {language === "te" ? "అర్థమైంది" : "Understood"}
              </AppText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
  emptyModalContent: { backgroundColor: "#fff", width: "100%", borderRadius: 24, padding: 24, alignItems: "center", elevation: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10 },
  emptyModalIconBox: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#FEF2F2", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  emptyModalTitle: { fontSize: 20, fontWeight: "600", color: "#0F172A", marginBottom: 10 },
  emptyModalSub: { fontSize: 14, color: "#64748B", textAlign: "center", lineHeight: 22, marginBottom: 24 },
  emptyModalBtn: { backgroundColor: "#16A34A", width: "100%", paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  emptyModalBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  stickyBox: { backgroundColor: "#ffffff", padding: 20, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10 },
  barItem: { marginBottom: 16 },
  barTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: 'center', marginBottom: 8 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  barLabel: { fontSize: 13, color: "#64748B", fontWeight: "600", letterSpacing: 0.3 },
  barValue: { fontSize: 14, fontWeight: "600" },
  barBg: { height: 10, backgroundColor: "#F1F5F9", borderRadius: 12, overflow: "hidden", flexDirection: "row" },
  barFill: { height: "100%", width: "100%", borderRadius: 12,  },
  card: { marginHorizontal: 20, marginVertical: 8, flexDirection: "row", backgroundColor: "#fff", padding: 16, borderRadius: 16, borderWidth: 1, borderColor: "#E5E7EB", alignItems: 'center' },
  sideBar: { width: 4, height: '80%', marginRight: 12, borderRadius: 2 },
  cropName: { fontSize: 20, fontWeight: "600", color: "#0F172A", flexShrink: 1 },
  
  // 🔥 NEW STATUS PILL STYLES
  statusPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  statusPillText: { fontSize: 12, fontWeight: "600", textTransform: "uppercase" },

  row: { fontSize: 13, color: "#475569", marginTop: 2, fontWeight: "500" },
  profitText: { fontSize: 14, fontWeight: "600", marginTop: 8 },
  circleWrap: { justifyContent: "center", alignItems: "center", marginLeft: 10 },
  circleCenter: { position: "absolute", width: 80, height: 80, justifyContent: "center", alignItems: "center" },
  circleText: { fontSize: 13, fontWeight: "700" },
  topCard: { margin: 20, padding: 24, borderRadius: 24, elevation: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  glassBox: { flex: 1, alignItems: "center", paddingVertical: 14, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  glassLabel: { color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 6, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.5 },
  glassValue: { color: "#fff", fontSize: 18, fontWeight: "700", marginTop: 4 },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.15)", marginVertical: 16 },
  resultBox: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 },
  resultTitle: { color: "#fff", fontSize: 14, fontWeight: "600", letterSpacing: 1.5, opacity: 0.9 },
  resultAmount: { color: "#fff", fontSize: 36, fontWeight: "800", textAlign: "center", marginTop: 2 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  qtyBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  qtyText: { fontSize: 11, fontWeight: "600" },
  aiContainer: { margin: 20, backgroundColor: "#0F172A", padding: 20, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", elevation: 10 },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: "rgba(245, 158, 11, 0.2)", paddingBottom: 10 },
  aiTitle: { fontSize: 15, fontWeight: "600", color: "#F59E0B", letterSpacing: 1, textTransform: "uppercase" },
  aiCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: "rgba(255,255,255,0.06)", padding: 14, borderRadius: 12, marginBottom: 10, gap: 12 },
  aiBullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#F59E0B", marginTop: 7 },
  aiText: { flex: 1, fontSize: 14, color: "#F1F5F9", lineHeight: 24, fontWeight: "500" },
  aiSmartCard: { marginHorizontal: 20, marginTop: 10, marginBottom: 10 },
  aiSmartInner: { flexDirection: "row", alignItems: "center", padding: 18, borderRadius: 20, elevation: 6 },
  aiSmartIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(255,255,255,0.2)", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  aiSmartTitle: { color: "#fff", fontSize: 15, fontWeight: "600" },
  aiSmartSub: { color: "rgba(255,255,255,0.9)", fontSize: 13, marginTop: 2, fontWeight: "500" }
});