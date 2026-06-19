// app/farmer/schemes/admin-scheme.tsx

import React, { useState, useEffect } from "react";
import storage from "@react-native-firebase/storage";
import {
  View,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TextInput,
  TouchableOpacity,
  Keyboard,
  Alert,
  Image
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import firestore from "@react-native-firebase/firestore";
import { executeOfflineSafeRead, executeOfflineSafeWrite } from "@/utils/offlineHelper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import * as ImagePicker from 'expo-image-picker';

import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";
import AgriLoader from "@/components/AgriLoader";

export default function AdminSchemeScreen() {
  const router = useRouter();

  const [language, setLanguage] = useState<"te" | "en">("te");
  const [loading, setLoading] = useState(false);

  // Form States
  const [title, setTitle] = useState("");
  const [shortDesc, setShortDesc] = useState("");
  const [bannerImage, setBannerImage] = useState<string | null>(null);
  const [targetState, setTargetState] = useState<"AP" | "TS" | "BOTH">("BOTH");
  const [howToApply, setHowToApply] = useState("");
  const [applyLink, setApplyLink] = useState("");

  // Dynamic Array States
  const [eligibility, setEligibility] = useState<string[]>([""]);
  const [documents, setDocuments] = useState<string[]>([""]);

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    AsyncStorage.getItem("APP_LANG").then((l) => {
      if (l) setLanguage(l as "te" | "en");
    });
  }, []);

  /* ---------------- IMAGE PICKER (ఇమేజ్ అప్‌లోడ్) ---------------- */
  const pickImage = async () => {
    Keyboard.dismiss(); 
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        language === "te" ? "అనుమతి నిరాకరించబడింది" : "Permission Denied",
        language === "te" ? "ఫోటోలను ఎంచుకోవడానికి గ్యాలరీ परवानगी కావాలి." : "We need gallery permissions to upload image."
      );
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9], 
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setBannerImage(result.assets[0].uri);
    }
  };

  /* ---------------- DYNAMIC ARRAYS LOGIC ---------------- */
  const updateArray = (setter: any, index: number, value: string, array: string[]) => {
    const newArray = [...array];
    newArray[index] = value;
    setter(newArray);
  };

  const addField = (setter: any, array: string[]) => {
    setter([...array, ""]);
  };

  const removeField = (setter: any, index: number, array: string[]) => {
    const newArray = array.filter((_, i) => i !== index);
    setter(newArray.length ? newArray : [""]);
  };

  /* ---------------- VALIDATION & SAVE ---------------- */
 const handleSave = async () => {
    Keyboard.dismiss();

    const newErrors: any = {};
    if (!title.trim()) newErrors.title = language === "te" ? "పథకం పేరు తప్పనిసరి*" : "Title is required*";
    if (!shortDesc.trim()) newErrors.shortDesc = language === "te" ? "వివరణ తప్పనిసరి*" : "Description is required*";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    const cleanEligibility = eligibility.map(e => e.trim()).filter(e => e.length > 0);
    const cleanDocuments = documents.map((d: any) => d.trim()).filter(d => d.length > 0);

    try {
      setLoading(true);

      let finalImageUrl = bannerImage || "";

      // 🔥 Firebase Storage Upload Logic
      if (bannerImage && !bannerImage.startsWith("http")) {
        // ఇక్కడ ఫోటోని Firebase లో అప్‌లోడ్ చేసి పబ్లిక్ URL తెస్తున్నాం
        const filename = bannerImage.substring(bannerImage.lastIndexOf('/') + 1);
        const storageRef = storage().ref(`schemes/${Date.now()}_${filename}`);
        
        await storageRef.putFile(bannerImage);
        finalImageUrl = await storageRef.getDownloadURL();
      }

      const schemeData = {
        title: title.trim(),
        shortDesc: shortDesc.trim(),
        bannerImage: finalImageUrl, // 🔥 ఇప్పుడు పబ్లిక్ లింక్ వెళ్తుంది
        state: targetState,
        howToApply: howToApply.trim(),
        applyLink: applyLink.trim(),
        eligibility: cleanEligibility,
        documentsRequired: cleanDocuments,
        isActive: true,
        createdAt: firestore.FieldValue.serverTimestamp(),
      };

      await executeOfflineSafeWrite(firestore().collection("schemes").add(schemeData));

      setLoading(false);
      Alert.alert(
        language === "te" ? "విజయవంతం" : "Success",
        language === "te" ? "పథకం విజయవంతంగా జోడించబడింది." : "Scheme added successfully.",
        [{ text: "OK", onPress: () => router.back() }]
      );

    } catch (error) {
      console.log("Error saving scheme:", error);
      setLoading(false);
      Alert.alert("Error", "Failed to save scheme. Please check internet and try again.");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      <AppHeader
        title={language === "te" ? "కొత్త పథకం" : "Add New Scheme"}
        subtitle={language === "te" ? "అడ్మిన్ ప్యానెల్" : "Admin Panel"}
        language={language}
      />

      <KeyboardAwareScrollView
        enableOnAndroid={true}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        
        {/* IMAGE PICKER (ఇమేజ్ అప్‌లోడ్ బాక్స్) */}
        <AppText style={styles.label}>{language === "te" ? "బ్యాнер ఇమేజ్" : "Banner Image"}</AppText>
        <TouchableOpacity 
          style={styles.imageUploadBox} 
          onPress={pickImage}
          activeOpacity={0.8}
        >
          {bannerImage ? (
            <Image source={{ uri: bannerImage }} style={styles.previewImage} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="cloud-upload-outline" size={32} color="#16A34A" />
              <AppText style={styles.imagePlaceholderText}>
                {language === "te" ? "ఫోటో అప్‌లోడ్ చేయడానికి ఇక్కడ నొక్కండి" : "Tap to upload image (16:9)"}
              </AppText>
            </View>
          )}
        </TouchableOpacity>

        {/* TITLE */}
        <AppText style={styles.label}>{language === "te" ? "పథకం పేరు*" : "Scheme Title*"}</AppText>
        <View style={[styles.inputBox, errors.title && styles.inputError]}>
          <Ionicons name="document-text-outline" size={20} color={title ? "#16A34A" : "#9CA3AF"} />
          <TextInput
            value={title}
            onChangeText={(txt) => { setTitle(txt); if (errors.title) setErrors(prev => ({ ...prev, title: "" })); }}
            placeholder={language === "te" ? "పథకం పేరు నమోదు చేయండి" : "Enter Scheme Title"}
            style={styles.input}
            cursorColor="#16A34A"
          />
        </View>
        {errors.title && <AppText style={styles.errorText}>{errors.title}</AppText>}

        {/* SHORT DESCRIPTION */}
        <AppText style={styles.label}>{language === "te" ? "క్లుప్త వివరణ*" : "Short Description*"}</AppText>
        <View style={[styles.inputBox, { height: 80, alignItems: "flex-start", paddingVertical: 12 }, errors.shortDesc && styles.inputError]}>
          <TextInput
            value={shortDesc}
            onChangeText={(txt) => { setShortDesc(txt); if (errors.shortDesc) setErrors(prev => ({ ...prev, shortDesc: "" })); }}
            placeholder={language === "te" ? "పథకం గురించి క్లుప్తంగా..." : "Brief description..."}
            style={[styles.input, { textAlignVertical: "top", marginLeft: 0 }]}
            cursorColor="#16A34A"
            multiline
          />
        </View>
        {errors.shortDesc && <AppText style={styles.errorText}>{errors.shortDesc}</AppText>}

        {/* STATE SELECTION */}
        <AppText style={styles.label}>{language === "te" ? "రాష్ట్రం ఎంచుకోండి*" : "Select State*"}</AppText>
        <View style={styles.stateRow}>
          {["AP", "TS", "BOTH"].map((st) => (
            <TouchableOpacity
              key={st}
              activeOpacity={0.8}
              style={[styles.stateBtn, targetState === st && styles.stateBtnActive]}
              onPress={() => {
                Keyboard.dismiss();
                setTargetState(st as any);
              }}
            >
              <AppText style={[styles.stateBtnText, targetState === st && styles.stateBtnTextActive]}>
                {st === "BOTH" ? (language === "te" ? "రెండు" : "Both") : st}
              </AppText>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.divider} />

        {/* DYNAMIC ELIGIBILITY */}
        <AppText style={styles.sectionLabel}>{language === "te" ? "అర్హతలు (Eligibility)" : "Eligibility Points"}</AppText>
        {eligibility.map((point, index) => (
          <View key={`elig-${index}`} style={styles.dynamicRow}>
            <View style={styles.dynamicInputBox}>
              <TextInput
                value={point}
                onChangeText={(txt) => updateArray(setEligibility, index, txt, eligibility)}
                placeholder={`${index + 1}. ${language === "te" ? "పాయింట్ నమోదు చేయండి" : "Enter point"}`}
                style={styles.input}
                cursorColor="#16A34A"
              />
            </View>
            <TouchableOpacity style={styles.removeBtn} onPress={() => removeField(setEligibility, index, eligibility)}>
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addMoreBtn} onPress={() => addField(setEligibility, eligibility)}>
          <Ionicons name="add-circle-outline" size={20} color="#2563EB" />
          <AppText style={styles.addMoreText}>{language === "te" ? "మరొకటి చేర్చండి" : "Add More"}</AppText>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* DYNAMIC DOCUMENTS */}
        <AppText style={styles.sectionLabel}>{language === "te" ? "కావాల్సిన పత్రాలు (Documents)" : "Documents Required"}</AppText>
        {documents.map((doc, index) => (
          <View key={`doc-${index}`} style={styles.dynamicRow}>
            <View style={styles.dynamicInputBox}>
              <TextInput
                value={doc}
                onChangeText={(txt) => updateArray(setDocuments, index, txt, documents)}
                placeholder={`${index + 1}. ${language === "te" ? "పత్రం పేరు" : "Document name"}`}
                style={styles.input}
                cursorColor="#16A34A"
              />
            </View>
            <TouchableOpacity style={styles.removeBtn} onPress={() => removeField(setDocuments, index, documents)}>
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addMoreBtn} onPress={() => addField(setDocuments, documents)}>
          <Ionicons name="add-circle-outline" size={20} color="#2563EB" />
          <AppText style={styles.addMoreText}>{language === "te" ? "మరొకటి చేర్చండి" : "Add More"}</AppText>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* HOW TO APPLY */}
        <AppText style={styles.label}>{language === "te" ? "ఎలా దరఖాస్తు చేయాలి?" : "How to Apply?"}</AppText>
        <View style={[styles.inputBox, { height: 80, alignItems: "flex-start", paddingVertical: 12 }]}>
          <TextInput
            value={howToApply}
            onChangeText={setHowToApply}
            placeholder={language === "te" ? "దరఖాస్తు విధానం రాయండి..." : "Application process..."}
            style={[styles.input, { textAlignVertical: "top", marginLeft: 0 }]}
            cursorColor="#16A34A"
            multiline
          />
        </View>

        {/* APPLY LINK */}
        <AppText style={styles.label}>{language === "te" ? "అప్లై లింక్ (Website URL)" : "Application Link"}</AppText>
        <View style={styles.inputBox}>
          <Ionicons name="link-outline" size={20} color={applyLink ? "#16A34A" : "#9CA3AF"} />
          <TextInput
            value={applyLink}
            onChangeText={setApplyLink}
            placeholder="https://..."
            style={styles.input}
            cursorColor="#16A34A"
            keyboardType="url"
            autoCapitalize="none"
          />
        </View>

        {/* SAVE BUTTON */}
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading} activeOpacity={0.85}>
          <LinearGradient colors={["#2E7D32", "#1B5E20"]} style={styles.saveGradient}>
            <AppText style={styles.saveText}>
              {language === "te" ? "పథకాన్ని పబ్లిష్ చేయండి" : "Publish Scheme"}
            </AppText>
          </LinearGradient>
        </TouchableOpacity>

      </KeyboardAwareScrollView>

      <AgriLoader visible={loading} type="saving" language={language} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F9FAFB" },
  scrollContent: { padding: 20, paddingBottom: 60 },
  label: { fontSize: 14, color: "#4B5563", fontWeight: "600", marginBottom: 6, marginLeft: 4 },
  sectionLabel: { fontSize: 16, color: "#111827", fontWeight: "700", marginBottom: 12 },
  
  // IMAGE PICKER STYLES
  imageUploadBox: {
    width: "100%",
    height: 180,
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    overflow: "hidden"
  },
  previewImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover"
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center"
  },
  imagePlaceholderText: {
    color: "#6B7280",
    marginTop: 8,
    fontSize: 14
  },

  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 55,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#D1D5DB"
  },
  inputError: { borderColor: "#EF4444", backgroundColor: "#FEF2F2" },
  errorText: { color: "#EF4444", fontSize: 12, marginTop: -12, marginBottom: 12, marginLeft: 4 },
  input: { flex: 1, marginLeft: 10, fontSize: 15, color: "#1F2937", includeFontPadding: false },

  stateRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  stateBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#D1D5DB", alignItems: "center" },
  stateBtnActive: { backgroundColor: "#16A34A", borderColor: "#16A34A" },
  stateBtnText: { color: "#4B5563", fontWeight: "600" },
  stateBtnTextActive: { color: "#ffffff" },

  divider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 20 },

  dynamicRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  dynamicInputBox: { flex: 1, backgroundColor: "#ffffff", borderRadius: 10, paddingHorizontal: 15, height: 50, borderWidth: 1, borderColor: "#D1D5DB", justifyContent: "center" },
  removeBtn: { width: 45, height: 50, backgroundColor: "#FEF2F2", borderRadius: 10, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#FCA5A5" },
  
  addMoreBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 12, alignSelf: "flex-start", backgroundColor: "#EFF6FF", borderRadius: 8, borderWidth: 1, borderColor: "#BFDBFE" },
  addMoreText: { color: "#2563EB", fontWeight: "600", fontSize: 14 },

  saveBtn: { marginTop: 30, borderRadius: 14, overflow: "hidden", elevation: 4 },
  saveGradient: { height: 56, justifyContent: "center", alignItems: "center" },
  saveText: { color: "white", fontSize: 16, fontWeight: "700" }
});