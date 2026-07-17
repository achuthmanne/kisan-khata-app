import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import { executeOfflineSafeRead, executeOfflineSafeWrite } from "@/utils/offlineHelper";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  Image
} from "react-native";
import MapView from "react-native-maps";

import AgriLoader from "@/components/AgriLoader";
import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent
} from "expo-speech-recognition";

export default function AddMachine() {
  const router = useRouter();
  const { machineId } = useLocalSearchParams(); 
  const isEditing = !!machineId; 
  const [language, setLanguage] = useState<"te" | "en">("en");
  
  const mapRef = useRef<MapView>(null);

  const [activeInput, setActiveInput] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({}); 
  const [isListening, setIsListening] = useState(false);
  const [voiceTarget, setVoiceTarget] = useState<string | null>(null);
  
  const [listingType, setListingType] = useState<"machine" | "labor">("machine");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [listingName, setListingName] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploadRatio, setUploadRatio] = useState<number>(4/3);
  const [serviceType, setServiceType] = useState<"Rent" | "Work" | "Both" | "">("");
  
  const [showImageModal, setShowImageModal] = useState(false);
  
  const [statusModal, setStatusModal] = useState<{
    visible: boolean;
    type: "success" | "error" | "warning";
    message: string;
  }>({ visible: false, type: "success", message: "" });
  const [successModal, setSuccessModal] = useState(false);
  
  const [coords, setCoords] = useState<any>(null);
  const [locationText, setLocationText] = useState(
    language === "te" ? "స్థానాన్ని పొందుతోంది..." : "Fetching location..."
  );
  const [loading, setLoading] = useState(false);

  const [showMapModal, setShowMapModal] = useState(false);

  const nameRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const listingNameRef = useRef<TextInput>(null);

  useEffect(() => {
    AsyncStorage.getItem("APP_LANG").then((l) => {
      if (l) setLanguage(l as any);
    });
  }, []);

  useEffect(() => {
    if (isEditing) {
      fetchMachineData();
    }
  }, [machineId]);

  const fetchMachineData = async () => {
    if (!machineId) return;
    try {
      const doc = await executeOfflineSafeRead(firestore().collection("machines").doc(machineId as string), true);
      const data = doc.data(); 
      if (data) {
        setListingType(data.listingType || "machine");
        setOwnerName(data.ownerName || "");
        setPhone(data.phone || "");
        setListingName(data.listingName || data.equipment || "");
        setImageUri(data.imageUri || data.image || null);
        setServiceType(data.serviceType || "");
        setLocationText(data.village || "");
        
        if (data.latitude && data.longitude) {
          setCoords({ latitude: data.latitude, longitude: data.longitude });
        }
      }
    } catch (e) {
      console.log("Fetch Error:", e);
    }
  };

  const translateToTelugu = useCallback(async (text: string) => {
    try {
      const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=te&dt=t&q=${encodeURIComponent(text)}`);
      const data = await res.json();
      return data[0][0][0];
    } catch {
      return text;
    }
  }, []);

  const fetchAddressFromCoords = async (lat: number, lon: number) => {
    try {
      setLocationText(language === "te" ? "స్థానాన్ని పొందుతోంది..." : "Fetching location...");
      const address = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
      
      if (!address || address.length === 0) {
        setLocationText(language === "te" ? "లొకేషన్ వివరాలు దొరకలేదు" : "Location details not found");
        return;
      }

      const place = address[0];
      const isPlusCode = (text: string) => /\+/.test(text || "") && /[0-9]/.test(text || "");

      let parts = [];
      if (place.name && !isPlusCode(place.name)) parts.push(place.name);
      else if (place.street && !isPlusCode(place.street)) parts.push(place.street);

      if (place.subregion) parts.push(place.subregion);
      else if (place.city) parts.push(place.city);
      else if (place.district) parts.push(place.district);

      parts = [...new Set(parts)].filter(Boolean);
      let fullLocation = parts.join(", ");
      
      if (!fullLocation) fullLocation = language === "te" ? "లొకేషన్ దొరకలేదు" : "Location not found";

      if (language === "te") {
        try {
          const translated = await translateToTelugu(fullLocation);
          setLocationText(translated || fullLocation);
        } catch {
          setLocationText(fullLocation);
        }
      } else {
        setLocationText(fullLocation);
      }
    } catch (error) {
      setLocationText(language === "te" ? "లొకేషన్ పొందడంలో లోపం" : "Error getting location");
    }
  };

  const fetchLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationText(language === "te" ? "లొకేషన్ అనుమతి ఇవ్వలేదు" : "Location permission denied");
        return;
      }
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        setLocationText(language === "te" ? "GPS ఆఫ్‌లో ఉంది" : "GPS is turned off");
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      setCoords(loc.coords);
      
      mapRef.current?.animateToRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.002,
        longitudeDelta: 0.002,
      }, 1000);

      fetchAddressFromCoords(loc.coords.latitude, loc.coords.longitude);
      if (errors.location) setErrors({ ...errors, location: "" });
    } catch (error) {
      setLocationText(language === "te" ? "లొకేషన్ దొరకలేదు" : "Location not found");
    }
  };

  const handleRegionChangeComplete = (region: any) => {
    setCoords({ latitude: region.latitude, longitude: region.longitude });
    fetchAddressFromCoords(region.latitude, region.longitude);
    if (errors.location) setErrors({ ...errors, location: "" });
  };

  useEffect(() => {
    if (!isEditing) fetchLocation();
  }, [language]);

  const startVoice = async (target: string) => {
    try {
      ExpoSpeechRecognitionModule.stop();
      const res = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!res.granted) return;
      
      setVoiceTarget(target);
      setActiveInput(target);
      setIsListening(true);
      
      ExpoSpeechRecognitionModule.start({
        lang: language === "te" ? "te-IN" : "en-US",
        interimResults: true,
      });
    } catch (e) {
      console.log("Voice error", e);
    }
  };

  useSpeechRecognitionEvent("result", (event) => {
    if (!isListening || !event.results?.length) return;
    
    const text = event.results[0].transcript;
    switch (voiceTarget) {
      case "name": 
        setOwnerName(text); 
        if(errors.ownerName) setErrors({...errors, ownerName: ""});
        break;
      case "phone": 
        setPhone(text.replace(/\D/g, "")); 
        if(errors.phone) setErrors({...errors, phone: ""});
        break;
      case "listingName": 
        setListingName(text); 
        if(errors.listingName) setErrors({...errors, listingName: ""});
        break;
    }
  });

  useSpeechRecognitionEvent("end", () => {
    setIsListening(false);
    setVoiceTarget(null);
  });

  useEffect(() => {
    return () => { ExpoSpeechRecognitionModule.stop(); };
  }, []);

  const handlePickImage = async (useCamera: boolean) => {
    try {
      setShowImageModal(false);
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.2, 
        base64: false, 
      };
      
      let result;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') return;
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return;
        result = await ImagePicker.launchImageLibraryAsync(options);
      }
        
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImageUri(result.assets[0].uri);
        if (result.assets[0].width && result.assets[0].height) {
           setUploadRatio(result.assets[0].width / result.assets[0].height);
        }
        if (errors.image) setErrors({...errors, image: ""});
      }
    } catch (error) {
      console.log("Image Pick Error:", error);
    }
  };

  const handleSave = async () => {
    if (loading) return;

    const newErrors: any = {};
    if (!ownerName.trim()) newErrors.ownerName = language === "te" ? "యజమాని పేరు నమోదు చేయండి*" : "Enter owner name*";
    
    if (!phone.trim()) {
      newErrors.phone = language === "te" ? "ఫోన్ నంబర్ నమోదు చేయండి*" : "Enter phone number*";
    } else if (!/^[6-9]\d{9}$/.test(phone.trim())) {
      newErrors.phone = language === "te" ? "సరైన ఫోన్ నంబర్ ఇవ్వండి*" : "Enter valid phone number*";
    }

    if (!listingName.trim()) newErrors.listingName = language === "te" ? "వివరాలు నమోదు చేయండి*" : "Enter listing name*";
    if (!imageUri) newErrors.image = language === "te" ? "ఒక ఫోటో ఎంచుకోండి*" : "Upload an image*";
    if (listingType === "machine" && !serviceType) newErrors.serviceType = language === "te" ? "అందుబాటు విధానాన్ని ఎంచుకోండి*" : "Select availability mode*";
    if (!coords) newErrors.location = language === "te" ? "లొకేషన్ దొరకలేదు, దయచేసి మ్యాప్ లో ఎంచుకోండి*" : "Location not found, select on map*";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    const userPhone = await AsyncStorage.getItem("USER_PHONE");
    if (!userPhone) return;

    setLoading(true);

    try {
      let finalImageUri = imageUri;

      // Upload image to Firebase Storage if it's a new local file
      if (imageUri && !imageUri.startsWith("http")) {
        const fileName = `machineImages/${userPhone}_${Date.now()}.jpg`;
        const reference = storage().ref(fileName);
        await reference.putFile(imageUri);
        finalImageUri = await reference.getDownloadURL();
      }

      const machineData = {
        ownerName: ownerName.trim(),
        phone: phone.trim(),
        listingType,
        listingName: listingName.trim(),
        imageUri: finalImageUri,
        serviceType: listingType === "labor" ? "Work" : serviceType, 
        latitude: coords.latitude,
        longitude: coords.longitude,
        village: locationText,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };

      const ref = firestore().collection("machines");

      if (isEditing) {
        await executeOfflineSafeWrite(ref.doc(machineId as string).update(machineData));
      } else {
        await executeOfflineSafeWrite(ref.add({
          ...machineData,
          userId: userPhone,
          createdAt: firestore.FieldValue.serverTimestamp(),
        }));
      }

      setLoading(false);
      setSuccessModal(true);
    } catch (e) {
      setLoading(false);
      setStatusModal({
        visible: true,
        type: "error",
        message: language === "te" ? "సర్వర్ సమస్య, మళ్ళీ ప్రయత్నించండి." : "Server error, please try again."
      });
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <AppHeader
        title={isEditing ? (language === "te" ? "వివరాలు సవరించండి" : "Edit Listing") : (language === "te" ? "వివరాలు జోడించండి" : "Add Listing")}
        subtitle={language === "te" ? "వివరాలు నమోదు చేయండి" : "Enter details"}
        language={language}
      />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.container}>
            
            {/* 🔄 LISTING TYPE TOGGLE */}
            <View style={styles.toggleContainer}>
              <TouchableOpacity 
                activeOpacity={0.8}
                onPress={() => setListingType("machine")}
                style={[styles.toggleBtn, listingType === "machine" && styles.toggleActive]}
              >
                <MaterialCommunityIcons name="tractor" size={20} color={listingType === "machine" ? "#FFFFFF" : "#6B7280"} />
                <AppText style={[styles.toggleText, listingType === "machine" && styles.toggleTextActive]}>
                  {language === "te" ? "యంత్రం / వాహనం" : "Machine / Vehicle"}
                </AppText>
              </TouchableOpacity>
              <TouchableOpacity 
                activeOpacity={0.8}
                onPress={() => setListingType("labor")}
                style={[styles.toggleBtn, listingType === "labor" && styles.toggleActive]}
              >
                <MaterialCommunityIcons name="account-hard-hat" size={20} color={listingType === "labor" ? "#FFFFFF" : "#6B7280"} />
                <AppText style={[styles.toggleText, listingType === "labor" && styles.toggleTextActive]}>
                  {language === "te" ? "కూలీ / ముఠా" : "Manual Labor"}
                </AppText>
              </TouchableOpacity>
            </View>

            {/* 👤 NAME INPUT */}
            <TouchableOpacity
              style={[styles.inputBox, activeInput === "name" && styles.inputFocused, errors.ownerName && styles.inputError]}
              activeOpacity={1}
              onPress={() => { setActiveInput("name"); nameRef.current?.focus(); }}
            >
              <Ionicons name="person-outline" size={20} color={ownerName || activeInput === "name" ? "#16A34A" : "#9CA3AF"} />
              <View style={styles.inputWrapper}>
                {!ownerName && activeInput !== "name" && (
                  <AppText style={styles.placeholder}>
                    {isListening && voiceTarget === "name" ? (language === "te" ? "వింటున్నాను..." : "Listening...") : (language === "te" ? "మీ పేరు*" : "Your Name*")}
                  </AppText>
                )}
                <TextInput
                  ref={nameRef}
                  value={ownerName}
                  onChangeText={(txt) => { setOwnerName(txt); if (errors.ownerName) setErrors({ ...errors, ownerName: "" }); }}
                  style={styles.input}
                  cursorColor={'#16A34A'}
                  selectionColor={'#16A34A40'}
                  onFocus={() => setActiveInput("name")}
                  onBlur={() => setActiveInput(null)}
                />
              </View>
              {ownerName && ownerName.trim().length > 0 ? (
                <TouchableOpacity onPress={() => setOwnerName("")} style={styles.micBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close-circle" size={24} color="#9CA3AF" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => startVoice("name")} style={styles.micBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <MaterialCommunityIcons name={isListening && voiceTarget === "name" ? "microphone" : "microphone-outline"} size={24} color={isListening && voiceTarget === "name" ? "#EF4444" : (activeInput === "name" ? "#16A34A" : "#6B7280")} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
            {errors.ownerName && <AppText style={styles.errorText} language={language}>{errors.ownerName}</AppText>}

            {/* 📞 PHONE INPUT */}
            <TouchableOpacity
              style={[styles.inputBox, activeInput === "phone" && styles.inputFocused, errors.phone && styles.inputError]}
              activeOpacity={1}
              onPress={() => { setActiveInput("phone"); phoneRef.current?.focus(); }}
            >
              <Ionicons name="call-outline" size={20} color={phone || activeInput === "phone" ? "#16A34A" : "#9CA3AF"} />
              <View style={styles.inputWrapper}>
                {!phone && activeInput !== "phone" && (
                  <AppText style={styles.placeholder}>
                    {isListening && voiceTarget === "phone" ? (language === "te" ? "వింటున్నాను..." : "Listening...") : (language === "te" ? "ఫోన్ నంబర్*" : "Phone Number*")}
                  </AppText>
                )}
                <TextInput
                  ref={phoneRef}
                  value={phone}
                  onChangeText={(txt) => { setPhone(txt); if (errors.phone) setErrors({ ...errors, phone: "" }); }}
                  cursorColor={'#16A34A'}
                  selectionColor={'#16A34A40'}
                  keyboardType="numeric"
                  maxLength={10}
                  style={styles.input}
                  onFocus={() => setActiveInput("phone")}
                  onBlur={() => setActiveInput(null)}
                />
              </View>
              {phone && phone.trim().length > 0 ? (
                <TouchableOpacity onPress={() => setPhone("")} style={styles.micBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close-circle" size={24} color="#9CA3AF" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => startVoice("phone")} style={styles.micBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <MaterialCommunityIcons name={isListening && voiceTarget === "phone" ? "microphone" : "microphone-outline"} size={24} color={isListening && voiceTarget === "phone" ? "#EF4444" : (activeInput === "phone" ? "#16A34A" : "#6B7280")} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
            {errors.phone && <AppText style={styles.errorText} language={language}>{errors.phone}</AppText>}

            {/* 📝 CUSTOM LISTING NAME INPUT */}
            <TouchableOpacity
              style={[styles.inputBox, activeInput === "listingName" && styles.inputFocused, errors.listingName && styles.inputError]}
              activeOpacity={1}
              onPress={() => { setActiveInput("listingName"); listingNameRef.current?.focus(); }}
            >
              <MaterialCommunityIcons name={listingType === "machine" ? "tractor-variant" : "hammer-wrench"} size={20} color={listingName || activeInput === "listingName" ? "#16A34A" : "#9CA3AF"} />
              <View style={styles.inputWrapper}>
                {!listingName && activeInput !== "listingName" && (
                  <AppText style={styles.placeholder}>
                    {isListening && voiceTarget === "listingName" ? (language === "te" ? "వింటున్నాను..." : "Listening...") : (listingType === "machine" 
                      ? (language === "te" ? "యంత్రం పేరు (ఉదా: ట్రాక్టర్)*" : "Machine Name (e.g. Tractor)*") 
                      : (language === "te" ? "కూలీ / ముఠా పేరు (ఉదా: రాము గ్రూప్)*" : "Labor/Muta Name (e.g. Ramu Group)*"))}
                  </AppText>
                )}
                <TextInput
                  ref={listingNameRef}
                  value={listingName}
                  onChangeText={(txt) => { setListingName(txt); if (errors.listingName) setErrors({ ...errors, listingName: "" }); }}
                  style={styles.input}
                  cursorColor={'#16A34A'}
                  selectionColor={'#16A34A40'}
                  onFocus={() => setActiveInput("listingName")}
                  onBlur={() => setActiveInput(null)}
                />
              </View>
              {listingName && listingName.trim().length > 0 ? (
                <TouchableOpacity onPress={() => setListingName("")} style={styles.micBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close-circle" size={24} color="#9CA3AF" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => startVoice("listingName")} style={styles.micBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <MaterialCommunityIcons name={isListening && voiceTarget === "listingName" ? "microphone" : "microphone-outline"} size={24} color={isListening && voiceTarget === "listingName" ? "#EF4444" : (activeInput === "listingName" ? "#16A34A" : "#6B7280")} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
            {errors.listingName && <AppText style={styles.errorText} language={language}>{errors.listingName}</AppText>}

            {/* 📸 IMAGE UPLOAD SECTION */}
            <View style={{ marginBottom: 20 }}>
              <AppText style={styles.selectedTitle}>{language === "te" ? "ఒక ఫోటో జోడించండి*" : "Upload an Image*"}</AppText>
              
              {imageUri ? (
                <View style={[styles.uploadedImageBox, { aspectRatio: uploadRatio }]}>
                  <Image source={{ uri: imageUri }} style={styles.uploadedImage} />
                  <TouchableOpacity style={styles.removeImageBtn} onPress={() => setImageUri(null)}>
                    <Ionicons name="trash" size={20} color="white" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity activeOpacity={0.8} style={[styles.imageUploadBtn, errors.image && { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' }]} onPress={() => setShowImageModal(true)}>
                  <Ionicons name="camera-outline" size={32} color={errors.image ? "#DC2626" : "#6B7280"} />
                  <AppText style={{ color: errors.image ? "#DC2626" : "#6B7280", marginTop: 8, fontFamily: "Mandali" }}>
                    {language === "te" ? "ఫోటో అప్‌లోడ్ చేయడానికి ఇక్కడ నొక్కండి" : "Tap here to upload a photo"}
                  </AppText>
                </TouchableOpacity>
              )}
              {errors.image && <AppText style={[styles.errorText, { marginTop: 4, marginLeft: 0 }]} language={language}>{errors.image}</AppText>}
            </View>

            {/* 🔥 NEW SECTION: RENT OR WORK (SERVICE TYPE) - ONLY FOR MACHINES */}
            {listingType === "machine" && (
              <View style={{ marginBottom: 20 }}>
                <AppText style={styles.selectedTitle}>
                  {language === "te" ? "అందుబాటు విధానం*" : "Availability Mode*"}
                </AppText>
                
                <View style={styles.availRow}>
                  {[
                    { id: "Rent", en: "Rent Only", te: "అద్దెకు మాత్రమే", icon: "key-outline" },
                    { id: "Work", en: "Provide Service", te: "పనులకు వెళ్తాం", icon: "cog-outline" },
                    { id: "Both", en: "Rent & Service", te: "రెండింటికి", icon: "swap-horizontal-outline" }
                  ].map((opt) => {
                    const isActive = serviceType === opt.id;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        activeOpacity={0.7}
                        style={[styles.availCard, isActive && styles.availCardActive]}
                        onPress={() => {
                          setServiceType(opt.id as any);
                          if (errors.serviceType) setErrors({ ...errors, serviceType: "" });
                        }}
                      >
                        <Ionicons name={opt.icon as any} size={20} color={isActive ? "#16A34A" : "#6B7280"} />
                        <AppText style={[styles.availText, isActive && styles.availTextActive]}>
                          {language === "te" ? opt.te : opt.en}
                        </AppText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {errors.serviceType && <AppText style={[styles.errorText, { marginTop: 8, marginLeft: 0 }]} language={language}>{errors.serviceType}</AppText>}
              </View>
            )}

            {/* 📍 LOCATION */}
            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={() => { setShowMapModal(true); if (errors.location) setErrors({ ...errors, location: "" }); }}
              style={[styles.inputBox, { height: undefined, minHeight: 55, paddingVertical: 12, marginBottom: 8 }, !coords && { borderColor: '#FCA5A5' }, errors.location && styles.inputError]}
            >
              <Ionicons name="location" size={20} color={coords ? "#16A34A" : "#EF4444"} />
              <View style={[styles.inputWrapper, { paddingRight: 8 }]}>
                <AppText style={{ color: coords ? "#1F2937" : "#EF4444", fontSize: 14, fontFamily: "Mandali", lineHeight: 22 }}>{locationText}</AppText>
              </View>
              <View style={styles.blueMapBtn}>
                <MaterialCommunityIcons name="map-marker-radius" size={20} color="#2563EB" />
              </View>
            </TouchableOpacity>
            {errors.location && <AppText style={[styles.errorText, { marginTop: -4, marginBottom: 8 }]} language={language}>{errors.location}</AppText>}

            {/* ⚠️ LOCATION WARNING */}
            <View style={styles.locationNoteBox}>
              <Ionicons name="information-circle-outline" size={16} color="#B91C1C" />
              <AppText style={styles.locationNoteText}>
                {language === "te" ? `గమనిక: యంత్రం/కూలీలు ఉన్న చోట నుండి మాత్రమే వివరాలను నమోదు చేయండి. లొకేషన్ మార్చుకోవడానికి పైనున్న బ్లూ బటన్ ని నొక్కండి.` : `Note: Add details only when you are at the correct location. Click the blue map icon above to adjust your location.`}
              </AppText>
            </View>

            {/* SAVE BUTTON */}
            <TouchableOpacity activeOpacity={0.8} style={styles.saveBtn} onPress={() => handleSave()}>
              <LinearGradient colors={["#2E7D32", "#1B5E20"]} style={styles.saveGradient}>
                <AppText style={styles.saveText}>{isEditing ? (language === "te" ? "సవరించండి" : "Update Listing") : (language === "te" ? "నమోదు చేయండి" : "Register")}</AppText>
              </LinearGradient>
            </TouchableOpacity>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ---------------- MAP MODAL ---------------- */}
      <Modal visible={showMapModal} animationType="slide" transparent={false}>
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          {coords && (
            <MapView
              ref={mapRef}
              style={StyleSheet.absoluteFillObject}
              initialRegion={{ latitude: coords.latitude, longitude: coords.longitude, latitudeDelta: 0.002, longitudeDelta: 0.002 }}
              showsUserLocation={true}
              showsMyLocationButton={false} 
              onRegionChangeComplete={handleRegionChangeComplete}
            />
          )}

          <View style={styles.centerPinWrapper} pointerEvents="none">
            <Ionicons name="location-sharp" size={46} color="#DC2626" />
          </View>

          <View style={styles.mapTopArea}>
            <TouchableOpacity activeOpacity={0.8} onPress={() => setShowMapModal(false)} style={styles.simpleBackBtn}>
              <Ionicons name="chevron-back" size={24} color="#111827" />
            </TouchableOpacity>
          </View>

          <View style={styles.bottomContainer}>
            <TouchableOpacity activeOpacity={0.8} style={styles.simpleLocateBtn} onPress={fetchLocation}>
              <MaterialCommunityIcons name="crosshairs-gps" size={22} color="#2563EB" />
            </TouchableOpacity>

            <View style={styles.minimalBottomCard}>
              <View style={styles.addressRow}>
                <Ionicons name="location" size={24} color="#16A34A" style={{ marginTop: 2 }} />
                <AppText style={styles.minimalAddress}>{locationText}</AppText>
              </View>
              <TouchableOpacity activeOpacity={0.85} onPress={() => setShowMapModal(false)}>
                <LinearGradient colors={["#2E7D32", "#1B5E20"]} style={styles.minimalConfirmBtn}>
                  <AppText style={styles.minimalConfirmText}>{language === "te" ? "లొకేషన్ నిర్ధారించండి" : "Confirm Location"}</AppText>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 📸 IMAGE UPLOAD MODAL */}
      <Modal visible={showImageModal} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowImageModal(false)}>
          <View style={styles.imageActionSheet}>
            <View style={styles.sheetHandle} />
            
            <View style={styles.sheetHeaderRow}>
              <AppText style={styles.sheetTitle}>{language === "te" ? "ఫోటో ఎంచుకోండి" : "Select Photo"}</AppText>
              <TouchableOpacity onPress={() => setShowImageModal(false)} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <Ionicons name="close-circle" size={26} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity style={styles.sheetBtn} onPress={() => handlePickImage(true)}>
              <View style={[styles.sheetIconBox, { backgroundColor: "#DBEAFE" }]}>
                <Ionicons name="camera" size={24} color="#2563EB" />
              </View>
              <AppText style={styles.sheetBtnText}>{language === "te" ? "కెమెరా తెరవండి" : "Take Photo"}</AppText>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.sheetBtn} onPress={() => handlePickImage(false)}>
              <View style={[styles.sheetIconBox, { backgroundColor: "#D1FAE5" }]}>
                <Ionicons name="images" size={24} color="#059669" />
              </View>
              <AppText style={styles.sheetBtnText}>{language === "te" ? "గ్యాలరీ నుండి ఎంచుకోండి" : "Choose from Gallery"}</AppText>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* SUCCESS MODAL */}
      <Modal visible={successModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.successModalContent, { width: "85%", paddingVertical: 32, elevation: 15, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 20 }]}>
            <View style={[styles.successIconCircle, { width: 80, height: 80, borderRadius: 40, marginBottom: 20, backgroundColor: "#DCFCE7", borderWidth: 3, borderColor: "#16A34A" }]}>
              <Ionicons name="checkmark-done" size={44} color="#16A34A" />
            </View>
            <AppText style={[styles.successTitleText, { fontSize: 22, color: "#16A34A", textAlign: "center" }]}>
              {language === "te" ? "అభినందనలు! 🎉" : "Congratulations! 🎉"}
            </AppText>
            <AppText style={[styles.successSubText, { fontSize: 16, lineHeight: 24, marginTop: 10, marginBottom: 30, color: "#4B5563" }]}>
              {language === "te" 
                ? `మీ ${listingType === "labor" ? "కూలీల బృందం" : "యంత్రం"} కిసాన్ ఖాతాలో విజయవంతంగా నమోదైంది. మాతో చేరినందుకు ధన్యవాదాలు!` 
                : `Your ${listingType === "labor" ? "labour group" : "machine"} has been successfully registered on Kisan Khata. Thank you for joining us!`}
            </AppText>
            <TouchableOpacity activeOpacity={0.8} style={[styles.saveBtn, { width: "100%", marginTop: 10 }]} onPress={() => { setSuccessModal(false); router.back(); }}>
              <LinearGradient colors={["#16A34A", "#15803D"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.saveGradient}>
                <AppText style={styles.saveText}>{language === "te" ? "కొనసాగించండి" : "Continue"}</AppText>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* STATUS MODAL (ERRORS) */}
      <Modal visible={statusModal.visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.successModalContent}>
            <View style={[styles.successIconCircle, { backgroundColor: statusModal.type === "error" ? "#EF4444" : "#F59E0B" }]}>
              <Ionicons name={statusModal.type === "error" ? "close" : "warning"} size={40} color="white" />
            </View>
            <AppText style={styles.successTitleText}>{statusModal.type === "error" ? (language === "te" ? "లోపం" : "Error") : "Warning"}</AppText>
            <AppText style={styles.successSubText}>{statusModal.message}</AppText>
            <TouchableOpacity style={[styles.successOkBtn, { backgroundColor: statusModal.type === "error" ? "#EF4444" : "#F59E0B" }]} onPress={() => setStatusModal({ ...statusModal, visible: false })}>
              <AppText style={styles.successOkText}>{language === "te" ? "సరే" : "OK"}</AppText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <AgriLoader visible={loading} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F9FAFB" },
  scrollContainer: { paddingBottom: 40 },
  container: { padding: 16 },
  
  toggleContainer: {
    flexDirection: "row",
    backgroundColor: "#E5E7EB",
    borderRadius: 14,
    padding: 4,
    marginBottom: 15,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  toggleActive: {
    backgroundColor: "#1B5E20",
  },
  toggleText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280"
  },
  toggleTextActive: {
    color: "#ffffff",
    fontWeight: "600"
  },

  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 55,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#D1D5DB"
  },
  inputFocused: {
    borderColor: "#16A34A",
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inputError: { borderColor: "#EF4444" },
  inputWrapper: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#1F2937",
    fontFamily: "Mandali",
    textAlignVertical: "center",
    includeFontPadding: false,
  },
  placeholder: {
    position: "absolute",
    fontSize: 16,
    color: "#9CA3AF",
    fontFamily: "Mandali"
  },
  micBtn: { marginLeft: 10, padding: 4 },
  errorText: { color: "#EF4444", fontSize: 12, fontFamily: "Mandali", marginTop: -12, marginBottom: 12, marginLeft: 5 },

  imageUploadBtn: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    borderStyle: "dashed",
    borderRadius: 12,
    height: 120,
    justifyContent: "center",
    alignItems: "center"
  },
  uploadedImageBox: { width: "100%", borderRadius: 16, overflow: "hidden", position: "relative", borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: "#F9FAFB" },
  uploadedImage: { width: "100%", height: "100%", resizeMode: "cover" },
  removeImageBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center"
  },

  selectedTitle: { fontSize: 15, fontWeight: "600", color: "#374151", marginBottom: 10 },
  
  availRow: { flexDirection: "row", gap: 10 },
  availCard: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  availCardActive: { backgroundColor: "#F0FDF4", borderColor: "#16A34A" },
  availText: { fontSize: 12, color: "#4B5563", marginTop: 4, textAlign: "center" },
  availTextActive: { color: "#16A34A", fontWeight: "600" },

  blueMapBtn: { backgroundColor: "#EFF6FF", padding: 8, borderRadius: 8, marginLeft: 8 },

  locationNoteBox: { flexDirection: "row", backgroundColor: "#FEF2F2", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#FCA5A5", marginTop: 0, marginBottom: 15, alignItems: "center" },
  locationNoteText: { fontSize: 12, color: "#991B1B", fontFamily: "Mandali", marginLeft: 8, flex: 1, lineHeight: 18 },

  saveBtn: { marginTop: 5, borderRadius: 18, overflow: "hidden" },
  saveGradient: { height: 52, justifyContent: "center", alignItems: "center" },
  saveText: { color: "white", fontSize: 15, fontWeight: "600" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  imageActionSheet: { backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === "ios" ? 40 : 24 },
  sheetHandle: { width: 40, height: 4, backgroundColor: "#D1D5DB", borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  sheetHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  sheetTitle: { fontSize: 18, fontWeight: "600", color: "#1F2937" },
  sheetBtn: { flexDirection: "row", alignItems: "center", marginBottom: 16, backgroundColor: "#F9FAFB", padding: 16, borderRadius: 12 },
  sheetIconBox: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", marginRight: 16 },
  sheetBtnText: { fontSize: 16, color: "#1F2937", fontWeight: "500" },

  successModalContent: { backgroundColor: "white", margin: 30, borderRadius: 20, padding: 24, alignItems: "center", alignSelf: "center", width: "80%" },
  successIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#16A34A", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  successTitleText: { fontSize: 20, fontWeight: "600", color: "#1F2937", marginBottom: 8 },
  successSubText: { fontSize: 14, color: "#6B7280", textAlign: "center", marginBottom: 24, fontFamily: "Mandali" },
  successOkBtn: { backgroundColor: "#16A34A", paddingVertical: 12, paddingHorizontal: 40, borderRadius: 25 },
  successOkText: { color: "white", fontSize: 16, fontWeight: "600" },

  centerPinWrapper: { position: "absolute", top: "50%", left: "50%", marginLeft: -23, marginTop: -46, zIndex: 10 },
  mapTopArea: { position: "absolute", top: Platform.OS === "ios" ? 55 : (StatusBar.currentHeight || 24) + 15, left: 16, zIndex: 10 },
  simpleBackBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "white", justifyContent: "center", alignItems: "center", elevation: 5, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  bottomContainer: { position: "absolute", bottom: 0, width: "100%", padding: 16, paddingBottom: Platform.OS === "ios" ? 30 : 16, zIndex: 10 },
  simpleLocateBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: "white", justifyContent: "center", alignItems: "center", alignSelf: "flex-end", marginBottom: 16, elevation: 4, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  minimalBottomCard: { backgroundColor: "white", borderRadius: 16, padding: 12, elevation: 10, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: -4 } },
  addressRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 16 },
  minimalAddress: { flex: 1, fontSize: 14, color: "#1F2937", marginLeft: 10, fontFamily: "Mandali", lineHeight: 22 },
  minimalConfirmBtn: { paddingVertical: 10, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  minimalConfirmText: { color: "white", fontSize: 14, fontWeight: "600" },
});