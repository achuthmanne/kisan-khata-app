// app/farmer/(tabs)/_layout.tsx

import { getDrawer, setDrawer } from "@/assets/stores/drawerStore";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import { Tabs, useRouter, useSegments } from "expo-router";
import { Alert, Platform, Easing } from "react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  Linking
} from "react-native";
import Svg, { Path } from "react-native-svg";

import { useLanguage } from "@/context/LanguageContext";
import AppText from "../../../components/AppText";
import CustomTabBar from "../../../components/CustomTabBar";

export default function FarmerLayout() {
  const router = useRouter();
  const segments = useSegments();

  const [drawerOpen, setDrawerOpenState] = useState(false);
  const { language, changeLanguage } = useLanguage();
  const [isProfileComplete, setIsProfileComplete] = useState(true);
  const [name, setName] = useState("...");
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // 🔥 గ్లిచ్ రాకుండా డ్రాయర్ విడ్త్ ని పూర్తిగా కవర్ చేయడానికి -320 పెట్టాను
  const drawerAnim = useRef(new Animated.Value(-320)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  
  // 🔥 టోగుల్ స్విచ్ స్మూత్ గా మూవ్ అవ్వడానికి పక్కా నేటివ్ డ్రైవర్ సపోర్ట్ చేసే నోడ్
  const toggleTranslateX = useRef(new Animated.Value(language === "te" ? 24 : 2)).current;

  /* ---------------- LANGUAGE TOGGLE ANIMATION (100% SMOOTH) ---------------- */
  useEffect(() => {
    Animated.spring(toggleTranslateX, {
      toValue: language === "te" ? 24 : 2,
      useNativeDriver: true, // 🔥 నేటివ్ డ్రైవర్ TRUE! దీనివల్ల ఇన్స్టా లాగా స్మూత్ గా వెళ్తుంది
      damping: 15,
      stiffness: 150,
      mass: 0.6
    }).start();
  }, [language]);

  /* ---------------- DRAWER ANIMATION (STRICT REAL-WORLD CURVE) ---------------- */
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
          easing: Easing.bezier(0.25, 0.1, 0.25, 1), // 🔥 ప్రొడクション బెజియర్ కర్వ్
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
        const hasName = !!data?.name && data.name.trim().length >= 3;
        setIsProfileComplete(hasName);

        if (!hasName && segments[segments.length - 1] !== "profile") {
          router.replace("/farmer/(tabs)/profile");
        }
      }
    };
    checkUserStatus();
  }, [segments]);

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
    
    // 🔥 గ్లిచ్ రాకుండా డ్రాయర్ పూర్తిగా వెనక్కి వెళ్ళాకే (320ms) నావిగేషన్ జరగాలి
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
      
            <SafeAreaView style={{ flex: 1 }}>
      
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
                        backgroundColor: "rgba(255,255,255,0.2)",
                        justifyContent: "center",
                        alignItems: "center"
                      }}
                    >
                      <AppText style={{ color: "#fff", fontSize: 28, fontWeight: "bold" }}>
                        {name?.charAt(0).toUpperCase() || "F"}
                      </AppText>
                    </View>
                
                    <AppText style={{ fontSize: 18, marginTop: 10, color: "#fff", fontWeight: "600" }}>
                      {name || "Farmer"}
                    </AppText>
                
                    <View
                      style={{
                        marginTop: 6,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 10,
                        backgroundColor: "rgba(255,255,255,0.2)"
                      }}
                    >
                      <AppText style={{ fontSize: 12, color: "#fff" }}>
                        {language === "te" ? "రైతు" : "Farmer"}
                      </AppText>
                    </View>
                  </View>
                </LinearGradient>

                {/* PREMIUM LANGUAGE TOGGLE WRAPPER */}
                <View style={{ paddingHorizontal: 20 }}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={toggleLanguage}
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
              
                    {/* 🔥 BIGGER & GLITCH-FREE PREMIUM TOGGLE SWITCH */}
                    <View
                      style={[
                        styles.toggleContainer,
                        { backgroundColor: language === "te" ? "#DCFCE7" : "#E5E7EB" } // Clean instant color change
                      ]}
                    >
                      <Animated.View
                        style={[
                          styles.toggleCircle,
                          { transform: [{ translateX: toggleTranslateX }] } // Pure Native Animation
                        ]}
                      />
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
      
              {/* ✅ YOUR ORIGINAL RESPONSIVE SCROLLVIEW */}
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
                <TouchableOpacity style={styles.drawerItem} onPress={() => navigateFromDrawer("rate")}>
                  <Ionicons name="star-outline" size={20} color="#16A34A" />
                  <AppText style={styles.drawerText}>
                    {language === "te" ? "మాకు రేటింగ్ ఇవ్వండి" : "Rate Us"}
                  </AppText>
                </TouchableOpacity>
            
                {/* Logout Button */}
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

              </ScrollView>
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
                ? "మీరు నిజంగా నిష్క్రమించాలనుకుంటున్నారా?"
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

/* ---------------- YOUR EXACT STYLES WITH UPDATED FIXED TOGGLE ---------------- */
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
  // 🔥 FIXED PREMIUM TOGGLE STYLES
  toggleContainer: {
    width: 52,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D1D5DB"
  },
  toggleCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#16A34A",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2
  },
  logoutBtn: {
    marginTop: 20,
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