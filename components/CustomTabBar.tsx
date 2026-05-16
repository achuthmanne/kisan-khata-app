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
  View
} from "react-native";

const { width } = Dimensions.get("window");

export default function CustomTabBar({ state, navigation, language }: any) {

  // 🔥 Production level TabItem with smooth tap area and active font weights
  const TabItem = ({ icon, label, isFocused, onPress }: any) => {
    return (
      <TouchableOpacity 
        onPress={onPress} 
        style={styles.tabItem} 
        activeOpacity={0.6} // Premium smooth feel
      >
        <View style={styles.iconWrapper}>
          {icon}
        </View>

        <AppText
          style={[
            styles.label,
            { 
              color: isFocused ? "#14532D" : "#9CA3AF",
              fontWeight: isFocused ? "600" : "500" // Active state lo text bold
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
      <View style={styles.navbar}>

        {/* HOME */}
        <TabItem
          icon={
            <MaterialCommunityIcons
              name="home-variant-outline"
              size={24} // Size slightly adjusted for clean look
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
              size={24}
              color={state.index === 1 ? "#14532D" : "#9CA3AF"}
            />
          }
          label={language === "te" ? "పని చరిత్ర" : "Work History"}
          isFocused={state.index === 1}
          onPress={() => navigation.navigate("attendance-history")}
        />

        {/* 🔥 AI BUTTON (CENTER) - FUTURISTIC VERSION (STYLES UNTOUCHED) */}
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
              <MaterialCommunityIcons name="leaf" size={26} color="#fff" />

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
          {/* Label Removed Bro! */}
        </TouchableOpacity>

        {/* PAYMENTS */}
        <TabItem
          icon={
            <MaterialCommunityIcons
              name="receipt-text-outline"
              size={24}
              color={state.index === 2 ? "#14532D" : "#9CA3AF"}
            />
          }
          label={language === "te" ? "చెల్లింపుల చరిత్ర" : "Pay History"}
          isFocused={state.index === 2}
          onPress={() => navigation.navigate("history")}
        />

        {/* PROFILE */}
        <TabItem
          icon={
            <MaterialCommunityIcons
              name="account-outline"
              size={24}
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

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 16, // Bottom nundi konchem gap isthe premium premium ga untadi
    width: "100%",
    alignItems: "center"
  },

  navbar: {
    flexDirection: "row",
    height: 72, // AI 60px కాబట్టి ఇది 72 ఇస్తే పర్ఫెక్ట్ గా సింక్ అవుతుంది
    width: width - 32, // Edges nundi neat ga gap
    backgroundColor: "#fff",
    borderRadius: 24, // Smooth rounded corners
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.06, // Soft shadow for modern look
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4 // Items equal spacing kosam
  },

  tabItem: {
    flex: 1, // అన్నీ ఈక్వల్ విడ్త్ తీసుకుంటాయి, ప్రొడక్షన్ యాప్స్ లో ఇదే సీక్రెట్
    alignItems: "center",
    justifyContent: "center",
    height: "100%", 
  },

  iconWrapper: {
    paddingBottom: 4 // Icon కి Text కి మధ్య చిన్న గ్యాప్
  },

  label: {
    fontSize: 10, // చిన్నగా ఉంటేనే క్యూట్ అండ్ ప్రొఫెషనల్ గా ఉంటది
  },

  aiWrapper: {
    flex: 1, // మిగతా వాటితో పాటు ఈక్వల్ స్పేస్ తీసుకుంటుంది
    alignItems: 'center',
    justifyContent: 'center',
    // marginTop: -10 తీసేశాను బ్రో, సో పర్ఫెక్ట్ గా లోపలే సెంటర్ అవుతుంది.
  },

  /* 👇 ఇవన్నీ నువ్వు ఇచ్చిన ఒరిజినల్ AI స్టైల్స్ బ్రో, ఏమీ మార్చలేదు 👇 */
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
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
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