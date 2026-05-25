import AppText from "@/components/AppText";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Dimensions, Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

const { width } = Dimensions.get("window");

export default function CustomTabBar({ state, navigation, language }: any) {
  const insets = useSafeAreaInsets();
  
  // రెస్పాన్సివ్ స్పేసింగ్
  const paddingBottom = Platform.OS === 'ios' ? Math.max(insets.bottom, 12) : 12; 
  const navbarHeight = 60 + paddingBottom;
  
  // 🔥 డెప్త్ పారామీటర్స్ - ట్యాబ్ నేమ్స్ ఎండ్ అయ్యే లైన్ లెవెల్ వరకు లోతు పెంచాను
  const cutWidth = 54;   // కర్వ్ వెడల్పు కొంచెం పెంచాను లోతుకి తగ్గట్టు
  const cutDepth = 58;   // 🔥 పక్కాగా ట్యాబ్ లేబుల్స్ లైన్ వరకు వెళ్లే డెప్త్

  // కరెక్ట్ గా బాటమ్ లైన్ వరకు వెళ్లే Cubic Bezier Curve
  const path = `
    M 0, 0
    L ${width / 2 - cutWidth}, 0
    C ${width / 2 - 32}, 0  ${width / 2 - 30}, ${cutDepth}  ${width / 2}, ${cutDepth}
    C ${width / 2 + 30}, ${cutDepth}  ${width / 2 + 32}, 0  ${width / 2 + cutWidth}, 0
    L ${width}, 0
    L ${width}, ${navbarHeight}
    L 0, ${navbarHeight}
    Z
  `;

  const TabItem = ({ icon, label, isFocused, onPress }: any) => {
    return (
      <TouchableOpacity 
        onPress={onPress} 
        style={styles.tabItem} 
        activeOpacity={0.7} 
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
    <View style={[styles.container, { height: navbarHeight }]}>
      
      {/* SVG Background View */}
      <Svg width={width} height={navbarHeight} style={StyleSheet.absoluteFill}>
        <Path
          d={path}
          fill="#FFFFFF"
          stroke="#E5E7EB"
          strokeWidth={1}
        />
      </Svg>

      {/* Tabs Container */}
      <View style={[styles.navbar, { height: 60 }]}>
        
        {/* ఎడమవైపే ట్యాబ్స్ */}
        <View style={styles.sideGroup}>
          <TabItem
            icon={<MaterialCommunityIcons name="home-variant-outline" size={24} color={state.index === 0 ? "#14532D" : "#9CA3AF"} />}
            label={language === "te" ? "హోమ్" : "Home"}
            isFocused={state.index === 0}
            onPress={() => navigation.navigate("index")}
          />
          <TabItem
            icon={<MaterialCommunityIcons name="calendar-clock-outline" size={24} color={state.index === 1 ? "#14532D" : "#9CA3AF"} />}
            label={language === "te" ? "పని చరిత్ర" : "History"}
            isFocused={state.index === 1}
            onPress={() => navigation.navigate("attendance-history")}
          />
        </View>

        {/* మధ్యలో ఖాళీ స్పేస్ */}
        <View style={styles.centerSpace} />

        {/* కుడివైపే ట్యాబ్స్ */}
        <View style={styles.sideGroup}>
          <TabItem
            icon={<MaterialCommunityIcons name="receipt-text-outline" size={24} color={state.index === 2 ? "#14532D" : "#9CA3AF"} />}
            label={language === "te" ? "చెల్లింపులు" : "Payments"}
            isFocused={state.index === 2}
            onPress={() => navigation.navigate("history")}
          />
          <TabItem
            icon={<MaterialCommunityIcons name="account-outline" size={24} color={state.index === 3 ? "#14532D" : "#9CA3AF"} />}
            label={language === "te" ? "ప్రొఫైల్" : "Profile"}
            isFocused={state.index === 3}
            onPress={() => navigation.navigate("profile")}
          />
        </View>
      </View>

      {/* 🔥 AI Floating Button - లోతైన కర్వ్ కి తగ్గట్టుగా పొజిషన్ పర్ఫెక్ట్ గా కిందకి దించాను */}
      <View style={styles.aiWrapper}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.navigate("ai")}
        >
          <LinearGradient
            colors={["#065F46", "#10B981", "#6EE7B7"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.aiButton}
          >
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons name="leaf" size={28} color="#fff" />
              <MaterialCommunityIcons name="star-four-points" size={10} color="#fff" style={{ position: "absolute", top: -2, left: -2, opacity: 0.9 }} />
              <MaterialCommunityIcons name="star-four-points" size={7} color="rgba(255, 255, 255, 0.7)" style={{ position: "absolute", bottom: 2, right: -2 }} />
              <View style={styles.iconHalo} />
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>

    </View>
  );
}

/* ---------------- STYLES ---------------- */
const styles = StyleSheet.create({
  container: {
    width: width,
    backgroundColor: 'transparent',
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -3 },
    elevation: 10,
  },
  navbar: {
    flexDirection: "row",
    width: "100%",
    alignItems: "center",
  },
  sideGroup: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: '100%',
  },
  centerSpace: {
    width: 88, // డీప్ కర్వ్ కి తగ్గట్టు స్పేస్
  },
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 65,
    height: '100%',
  },
  iconWrapper: {
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  label: {
    fontSize: 11,
    letterSpacing: -0.1,
  },
  aiWrapper: {
    position: 'absolute',
    top: 2, // 🔥 లోపలికి బాగా దిగింది కాబట్టి టాప్ వాల్యూ పెంచి సెంటర్ చేశా బ్రో
    left: width / 2 - 28, 
    width: 56,
    height: 56,
  },
  aiButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconHalo: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
});