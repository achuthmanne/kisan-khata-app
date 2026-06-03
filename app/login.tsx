import firestore from "@react-native-firebase/firestore";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import AgriLoader from "../components/AgriLoader";
import AppText from "../components/AppText";

export default function LoginScreen() {
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"FARMER" | "MESTRI" | null>(null);
  const [language, setLanguage] = useState<"te" | "en">("te");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const focus = useSharedValue(0);

  const borderStyle = useAnimatedStyle(() => ({
    borderColor: focus.value ? "#1B5E20" : "#E5E7EB",
    borderWidth: focus.value ? 2 : 1,
  }));

  const valid = phone.length === 10 && role !== null;

  const handleContinue = async () => {
    if (!valid) {
      setError(language === "te" ? "సరైన వివరాలు నమోదు చేయండి" : "Enter valid details");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const doc = await firestore().collection("users").doc(phone).get();
      const userExists: boolean = doc.exists();

      if (userExists) {
        const userData = doc.data();
        const existingRole = userData?.role;

        const isFarmerDB = existingRole?.toUpperCase() === "FARMER" || existingRole === "రైతు";
        const isMestriDB = existingRole?.toUpperCase() === "MESTRI" || existingRole === "మేస్త్రీ";

        if ((isFarmerDB && role === "MESTRI") || (isMestriDB && role === "FARMER")) {
          setLoading(false);
          const roleInTelugu = isFarmerDB ? "రైతు" : "మేస్త్రీ";
          const roleInEnglish = isFarmerDB ? "Farmer" : "Mestri";
          
          setError(
            language === "te" 
              ? `ఈ నంబర్ ఇప్పటికే "${roleInTelugu}" గా నమోదై ఉంది` 
              : `This number is already registered as a ${roleInEnglish}`
          );
          return;
        }
      }

      router.push({
        pathname: "/pin",
        params: { phone, role, language, mode: userExists ? "login" : "create" },
      });
      setLoading(false);
    } catch (err) {
      setLoading(false);
      setError(language === "te" ? "నెట్‌వర్క్ లోపం" : "Network error");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
    
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={styles.container}>
          
          <View style={styles.langRow}>
            <Pressable onPress={() => setLanguage("te")}>
              <AppText style={[styles.lang, language === "te" && styles.active]} language={language}>తెలుగు</AppText>
            </Pressable>
            <AppText style={{ marginHorizontal: 8, color: "#E5E7EB" }} language={language}>|</AppText>
            <Pressable onPress={() => setLanguage("en")}>
              <AppText style={[styles.lang, language === "en" && styles.active]} language={language}>English</AppText>
            </Pressable>
          </View>

          <AppText style={styles.title} language={language}>Kisan Khata</AppText>
          <AppText style={styles.tagline} language={language}>
           {language === "te" 
            ? "ఆధునిక వ్యవసాయానికి డిజిటల్ ఖాతా." 
            : "The Digital Ledger for Modern Agriculture."}
          </AppText>

          <Animated.View style={[styles.inputBox, borderStyle]}>
            <AppText style={styles.prefix} language={language}>+91</AppText>
            <View style={styles.divider} />
            <TextInput
              style={[styles.input, { fontFamily: "Mandali", marginTop: Platform.OS === "android" ? 2 : 0 }]}
              keyboardType="number-pad"
              maxLength={10}
              value={phone}
              cursorColor="#1B5E20"
              selectionColor="#1B5E20"
              placeholder={language === "te" ? "ఫోన్ నంబర్" : "Phone Number"}
              placeholderTextColor="#9CA3AF"
              onFocus={() => (focus.value = withTiming(1))}
              onBlur={() => (focus.value = withTiming(0))}
              onChangeText={(t) => {
                setPhone(t.replace(/[^0-9]/g, ""));
                setError("");
              }}
            />
          </Animated.View>

          <View style={styles.roleRow}>
            <TouchableOpacity activeOpacity={0.8} style={[styles.roleCard, role === "FARMER" && styles.roleActive]} onPress={() => setRole("FARMER")}>
              <Image source={require("../assets/images/farmer.png")} style={[styles.customIcon, { opacity: role === "FARMER" ? 1 : 0.5 }]} />
              <AppText style={[styles.roleText, role === "FARMER" && { color: "#1B5E20" }]} language={language}>
                {language === "te" ? "రైతు" : "Farmer"}
              </AppText>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.roleCard, role === "MESTRI" && styles.roleActive]} onPress={() => setRole("MESTRI")}>
              <Image source={require("../assets/images/kuli.png")} style={[styles.customIcon, { opacity: role === "MESTRI" ? 1 : 0.5 }]} />
              <AppText style={[styles.roleText, role === "MESTRI" && { color: "#1B5E20" }]} language={language}>
                {language === "te" ? "మేస్త్రీ" : "Mestri"}
              </AppText>
            </TouchableOpacity>
          </View>

          {error !== "" && <AppText style={styles.error} language={language}>{error}</AppText>}

          <TouchableOpacity activeOpacity={0.8} style={[styles.button, !valid && styles.disabled]} disabled={!valid || loading} onPress={handleContinue}>
            <AppText style={styles.buttonText} language={language}>
              {language === "te" ? "ముందుకు" : "Continue"}
            </AppText>
          </TouchableOpacity>
        </View>

        <AgriLoader visible={loading} type="loading" language={language} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6F7F6" },
  watermark: { position: "absolute", width: 300, height: 300, opacity: 0.04, alignSelf: "center", top: "30%" },
  container: { flex: 1, padding: 24, paddingTop: 60 },
  langRow: { flexDirection: "row", alignSelf: "flex-end", marginBottom: 40, alignItems: 'center' },
  lang: { color: "#9CA3AF", fontSize: 14 },
  active: { color: "#1B5E20", fontWeight: "500" },
  title: { fontSize: 36, fontWeight: "800", color: "#1B5E20", letterSpacing: -1 },
  tagline: { fontSize: 16, color: "#6B7280", marginBottom: 50, fontWeight: "500" },
  inputBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFF", borderRadius: 22, borderWidth: 0.5, borderColor: "#E5E7EB", paddingHorizontal: 18, height: 60, marginBottom: 20, marginTop: -20},
  prefix: { fontSize: 17, fontWeight: "600", color: "#1B5E20", marginRight: 8 },
  divider: { width: 1.5, height: 24, backgroundColor: "#E5E7EB", marginRight: 15 },
  input: { flex: 1, fontSize: 18, fontWeight: "600", color: "#111827", height: '100%', paddingVertical: 0 },
  roleRow: { flexDirection: "row", marginBottom: 30, gap: 12 },
  roleCard: { flex: 1, backgroundColor: "#FFF", paddingVertical: 25, borderRadius: 22, alignItems: "center", borderWidth: 1, borderColor: "#F3F4F6" },
  customIcon: { width: 55, height: 55, resizeMode: 'contain', marginBottom: 8 },
  roleActive: { borderColor: "#1B5E20", backgroundColor: "#E8F5E9" },
  roleText: { marginTop: 10, fontWeight: "600", color: "#6B7280", fontSize: 15 },
  error: { color: "#D32F2F", marginBottom: 15, fontWeight: "600", textAlign: "center" },
  button: { height: 55, borderRadius: 22, backgroundColor: "#1B5E20", justifyContent: "center", alignItems: "center" },
  disabled: { backgroundColor: "#D1D5DB" },
  buttonText: { color: "#FFF", fontWeight: "600", fontSize: 18, letterSpacing: 0.5 },
});