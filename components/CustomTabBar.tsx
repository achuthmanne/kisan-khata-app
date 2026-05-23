import AppText from "@/components/AppText";
import { LinearGradient } from "expo-linear-gradient";
import {
  MaterialIcons,
  MaterialCommunityIcons
} from "@expo/vector-icons";
import React from "react";
import {
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  View,
  Platform
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

export default function CustomTabBar({ state, navigation, language }: any) {
  const insets = useSafeAreaInsets();
  const paddingBottom = Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 10);
  const navbarHeight = 60 + paddingBottom;

  // 🔥 Production level TabItem
  const TabItem = ({ icon, label, isFocused, onPress }: any) => {
    return (
      <TouchableOpacity 
        onPress={onPress} 
        style={styles.tabItem} 
        activeOpacity={0.6} 
      >
        <View style={styles.iconWrapper}>
          {icon}
        </View>

        <AppText
          style={[
            styles.label,
            { 
              color: isFocused ? "#14532D" : "#9CA3AF",
              fontWeight: isFocused ? "600" : "500" 
            }
          ]}
          language={language}
        >
          {label}
        </AppText>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.navbar, { height: navbarHeight, paddingBottom: paddingBottom }]}>

        {/* HOME */}
        <TabItem
          icon={
            <MaterialCommunityIcons
              name="home-variant-outline"
              size={26} // పెంచాను, ట్రెడిషనల్ లుక్ కోసం
              color={state.index === 0 ? "#14532D" : "#9CA3AF"}
            />
          }
          label={language === "te" ? "హోమ్" : "Home"}
          isFocused={state.index === 0}
          onPress={() => navigation.navigate("index")}
        />

        {/* ATTENDANCE */}
        <TabItem
          icon={
            <MaterialCommunityIcons
              name="calendar-clock-outline"
              size={26}
              color={state.index === 1 ? "#14532D" : "#9CA3AF"}
            />
          }
          label={language === "te" ? "పని చరిత్ర" : "History"} // చిన్న టెక్స్ట్ ఉంటే నీట్ గా ఉంటుంది
          isFocused={state.index === 1}
          onPress={() => navigation.navigate("attendance-history")}
        />

        {/* 🔥 AI BUTTON (CENTER) - POPPING OUT SLIGHTLY */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => navigation.navigate("ai")}
          style={styles.aiWrapper}
        >
          <LinearGradient
            colors={["#065F46", "#10B981", "#6EE7B7"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.aiButton}
          >
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons name="leaf" size={28} color="#fff" />

              <MaterialCommunityIcons
                name="star-four-points"
                size={12}
                color="#fff"
                style={{ position: "absolute", top: -3, left: -2, opacity: 0.9 }}
              />
              
              <MaterialCommunityIcons
                name="star-four-points"
                size={8}
                color="rgba(255, 255, 255, 0.7)"
                style={{ position: "absolute", bottom: 3, right: -2 }}
              />

              <View style={styles.iconHalo} />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* PAYMENTS */}
        <TabItem
          icon={
            <MaterialCommunityIcons
              name="receipt-text-outline"
              size={26}
              color={state.index === 2 ? "#14532D" : "#9CA3AF"}
            />
          }
          label={language === "te" ? "చెల్లింపులు" : "Payments"}
          isFocused={state.index === 2}
          onPress={() => navigation.navigate("history")}
        />

        {/* PROFILE */}
        <TabItem
          icon={
            <MaterialCommunityIcons
              name="account-outline"
              size={26}
              color={state.index === 3 ? "#14532D" : "#9CA3AF"}
            />
          }
          label={language === "te" ? "ప్రొఫైల్" : "Profile"}
          isFocused={state.index === 3}
          onPress={() => navigation.navigate("profile")}
        />

      </View>
    </View>
  );
}

/* ---------------- STYLES ---------------- */

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  container: {
    width: "100%",
    backgroundColor: "#fff",
    borderTopLeftRadius: 24, 
    borderTopRightRadius: 24,
    
    // 🔥 నావ్‌బార్ మొత్తానికి బార్డర్ యాడ్ చేశాను ఇక్కడ
    borderTopWidth: 1,
    borderLeftWidth: 1,   // కర్వ్ దగ్గర కూడా నీట్ గా రావడం కోసం
    borderRightWidth: 1,  
    borderColor: "#E5E7EB", // మన యాప్ థీమ్ గ్రే-లైట్ కలర్
    
    elevation: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 }, 
  },

  navbar: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 8,
  },

  tabItem: {
    flex: 1, 
    alignItems: "center",
    justifyContent: "center",
    height: "100%", 
  },

  iconWrapper: {
    paddingBottom: 4 
  },

  label: {
    fontSize: 11, 
  },

  aiWrapper: {
    flex: 1, 
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -25, // AI బటన్ పాప్ అవుట్ అవ్వడానికి
  },

  aiButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
    
    // 🔥 నావ్‌బార్ కి ఇచ్చిన సేమ్ కలర్ తో బార్డర్
    borderWidth:2, // కొంచెం మందంగా ఉంటే నావ్‌బార్ బార్డర్ తో పర్ఫెక్ట్ గా కలుస్తుంది
    borderColor: '#E5E7EB',
  },
  
  // (మిగతా styles iconContainer, iconHalo అలాగే ఉంచుకో)
  iconContainer: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconHalo: {
    position: 'absolute',
    width: 45,
    height: 45,
    borderRadius: 22.5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
});