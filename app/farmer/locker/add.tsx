import React, { useState, useEffect } from "react";
import { View, StyleSheet, TouchableOpacity, ScrollView, TextInput, Platform, Keyboard, StatusBar, SafeAreaView, Image, Modal, KeyboardAvoidingView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { FlatList } from "react-native";

import AppText from "@/components/AppText";
import AppHeader from "@/components/AppHeader";
import AgriLoader from "@/components/AgriLoader";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

const translations = {
  te: {
    title: "లాకర్‌లో దాచుకోండి",
    subtitle: "విత్తనాలు, మందుల వివరాలు రికార్డ్ చేయండి",
    seed: "విత్తనాలు",
    fertilizer: "ఎరువులు",
    pesticide: "మందులు",
    other: "ఇతరాలు",
    category: "కేటగిరీ ఎంచుకోండి*",
    crop: "పంట పేరు (ఉదా: పత్తి)*",
    brandName: "కంపెనీ / బ్రాండ్ పేరు*",
    brandTitle: "శీర్షిక / పేరు*",
    price: "ఒక్కో ప్యాకెట్ / ఐటెమ్ ధర (₹)",
    notes: "వివరాలు (అవసరమైతేనే)",
    save: "భద్రపరుచు",
    takePhoto: "కెమెరా",
    gallery: "గ్యాలరీ",
    photoTitle: "ఫోటో (అవసరమైతేనే)",
    uploading: "అప్లోడ్ అవుతోంది...",
    errors: {
      category: "దయచేసి కేటగిరీ ఎంచుకోండి",
      crop: "దయచేసి పంట పేరు రాయండి",
      brandName: "దయచేసి బ్రాండ్ పేరు రాయండి",
    }
  },
  en: {
    title: "Add to Locker",
    subtitle: "Record your seeds and pesticides details",
    seed: "Seeds",
    fertilizer: "Fertilizers",
    pesticide: "Pesticides",
    other: "Others",
    category: "Select Category*",
    crop: "Crop Name (e.g., Cotton)*",
    brandName: "Company / Brand Name*",
    brandTitle: "Title / Name*",
    price: "Price per packet / item (₹)",
    notes: "Notes (Optional)",
    save: "Save to Locker",
    takePhoto: "Camera",
    gallery: "Gallery",
    photoTitle: "Photo (Optional)",
    uploading: "Uploading...",
    errors: {
      category: "Please select category",
      crop: "Please enter crop name",
      brandName: "Please enter brand name",
    }
  },
};

export default function AddLockerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const getStr = (val: any) => (typeof val === "string" ? val : "");
  
  const [language, setLanguage] = useState<"te" | "en">("te");
  const t = translations[language];

  const [category, setCategory] = useState<"seed" | "fertilizer" | "pesticide" | "other" | null>(null);
  const [crop, setCrop] = useState("");
  const [brandName, setBrandName] = useState(getStr(params.brand) || "");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState(getStr(params.notes) || "");
  const [activeSession, setActiveSession] = useState("");
  const [images, setImages] = useState<string[]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [activeInput, setActiveInput] = useState<string | null>(null);
  
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  
  // Crop Modal States
  const [showCropModal, setShowCropModal] = useState(false);
  const [userCrops, setUserCrops] = useState<string[]>([]);
  const [cropSearch, setCropSearch] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceTarget, setVoiceTarget] = useState<"search" | "notes" | "brand" | null>(null);

  // 🔥 FETCH LANGUAGE & SESSION
  useEffect(() => {
    let isMountedLocal = true;
    AsyncStorage.getItem("APP_LANG").then((l) => { if (l && isMountedLocal) setLanguage(l as any); });
    
    const loadSession = async () => {
      const phone = await AsyncStorage.getItem("USER_PHONE");
      if (phone) {
        const doc = await firestore().collection("users").doc(phone).get();
        if (isMountedLocal) setActiveSession(doc.data()?.activeSession || "");
      }
    };
    loadSession();

    loadUserCrops();

    return () => { 
      isMountedLocal = false; 
      ExpoSpeechRecognitionModule.stop();
    };
  }, []);

  const getCurrentSession = () => {
    const now = new Date();
    const year = now.getFullYear();
    const startYear = now.getMonth() >= 5 ? year : year - 1;
    return `${startYear}-${(startYear + 1).toString().slice(-2)}`;
  };

  const loadUserCrops = async () => {
    try {
      const phone = await AsyncStorage.getItem("USER_PHONE");
      if (!phone) return;

      const cachedCrops = await AsyncStorage.getItem(`CACHED_CROPS_${phone}`);
      if (cachedCrops) {
        setUserCrops(JSON.parse(cachedCrops));
      }

      const userDoc = await firestore().collection("users").doc(phone).get();
      const fetchedSession = userDoc.data()?.activeSession;
      if (!fetchedSession) return;

      const landsSnap = await firestore().collection("users").doc(phone).collection("lands").where("session", "==", fetchedSession).get();
      const landsMap: any = {};
      landsSnap.forEach(doc => { landsMap[doc.id] = doc.data().nickname; });

      const snap = await firestore().collection("users").doc(phone).collection("fields").where("session", "==", fetchedSession).get();
      const set = new Set<string>();
      snap.forEach(doc => {
        const data = doc.data();
        if (data.crop) {
          const nick = landsMap[data.landId] || data.nickname;
          const name = nick ? `${data.crop} - ${nick}` : data.crop;
          set.add(name);
        }
      });
      
      const freshCrops = Array.from(set);
      setUserCrops(freshCrops);
      await AsyncStorage.setItem(`CACHED_CROPS_${phone}`, JSON.stringify(freshCrops));
    } catch (e) {
      console.log("Load crops error", e);
    }
  };

  const startVoice = async (target: "search" | "notes" | "brand" = "search") => {
    try {
      Keyboard.dismiss();
      const res = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!res.granted) return;
      setVoiceTarget(target);
      setIsListening(true);
      ExpoSpeechRecognitionModule.start({ lang: language === "te" ? "te-IN" : "en-US", interimResults: true });
    } catch (e) {
      console.log("Voice Search Error:", e);
      setIsListening(false);
      setVoiceTarget(null);
    }
  };

  useSpeechRecognitionEvent("result", (event) => {
    if (!isListening) return;
    const text = event.results?.[0]?.transcript?.replace(/[.,?!]/g, "");
    if (text) {
      if (voiceTarget === "notes") {
        setNotes((prev) => prev ? prev + " " + text : text);
      } else if (voiceTarget === "brand") {
        setBrandName(text);
        if (errors.brandName) setErrors({ ...errors, brandName: "" });
      } else {
        setCropSearch(text);
      }
    }
  });

  useSpeechRecognitionEvent("end", () => {
    setIsListening(false);
    setVoiceTarget(null);
  });

  const pickImage = async (source: "camera" | "gallery") => {
    if (images.length >= 2) return;
    try {
      let result;
      if (source === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) return;
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.5, // Compress for faster upload
        });
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) return;
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.5,
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImages(prev => [...prev, result.assets[0].uri]);
      }
    } catch (error) {
      console.log("Error picking image", error);
    }
  };

  const uploadImages = async (phone: string): Promise<string[]> => {
    if (images.length === 0) return [];
    const urls: string[] = [];
    for (let i = 0; i < images.length; i++) {
      try {
        const filename = `${Date.now()}_${i}.jpg`;
        const reference = storage().ref(`locker_images/${phone}/${filename}`);
        await reference.putFile(images[i]);
        const url = await reference.getDownloadURL();
        urls.push(url);
      } catch (e) {
        console.log("Upload failed", e);
      }
    }
    return urls;
  };

  const handleSave = async () => {
    Keyboard.dismiss();
    const newErrors: Record<string, string> = {};

    if (!category) newErrors.category = t.errors.category || "Please select category";
    if (category && category !== "other" && !crop.trim()) newErrors.crop = t.errors.crop;
    if (!brandName.trim()) newErrors.brandName = t.errors.brandName;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const phone = await AsyncStorage.getItem("USER_PHONE");
      if (!phone) throw new Error("No phone");

      const uploadedUrls = await uploadImages(phone);

      const userDoc = await firestore().collection("users").doc(phone).get();
      const activeSession = userDoc.data()?.activeSession || null;

      const lockerData = {
        type: category,
        crop: category === "other" ? "" : crop.trim(),
        brandName: brandName.trim(),
        price: price ? parseFloat(price) : null,
        notes: notes.trim(),
        session: activeSession,
        imageUrls: uploadedUrls,
        imageUrl: uploadedUrls.length > 0 ? uploadedUrls[0] : null, // Backward compatibility
        createdAt: firestore.FieldValue.serverTimestamp(),
      };

      await firestore().collection("users").doc(phone).collection("locker").add(lockerData);
      await AsyncStorage.setItem("LOCKER_NEW_TAB", category as string);
      router.back();
    } catch (e) {
      console.log("Save error", e);
    } finally {
      setLoading(false);
    }
  };

  const getDynamicPricePlaceholder = () => {
    if (language === "te") {
      switch (category) {
        case "seed": return "ఒక్కో ప్యాకెట్ ధర (₹)";
        case "fertilizer": return "ఒక్కో బస్తా ధర (₹)";
        case "pesticide": return "ఒక్కో బాటిల్ / డబ్బా ధర (₹)";
        default: return "ఒక్కో వస్తువు ధర (₹)";
      }
    } else {
      switch (category) {
        case "seed": return "Price per Packet (₹)";
        case "fertilizer": return "Price per Bag (₹)";
        case "pesticide": return "Price per Bottle/Tin (₹)";
        default: return "Price per Item (₹)";
      }
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case "seed": return "#16A34A"; // Green
      case "fertilizer": return "#0284C7"; // Blue
      case "pesticide": return "#DC2626"; // Red
      case "other": return "#7C3AED"; // Purple
      default: return "#16A34A";
    }
  };

  const handleSelectCrop = (selected: string) => {
    if (selected.trim().length > 0) {
      setCrop(selected.trim());
      if (errors.crop) setErrors(prev => ({ ...prev, crop: "" }));
      setCropSearch("");
      setShowCropModal(false);
      setActiveInput(null);
      ExpoSpeechRecognitionModule.stop();
      setIsListening(false);
    }
  };

  const filteredModalCrops = userCrops.filter(c => c.toLowerCase().includes(cropSearch.toLowerCase()));

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <AppHeader title={t.title} subtitle={t.subtitle} language={language} onBack={() => router.back()} />

      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : undefined} 
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.container} 
          showsVerticalScrollIndicator={false} 
          keyboardShouldPersistTaps="handled"
        >

          {/* 🔥 OLD SESSION WARNING BANNER */}
          {activeSession && activeSession !== getCurrentSession() && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#FFFBEB", borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "#FDE68A" }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#FEF3C7", justifyContent: "center", alignItems: "center" }}>
                <Ionicons name="warning" size={22} color="#D97706" />
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={{ fontSize: 14, color: "#92400E", fontWeight: "600", marginBottom: 2 }} language={language}>
                  {language === "te" ? "పాత సాగు సంవత్సరం" : "Old Active Season"}
                </AppText>
                <AppText style={{ fontSize: 13, color: "#92400E", lineHeight: 18 }} language={language}>
                  {language === "te" 
                    ? `మీరు పాత సాగు సంవత్సరం (${activeSession}) లో వస్తువు వివరాలు నమోదు చేస్తున్నారు.` 
                    : `You are adding an item to an older season (${activeSession}).`}
                </AppText>
              </View>
            </View>
          )}
        
        {/* CATEGORY SELECTOR */}
        <TouchableOpacity 
          activeOpacity={0.7} 
          style={[styles.inputBox, errors.category && styles.inputError]} 
          onPress={() => setShowCatModal(true)}
        >
          <Ionicons name="grid-outline" size={20} color={category ? getCategoryColor(category) : "#9CA3AF"} />
          <View style={{ flex: 1, marginLeft: 12, justifyContent: 'center' }}>
            <AppText style={{ color: category ? "#1F2937" : "#9CA3AF", fontSize: 16, fontFamily: "Mandali" }}>
              {category ? (t[category as keyof typeof t] as string) : t.category}
            </AppText>
          </View>
          <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
        </TouchableOpacity>
        {errors.category && <AppText style={styles.errorText} language={language}>{errors.category}</AppText>}

        {/* PHOTO SECTION (PREMIUM) */}
        <View style={styles.photoSection}>
          <AppText style={styles.sectionTitle} language={language}>{t.photoTitle}</AppText>
          
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {images.map((imgUri, idx) => (
              <View key={idx} style={{ position: "relative" }}>
                <Image source={{ uri: imgUri }} style={{ width: 80, height: 80, borderRadius: 10, backgroundColor: "#E5E7EB" }} />
                <TouchableOpacity style={{ position: "absolute", top: -8, right: -8, backgroundColor: "#fff", borderRadius: 12 }} onPress={() => setImages(prev => prev.filter((_, i) => i !== idx))}>
                  <Ionicons name="close-circle" size={24} color="#DC2626" />
                </TouchableOpacity>
              </View>
            ))}
            
            {images.length < 2 && (
              <TouchableOpacity 
                style={[styles.uploadDashBox, { width: 80, height: 80 }]} 
                onPress={() => setPhotoModalVisible(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="cloud-upload-outline" size={28} color="#16A34A" />
              </TouchableOpacity>
            )}
          </View>
        </View>

          {/* INPUT FIELDS */}
          
          {category !== "other" && (
            <TouchableOpacity 
              activeOpacity={0.7} 
              style={[styles.inputBox, activeInput === "crop" && styles.inputFocused, errors.crop && styles.inputError]} 
              onPress={() => { setShowCropModal(true); setActiveInput("crop"); setCropSearch(""); if (errors.crop) setErrors({...errors, crop: ""}); }}
            >
              <Ionicons name="leaf-outline" size={20} color={crop ? "#16A34A" : "#9CA3AF"} />
              <View style={{ flex: 1, marginLeft: 12, justifyContent: 'center' }}>
                <AppText style={{ color: crop ? "#1F2937" : "#9CA3AF", fontSize: 16, fontFamily: "Mandali" }}>
                  {crop || t.crop}
                </AppText>
              </View>
              <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
          {errors.crop && <AppText style={styles.errorText} language={language}>{errors.crop}</AppText>}

          <TouchableOpacity 
            activeOpacity={1} 
            style={[styles.inputBox, { paddingRight: 8 }, activeInput === "brand" && styles.inputFocused, errors.brandName && styles.inputError]}
            onPress={() => { setActiveInput("brand"); }}
          >
            <Ionicons name="cube-outline" size={20} color={brandName || activeInput === "brand" ? "#16A34A" : "#9CA3AF"} />
            <View style={[styles.inputWrapper, { flex: 1, marginLeft: 12, marginRight: 8 }]}>
              {!brandName && activeInput !== "brand" && (
                <AppText style={styles.placeholder}>
                  {isListening && voiceTarget === "brand" ? (language === "te" ? "వింటున్నాను..." : "Listening...") : (category === "other" ? t.brandTitle : t.brandName)}
                </AppText>
              )}
              <TextInput
                value={brandName}
                onChangeText={(txt) => { setBrandName(txt); if (errors.brandName) setErrors({ ...errors, brandName: "" }); }}
                cursorColor="#16A34A"
                style={[styles.input, { display: brandName || activeInput === "brand" ? "flex" : "none" }]}
                onFocus={() => setActiveInput("brand")}
                onBlur={() => setActiveInput(null)}
                autoComplete="off"
                importantForAutofill="no"
                autoCorrect={false}
              />
            </View>
            <TouchableOpacity onPress={() => startVoice("brand")} style={{ padding: 6, borderRadius: 10 }}>
              <Ionicons name={isListening && voiceTarget === "brand" ? "mic" : "mic-outline"} size={24} color={isListening && voiceTarget === "brand" ? "#EF4444" : (activeInput === "brand" ? "#16A34A" : "#6B7280")} />
            </TouchableOpacity>
          </TouchableOpacity>
          {errors.brandName && <AppText style={styles.errorText} language={language}>{errors.brandName}</AppText>}

          <View style={[styles.inputBox, activeInput === "price" && styles.inputFocused]}>
            <Ionicons name="cash-outline" size={20} color={price ? "#16A34A" : "#9CA3AF"} />
            <View style={styles.inputWrapper}>
              <TextInput
                value={price}
                onChangeText={setPrice}
                placeholder={getDynamicPricePlaceholder()}
                placeholderTextColor="#9CA3AF"
                cursorColor="#16A34A"
                keyboardType="numeric"
                style={styles.input}
                onFocus={() => setActiveInput("price")}
                onBlur={() => setActiveInput(null)}
                autoComplete="off"
                importantForAutofill="no"
              />
            </View>
          </View>

          <TouchableOpacity activeOpacity={1} style={[styles.inputBox, { height: 120, alignItems: "flex-start", paddingTop: 14, paddingRight: 8 }, activeInput === "notes" && styles.inputFocused]} onPress={() => { setActiveInput("notes"); }}>
            <Ionicons name="document-text-outline" size={20} color={notes || activeInput === "notes" ? "#16A34A" : "#9CA3AF"} style={{ marginTop: 4 }} />
            <View style={[styles.inputWrapper, { flex: 1, marginLeft: 12, marginRight: 8, justifyContent: "flex-start" }]}>
              {!notes && activeInput !== "notes" && (
                <AppText style={[styles.placeholder, { top: 4 }]}>{isListening && voiceTarget === "notes" ? (language === "te" ? "వింటున్నాను..." : "Listening...") : t.notes}</AppText>
              )}
              <TextInput
                value={notes}
                onChangeText={setNotes}
                cursorColor="#16A34A"
                style={[styles.input, { height: 90, textAlignVertical: "top", paddingTop: 0, display: notes || activeInput === "notes" ? "flex" : "none" }]}
                onFocus={() => setActiveInput("notes")}
                onBlur={() => setActiveInput(null)}
                autoComplete="off"
                importantForAutofill="no"
                multiline
              />
            </View>
            <TouchableOpacity onPress={() => startVoice("notes")} style={{ padding: 6, borderRadius: 10, marginTop: -4 }}>
              <Ionicons name={isListening && voiceTarget === "notes" ? "mic" : "mic-outline"} size={24} color={isListening && voiceTarget === "notes" ? "#EF4444" : (activeInput === "notes" ? "#16A34A" : "#6B7280")} />
            </TouchableOpacity>
          </TouchableOpacity>

          {/* SAVE BUTTON */}
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading} activeOpacity={0.8}>
            <LinearGradient colors={["#2E7D32", "#1B5E20"]} style={styles.saveGradient}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#fff" />
              <AppText style={styles.saveText}>{t.save}</AppText>
            </LinearGradient>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* PREMIUM PHOTO UPLOAD MODAL */}
      <Modal visible={photoModalVisible} transparent animationType="slide" statusBarTranslucent>
        <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }} activeOpacity={1} onPress={() => setPhotoModalVisible(false)}>
          <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#EFF6FF", justifyContent: "center", alignItems: "center", marginRight: 12 }}>
                  <Ionicons name="cloud-upload" size={22} color="#2563EB" />
                </View>
                <AppText style={{ fontSize: 18, fontWeight: "600", color: "#1F2937", fontFamily: "Mandali" }}>
                  {language === "te" ? "ఫోటో అప్లోడ్ చేయండి" : "Upload Photo"}
                </AppText>
              </View>
              <TouchableOpacity onPress={() => setPhotoModalVisible(false)} hitSlop={{top:10, bottom:10, left:10, right:10}}>
                <Ionicons name="close" size={26} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#F9FAFB", padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: "#F3F4F6" }} activeOpacity={0.8} onPress={async () => {
              setPhotoModalVisible(false);
              setTimeout(() => pickImage("camera"), 500);
            }}>
              <View style={[{ width: 48, height: 48, borderRadius: 12, justifyContent: "center", alignItems: "center", marginRight: 16 }, { backgroundColor: "#EFF6FF" }]}><Ionicons name="camera" size={24} color="#3B82F6" /></View>
              <View>
                <AppText style={{ fontSize: 16, fontWeight: "600", color: "#1F2937", fontFamily: "Mandali" }}>{language === "te" ? "కెమెరా ద్వారా" : "Take Photo"}</AppText>
                <AppText style={{ fontSize: 13, color: "#6B7280", marginTop: 2, fontFamily: "Mandali" }}>{language === "te" ? "ఇప్పుడే ఫోటో తీయండి" : "Capture a live photo"}</AppText>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#F9FAFB", padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: "#F3F4F6" }} activeOpacity={0.8} onPress={async () => {
              setPhotoModalVisible(false);
              setTimeout(() => pickImage("gallery"), 500);
            }}>
              <View style={[{ width: 48, height: 48, borderRadius: 12, justifyContent: "center", alignItems: "center", marginRight: 16 }, { backgroundColor: "#F0FDF4" }]}><Ionicons name="images" size={24} color="#16A34A" /></View>
              <View>
                <AppText style={{ fontSize: 16, fontWeight: "600", color: "#1F2937", fontFamily: "Mandali" }}>{language === "te" ? "గ్యాలరీ నుండి" : "Gallery"}</AppText>
                <AppText style={{ fontSize: 13, color: "#6B7280", marginTop: 2, fontFamily: "Mandali" }}>{language === "te" ? "పాత ఫోటో ఎంచుకోండి" : "Choose an existing photo"}</AppText>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* CATEGORY MODAL */}
      <Modal visible={showCatModal} transparent animationType="fade">
        <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 }} activeOpacity={1} onPress={() => setShowCatModal(false)}>
          <View style={{ width: "100%", backgroundColor: "#fff", borderRadius: 16, padding: 20 }}>
            <AppText style={{ fontSize: 18, fontWeight: "600", color: "#1F2937", marginBottom: 16, fontFamily: "Mandali" }}>
              {t.category}
            </AppText>
            {(["seed", "fertilizer", "pesticide", "other"] as const).map((cat) => (
              <TouchableOpacity
                key={cat}
                style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" }}
                onPress={() => {
                  setCategory(cat);
                  setShowCatModal(false);
                  setErrors({ ...errors, category: "" });
                }}
              >
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: getCategoryColor(cat) + "20", justifyContent: "center", alignItems: "center", marginRight: 12 }}>
                  <Ionicons name="grid-outline" size={20} color={getCategoryColor(cat)} />
                </View>
                <AppText style={{ fontSize: 16, color: "#4B5563", fontFamily: "Mandali" }}>{t[cat as keyof typeof t] as string}</AppText>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* CROP SELECTION MODAL */}
      <Modal visible={showCropModal} transparent animationType="slide" onRequestClose={() => {
        setShowCropModal(false);
        setActiveInput(null);
        ExpoSpeechRecognitionModule.stop();
        setIsListening(false);
      }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <AppText style={{ fontSize: 18, fontWeight: "600", fontFamily: "Mandali" }}>
                {t.crop}
              </AppText>
              <TouchableOpacity onPress={() => { 
                setShowCropModal(false); 
                setActiveInput(null); 
                setCropSearch(""); 
                ExpoSpeechRecognitionModule.stop(); 
                setIsListening(false);
              }}>
                <Ionicons name="close-circle" size={30} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBar}>
              <TextInput
                autoFocus
                value={cropSearch}
                onChangeText={setCropSearch}
                placeholder={language === "te" ? "వెతకండి..." : "Search or Type..."}
                placeholderTextColor={'#9CA3AF'}
                cursorColor={'#16A34A'}
                style={[styles.searchInput, { fontFamily: 'Mandali' }]}
              />
              <TouchableOpacity onPress={() => startVoice()} style={{ marginLeft: 8, padding: 6, borderRadius: 10, backgroundColor: "#eaedf2" }}>
                <Ionicons name={isListening ? "mic" : "mic-outline"} size={24} color={isListening ? "#EF4444" : "#16A34A"} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={filteredModalCrops}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={() => (
                  <View style={{ padding: 20, alignItems: "center" }}>
                    <View style={{ padding: 20, alignItems: 'center' }}>
                      <Ionicons name="information-circle-outline" size={24} color="#6B7280" style={{ marginBottom: 10 }} />
                      <AppText style={{ color: "#4B5563", textAlign: "center", fontSize: 15, fontWeight: '500', lineHeight: 22 }}>
                        {language === "te" ? "మొదట 'నా పొలాలు' విభాగంలో\nపంట వివరాలను నమోదు చేయండి." : "First, register your crop details in the\n'My Fields' section."}
                      </AppText>
                      <AppText style={{ color: "#9CA3AF", textAlign: "center", fontSize: 13, marginTop: 8 }}>
                        {language === "te" ? "అక్కడ జోడించిన పంటలు మాత్రమే ఇక్కడ కనిపిస్తాయి." : "Only crops added there will appear here for selection."}
                      </AppText>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => {
                          setShowCropModal(false);
                          router.push("/farmer/fields"); 
                        }}
                        style={{ marginTop: 16, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#16A34A", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 }}
                      >
                        <Ionicons name="add-circle-outline" size={18} color="#fff" />
                        <AppText style={{ color: "#fff", fontWeight: "600" }}>
                          {language === "te" ? "పంట జోడించండి" : "Add Crop"}
                        </AppText>
                      </TouchableOpacity>
                    </View>
                  </View>
              )}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.item}
                  onPress={() => handleSelectCrop(item)}
                >
                  <AppText style={styles.itemText}>{item}</AppText>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      <AgriLoader visible={loading} type="saving" language={language} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6F7F6" },
  container: { padding: 20, paddingBottom: 120 }, 
  
  catContainer: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  catBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: "#E5E7EB" },
  catText: { fontSize: 14, color: "#4B5563", fontWeight: "600" },
  catTextActive: { color: "#fff" },

  photoSection: { marginBottom: 20, backgroundColor: "#fff", padding: 15, borderRadius: 16, borderWidth: 1, borderColor: "#E5E7EB" },
  sectionTitle: { fontSize: 14, color: "#6B7280", marginBottom: 10, fontWeight: "600" },
  uploadDashBox: { height: 100, borderRadius: 12, borderWidth: 1.5, borderColor: "#16A34A", borderStyle: "dashed", backgroundColor: "#F0FDF4", justifyContent: "center", alignItems: "center" },
  uploadText: { color: "#16A34A", fontWeight: "600", fontSize: 14, marginTop: 8 },
  
  imagePreviewContainer: { position: "relative", width: "100%", height: 180, borderRadius: 12, overflow: "hidden" },
  imagePreview: { width: "100%", height: "100%", resizeMode: "cover" },
  removeImgBtn: { position: "absolute", top: 10, right: 10, backgroundColor: "rgba(0,0,0,0.5)", width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center" },

  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    paddingHorizontal: 15,
    minHeight: 55,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#D1D5DB" 
  },
  inputFocused: { 
    borderColor: "#16A34A",
    backgroundColor: "#FFFFFF"
  },
  inputError: { borderColor: "#EF4444" },
  errorText: { color: "#EF4444", fontSize: 12, fontFamily: "Mandali", marginTop: -10, marginBottom: 10, marginLeft: 4 },
  inputWrapper: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  input: { flex: 1, fontSize: 16, color: "#1F2937", fontFamily: "Mandali", textAlignVertical: "center", includeFontPadding: false },
  placeholder: { position: "absolute", fontSize: 16, color: "#9CA3AF", fontFamily: "Mandali" },

  saveBtn: { marginTop: 10, borderRadius: 18, overflow: "hidden", elevation: 6, shadowColor: "#1B5E20", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 8 },
  saveGradient: { height: 56, justifyContent: "center", alignItems: "center", flexDirection: "row", gap: 8 },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "600" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#fff", height: "70%", borderTopLeftRadius: 25, borderTopRightRadius: 25 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", padding: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', alignItems: "center" },
  searchBar: {
    flexDirection: "row",
    margin: 20,
    backgroundColor: "#F3F4F6",
    borderRadius: 18,
    paddingHorizontal: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB"
  },
  searchInput: { flex: 1, height: 54, fontSize: 16, fontFamily: 'Mandali' },
  item: { padding: 20, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  itemText: { fontSize: 17, fontFamily: "Mandali" },
});
