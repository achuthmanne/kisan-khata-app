import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StyleSheet, TouchableOpacity, View, Platform, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppText from "./AppText";

export default function AppHeader({ title, subtitle, language, onDownload, rightIcon, onRightPress, onBackPress }: any) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // Dynamic padding: Chinna screens lo thakkuva, pedda notch screens lo ekkuva.
  const safeTop = Math.max(insets.top, Platform.OS === "android" ? (StatusBar.currentHeight || 20) : 20);

  return (
    <LinearGradient
      colors={["#1B5E20", "#2E7D32"]}
      style={[styles.header, { paddingTop: safeTop }]}
    >
      {/* TOP ROW */}
      <View style={styles.topRow}>
        <TouchableOpacity 
          onPress={() => onBackPress ? onBackPress() : router.back()} 
          style={styles.iconBtn}
        >
          <Ionicons name="arrow-back" size={20} color="white" />
        </TouchableOpacity>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', marginHorizontal: 10 }}>
          <AppText style={styles.title} language={language}>
            {title}
          </AppText>
          {/* SUBTITLE */}
          {subtitle && (
            <AppText style={styles.subtitle} language={language}>
              {subtitle}
            </AppText>
          )}
        </View>

        {/* 📥 DOWNLOAD OR CUSTOM RIGHT BUTTON */}
        {onDownload ? (
          <TouchableOpacity onPress={onDownload} style={styles.iconBtn}>
            <Ionicons name="cloud-download-outline" size={20} color="white" />
          </TouchableOpacity>
        ) : rightIcon && onRightPress ? (
          <TouchableOpacity onPress={onRightPress} style={styles.iconBtn}>
            <Ionicons name={rightIcon} size={20} color="white" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 32 }} /> // Space maintainer
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingBottom: 12,
    paddingHorizontal: 20
  },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },

  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.15)", // నీ పాత స్టైల్ నే వాడాను బ్రో
    justifyContent: "center",
    alignItems: "center"
  },

  title: {
    color: "white",
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
    includeFontPadding: false,
    textAlignVertical: "center"
  },

  subtitle: {
    marginTop: 2,
    textAlign: "center",
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    includeFontPadding: false,
  }
});