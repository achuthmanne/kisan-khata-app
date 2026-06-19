// app/vehicle-farmers/add-farmer.tsx

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { executeOfflineSafeRead, executeOfflineSafeWrite } from "@/utils/offlineHelper";
import * as Contacts from 'expo-contacts';
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import AgriLoader from "@/components/AgriLoader";
import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";

const getStr = (val: string | string[] | undefined) => (Array.isArray(val) ? val[0] : val || "");

export default function AddWork() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const isMounted = useRef(true); 
  
  const vehicleId = getStr(params.vehicleId);
  const editId = getStr(params.editId);
  const hasRecords = getStr(params.hasRecords);
  
  const isLocked = hasRecords === "true";

  const [name, setName] = useState(getStr(params.name));
  const [phone, setPhone] = useState(getStr(params.phone));
  const [village, setVillage] = useState(getStr(params.village));

  const [activeSession, setActiveSession] = useState("");
  const [activeInput, setActiveInput] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({}); 
  const [loading, setLoading] = useState(false);

  const [language, setLanguage] = useState<"te" | "en">("te");
  
  // 🔥 Lock Info & Duplicate Modal States
  const [showLockInfo, setShowLockInfo] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  // 🔥 CONTACTS STATES
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<any[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(false);

  const nameRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const villageRef = useRef<TextInput>(null);

  const placeholders = {
    en: {
      name: "Full Name*",
      phone: "Phone Number*",
      village: "Village Name*"
    },
    te: {
      name: "రైతు పూర్తి పేరు*",
      phone: "ఫోన్ నంబర్*",
      village: "గ్రామం పేరు*"
    }
  };

  const t = placeholders[language] || placeholders.en;
  const [isListening, setIsListening] = useState(false);

  useSpeechRecognitionEvent("result", (event) => {
    if (!isMounted.current) return;
    if (event.results && event.results.length > 0) {
      const transcript = event.results[0].transcript;
      if (activeInput === "name" && !isLocked) {
        setName(transcript);
        if (errors.name) setErrors({ ...errors, name: "" });
      }
      else if (activeInput === "village") {
        setVillage(transcript);
        if (errors.village) setErrors({ ...errors, village: "" });
      }
      // 🔥 VOICE SEARCH FOR CONTACTS
      else if (activeInput === "contactSearch") {
        setContactSearch(transcript);
        if(transcript.trim() === "") {
          setFilteredContacts(contacts);
        } else {
          const lower = transcript.toLowerCase();
          setFilteredContacts(contacts.filter(c => c.name?.toLowerCase().includes(lower)));
        }
      }
    }
  });

  useSpeechRecognitionEvent("end", () => {
    if (isMounted.current) setIsListening(false);
  });

  const handleVoiceInput = async (target: string) => {
    if (target === "name" && isLocked) {
      setShowLockInfo(true);
      return;
    }

    setActiveInput(target);
    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!result.granted) return;

    setIsListening(true);
    ExpoSpeechRecognitionModule.start({
      lang: language === "te" ? "te-IN" : "en-US",
      interimResults: true,
    });
  };

  /* ---------------- OPEN CONTACTS LOGIC ---------------- */
  const handleOpenContacts = async () => {
    // 🔥 PRO FIX: ఇక్కడ లాక్ ఉన్నా కూడా కాంటాక్ట్స్ ఓపెన్ అవ్వాలి, ఎందుకంటే వాళ్ళు నంబర్ మార్చుకోవచ్చు!
    try {
      setLoadingContacts(true);
      const { status } = await Contacts.requestPermissionsAsync();

      if (status === 'granted') {
        const { data } = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.PhoneNumbers],
          sort: Contacts.SortTypes.FirstName
        });

        if (data.length > 0) {
          const validContacts = data.filter(c => c.phoneNumbers && c.phoneNumbers.length > 0);
          setContacts(validContacts);
          setFilteredContacts(validContacts);
          setShowContactsModal(true);
        } else {
          Alert.alert(
            language === 'te' ? "నంబర్లు లేవు" : "No Contacts Found", 
            language === 'te' ? "మీ ఫోన్ లో నంబర్లు లేవు." : "Your phonebook is empty."
          );
        }
      } else {
        Alert.alert(
          language === 'te' ? "పర్మిషన్ అవసరం!" : "Permission Required!",
          language === 'te' ? "ఫోన్ నంబర్లను సులభంగా యాడ్ చేయడానికి పర్మిషన్ కావాలి. దయచేసి సెట్టింగ్స్ లోకి వెళ్లి 'Contacts' పర్మిషన్ ఆన్ చేయండి." : "Please enable Contacts permission in Settings to easily add farmers.",
          [
            { text: language === 'te' ? "వద్దు" : "Cancel", style: "cancel" },
            { text: language === 'te' ? "సెట్టింగ్స్" : "Settings", onPress: () => Linking.openSettings() }
          ]
        );
      }
    } catch (error) {
      console.log("Contacts Error: ", error);
    } finally {
      if (isMounted.current) setLoadingContacts(false);
    }
  };

  const selectContact = (contact: any) => {
    if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
      let rawNum = contact.phoneNumbers[0].number || "";
      let cleanNum = rawNum.replace(/\D/g, ''); 
      
      if (cleanNum.length > 10 && cleanNum.startsWith('91')) {
        cleanNum = cleanNum.slice(2);
      } else if (cleanNum.length > 10) {
        cleanNum = cleanNum.slice(-10);
      }

      // 🔥 PRO FIX: లాక్ అయి ఉంటే పేరు అప్‌డేట్ అవ్వదు, కేవలం ఫోన్ నంబర్ మాత్రమే అప్‌డేట్ అవుతుంది!
      if (!isLocked) {
        setName(contact.name || "");
        setErrors(prev => ({...prev, name: ""}));
      }

      setPhone(cleanNum);
      setErrors(prev => ({...prev, phone: ""}));
    }
    setShowContactsModal(false);
    setContactSearch("");
  };

  /* ---------------- LOAD ---------------- */
  useEffect(() => {
    isMounted.current = true;
    
    AsyncStorage.getItem("APP_LANG").then((l) => {
      if (l && isMounted.current) setLanguage(l as any);
    });

    const fetchSession = async () => {
      const userPhone = await AsyncStorage.getItem("USER_PHONE");
      if (!userPhone) return;
      const doc = await executeOfflineSafeRead(firestore().collection("users").doc(userPhone));
      if (isMounted.current) {
        setActiveSession(doc.data()?.activeSession || "");
      }
    };
    fetchSession();

    return () => {
      isMounted.current = false;
      ExpoSpeechRecognitionModule.stop();
    };
  }, []);

  const getCurrentSession = () => {
    const now = new Date();
    const year = now.getFullYear();
    const startYear = now.getMonth() >= 5 ? year : year - 1;
    return `${startYear}-${(startYear + 1).toString().slice(-2)}`;
  };

  /* ---------------- SAVE ---------------- */
  const handleSave = async (bypassDuplicate = false) => {
    if (loading) return; 

    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const cleanVillage = village.trim();

    const newErrors: any = {};
    if (!cleanName) newErrors.name = language === "te" ? "రైతు పేరు నమోదు చేయండి*" : "Enter farmer name*";
    
    if (!cleanPhone) {
      newErrors.phone = language === "te" ? "ఫోన్ నంబర్ నమోదు చేయండి*" : "Enter phone number*";
    } else if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      newErrors.phone = language === "te" ? "సరైన ఫోన్ నంబర్ ఇవ్వండి*" : "Enter valid phone number*";
    }

    if (!cleanVillage) newErrors.village = language === "te" ? "గ్రామం పేరు నమోదు చేయండి*" : "Enter village name*";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    try {
      setLoading(true);

      const userPhone = await AsyncStorage.getItem("USER_PHONE");
      if (!userPhone || !activeSession) {
        if (isMounted.current) setLoading(false);
        return;
      }

      const ref = firestore()
        .collection("users")
        .doc(userPhone)
        .collection("vehicles")
        .doc(vehicleId)
        .collection("farmers");

      if (!editId && !bypassDuplicate) {
        const duplicateCheck = await ref
          .where("phone", "==", cleanPhone)
          .where("session", "==", activeSession)
          .get();

        if (!duplicateCheck.empty) {
          if (isMounted.current) {
            setLoading(false);
            setShowDuplicateModal(true);
          }
          return;
        }
      }

      if (editId) {
        await ref.doc(editId).update({
          farmerName: cleanName,
          phone: cleanPhone,
          village: cleanVillage
        });
      } else {
        await ref.add({
          farmerName: cleanName,
          phone: cleanPhone,
          village: cleanVillage,
          session: activeSession, 
          createdAt: firestore.FieldValue.serverTimestamp()
        });
      }

      setTimeout(() => {
        if (isMounted.current) {
          setLoading(false);
          router.back();
        }
      }, 400);

    } catch (e) {
      console.log(e);
      if (isMounted.current) setLoading(false);
    }
  };

  /* ---------------- UI ---------------- */
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />

      <AppHeader
        title={
          editId
            ? (language === "te" ? "రైతు వివరాలు మార్చండి" : "Edit Farmer")
            : (language === "te" ? "రైతు వివరాలు" : "Add Farmer")
        }
        subtitle={
          editId
            ? (language === "te" ? "సవరించండి" : "Update Details")
            : (language === "te" ? "రైతు నమోదు చేయండి" : "Add Farmer Details")
        }
        language={language}
      />

      <KeyboardAwareScrollView 
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        showsVerticalScrollIndicator={false}
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
                  ? `మీరు పాత సాగు సంవత్సరం (${activeSession}) లో రైతుని నమోదు చేస్తున్నారు.` 
                  : `You are adding a farmer to an older season (${activeSession}).`}
              </AppText>
            </View>
          </View>
        )}

        {/* 🔥 IMPORT FROM CONTACTS BUTTON (Available in both Add and Edit Modes) */}
        <TouchableOpacity 
          style={styles.contactImportBtn} 
          onPress={handleOpenContacts}
          activeOpacity={0.7}
        >
          {loadingContacts ? (
             <ActivityIndicator size="small" color="#16A34A" />
          ) : (
             <>
               <View style={styles.contactIconBg}>
                  <Ionicons name="people" size={18} color="#16A34A" />
               </View>
               <AppText style={styles.contactImportText}>
                {language === "te" ? "కాంటాక్ట్స్ నుండి ఎంచుకోండి" : "Select from Contacts"}
               </AppText>
               <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
             </>
          )}
        </TouchableOpacity>

        {/* 👤 NAME */}
        <TouchableOpacity
          style={[
            styles.inputBox, 
            activeInput === "name" && !isLocked && styles.inputFocused, 
            errors.name && styles.inputError,
            isLocked && styles.inputLocked 
          ]}
          activeOpacity={1}
          onPress={() => {
            if (isLocked) setShowLockInfo(true);
            else { setActiveInput("name"); nameRef.current?.focus(); }
          }}
        >
          {isLocked ? (
             <Ionicons name="lock-closed" size={20} color="#9CA3AF" />
          ) : (
            <Ionicons name="person-outline" size={20} color={name || activeInput === "name" ? "#16A34A" : "#9CA3AF"} />
          )}

          <View style={styles.inputWrapper}>
            {!name && activeInput !== "name" && (
              <AppText style={{ color: "#9CA3AF", fontFamily: "Mandali" }}>{t.name}</AppText>
            )}
            <TextInput
              ref={nameRef}
              value={name}
              editable={!isLocked} 
              onChangeText={(txt) => {
                setName(txt);
                if (errors.name) setErrors({ ...errors, name: "" });
              }}
              cursorColor="#16A34A"
              selectionColor="#16A34A40"
              style={[styles.input, { display: (name || activeInput === "name") ? "flex" : "none" }, isLocked && { color: "#6B7280" }]}
              onFocus={() => setActiveInput("name")}
              onBlur={() => setActiveInput(null)}
              returnKeyType="next"
              onSubmitEditing={() => phoneRef.current?.focus()}
            />
          </View>
          <TouchableOpacity 
            onPress={() => {
              if (isLocked) setShowLockInfo(true);
              else handleVoiceInput("name");
            }} 
            style={styles.micBtn}
          >
            {isLocked ? (
              <Ionicons name="information-circle-outline" size={24} color="#F59E0B" />
            ) : (
              <MaterialCommunityIcons 
                name={isListening && activeInput === "name" ? "microphone" : "microphone-outline"} 
                size={24} 
                color={isListening && activeInput === "name" ? "#EF4444" : (activeInput === "name" ? "#16A34A" : "#6B7280")} 
              />
            )}
          </TouchableOpacity>
        </TouchableOpacity>
        {errors.name && <AppText style={styles.errorText} language={language}>{errors.name}</AppText>}

        {/* 📞 PHONE */}
        <TouchableOpacity
          style={[styles.inputBox, activeInput === "phone" && styles.inputFocused, errors.phone && styles.inputError]}
          activeOpacity={1}
          onPress={() => { setActiveInput("phone"); phoneRef.current?.focus(); }}
        >
          <Ionicons 
            name="call-outline" 
            size={20} 
            color={phone || activeInput === "phone" ? "#16A34A" : "#9CA3AF"} 
          />
          <View style={styles.inputWrapper}>
            {!phone && activeInput !== "phone" && (
              <AppText style={{ color: "#9CA3AF", fontFamily: "Mandali" }}>{t.phone}</AppText>
            )}
            <TextInput
              ref={phoneRef}
              value={phone}
              onChangeText={(txt) => {
                setPhone(txt);
                if (errors.phone) setErrors({ ...errors, phone: "" });
              }}
              keyboardType="number-pad"
              maxLength={10}
              cursorColor="#16A34A"
              selectionColor="#16A34A40"
              style={[styles.input, { display: (phone || activeInput === "phone") ? "flex" : "none" }]}
              onFocus={() => setActiveInput("phone")}
              onBlur={() => setActiveInput(null)}
              returnKeyType="next"
              onSubmitEditing={() => villageRef.current?.focus()}
            />
          </View>
        </TouchableOpacity>
        {errors.phone && <AppText style={styles.errorText} language={language}>{errors.phone}</AppText>}

        {/* 📍 VILLAGE */}
        <TouchableOpacity
          style={[styles.inputBox, activeInput === "village" && styles.inputFocused, errors.village && styles.inputError]}
          activeOpacity={1}
          onPress={() => { setActiveInput("village"); villageRef.current?.focus(); }}
        >
          <Ionicons 
            name="location-outline" 
            size={20} 
            color={village || activeInput === "village" ? "#16A34A" : "#9CA3AF"} 
          />
          <View style={styles.inputWrapper}>
            {!village && activeInput !== "village" && (
              <AppText style={{ color: "#9CA3AF", fontFamily: "Mandali" }}>{t.village}</AppText>
            )}
            <TextInput
              ref={villageRef}
              value={village}
              onChangeText={(txt) => {
                setVillage(txt);
                if (errors.village) setErrors({ ...errors, village: "" });
              }}
              cursorColor="#16A34A"
              selectionColor="#16A34A40"
              style={[styles.input, { display: (village || activeInput === "village") ? "flex" : "none" }]}
              onFocus={() => setActiveInput("village")}
              onBlur={() => setActiveInput(null)}
              returnKeyType="done"
            />
          </View>
          <TouchableOpacity onPress={() => handleVoiceInput("village")} style={styles.micBtn}>
            <MaterialCommunityIcons 
              name={isListening && activeInput === "village" ? "microphone" : "microphone-outline"} 
              size={24} 
              color={isListening && activeInput === "village" ? "#EF4444" : (activeInput === "village" ? "#16A34A" : "#6B7280")} 
            />
          </TouchableOpacity>
        </TouchableOpacity>
        {errors.village && <AppText style={styles.errorText} language={language}>{errors.village}</AppText>}

        {/* SAVE */}
        <TouchableOpacity
          style={styles.saveBtn}
          onPress={() => handleSave(false)}
          activeOpacity={0.9}
          disabled={loading}
        >
          <LinearGradient
            colors={["#2E7D32", "#1B5E20"]}
            style={styles.saveGradient}
          >
            <AppText style={styles.saveText}>
              {editId
                ? (language === "te" ? "సవరించండి" : "Update Farmer")
                : (language === "te" ? "భద్రపరచండి" : "Save Farmer")}
            </AppText>
          </LinearGradient>
        </TouchableOpacity>

      </KeyboardAwareScrollView>

      <AgriLoader visible={loading} type={editId ? "updating" : "saving"} language={language} />

      {/* 🔥 CONTACTS PICKER MODAL (Fully Polished) */}
      <Modal visible={showContactsModal} animationType="slide" transparent>
        <View style={styles.modalOverlayFull}>
          <View style={styles.contactModalContent}>
            <View style={styles.modalHeader}>
              <AppText style={styles.modalTitleText}>
                {language === 'te' ? "ఫోన్ నంబర్ల జాబితా" : "Select Contact"}
              </AppText>
              <TouchableOpacity onPress={() => setShowContactsModal(false)} hitSlop={{top:10, bottom:10, left:10, right:10}}>
                <Ionicons name="close-circle" size={28} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* 🔥 REFINED SEARCH BAR WITH VOICE & CLEAR */}
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color="#9CA3AF" />
              <TextInput 
                value={contactSearch}
                onChangeText={(txt) => {
                  setContactSearch(txt);
                  if(txt.trim() === "") {
                    setFilteredContacts(contacts);
                  } else {
                    const lower = txt.toLowerCase();
                    setFilteredContacts(contacts.filter(c => c.name?.toLowerCase().includes(lower)));
                  }
                }}
                placeholder={language === 'te' ? "పేరుతో వెతకండి..." : "Search name..."}
                placeholderTextColor="#9CA3AF"
                selectionColor="#16A34A40"
                cursorColor="#16A34A"
                style={styles.contactSearchInput}
                onFocus={() => setActiveInput("contactSearch")}
                onBlur={() => setActiveInput(null)}
              />

              {/* Close Button */}
              {contactSearch.trim().length > 0 && (
                <TouchableOpacity 
                  onPress={() => {
                    setContactSearch("");
                    setFilteredContacts(contacts);
                  }}
                  style={{ padding: 6 }}
                >
                  <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              )}

              {/* Voice Mic Button */}
              <TouchableOpacity
                onPress={() => handleVoiceInput("contactSearch")}
                style={{ marginLeft: 5, padding: 6, borderRadius: 10, backgroundColor: "#E5E7EB" }}
              >
                <MaterialCommunityIcons
                  name={isListening && activeInput === "contactSearch" ? "microphone" : "microphone-outline"}
                  size={20}
                  color={isListening && activeInput === "contactSearch" ? "#EF4444" : "#2E7D32"}
                />
              </TouchableOpacity>
            </View>

            <FlatList 
              data={filteredContacts}
              keyExtractor={(item, idx) => item.id || idx.toString()}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 20 }}
              renderItem={({item}) => (
                <TouchableOpacity style={styles.contactItem} onPress={() => selectContact(item)}>
                  <View style={styles.contactAvatar}>
                    <AppText style={{color: '#fff', fontWeight: 'bold', fontSize: 16}}>{item.name?.charAt(0) || "U"}</AppText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText style={styles.contactName} numberOfLines={1}>{item.name}</AppText>
                    <AppText style={styles.contactPhone}>{item.phoneNumbers?.[0]?.number}</AppText>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* 🔥 LOCK INFO MODAL */}
      <Modal visible={showLockInfo} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.modalOverlayStandard}>
          <View style={styles.modalContentStandard}>
            <View style={[styles.modalIconBgStandardInfo, { backgroundColor: "#FEE2E2" }]}>
              <Ionicons name="lock-closed" size={36} color="#DC2626" />
            </View>
            <AppText style={[styles.modalTitleStandardInfo, { color: "#DC2626" }]} language={language}>
              {language === "te" ? "పేరు మార్చలేరు" : "Name Locked"}
            </AppText>
            <AppText style={styles.modalSubStandard} language={language}>
              {language === "te"
                ? "ఈ రైతుకి సంబంధించిన పని వివరాలు ఇప్పటికే రికార్డ్ అయినందున మీరు పేరును సవరించలేరు. కేవలం ఫోన్ నంబర్ మరియు గ్రామం మార్చుకోవచ్చు."
                : "Since this farmer has existing work records, you cannot change the name. You can only update the phone number and village."}
            </AppText>
            <View style={styles.modalButtonsStandard}>
              <TouchableOpacity activeOpacity={0.8}
                style={[styles.modalInfoBtnStandard, { backgroundColor: "#DC2626" }]}
                onPress={() => setShowLockInfo(false)}
              >
                <AppText style={styles.modalInfoTextStandard} language={language}>
                  {language === "te" ? "అర్థమైంది" : "Got It"}
                </AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 🔥 DUPLICATE ENTRY WARNING MODAL */}
      <Modal visible={showDuplicateModal} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.modalOverlayStandard}>
          <View style={styles.modalContentStandard}>
            <View style={styles.modalIconBgStandardInfo}>
              <Ionicons name="copy-outline" size={36} color="#3B82F6" />
            </View>
            <AppText style={styles.modalTitleStandardInfo} language={language}>
              {language === "te" ? "ఇప్పటికే నమోదు అయి ఉంది!" : "Duplicate Entry!"}
            </AppText>
            <AppText style={styles.modalSubStandard} language={language}>
              {language === "te" ? "ఈ ఫోన్ నంబర్ తో రైతు వివరాలు ఇప్పటికే ఉన్నాయి.\n\nమీరు ఖచ్చితంగా మళ్లీ జతచేయాలనుకుంటున్నారా?" : "A farmer with this phone number already exists.\n\nAre you sure you want to add this duplicate entry?"}
            </AppText>
            <View style={styles.modalButtonsStandard}>
              <TouchableOpacity activeOpacity={0.8} style={styles.modalCancelBtnStandard} onPress={() => setShowDuplicateModal(false)}>
                <AppText style={styles.modalCancelTextStandard} language={language}>{language === 'te' ? "వద్దు" : "Cancel"}</AppText>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.8} style={styles.modalInfoBtnStandard}
                onPress={() => { setShowDuplicateModal(false); handleSave(true); }}
              >
                <AppText style={styles.modalInfoTextStandard} language={language}>{language === 'te' ? "అవును, సేవ్ చేయి" : "Yes, Save"}</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

