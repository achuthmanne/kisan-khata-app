// app/farmer/(tabs)/_layout.tsx

import { getDrawer, setDrawer } from "@/assets/stores/drawerStore";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import { Tabs, useRouter, useSegments } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  Linking,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { Image } from "expo-image";

import { useLanguage } from "@/context/LanguageContext";
import AppText from "../../../components/AppText";
import CustomTabBar from "../../../components/CustomTabBar";

import AnimatedReanimated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

/* 🔥 INSTAGRAM-STYLE PREMIUM TOGGLE WITH LOCAL STATE FOR ZERO-STUTTER 60FPS */
const InstagramToggle = React.memo(({ isEnabled, onToggle }: { isEnabled: boolean, onToggle: () => void }) => {
  const [localState, setLocalState] = useState(isEnabled);
  const progress = useSharedValue(isEnabled ? 1 : 0);

  // Sync with external state if it changes outside
  useEffect(() => {
    setLocalState(isEnabled);
    progress.value = withTiming(isEnabled ? 1 : 0, {
      duration: 250,
    });
  }, [isEnabled]);

  const handlePress = () => {
    const nextState = !localState;
    setLocalState(nextState);
    
    // Start the animation immediately on the UI thread
    progress.value = withTiming(nextState ? 1 : 0, {
      duration: 250,
    });
    
    // Delay the heavy context update so it doesn't block the animation start
    setTimeout(() => {
      onToggle();
    }, 150);
  };

  const trackAnimatedStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: interpolateColor(
        progress.value,
        [0, 1],
        ["#E5E7EB", "#16A34A"]
      ),
    };
  });

  const thumbAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: progress.value * 20 }],
    };
  });

  return (
    <TouchableOpacity activeOpacity={1} onPress={handlePress}>
      <AnimatedReanimated.View
        style={[{
          width: 52,
          height: 32,
          borderRadius: 16,
          justifyContent: "center",
          paddingHorizontal: 4,
        }, trackAnimatedStyle]}
      >
        <AnimatedReanimated.View
          style={[{
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: "#FFFFFF",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 2,
            elevation: 3,
          }, thumbAnimatedStyle]}
        />
      </AnimatedReanimated.View>
    </TouchableOpacity>
  );
});

