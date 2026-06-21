import React, { useState, useEffect, useRef } from "react";
import { executeOfflineSafeRead, executeOfflineSafeWrite, executeOfflineSafeFetch } from "@/utils/offlineHelper";

import { View, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Modal, FlatList, Keyboard, StatusBar, SafeAreaView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import notifee, { TimestampTrigger, TriggerType, AndroidImportance, AndroidCategory, AndroidVisibility } from '@notifee/react-native';
import { LinearGradient } from "expo-linear-gradient";
import { useIsFocused } from "@react-navigation/native";

import AppText from "@/components/AppText";
import AppHeader from "@/components/AppHeader";
import AgriLoader from "@/components/AgriLoader";

const translations = {
  te: {
    title: "అలారం సెట్ చేయండి",
    subtitle: "పని గుర్తుచేయడానికి వివరాలు ఇవ్వండి",
    crop: "పంటను ఎంచుకోండి*",
    task: "పని వివరాలు (ఉదా: పత్తికి మందు కొట్టాలి)*",
    date: "తేదీ ఎంచుకోండి*",
    time: "సమయం ఎంచుకోండి*",
    save: "అలారం సెట్ చేయి",
    saving: "సెట్ అవుతోంది...",
    voiceHint: "మాట్లాడండి...",
    errors: {
      crop: "దయచేసి పంటను ఎంచుకోండి*",
      task: "దయచేసి పని వివరాలు రాయండి*",
      date: "తేదీ ఎంచుకోండి*",
      time: "సమయం ఎంచుకోండి*",
    },
    noCrops: "పంటలు ఏమీ లేవు. దయచేసి 'నా పొలాలు' లో ముందుగా పంటను జోడించండి.",
    addCropBtn: "పంట జోడించండి",
  },
  en: {
    title: "Set Alarm",
    subtitle: "Enter details for the task reminder",
    crop: "Select Crop*",
    task: "Task Details (e.g., Spray Pesticide)*",
    date: "Select Date*",
    time: "Select Time*",
    save: "Set Alarm",
    saving: "Setting...",
    voiceHint: "Listening...",
    errors: {
      crop: "Please select a crop*",
      task: "Please enter task details*",
      date: "Please select a date*",
      time: "Please select a time*",
    },
    noCrops: "No crops found. Please add a crop in 'My Fields' first.",
    addCropBtn: "Add Crop",
  },
};

export default function AddReminderScreen() {
  const router = useRouter();
  const isScreenFocused = useIsFocused();
  const [language, setLanguage] = useState<"te" | "en">("te");
  const t = translations[language];

  const [crop, setCrop] = useState("");
  const [task, setTask] = useState("");
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState<Date | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const [activeInput, setActiveInput] = useState<string | null>(null);
  const [voiceTarget, setVoiceTarget] = useState<"search" | "task" | null>(null);

  const taskRef = useRef<TextInput>(null);

  // Picker States
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Crop Modal States
  const [showCropModal, setShowCropModal] = useState(false);
  const [userCrops, setUserCrops] = useState<string[]>([]);
  const [cropSearch, setCropSearch] = useState("");

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      const lang = await AsyncStorage.getItem("APP_LANG");
      if (lang && isMounted) setLanguage(lang as "te" | "en");
      loadUserCrops(isMounted);
    };
    init();

    return () => {
      isMounted = false;
      ExpoSpeechRecognitionModule.stop();
    };
  }, []);

  useEffect(() => {
    if (!isScreenFocused) {
      ExpoSpeechRecognitionModule.stop();
      setIsListening(false);
    }
  }, [isScreenFocused]);

  const loadUserCrops = async (isMounted = true) => {
    try {
      const phone = await AsyncStorage.getItem("USER_PHONE");
      if (!phone) return;

      // 1. FAST LOAD FROM LOCAL CACHE
      const cachedCrops = await AsyncStorage.getItem(`CACHED_CROPS_${phone}`);
      if (cachedCrops && isMounted) {
        setUserCrops(JSON.parse(cachedCrops));
      }

      // 2. BACKGROUND FETCH FROM FIRESTORE
      const userDoc = await executeOfflineSafeRead(firestore().collection("users").doc(phone), true);
      const activeSession = userDoc.data()?.activeSession;
      if (!activeSession) return;

      const landsSnap = await executeOfflineSafeRead(firestore().collection("users").doc(phone).collection("lands").where("session", "==", activeSession), true);
      const landsMap: any = {};
      landsSnap.forEach((doc: any) => { landsMap[doc.id] = doc.data().nickname; });

      const snap = await executeOfflineSafeRead(firestore().collection("users").doc(phone).collection("fields").where("session", "==", activeSession), true);
      const set = new Set<string>();
      snap.forEach((doc: any) => {
        const data = doc.data();
        if (data.crop) {
          const nick = landsMap[data.landId] || data.nickname;
          const name = nick ? `${data.crop} - ${nick}` : data.crop;
          set.add(name);
        }
      });
      
      const freshCrops = Array.from(set);
      if (isMounted) setUserCrops(freshCrops);
      await AsyncStorage.setItem(`CACHED_CROPS_${phone}`, JSON.stringify(freshCrops));
    } catch (e) {
      console.log("Load crops error", e);
    }
  };

  const startVoice = async (target: "search" | "task") => {
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
    }
  };

  useSpeechRecognitionEvent("result", (event) => {
    if (!isListening) return;
    const text = event.results?.[0]?.transcript?.replace(/[.,?!]/g, "");
    if (text) {
      if (voiceTarget === "task") {
        setTask(text);
        if (errors.task) setErrors(prev => ({ ...prev, task: "" }));
      } else {
        setCropSearch(text);
      }
    }
  });

  useSpeechRecognitionEvent("end", () => {
    setIsListening(false);
    setVoiceTarget(null);
  });

  const scheduleLocalNotification = async (taskName: string, targetDate: Date, targetTime: Date, docId: string) => {
    try {
      await notifee.requestPermission();

      const alarmDate = new Date(
        targetDate.getFullYear(),
        targetDate.getMonth(),
        targetDate.getDate(),
        targetTime.getHours(),
        targetTime.getMinutes(),
        0
      );

      if (alarmDate.getTime() < Date.now()) return null;

      const channelId = await notifee.createChannel({
        id: 'real_alarm_2',
        name: 'Real Alarm Clock',
        importance: AndroidImportance.HIGH,
        vibration: true,
        sound: 'alarm',
      });

      const trigger: TimestampTrigger = {
        type: TriggerType.TIMESTAMP,
        timestamp: alarmDate.getTime(),
      };

      const notifId = await notifee.createTriggerNotification({
        title: language === "te" ? "పని గుర్తుచేసే అలారం ⏰" : "Task Reminder ⏰",
        body: taskName,
        data: { reminderId: docId, task: taskName, crop: crop },
        android: {
          channelId,
          importance: AndroidImportance.HIGH,
          category: AndroidCategory.ALARM,
          visibility: AndroidVisibility.PUBLIC,
          loopSound: true,
          ongoing: true,
          autoCancel: false,
          fullScreenAction: {
            id: 'default',
          },
          pressAction: {
            id: 'default',
          },
        },
      }, trigger);
      
      return notifId;
    } catch (e) {
      console.log("Notification scheduling failed", e);
      return null;
    }
  };

  const handleSave = async () => {
    Keyboard.dismiss();
    const newErrors: Record<string, string> = {};

    if (!crop.trim()) newErrors.crop = t.errors.crop;
    if (!task.trim()) newErrors.task = t.errors.task;
    if (!date) newErrors.date = t.errors.date;
    if (!time) newErrors.time = t.errors.time;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const phone = await AsyncStorage.getItem("USER_PHONE");
      if (!phone) throw new Error("No phone");

      const reminderData = {
        crop,
        task,
        date: date?.toISOString(),
        time: time?.toISOString(),
        status: "pending",
        createdAt: firestore.FieldValue.serverTimestamp(),
      };

      const docRef = await executeOfflineSafeWrite(firestore().collection("users").doc(phone).collection("reminders").add(reminderData));

      if (date && time && docRef) {
        const notifId = await scheduleLocalNotification(task, date, time, (docRef as any).id);
        if (notifId) {
          await executeOfflineSafeWrite((docRef as any).update({ notificationId: notifId }));
        }
      }

      router.back();
    } catch (e) {
      console.log("Save error", e);
    } finally {
      setLoading(false);
    }
  };

  const filteredModalCrops = userCrops.filter(c => c.toLowerCase().includes(cropSearch.toLowerCase()));

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

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <AppHeader title={t.title} subtitle={t.subtitle} language={language} onBack={() => router.back()} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          
          {/* CROP BOX */}
          <TouchableOpacity 
            activeOpacity={0.7} 
            style={[styles.inputBox, activeInput === "crop" && styles.inputFocused, errors.crop && styles.inputError]} 
            onPress={() => { setShowCropModal(true); setActiveInput("crop"); setCropSearch(""); if (errors.crop) setErrors({...errors, crop: ""}); }}
          >
            <Ionicons name="leaf-outline" size={20} color={crop ? "#16A34A" : "#9CA3AF"} />
            <View style={styles.inputWrapper}>
              <AppText style={{ color: crop ? "#1F2937" : "#9CA3AF", fontSize: 16, fontFamily: "Mandali" }}>
                {crop || t.crop}
              </AppText>
            </View>
            <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
          </TouchableOpacity>
          {errors.crop && <AppText style={styles.errorText} language={language}>{errors.crop}</AppText>}

          {/* TASK INPUT WITH VOICE */}
          <TouchableOpacity 
            activeOpacity={1}
            onPress={() => {
              setActiveInput("task");
              setTimeout(() => taskRef.current?.focus(), 50);
            }}
            style={[styles.inputBox, { paddingRight: 8 }, activeInput === "task" && styles.inputFocused, errors.task && styles.inputError]}
          >
            <Ionicons name="document-text-outline" size={20} color={task || activeInput === "task" ? "#16A34A" : "#9CA3AF"} />
            <View style={[styles.inputWrapper, { flex: 1, marginLeft: 12, marginRight: 8 }]}>
              {!task && activeInput !== "task" && (
                <AppText style={styles.placeholder}>
                  {isListening && voiceTarget === "task" ? t.voiceHint : t.task}
                </AppText>
              )}
              <TextInput
                ref={taskRef}
                value={task}
                cursorColor="#16A34A"
                selectionColor="#afd2a5"
                onChangeText={(txt) => {
                  setTask(txt);
                  if (errors.task) setErrors({ ...errors, task: "" });
                }}
                style={[styles.input, { display: (task || activeInput === "task") ? "flex" : "none" }]}
                onFocus={() => setActiveInput("task")}
                onBlur={() => setActiveInput(null)}
                multiline
              />
            </View>
            <TouchableOpacity onPress={() => startVoice("task")} style={{ padding: 6, borderRadius: 10 }}>
              <Ionicons 
                name={voiceTarget === "task" && isListening ? "mic" : "mic-outline"} 
                size={24} 
                color={voiceTarget === "task" && isListening ? "#EF4444" : (activeInput === "task" ? "#16A34A" : "#6B7280")} 
              />
            </TouchableOpacity>
          </TouchableOpacity>
          {errors.task && <AppText style={styles.errorText} language={language}>{errors.task}</AppText>}

          {/* DATE PICKER */}
          <TouchableOpacity activeOpacity={0.8} style={[styles.inputBox, activeInput === "date" && styles.inputFocused, errors.date && styles.inputError]} onPress={() => { setShowDatePicker(true); setActiveInput("date"); }}>
            <Ionicons name="calendar-outline" size={20} color={date ? "#16A34A" : "#9CA3AF"} />
            <View style={styles.inputWrapper}>
              <AppText style={{ color: date ? "#1F2937" : "#9CA3AF", fontSize: 16, fontFamily: "Mandali" }}>
                {date ? date.toLocaleDateString(language === "te" ? "te-IN" : "en-IN") : t.date}
              </AppText>
            </View>
          </TouchableOpacity>
          {errors.date && <AppText style={styles.errorText} language={language}>{errors.date}</AppText>}

          {/* TIME PICKER */}
          <TouchableOpacity activeOpacity={0.8} style={[styles.inputBox, activeInput === "time" && styles.inputFocused, errors.time && styles.inputError]} onPress={() => { setShowTimePicker(true); setActiveInput("time"); }}>
            <Ionicons name="time-outline" size={20} color={time ? "#16A34A" : "#9CA3AF"} />
            <View style={styles.inputWrapper}>
              <AppText style={{ color: time ? "#1F2937" : "#9CA3AF", fontSize: 16, fontFamily: "Mandali" }}>
                {time ? time.toLocaleTimeString(language === "te" ? "te-IN" : "en-IN", { hour: '2-digit', minute: '2-digit' }) : t.time}
              </AppText>
            </View>
          </TouchableOpacity>
          {errors.time && <AppText style={styles.errorText} language={language}>{errors.time}</AppText>}

          {/* SAVE BUTTON */}
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading} activeOpacity={0.8}>
            <LinearGradient colors={["#2E7D32", "#1B5E20"]} style={styles.saveGradient}>
              <Ionicons name="alarm-outline" size={20} color="#fff" />
              <AppText style={styles.saveText}>{t.save}</AppText>
            </LinearGradient>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* 🟢 LOADER */}
      <AgriLoader visible={loading} type="saving" language={language} />

      {/* MODALS FOR PICKERS */}
      {showDatePicker && (
        <DateTimePicker
          value={date || new Date()}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
            setShowDatePicker(false);
            setActiveInput(null);
            if (selectedDate) {
              setDate(selectedDate);
              if (errors.date) setErrors(prev => ({ ...prev, date: "" }));
            }
          }}
        />
      )}

      {showTimePicker && (
        <DateTimePicker
          value={time || new Date()}
          mode="time"
          display="default"
          onChange={(event: DateTimePickerEvent, selectedTime?: Date) => {
            setShowTimePicker(false);
            setActiveInput(null);
            if (selectedTime) {
              setTime(selectedTime);
              if (errors.time) setErrors(prev => ({ ...prev, time: "" }));
            }
          }}
        />
      )}

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
              <TouchableOpacity onPress={() => startVoice("search")} style={{ marginLeft: 8, padding: 6, borderRadius: 10, backgroundColor: "#eaedf2" }}>
                <Ionicons name={voiceTarget === "search" && isListening ? "mic" : "mic-outline"} size={24} color={voiceTarget === "search" && isListening ? "#EF4444" : "#16A34A"} />
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

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6F7F6" },
  container: { padding: 20, paddingBottom: 120 }, 
  
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
  placeholder: {
    fontSize: 16,
    color: "#9CA3AF",
    fontFamily: "Mandali"
  },

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