/* ---------------- STYLES ---------------- */
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F6F7F6"
  },
  container: {
    padding: 20
  },
  contactImportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderStyle: 'dashed'
  },
  contactIconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10
  },
  contactImportText: {
    flex: 1,
    color: '#166534',
    fontWeight: '600',
    fontSize: 14,
    fontFamily: "Mandali"
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
  inputLocked: {
    backgroundColor: "#F3F4F6", 
    borderColor: "#E5E7EB",
  },
  inputFocused: {
    borderColor: "#16A34A",
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inputError: {
    borderColor: "#EF4444",
  },
  errorText: {
    color: "#EF4444",
    fontSize: 12,
    fontFamily: "Mandali",
    marginTop: -10,
    marginBottom: 10,
    marginLeft: 4,
  },
  micBtn: {
    marginLeft: 10,
    padding: 4,
  },
  inputWrapper: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center'
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#1F2937",
    fontFamily: "Mandali",
    textAlignVertical: "center",
    includeFontPadding: false,
  },
  saveBtn: {
    marginTop: 10,
    borderRadius: 18,
    overflow: "hidden",
    elevation: 6,
    shadowColor: "#1B5E20",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  saveGradient: {
    height: 56,
    justifyContent: "center",
    alignItems: "center"
  },
  saveText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600"
  },
  overlay: {
    position: "absolute",
    top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999
  },
  modalBox: { width: "80%", backgroundColor: "#fff", borderRadius: 20, padding: 24, alignItems: "center" },
  iconBg: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#E8F5E9", justifyContent: "center", alignItems: "center", marginBottom: 10 },
  modalTitle: { fontSize: 16, fontWeight: "600" },
  modalSub: { fontSize: 13, color: "#6B7280", textAlign: "center", marginTop: 6 },
  okBtn: { marginTop: 20, backgroundColor: "#1B5E20", paddingVertical: 12, paddingHorizontal: 40, borderRadius: 12 },
  okText: { color: "white", fontWeight: "600" },
  
  // 🔥 CONTACT MODAL STYLES
  modalOverlayFull: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end"
  },
  contactModalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    height: "80%",
    paddingHorizontal: 20
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 20
  },
  modalTitleText: {
    fontSize: 18,
    fontWeight: "600",
    color: '#111827'
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 45,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#E5E7EB"
  },
  contactSearchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    fontFamily: "Mandali",
    color: "#1F2937",
    paddingTop: 0,               
    paddingBottom: 0,            
    textAlignVertical: "center", 
    height: "100%",              
    marginTop: 2                 
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6"
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#16A34A",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15
  },
  contactName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2
  },
  contactPhone: {
    fontSize: 13,
    color: "#6B7280"
  },

  // UNIFIED PREMIUM MODAL CLASSES (DUPLICATE BLUE INFO THEME & RED VALIDATION)
  modalOverlayStandard: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 999 },
  modalContentStandard: { width: "85%", backgroundColor: "white", borderRadius: 24, padding: 24, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 15 },
  modalSubStandard: { textAlign: "center", color: "#64748B", marginTop: 8, marginBottom: 25, fontSize: 14, lineHeight: 22 },
  modalButtonsStandard: { flexDirection: "row", gap: 12, width: '100%' },
  modalIconBgStandardInfo: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#DBEAFE", justifyContent: "center", alignItems: "center", marginBottom: 12 },
  modalTitleStandardInfo: { fontSize: 20, fontWeight: "600", color: "#2563EB", marginTop: 10, textAlign: "center" },
  modalInfoBtnStandard: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#3B82F6", alignItems: "center", justifyContent: "center" },
  modalInfoTextStandard: { color: "white", fontWeight: "600" },
  modalCancelBtnStandard: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  modalCancelTextStandard: { color: "#4B5563", fontWeight: "600" }
});