export default function FarmerLayout() {
  const router = useRouter();
  const segments = useSegments();

  const [drawerOpen, setDrawerOpenState] = useState(false);
  const { language, changeLanguage } = useLanguage();
  const [isProfileComplete, setIsProfileComplete] = useState(true);
  const [name, setName] = useState("...");
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [role, setRole] = useState("");
  const [tierColor, setTierColor] = useState('#E5E7EB');
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const drawerAnim = useRef(new Animated.Value(-320)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  /* ---------------- DRAWER ANIMATION ---------------- */
  useEffect(() => {
    if (drawerOpen) {
      Animated.parallel([
        Animated.spring(drawerAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 24,
          stiffness: 160,
          mass: 0.8
        }),
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true
        })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(drawerAnim, {
          toValue: -320,
          duration: 250,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1), 
          useNativeDriver: true
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true
        })
      ]).start();
    }
  }, [drawerOpen]);

  /* ---------------- USER DATA ---------------- */
  useEffect(() => {
    const checkUserStatus = async () => {
      const phone = await AsyncStorage.getItem("USER_PHONE");

      if (phone) {
        const doc = await firestore().collection("users").doc(phone).get();
        const data = doc.data();
        setName(data?.name || "");
        setProfileImage(data?.profileImage || null);
        setRole(data?.role || "");

        const hasName = !!data?.name && data.name.trim().length >= 3;
        setIsProfileComplete(hasName);

        if (!hasName && segments[segments.length - 1] !== "profile") {
          router.replace("/farmer/(tabs)/profile");
        }

        const activeSession = data?.activeSession;
        if (activeSession) {
          const hasUserUnlocked = await AsyncStorage.getItem(`USER_UNLOCKED_${activeSession}`);
          if (hasUserUnlocked === 'true') {
            const color = await AsyncStorage.getItem('TIER_COLOR');
            if (color) setTierColor(color);
            else setTierColor('#10B981'); // Fallback New Farmer Color
          } else {
            setTierColor('#E5E7EB'); 
          }
        }
      }
    };
    checkUserStatus();
  }, [segments]);

  const getDefaultImage = () => {
    const isFarmer = role?.toLowerCase() === "farmer" || role === "రైతు";
    const isMestri = role?.toLowerCase() === "mestri" || role === "మేస్త్రీ";
    if (isFarmer) return require("../../../assets/images/farmer.png");
    if (isMestri) return require("../../../assets/images/kuli.png");
    return require("../../../assets/images/default.jpg");
  };

  const getTierDisplay = () => {
    if (tierColor === '#F59E0B') return language === 'te' ? '🏆 ఆదర్శ రైతు' : '🏆 Model Farmer';
    if (tierColor === '#3B82F6') return language === 'te' ? '🥈 ప్రగతిశీల రైతు' : '🥈 Progressive Farmer';
    if (tierColor === '#F97316') return language === 'te' ? '🥉 కష్టజీవి' : '🥉 Hardworking Farmer';
    if (tierColor === '#8B5CF6') return language === 'te' ? '🛡️ పోరాట యోధుడు' : '🛡️ Warrior Farmer';
    
    // Default (Locked or New Farmer)
    return language === 'te' ? '🌱 నవ రైతు' : '🌱 New Farmer';
  };

  useEffect(() => {
    const check = () => {
      const state = getDrawer();
      if (state !== drawerOpen) setDrawerOpenState(state);
    };
    const interval = setInterval(check, 100); 
    return () => clearInterval(interval);
  }, [drawerOpen]);

  /* ---------------- FUNCTIONS ---------------- */
  const toggleLanguage = async () => {
    const newLang = language === "te" ? "en" : "te";
    await changeLanguage(newLang);
  };

  const closeDrawer = () => {
    setDrawer(false);
    setDrawerOpenState(false); 
  };

  const navigateFromDrawer = (route: string) => {
    closeDrawer(); 
    
    setTimeout(async () => {
      if (route === "rate") {
        const packageName = "com.achuth.agrisnap"; 
        const playStoreUrl = `market://details?id=${packageName}`;
        const webUrl = `https://play.google.com/store/apps/details?id=${packageName}`;

        try {
          const supported = await Linking.canOpenURL(playStoreUrl);
          if (supported) await Linking.openURL(playStoreUrl); 
          else await Linking.openURL(webUrl); 
        } catch (error) {
          Alert.alert(
            language === "te" ? "లోపం" : "Error", 
            language === "te" ? "ప్లే స్టోర్ ఓపెన్ కాలేదు." : "Could not open Play Store."
          );
        }
      } else {
        router.push(route as any); 
      }
    }, 320); 
  };

  const confirmLogout = async () => {
    setShowLogoutModal(false);
    const lang = await AsyncStorage.getItem("APP_LANG");
    await AsyncStorage.clear();
    if (lang) await AsyncStorage.setItem("APP_LANG", lang);
    router.replace("/login");
  };

  return (
    <>
      <Tabs
        screenOptions={{ headerShown:false }}
        tabBar={(props:any)=>
          isProfileComplete
            ? <CustomTabBar {...props} language={language}/>
            : null
        }
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="attendance-history" />
        <Tabs.Screen name="history" />
        <Tabs.Screen name="profile" />
      </Tabs>

      {/* 🔥 DRAWER OVERLAY */}
      <Animated.View
        pointerEvents={drawerOpen ? "auto" : "none"}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          backgroundColor: "rgba(0,0,0,0.3)",
          opacity: overlayOpacity,
          zIndex: 999
        }}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={closeDrawer}
          style={{ position: "absolute", width: "100%", height: "100%", zIndex: 999 }}
        >
          {/* 🔥 MAIN DRAWER CONTENT */}
          <Animated.View
            style={{
              width: 300,
              height:"100%",
              backgroundColor: "#fff",
              transform: [{ translateX: drawerAnim }],
              elevation: 5,
              shadowColor: "#000",
              shadowOpacity: 0.15,
              shadowRadius: 10
            }}
            onStartShouldSetResponder={() => true}
            onTouchEnd={(e) => e.stopPropagation()}
          >
      
            {/* ARC CUT (SVG) */}
            <Svg width={"100%"} height={80} style={{ position: "absolute", bottom: -1 }}>
              <Path d={`M0 0 H300 V40 Q150 100 0 40 Z`} fill="#fff" />
            </Svg>
      
            <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }}>
      
              {/* TOP FIXED SECTION */}
              <View>
                {/* PROFILE WIDGET */}
                <LinearGradient
                  colors={["#16A34A", "#166534"]}
                  style={{
                    width: "100%",
                    paddingVertical: 50,
                    alignItems: "center",
                    marginBottom: 20, 
                    borderBottomWidth: 1, 
                    borderBottomColor: "#F1F5F9",
                    elevation: 3,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 5,
                  }}
                >
                  <View style={{ paddingHorizontal: 20, alignItems: "center" }}>
                    <View
                      style={{
                        width: 70,
                        height: 70,
                        borderRadius: 35,
                        borderWidth: 3,
                        borderColor: tierColor === '#E5E7EB' ? '#FFFFFF' : tierColor,
                        backgroundColor: "rgba(255,255,255,0.2)",
                        overflow: "hidden",
                        justifyContent: "center",
                        alignItems: "center"
                      }}
                    >
                      <Image 
                        source={profileImage ? { uri: profileImage } : getDefaultImage()} 
                        style={{ width: "100%", height: "100%" }} 
                        contentFit="cover"
                      />
                    </View>
                
                    <AppText style={{ fontSize: 18, marginTop: 10, color: "#fff", fontWeight: "600" }}>
                      {name || "Farmer"}
                    </AppText>
                
                    <View
                      style={{
                        marginTop: 8,
                        paddingHorizontal: 14,
                        paddingVertical: 5,
                        borderRadius: 16,
                        backgroundColor: "#FFFFFF",
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.15,
                        shadowRadius: 4,
                        elevation: 3
                      }}
                    >
                      <AppText style={{ fontSize: 12, color: tierColor !== '#E5E7EB' ? tierColor : '#16A34A', fontWeight: "600" }}>
                        {getTierDisplay()}
                      </AppText>
                    </View>
                  </View>
                </LinearGradient>

                {/* PREMIUM LANGUAGE TOGGLE WRAPPER */}
                <View style={{ paddingHorizontal: 20 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: 14
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <Ionicons name={language === "te" ? "earth-outline" : "language-outline"} size={20} color="#16A34A" />
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <AppText style={{ fontWeight: "600", fontSize: 20 }}>
                          {language === "te" ? "తెలుగు" : "English"}
                        </AppText>
                        <AppText style={{ fontSize: 12, color: "#9CA3AF" }}>
                          → {language === "te" ? "English" : "తెలుగు"}
                        </AppText>
                      </View>
                    </View>
              
                    {/* 🔥 INSTAGRAM REELS AUTO-SCROLL STYLE TOGGLE */}
                    <InstagramToggle isEnabled={language === "te"} onToggle={toggleLanguage} />
                  </View>
                </View>
              </View>
      
              {/* ✅ RESPONSIVE SCROLLVIEW (Takes remaining space) */}
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20, gap: 10 }}
                showsVerticalScrollIndicator={false}
                bounces={true} 
              >
            
                {/* My Profile */}
                <TouchableOpacity style={styles.drawerItem} onPress={() => { closeDrawer(); setTimeout(() => router.navigate("/farmer/(tabs)/profile"), 300); }}>
                  <Ionicons name="person-outline" size={20} color="#16A34A" />
                  <AppText style={styles.drawerText}>
                    {language === "te" ? "నా ప్రొఫైల్" : "My Profile"}
                  </AppText>
                </TouchableOpacity>
            
                {/* About Us */}
                <TouchableOpacity style={styles.drawerItem} onPress={() => navigateFromDrawer("/farmer/about")}>
                  <Ionicons name="information-circle-outline" size={20} color="#16A34A" />
                  <AppText style={styles.drawerText}>
                    {language === "te" ? "మా గురించి" : "About Us"}
                  </AppText>
                </TouchableOpacity>
            
                {/* Help */}
                <TouchableOpacity style={styles.drawerItem} onPress={() => navigateFromDrawer("/farmer/help")}>
                  <Ionicons name="help-circle-outline" size={20} color="#16A34A" />
                  <AppText style={styles.drawerText}>
                    {language === "te" ? "సహాయం" : "Help"}
                  </AppText>
                </TouchableOpacity>
            
                {/* Privacy Policy */}
                <TouchableOpacity style={styles.drawerItem} onPress={() => navigateFromDrawer("/farmer/privacy")}>
                  <Ionicons name="shield-checkmark-outline" size={20} color="#16A34A" />
                  <AppText style={styles.drawerText}>
                    {language === "te" ? "గోప్యత విధానం" : "Privacy Policy"}
                  </AppText>
                </TouchableOpacity>
            
                {/* Rate Us */}
                <TouchableOpacity style={[styles.drawerItem, { borderBottomWidth: 0 }]} onPress={() => navigateFromDrawer("rate")}>
                  <Ionicons name="star-outline" size={20} color="#16A34A" />
                  <AppText style={styles.drawerText}>
                    {language === "te" ? "మాకు రేటింగ్ ఇవ్వండి" : "Rate Us"}
                  </AppText>
                </TouchableOpacity>
              </ScrollView>

              {/* 🔥 PINNED LOGOUT BUTTON (Always at the bottom) */}
              <View style={styles.bottomPinnedContainer}>
                <TouchableOpacity
                  onPress={() => setShowLogoutModal(true)}
                  activeOpacity={0.85}
                  style={styles.logoutBtn}
                >
                  <Ionicons name="log-out-outline" size={20} color="#DC2626" />
                  <AppText style={{ color: "#DC2626", fontWeight: "600" }}>
                    {language === "te" ? "లాగౌట్" : "Logout"}
                  </AppText>
                </TouchableOpacity>
              </View>

            </SafeAreaView>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>

      {/* 🔥 LOGOUT MODAL */}
      <Modal visible={showLogoutModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.iconBg}>
              <Ionicons name="log-out" size={36} color="#e44830" />
            </View>
            <AppText style={styles.modalTitle} language={language}>
              {language === "te" ? "లాగౌట్" : "Logout"}
            </AppText>
            <AppText style={styles.modalSub} language={language}>
              {language === "te"
                ? "మీరు కిసాన్ ఖాతా యాప్ నుండి బయటకు రావాలనుకుంటున్నారా?"
                : "Are you sure you want to sign out?"}
            </AppText>
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setShowLogoutModal(false)} style={styles.cancelBtn}>
                <AppText style={styles.cancelText} language={language}>
                  {language === "te" ? "వద్దు" : "No"}
                </AppText>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmLogout} style={styles.confirmBtn}>
                <AppText style={styles.confirmText} language={language}>
                  {language === "te" ? "అవును" : "Yes"}
                </AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  drawerItem:{
    flexDirection:"row",
    alignItems:"center",
    paddingVertical:14,
    borderBottomWidth:0.5,
    borderColor:"#E5E7EB",
    gap:12
  },
  drawerText:{
    fontSize:15,
    fontWeight:"600",
    color:"#1F2937"
  },
  
  // 🔥 NEW PINNED CONTAINER STYLES
  bottomPinnedContainer: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: Platform.OS === 'ios' ? 30 : 25, // iOS లో కింద నావిగేషన్ బార్ కవర్ అవ్వకుండా
    borderTopWidth: 1,
    borderColor: "#F1F5F9",
    backgroundColor: "#fff",
  },
  logoutBtn: {
    // marginTop తీసేశాను ఇక్కడినుండి
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10
  },

  modalOverlay:{
    flex:1,
    backgroundColor:"rgba(0,0,0,0.7)",
    justifyContent:"center",
    alignItems:"center"
  },
  modalContent:{
    width:"80%",
    backgroundColor:"white",
    borderRadius:25,
    padding:25,
    alignItems:"center"
  },
  modalTitle:{
    fontSize:20,
    fontWeight:"500",
    color:"#e2431f",
    marginVertical:10
  },
  modalSub:{
    textAlign:"center",
    color:"#64748B",
    marginBottom:25
  },
  modalButtons:{
    flexDirection:"row",
    gap:10
  },
  cancelBtn:{
    flex:1,
    padding:12,
    borderRadius:12,
    backgroundColor:"#F1F5F9",
    alignItems:"center"
  },
  confirmBtn:{
    flex:1,
    padding:12,
    borderRadius:12,
    backgroundColor:"#EF4444",
    alignItems:"center"
  },
  cancelText:{
    color:"#64748B",
    fontWeight:"500"
  },
  confirmText:{
    color:"white",
    fontWeight:"500"
  },
  iconBg:{
    width:60,
    height:60,
    borderRadius:30,
    backgroundColor:"#f5e8e8",
    justifyContent:"center",
    alignItems:"center",
    marginBottom:10
  }
});