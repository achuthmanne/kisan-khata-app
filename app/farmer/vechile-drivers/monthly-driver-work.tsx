//vechile drivers monthly work history
import AppEmptyState from "@/components/AppEmptyState";
import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
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
import DateTimePickerModal from "react-native-modal-datetime-picker";
import ShimmerPlaceHolder from "react-native-shimmer-placeholder";

type CycleItem = {
  id: string;
  startDateRaw: string;
  endDateRaw: string | null;
  isActive: boolean;
  previousAdvance: number;
  monthlySalary: number;
  isCleared: boolean;
  entries?: WorkItem[];
  createdAt: any;
};

type WorkItem = {
  id: string;
  cycleId: string;
  date: string;
  dateRaw: string; // ISO
  attendance: "present" | "half" | "absent";
  advanceAmount?: string;
  cuttingAmount?: string;
  cuttingReason?: string;
  workMode: string | null;
  customerName?: string;
  work?: string;
  acresWorked?: string;
  hasBreak?: boolean;
  startTimeRaw?: string;
  endTimeRaw?: string;
  breakStartTimeRaw?: string;
  breakEndTimeRaw?: string;
  totalHoursStr?: string;
  createdAt?: any;
};

export default function MonthlyDriverHistory() {

  const router = useRouter();
  const { vehicleId, driverId, name, phone, paymentType, monthlySalary } = useLocalSearchParams();
  const isMounted = useRef(true); 

  const dName = Array.isArray(name) ? name[0] : name;
  const dPhone = Array.isArray(phone) ? phone[0] : phone;
  const vId = Array.isArray(vehicleId) ? vehicleId[0] : vehicleId;
  const dId = Array.isArray(driverId) ? driverId[0] : driverId;
  const dPaymentType = Array.isArray(paymentType) ? paymentType[0] : paymentType;
  const dMonthlySalary = Number(Array.isArray(monthlySalary) ? monthlySalary[0] : monthlySalary) || 0;

  const [cyclesLoaded, setCyclesLoaded] = useState(false);
  const [entriesLoaded, setEntriesLoaded] = useState(false);
  const loading = !cyclesLoaded || !entriesLoaded;
  const [language, setLanguage] = useState<"te" | "en">("te");
  const [expanded, setExpanded] = useState<string | null>(null);

  const [cycles, setCycles] = useState<CycleItem[]>([]);
  const [entries, setEntries] = useState<WorkItem[]>([]);

  // Onboarding
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardDate, setOnboardDate] = useState<Date | null>(null);
  const [onboardAdvance, setOnboardAdvance] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);

  // New Month
  const [showNewMonthModal, setShowNewMonthModal] = useState(false);
  const [showNewMonthPicker, setShowNewMonthPicker] = useState(false);
  const [newMonthDate, setNewMonthDate] = useState<Date | null>(null);
  const [newMonthError, setNewMonthError] = useState("");
  const [newMonthAdvance, setNewMonthAdvance] = useState("");
  const [newMonthSalary, setNewMonthSalary] = useState(dMonthlySalary.toString());

  // Status/Clear toggle
  const [clearId, setClearId] = useState<string | null>(null);
  const [showMissingDaysWarning, setShowMissingDaysWarning] = useState(false);

  /* ---------------- LOAD ---------------- */
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let unsubCycles: any;
      let unsubEntries: any;

      const load = async () => {
        const lang = await AsyncStorage.getItem("APP_LANG");
        if (lang && isMounted.current) setLanguage(lang as any);

        const userPhone = await AsyncStorage.getItem("USER_PHONE");
        if (!userPhone || !vId || !dId) {
            if (isMounted.current) {
                setCyclesLoaded(true);
                setEntriesLoaded(true);
            }
            return;
        }

        let activeSession: string | undefined;
        try {
            const userDoc = await firestore().collection("users").doc(userPhone).get({ source: "cache" });
            activeSession = userDoc.data()?.activeSession;
        } catch (e) {
            // fallback to server if cache fails
            const userDoc = await firestore().collection("users").doc(userPhone).get();
            activeSession = userDoc.data()?.activeSession;
        }

        if (!activeSession) {
          if (isMounted.current) {
              setCyclesLoaded(true);
              setEntriesLoaded(true);
          }
          return;
        }

        // FETCH CYCLES
        unsubCycles = firestore()
          .collection("users").doc(userPhone)
          .collection("vehicles").doc(vId)
          .collection("drivers").doc(dId)
          .collection("cycles")
          .where("session", "==", activeSession)
          .onSnapshot(snap => {
            if (!snap) return;
            const list: CycleItem[] = [];
            snap.forEach(doc => list.push({ id: doc.id, ...(doc.data() as any) }));
            list.sort((a, b) => {
              const timeA = a.startDateRaw ? new Date(a.startDateRaw).getTime() : 0;
              const timeB = b.startDateRaw ? new Date(b.startDateRaw).getTime() : 0;
              return timeB - timeA; // newest first
            });
            
            if (isMounted.current) {
                setCycles(list);
                setCyclesLoaded(true);
                if (list.length > 0) {
                   setShowOnboarding(false);
                   // expand active cycle by default
                   const active = list.find(c => c.isActive);
                   if (active && !expanded) setExpanded(active.id);
                }
            }
          }, (err) => {
             console.log("Cycles Error:", err);
             if (isMounted.current) setCyclesLoaded(true);
          });

        // FETCH ENTRIES
        unsubEntries = firestore()
          .collection("users").doc(userPhone)
          .collection("vehicles").doc(vId)
          .collection("drivers").doc(dId)
          .collection("entries")
          .where("session", "==", activeSession)
          .onSnapshot(snap => {
            if (!snap) return;
            const list: WorkItem[] = [];
            snap.forEach(doc => list.push({ id: doc.id, ...(doc.data() as any) }));
            if (isMounted.current) {
                setEntries(list);
                setEntriesLoaded(true);
            }
          }, (err) => {
             console.log("Entries Error:", err);
             if (isMounted.current) setEntriesLoaded(true);
          });
      };

      load();
      return () => {
        if (unsubCycles) unsubCycles();
        if (unsubEntries) unsubEntries();
      };
    }, [vId, dId])
  );

  // Show onboarding if finished loading and no cycles
  useEffect(() => {
    if (!loading && cycles.length === 0) {
        setShowOnboarding(true);
    }
  }, [loading, cycles.length]);

  /* ---------------- HELPERS ---------------- */

  const handleCreateFirstCycle = async () => {
    if (!onboardDate) return;
    const userPhone = await AsyncStorage.getItem("USER_PHONE");
    if (!userPhone || !vId || !dId) return;

    const userDoc = await firestore().collection("users").doc(userPhone).get();
    const activeSession = userDoc.data()?.activeSession;

    setShowOnboarding(false);

    try {
        await firestore()
          .collection("users").doc(userPhone)
          .collection("vehicles").doc(vId)
          .collection("drivers").doc(dId)
          .collection("cycles")
          .add({
            startDateRaw: onboardDate.toISOString(),
            endDateRaw: null,
            isActive: true,
            previousAdvance: Number(onboardAdvance) || 0,
            monthlySalary: dMonthlySalary,
            isCleared: false,
            session: activeSession,
            createdAt: firestore.FieldValue.serverTimestamp()
          });
    } catch (e) {
        console.error("Error creating first cycle:", e);
    }
  };

  const handleStartNewMonth = async () => {
    if (!newMonthDate) return;
    if (!newMonthSalary || newMonthSalary.trim() === "") {
        setNewMonthError(language === "te" ? "దయచేసి జీతం ఎంటర్ చేయండి." : "Please enter the salary.");
        return;
    }
    const userPhone = await AsyncStorage.getItem("USER_PHONE");
    if (!userPhone || !vId || !dId) return;

    const activeCycle = cycles.find(c => c.isActive);
    if (!activeCycle) return;

    const activeCycleStartDate = new Date(activeCycle.startDateRaw);
    const minNewMonthDate = new Date(activeCycleStartDate);
    const expectedMonth = (minNewMonthDate.getMonth() + 1) % 12;
    minNewMonthDate.setMonth(minNewMonthDate.getMonth() + 1);
    if (minNewMonthDate.getMonth() !== expectedMonth) {
        minNewMonthDate.setDate(0);
    }
    minNewMonthDate.setHours(0,0,0,0);

    const selectedNewMonthDate = new Date(newMonthDate);
    selectedNewMonthDate.setHours(0,0,0,0);

    if (selectedNewMonthDate.getTime() < minNewMonthDate.getTime()) {
        const oldCompletion = new Date(minNewMonthDate);
        oldCompletion.setDate(oldCompletion.getDate() - 1);
        const fDate = oldCompletion.toLocaleDateString('en-GB').replace(/\//g, '-');
        
        setNewMonthError(
           language === "te" 
             ? `పాత నెల తేదీ (${fDate}) తో పూర్తయింది. దయచేసి ఆ తర్వాతి తేదీని ఎంచుకోండి.` 
             : `Old month completed on (${fDate}). Please select a later date.`
        );
        return;
    }

    const userDoc = await firestore().collection("users").doc(userPhone).get();
    const activeSession = userDoc.data()?.activeSession;

    const batch = firestore().batch();

    const calculatedOldEndDate = new Date(newMonthDate);
    calculatedOldEndDate.setDate(calculatedOldEndDate.getDate() - 1);

    // End active cycle
    const oldCycleRef = firestore()
      .collection("users").doc(userPhone)
      .collection("vehicles").doc(vId)
      .collection("drivers").doc(dId)
      .collection("cycles").doc(activeCycle.id);
      
    batch.update(oldCycleRef, {
        isActive: false,
        endDateRaw: calculatedOldEndDate.toISOString()
    });

    // Create new cycle
    const newCycleRef = firestore()
      .collection("users").doc(userPhone)
      .collection("vehicles").doc(vId)
      .collection("drivers").doc(dId)
      .collection("cycles").doc();
      
    batch.set(newCycleRef, {
        startDateRaw: newMonthDate.toISOString(),
        endDateRaw: null,
        isActive: true,
        monthlySalary: Number(newMonthSalary),
        previousAdvance: Number(newMonthAdvance) || 0,
        isCleared: false,
        session: activeSession,
        createdAt: firestore.FieldValue.serverTimestamp()
    });

      // Check if salary changed, if so update driver and salary history
      const driverRef = firestore().collection("users").doc(userPhone).collection("vehicles").doc(vId).collection("drivers").doc(dId);
      
      if (Number(newMonthSalary) !== dMonthlySalary) {
        batch.update(driverRef, {
          monthlySalary: Number(newMonthSalary),
          salaryHistory: firestore.FieldValue.arrayUnion({
            startDateRaw: activeCycle.startDateRaw,
            endDateRaw: calculatedOldEndDate.toISOString(),
            salary: dMonthlySalary
          })
        });
      }

      // Close modal immediately (Optimistic UI)
      setShowNewMonthModal(false);
      setNewMonthDate(null);
      setNewMonthAdvance("");
      setNewMonthError("");

      try {
        await batch.commit();
      } catch (e) {
        console.error("Error creating new month:", e);
      }
  };

  const handleToggleClear = async () => {
    if (!clearId) return;
    const userPhone = await AsyncStorage.getItem("USER_PHONE");
    if (!userPhone || !vId || !dId) return;

    await firestore()
      .collection("users").doc(userPhone)
      .collection("vehicles").doc(vId)
      .collection("drivers").doc(dId)
      .collection("cycles").doc(clearId)
      .update({
        isCleared: true
      });
      
    setClearId(null);
  };

  const generateDaysForCycle = (cycle: CycleItem) => {
    const cycleEntries = entries.filter(e => {
      if (e.cycleId) return e.cycleId === cycle.id;
      
      let eDate = new Date();
      if (e.dateRaw) {
         eDate = new Date(e.dateRaw);
      } else if (e.date) {
         eDate = new Date(e.date.split('-').reverse().join('-'));
      }
      eDate.setHours(0,0,0,0);

      const sDate = new Date(cycle.startDateRaw);
      sDate.setHours(0,0,0,0);

      const endDate = cycle.isActive ? new Date() : new Date(cycle.endDateRaw || new Date().toISOString());
      endDate.setHours(23,59,59,999);

      return eDate.getTime() >= sDate.getTime() && eDate.getTime() <= endDate.getTime();
    });
    const start = new Date(cycle.startDateRaw);
    start.setHours(0,0,0,0);
    
    // Always generate exactly one month of days
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    end.setDate(end.getDate() - 1); // Up to the day before next month
    end.setHours(23,59,59,999);

    const days = [];
    const current = new Date(start);

    while (current <= end) {
        // format date string DD-MM-YYYY
        const dStr = current.toLocaleDateString('en-GB').replace(/\//g, '-');
        const matchingEntries = cycleEntries.filter(e => e.date === dStr);
        
        days.push({
            dateObj: new Date(current),
            dateStr: dStr,
            entries: matchingEntries
        });
        current.setDate(current.getDate() + 1);
    }
    
    return days; // Ascending order so start date is at the top // newest first
  };

  const ShimmerCard = () => {
    return (
      <View style={styles.cropCard}>
        <View style={{ flexDirection: "row", alignItems: "center", padding: 16 }}>
          <ShimmerPlaceHolder LinearGradient={LinearGradient} style={{ width: 4, height: 30, borderRadius: 4 }} />
          <ShimmerPlaceHolder LinearGradient={LinearGradient} style={{ width: 120, height: 14, marginLeft: 10, borderRadius: 6 }} />
        </View>
        <View style={{ padding: 14 }}>
          <ShimmerPlaceHolder LinearGradient={LinearGradient} style={{ width: "60%", height: 14, borderRadius: 6, marginBottom: 8 }} />
          <ShimmerPlaceHolder LinearGradient={LinearGradient} style={{ width: "90%", height: 12, borderRadius: 6, marginBottom: 6 }} />
          <ShimmerPlaceHolder LinearGradient={LinearGradient} style={{ width: "80%", height: 12, borderRadius: 6, marginBottom: 6 }} />
        </View>
      </View>
    );
  };

  /* ---------------- UI ---------------- */
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />

      <AppHeader
        title={language === "te" ? "నెలసరి చరిత్ర" : "Monthly History"}
        subtitle={language === "te" ? "ఖాతా వివరాలు" : "Account Details"}
        language={language}
      />

      {loading ? (
        <View style={{ padding: 10 }}>
          <ShimmerCard />
          <ShimmerCard />
          <ShimmerCard />
        </View>
      ) : (
        <>
          {(() => {
            const activeCycle = cycles.find(c => c.isActive);
            if (!activeCycle) return null;
            const startMs = new Date(activeCycle.startDateRaw).getTime();
            const todayMs = new Date().getTime();
            const diffDays = Math.floor((todayMs - startMs) / (1000 * 60 * 60 * 24));
            if (diffDays >= 28) {
               return (
                 <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
                   <TouchableOpacity 
                       activeOpacity={0.8}
                       style={{ backgroundColor: "#2563EB", padding: 10, borderRadius: 10, alignItems: "center", shadowColor: "#2563EB", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6 }}
                       onPress={() => {
                           setNewMonthDate(null);
                           setNewMonthAdvance("");
                           setNewMonthSalary(dMonthlySalary.toString());
                           setNewMonthError("");
                           setShowNewMonthModal(true);
                       }}
                   >
                       <AppText style={{ color: "#fff", fontWeight: "600", fontSize: 16, fontFamily: "Mandali" }}>{language === "te" ? "కొత్త నెల ప్రారంభించండి" : "Start New Month"}</AppText>
                   </TouchableOpacity>
                 </View>
               );
            }
            return null;
          })()}
          <FlatList
            data={cycles}
          keyExtractor={(item) => item.id} 
          contentContainerStyle={[
            { padding: 16, paddingBottom: 120 },
            cycles.length === 0 && { flexGrow: 1, justifyContent: 'center' }
          ]}
          ListEmptyComponent={
            !showOnboarding ? (
              <AppEmptyState
                iconName="calendar-outline"
                title={language === "te" ? "రికార్డ్స్ లేవు" : "No Cycles Found"}
                subtitle={language === "te" ? "కొత్త నెల ప్రారంభించండి" : "Start a new month cycle"}
                language={language}
              />
            ) : null
          }
          renderItem={({ item: cycle }) => {
            const isOpen = expanded === cycle.id;
            
            // Calculate totals
            const cycleEntries = entries.filter(e => {
              if (e.cycleId) return e.cycleId === cycle.id;
              
              // Legacy support: Match by date range if cycleId is missing
              let eDate = new Date();
              if (e.dateRaw) {
                 eDate = new Date(e.dateRaw);
              } else if (e.date) {
                 eDate = new Date(e.date.split('-').reverse().join('-'));
              }
              eDate.setHours(0,0,0,0);

              const sDate = new Date(cycle.startDateRaw);
              sDate.setHours(0,0,0,0);

              const endDate = cycle.isActive ? new Date() : new Date(cycle.endDateRaw || new Date().toISOString());
              endDate.setHours(23,59,59,999);

              return eDate.getTime() >= sDate.getTime() && eDate.getTime() <= endDate.getTime();
            });
            const sumAdvances = cycleEntries.reduce((sum, e) => sum + (Number(e.advanceAmount) || 0) + (Number(e.cuttingAmount) || 0), 0);
            const totalAdvance = sumAdvances + (Number(cycle.previousAdvance) || 0);
            const balance = cycle.monthlySalary - totalAdvance;
            
                        const formatMonthDay = (d: Date) => {
              const monthsEn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
              const monthsTe = ["జనవరి", "ఫిబ్రవరి", "మార్చి", "ఏప్రిల్", "మే", "జూన్", "జూలై", "ఆగస్టు", "సెప్టెంబర్", "అక్టోబర్", "నవంబర్", "డిసెంబర్"];
              if (language === "te") {
                 return `${monthsTe[d.getMonth()]} ${d.getDate()}`;
              }
              return `${monthsEn[d.getMonth()]} ${d.getDate()}`;
            };
            
            const startDateObj = new Date(cycle.startDateRaw);
            const startStr = formatMonthDay(startDateObj);
            
            let endDateObj = new Date(startDateObj);
            endDateObj.setMonth(endDateObj.getMonth() + 1);
            endDateObj.setDate(endDateObj.getDate() - 1);
            const endStr = formatMonthDay(endDateObj);
            
            const startMs = new Date(cycle.startDateRaw).getTime();
            const todayMs = new Date().getTime();
            const diffDays = Math.floor((todayMs - startMs) / (1000 * 60 * 60 * 24));
            
            const isCompletedMonth = !cycle.isActive || diffDays >= 28;
            const isPendingPayment = isCompletedMonth && !cycle.isCleared;

            let headerBg = "#F9FAFB";
            let sidebarColor = "#9CA3AF";
            let subtitleColor = "#6B7280";
            let subtitleText = cycle.isActive ? (language === "te" ? "ప్రస్తుత నెల" : "Active Month") : (language === "te" ? "గత నెల" : "Past Month");

            if (isPendingPayment) {
               headerBg = "#FEF2F2";
               sidebarColor = "#DC2626";
               subtitleColor = "#DC2626";
               subtitleText = language === "te" ? "పెండింగ్ లో ఉంది" : "Payment Pending";
            } else if (cycle.isActive) {
               headerBg = "#F0FDF4";
               sidebarColor = "#16A34A";
               subtitleColor = "#16A34A";
            } else if (cycle.isCleared) {
               headerBg = "#F9FAFB";
               sidebarColor = "#9CA3AF";
               subtitleColor = "#9CA3AF";
               subtitleText = language === "te" ? "గత నెల (లాక్)" : "Past Month (Locked)";
            }
            
            return (
              <View style={[styles.cropCard, cycle.isActive && { borderColor: "#E5E7EB", borderWidth: 1 }]}>
                {/* CYCLE HEADER */}
                <TouchableOpacity activeOpacity={0.7}
                  style={[styles.cropHeader, { alignItems: "center", backgroundColor: headerBg }]}
                  onPress={() => setExpanded(isOpen ? null : cycle.id)}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", flex: 1, paddingRight: 10 }}>
                    <View style={{
                      width: 4, height: 50, borderRadius: 4,
                      backgroundColor: sidebarColor, marginRight: 10
                    }} />
                    <View style={{ flex: 1 }}>
                      <AppText style={styles.cropTitle}>
                        {startStr} {language === "te" ? "నుండి" : "to"} {endStr}
                      </AppText>
                      <AppText style={[styles.cropCount, { color: subtitleColor, fontWeight: "600" }]}>
                        {subtitleText}
                      </AppText>
                    </View>
                  </View>
                  <View style={{ width: 32, height: 32, borderRadius: 20, backgroundColor: "#e9e9e9", justifyContent: "center", alignItems: "center" }}>
                    <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={18} color="#4B5563" />
                  </View>
                </TouchableOpacity>

                {/* OVERVIEW CARD */}
                {isOpen && (
                  <View style={{ padding: 14, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}>
                      <View style={styles.rowBetween}>
                          <AppText style={styles.label}>{language === "te" ? "నెల జీతం:" : "Monthly Salary:"}</AppText>
                          <AppText style={styles.value}>₹{Number(cycle.monthlySalary).toLocaleString('en-IN')}</AppText>
                      </View>
                      <View style={[styles.rowBetween, { marginTop: 6 }]}>
                          <AppText style={styles.label}>{language === "te" ? "అడ్వాన్స్ + కోత:" : "Advance + Cut:"}</AppText>
                          <AppText style={styles.value}>₹{Number(totalAdvance).toLocaleString('en-IN')}</AppText>
                      </View>
                      <View style={[styles.rowBetween, { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#E5E7EB" }]}>
                          <AppText style={[styles.label, { color: "#1F2937", fontWeight: "600" }]}>{language === "te" ? "ఇవ్వాల్సిన బ్యాలెన్స్:" : "Balance Due:"}</AppText>
                          <AppText style={[styles.value, { fontSize: 16, color: cycle.isCleared ? "#16A34A" : "#DC2626" }]}>₹{Number(balance).toLocaleString('en-IN')}</AppText>
                      </View>

                      {/* WHATSAPP SHARE BUTTON */}
                      {cycleEntries.length > 0 && (
                        <TouchableOpacity
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: "#E5F6EB",
                            paddingVertical: 10,
                            borderRadius: 8,
                            marginTop: 15,
                          }}
                          onPress={() => {
                            const days = generateDaysForCycle(cycle);
                            let presentD = 0;
                            let absentD = 0;
                            const dailyLog: string[] = [];

                            days.forEach(day => {
                              if (day.entries.length === 0) {
                                if (!cycle.isActive || new Date(day.dateObj).getTime() < new Date().getTime()) {
                                  absentD += 1;
                                  dailyLog.push(`📅 *${day.dateStr}*\n❌ మిస్ అయ్యింది`);
                                }
                              } else {
                                const e = day.entries[0];
                                let dayMsg = `📅 *${day.dateStr}*\n`;

                                if (e.work === "సగం రోజు (Half Day)") {
                                  absentD += 0.5;
                                  presentD += 0.5;
                                  dayMsg += `⏳ సగం రోజు (Half Day)\n`;
                                } else if (e.work === "సెలవు (Leave)") {
                                  absentD += 1;
                                  dayMsg += `❌ సెలవు (Leave)\n`;
                                } else {
                                  presentD += 1;
                                  if (e.work) {
                                      dayMsg += `✅ ${e.work}\n`;
                                  } else {
                                      dayMsg += `✅ హాజరు (Present)\n`;
                                  }
                                }
                                
                                if (e.customerName) {
                                  dayMsg += `👤 రైతు: ${e.customerName}\n`;
                                }

                                if (e.workMode === "hourly") {
                                  const sTime = e.startTimeRaw ? new Date(e.startTimeRaw).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "--:--";
                                  const eTime = e.endTimeRaw ? new Date(e.endTimeRaw).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "--:--";
                                  dayMsg += `⏱️ పని: ${sTime} - ${eTime} (${e.totalHoursStr})\n`;
                                  if (e.hasBreak) {
                                    const bs = e.breakStartTimeRaw ? new Date(e.breakStartTimeRaw).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "--:--";
                                    const be = e.breakEndTimeRaw ? new Date(e.breakEndTimeRaw).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "--:--";
                                    dayMsg += `☕ బ్రేక్: ${bs} - ${be}\n`;
                                  }
                                } else if (e.workMode === "acres") {
                                  dayMsg += `🚜 విస్తీర్ణం: ${e.acresWorked} ఎకరాలు\n`;
                                }

                                if (e.advanceAmount && Number(e.advanceAmount) > 0) {
                                  dayMsg += `💰 అడ్వాన్స్: ₹${e.advanceAmount}\n`;
                                }
                                if (e.cuttingAmount && Number(e.cuttingAmount) > 0) {
                                  dayMsg += `✂️ కోత: ₹${e.cuttingAmount}\n`;
                                }
                                if (e.cuttingReason) {
                                  dayMsg += `📌 కోత కారణం: ${e.cuttingReason}\n`;
                                }
                                dailyLog.push(dayMsg.trim());
                              }
                            });

                            let msg = `🚜 *Kisan Khata - Driver Report*\n`;
                            msg += `👤 *డ్రైవర్ పేరు:* ${dName || 'Driver'}\n`;
                            msg += `📅 *నెల:* ${startStr} - ${endStr}\n\n`;
                            msg += `💵 *నెల జీతం:* ₹${cycle.monthlySalary}\n`;
                            msg += `✂️ *అడ్వాన్స్ + కోత:* ₹${totalAdvance}\n`;
                            msg += `💰 *ఇవ్వాల్సిన బ్యాలెన్స్:* ₹${balance}\n\n`;
                            msg += `📋 *హాజరు వివరాలు:*\n`;
                            msg += `- మొత్తం రోజులు: ${days.length}\n`;
                            msg += `- హాజరైన రోజులు: ${presentD}\n`;
                            msg += `- కోత (Absent): ${absentD}\n`;
                            
                            if (dailyLog.length > 0) {
                                msg += `\n📝 *రోజువారీ పనుల వివరాలు:*\n\n`;
                                msg += dailyLog.join('\n\n');
                            }

                            Linking.openURL(`whatsapp://send?text=${encodeURIComponent(msg)}`);
                          }}
                        >
                          <Ionicons name="logo-whatsapp" size={20} color="#16A34A" />
                          <AppText style={{ color: "#16A34A", fontWeight: "600", marginLeft: 8 }}>
                            {language === "te" ? "వాట్సాప్ లో షేర్ చేయండి" : "Share on WhatsApp"}
                          </AppText>
                        </TouchableOpacity>
                      )}

                      {/* CLEAR STATUS (SHOW FOR PAST CYCLES, OR ACTIVE CYCLES >= 28 DAYS) */}
                      {(() => {
                         let showToggle = !cycle.isActive;
                         if (cycle.isActive) {
                           const startMs = new Date(cycle.startDateRaw).getTime();
                           const todayMs = new Date().getTime();
                           const diffDays = Math.floor((todayMs - startMs) / (1000 * 60 * 60 * 24));
                           if (diffDays >= 28) showToggle = true;
                         }
                         if (!showToggle) return null;
                         
                         return (
                           <View style={[styles.statusRow, { marginTop: 15, padding: 10, backgroundColor: "#F9FAFB", borderRadius: 8 }]}>
                             <AppText style={[styles.statusText, { color: cycle.isCleared ? "#16A34A" : "#DC2626" }]}>
                               {cycle.isCleared
                                 ? (language === "te" ? "చెల్లింపు పూర్తయింది (లాక్)" : "Payment Cleared (Locked)")
                                 : (language === "te" ? "డబ్బులు ఇవ్వాలి (పెండింగ్)" : "Payment Pending")}
                             </AppText>
                             <TouchableOpacity
                               activeOpacity={cycle.isCleared ? 1 : 0.8}
                               disabled={cycle.isCleared}
                               style={[styles.toggle, { backgroundColor: cycle.isCleared ? "#16A34A" : "#DC2626", opacity: cycle.isCleared ? 0.6 : 1 }]}
                               onPress={() => {
                                 if (cycle.isCleared) return;
                                 
                                 const days = generateDaysForCycle(cycle);
                                 const todayMs = new Date().setHours(0,0,0,0);
                                 const hasMissingDays = days.some(d => 
                                   d.dateObj.getTime() <= todayMs && d.entries.length === 0
                                 );
                                 if (hasMissingDays) {
                                    setShowMissingDaysWarning(true);
                                    return;
                                 }

                                 setClearId(cycle.id);
                               }}
                             >
                               <View style={[styles.toggleCircle, { alignSelf: cycle.isCleared ? "flex-end" : "flex-start" }]} />
                             </TouchableOpacity>
                           </View>
                         );
                      })()}
                  </View>
                )}

                {/* CHRONOLOGICAL DAILY LIST */}
                {isOpen && (
                  <View style={{ backgroundColor: "#F3F4F6", padding: 8 }}>
                    {generateDaysForCycle(cycle).map((day) => {
                      const hasEntry = day.entries && day.entries.length > 0;
                      const isMissed = !hasEntry && day.dateObj.getTime() < new Date().setHours(23, 59, 59, 999);
                      const isFuture = !hasEntry && !isMissed;

                      return (
                        <View key={day.dateStr} style={{ marginBottom: 8 }}>
                           <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6, marginLeft: 4 }}>
                             <Ionicons name="calendar-outline" size={16} color="#4B5563" style={{ marginRight: 6 }} />
                             <AppText style={{ fontSize: 14, color: "#4B5563", fontWeight: "600" }}>
                               {day.dateStr}
                             </AppText>
                           </View>

                           {isMissed && (
                               <View style={{ backgroundColor: "#FEF2F2", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#FECACA", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                 <View style={{ flexDirection: "row", alignItems: "center" }}>
                                   <Ionicons name="warning" size={16} color="#7F1D1D" style={{ marginRight: 6 }} />
                                   <AppText style={{ color: "#7F1D1D", fontWeight: "600", fontSize: 14 }}>{language === "te" ? "మిస్ అయ్యింది" : "Missed Entry"}</AppText>
                                 </View>
                                 {!cycle.isCleared && (
                                   <TouchableOpacity 
                                      style={{ backgroundColor: "#DC2626", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}
                                      onPress={() => router.push({
                                          pathname: "/farmer/vechile-drivers/add-monthly-driverwork",
                                          params: { vehicleId: vId, driverId: dId, cycleId: cycle.id, prefillDate: day.dateStr, prefillDateRaw: day.dateObj.toISOString(), balance: balance }
                                      })}
                                   >
                                      <AppText style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>{language === "te" ? "ఇప్పుడు వేయండి" : "Add Now"}</AppText>
                                   </TouchableOpacity>
                                 )}
                               </View>
                           )}

                           {isFuture && (
                               <View style={{ backgroundColor: "#F9FAFB", opacity: 0.7, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#E5E7EB", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                                 <View style={{ flexDirection: "row", alignItems: "center" }}>
                                   <Ionicons name="time-outline" size={16} color="#6B7280" style={{ marginRight: 6 }} />
                                   <AppText style={{ color: "#6B7280", fontSize: 14 }}>{language === "te" ? "రాబోయే రోజు" : "Upcoming"}</AppText>
                                 </View>
                               </View>
                           )}

                           {hasEntry && day.entries.map((e: any, index: number) => (
                             <View key={e.id || index} style={{ backgroundColor: "#fff", borderRadius: 12, marginBottom: index < day.entries.length - 1 ? 12 : 0, padding: 16, borderWidth: 1, borderColor: "#E5E7EB" }}>
                                <View style={[styles.rowBetween, { alignItems: 'flex-start' }]}>
                                  
                                  {/* LEFT COLUMN: Work, Customer, Attendance */}
                                  <View style={{ flex: 1, paddingRight: 12 }}>
                                    {e.work ? (
                                       <AppText style={{ fontSize: 17, color: "#1F2937", fontWeight: "600", fontFamily: "Mandali", lineHeight: 28 }}>
                                         {e.work}
                                       </AppText>
                                    ) : null}

                                    {e.customerName ? (
                                       <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                                         <Ionicons name="person-outline" size={15} color="#4B5563" style={{ marginRight: 6 }} />
                                         <AppText style={{ fontSize: 15, color: "#4B5563", fontWeight: "600", fontFamily: "Mandali" }}>
                                           {e.customerName}
                                         </AppText>
                                       </View>
                                    ) : null}

                                    {e.attendance === "absent" && (
                                      <View style={{ marginTop: 8, alignSelf: "flex-start", backgroundColor: "#FEE2E2", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, flexDirection: "row", alignItems: "center" }}>
                                        <Ionicons name="close-circle" size={15} color="#DC2626" style={{ marginRight: 6 }} />
                                        <AppText style={{ fontFamily: "Mandali", fontSize: 14, color: "#DC2626", fontWeight: "600" }}>
                                          {language === "te" ? "సెలవు" : "Absent"}
                                        </AppText>
                                      </View>
                                    )}
                                  </View>

                                  {/* RIGHT COLUMN: Money Details */}
                                  <View style={{ alignItems: "flex-end", minWidth: 100 }}>
                                    {e.advanceAmount && Number(e.advanceAmount) > 0 && (
                                        <View style={{ backgroundColor: "#F0FDF4", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginBottom: 6 }}>
                                          <AppText style={{ color: "#16A34A", fontWeight: "600", fontSize: 15 }}>
                                            {language === "te" ? "అడ్వాన్స్: " : "Adv: "}+₹{Number(e.advanceAmount).toLocaleString('en-IN')}
                                          </AppText>
                                        </View>
                                    )}
                                    {e.cuttingAmount && Number(e.cuttingAmount) > 0 && (
                                        <View style={{ backgroundColor: "#FEF2F2", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
                                          <AppText style={{ color: "#DC2626", fontWeight: "600", fontSize: 15 }}>
                                            {language === "te" ? "కోత: " : "Cut: "}-₹{Number(e.cuttingAmount).toLocaleString('en-IN')}
                                          </AppText>
                                        </View>
                                    )}
                                  </View>

                                </View>

                                {/* REASON BLOCK */}
                                {e.cuttingAmount && Number(e.cuttingAmount) > 0 && e.cuttingReason && (
                                  <View style={{ backgroundColor: "#F9FAFB", padding: 10, borderRadius: 8, marginTop: 12, borderWidth: 1, borderColor: "#E5E7EB" }}>
                                    <AppText style={{ color: "#4B5563", fontSize: 14, fontWeight: "600", lineHeight: 24 }}>
                                      <AppText style={{ color: "#374151", fontWeight: "600" }}>{language === "te" ? "కోతకి గల కారణం: " : "Reason for deduction: "}</AppText>
                                      {e.cuttingReason}
                                    </AppText>
                                  </View>
                                )}

                                {/* Work Details */}
                                {(e.workMode === "hourly" || e.workMode === "acres") && (
                                  <View style={{ backgroundColor: "#F8FAFC", padding: 10, borderRadius: 8, marginTop: 10 }}>
                                    {e.workMode === "hourly" ? (
                                      <View style={{ gap: 4 }}>
                                        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
                                          <Ionicons name="time-outline" size={14} color="#4B5563" style={{ marginRight: 4 }} />
                                          <AppText style={{ fontFamily: "Mandali", fontSize: 13, color: "#4B5563" }}>
                                            {language === "te" ? "పని సమయం: " : "Work Time: "}
                                            <AppText style={{ fontWeight: "600", color: "#1F2937" }}>
                                              {e.startTimeRaw ? new Date(e.startTimeRaw).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "--:--"} - {e.endTimeRaw ? new Date(e.endTimeRaw).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "--:--"}
                                            </AppText>
                                          </AppText>
                                        </View>
                                        
                                        {e.hasBreak && (
                                          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
                                            <Ionicons name="cafe-outline" size={14} color="#EF4444" style={{ marginRight: 4 }} />
                                            <AppText style={{ fontFamily: "Mandali", fontSize: 13, color: "#EF4444" }}>
                                              {language === "te" ? "బ్రేక్ సమయం (-): " : "Break Time (-): "}
                                              <AppText style={{ fontWeight: "600", color: "#EF4444" }}>
                                                {e.breakStartTimeRaw ? new Date(e.breakStartTimeRaw).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "--:--"} - {e.breakEndTimeRaw ? new Date(e.breakEndTimeRaw).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "--:--"}
                                              </AppText>
                                            </AppText>
                                          </View>
                                        )}

                                        <View style={{ height: 1, backgroundColor: "#E5E7EB", marginVertical: 4 }} />
                                        
                                        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
                                          <Ionicons name="checkmark-done" size={14} color="#16A34A" style={{ marginRight: 4 }} />
                                          <AppText style={{ fontFamily: "Mandali", fontSize: 13, color: "#16A34A" }}>
                                            {language === "te" ? "అసలు పని: " : "Actual Work: "}
                                            <AppText style={{ fontWeight: "600", color: "#16A34A" }}>{e.totalHoursStr}</AppText>
                                          </AppText>
                                        </View>
                                      </View>
                                    ) : (
                                      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
                                        <Ionicons name="map-outline" size={14} color="#4B5563" style={{ marginRight: 4 }} />
                                        <AppText style={{ fontFamily: "Mandali", fontSize: 13, color: "#4B5563" }}>
                                          {language === "te" ? "విస్తీర్ణం: " : "Area: "}
                                          <AppText style={{ fontWeight: "600", color: "#1F2937" }}>{e.acresWorked} {language === "te" ? "ఎకరాలు" : "Acres"}</AppText>
                                        </AppText>
                                      </View>
                                    )}
                                  </View>
                                )}

                             </View>
                           ))}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          }}
        />
        </>
      )}

      {/* FLOATING ADD BUTTON (Add today directly) */}
      {cycles.find(c => c.isActive) && (
          <TouchableOpacity activeOpacity={0.8}
            style={styles.addBtn}
            onPress={() => {
              const active = cycles.find(c => c.isActive);
              if (active) {
                 const activeEntries = entries.filter(e => e.cycleId === active.id);
                 const sumAdvances = activeEntries.reduce((sum, e) => sum + (Number(e.advanceAmount) || 0) + (Number(e.cuttingAmount) || 0), 0);
                 const activeAdvance = sumAdvances + (Number(active.previousAdvance) || 0);
                 const activeBalance = active.monthlySalary - activeAdvance;
                 router.push({
                   pathname: "/farmer/vechile-drivers/add-monthly-driverwork",    
                   params: { vehicleId: vId, driverId: dId, cycleId: active.id, balance: activeBalance }
                 });
              }
            }}
          >
            <LinearGradient colors={["#16A34A","#166534"]} style={styles.addGradient}>
              <Ionicons name="add" size={30} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
      )}

      {/* ONBOARDING MODAL */}
      <Modal visible={showOnboarding} transparent animationType="slide">
        <View style={styles.modalOverlayStandard}>
          <View style={styles.modalContentStandard}>
            <View style={styles.modalIconBgStandard}>
               <Ionicons name="calendar-outline" size={36} color="#e44830" />
            </View>
            <AppText style={styles.modalTitleStandard}>{language === "te" ? "ప్రస్తుత నెల ప్రారంభం" : "Start Current Month"}</AppText>
            <AppText style={styles.modalSubStandard}>
              {language === "te" 
                 ? `గమనిక: డ్రైవర్ పాత జాయినింగ్ తేదీ ఇవ్వకండి. మీరు లెక్క రాస్తున్న ఈ ప్రస్తుత నెల ఎప్పటి నుండి మొదలైందో ఆ తేదీ మాత్రమే ఎంచుకోండి.` 
                 : `Note: Do not enter the old joining date. Only select the starting date of the currently active month.`}
            </AppText>
            
            <View style={{ width: "100%", marginBottom: 20 }}>
                <AppText style={styles.label}>{language === "te" ? "మొదలైన తేదీ*" : "Start Date*"}</AppText>
                <TouchableOpacity style={styles.inputBox} onPress={() => setShowDatePicker(true)}>
                    <AppText style={{ color: onboardDate ? "#1F2937" : "#9CA3AF" }}>
                        {onboardDate ? onboardDate.toLocaleDateString('en-GB').replace(/\//g, '-') : (language === "te" ? "తేదీ ఎంచుకోండి" : "Select Date")}
                    </AppText>
                </TouchableOpacity>
            </View>

            <View style={styles.modalButtonsStandard}>
              <TouchableOpacity activeOpacity={0.8} style={styles.modalCancelBtnStandard} onPress={() => { setShowOnboarding(false); router.back(); }}>
                <AppText style={styles.modalCancelTextStandard}>{language === "te" ? "రద్దు చేయి" : "Cancel"}</AppText>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.8} style={styles.modalConfirmBtnStandard} onPress={handleCreateFirstCycle}>
                <AppText style={styles.modalConfirmTextStandard}>{language === "te" ? "నెల ప్రారంభించు" : "Start Month"}</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* NEW MONTH MODAL */}
      <Modal visible={showNewMonthModal} transparent animationType="slide">
        <View style={styles.modalOverlayStandard}>
          <View style={styles.modalContentStandard}>
            <View style={styles.modalIconBgStandard}>
               <Ionicons name="refresh-outline" size={36} color="#e44830" />
            </View>
            <AppText style={styles.modalTitleStandard}>{language === "te" ? "కొత్త నెల ప్రారంభించండి" : "Start New Month"}</AppText>
            
            <View style={{ width: "100%", marginBottom: 20, marginTop: 10 }}>
                <AppText style={styles.label}>{language === "te" ? "కొత్త నెల ఎప్పటినుండి?*" : "New Start Date*"}</AppText>
                <TouchableOpacity style={styles.inputBox} onPress={() => setShowNewMonthPicker(true)}>
                    <AppText style={{ color: newMonthDate ? "#1F2937" : "#9CA3AF" }}>
                        {newMonthDate ? newMonthDate.toLocaleDateString('en-GB').replace(/\//g, '-') : (language === "te" ? "తేదీ ఎంచుకోండి" : "Select Date")}
                    </AppText>
                </TouchableOpacity>
            </View>

            <View style={{ width: "100%", marginBottom: 20 }}>
                <AppText style={styles.label}>{language === "te" ? "జీతం పాతదే ఉంచాలా, ఏమైనా మారుస్తారా?*" : "Keep old salary or update it?*"}</AppText>
                <TextInput
                    style={styles.inputBox}
                    value={newMonthSalary}
                    onChangeText={setNewMonthSalary}
                    keyboardType="numeric"
                    placeholder={language === "te" ? "జీతం (ఉదా: 30000)" : "Salary (e.g. 30000)"}
                    placeholderTextColor="#9CA3AF"
                    selectionColor="#16A34A40"
                    cursorColor="#16A34A"
                />
            </View>

            {!!newMonthError && (
                <View style={{ width: "100%", alignItems: "center", marginBottom: 15 }}>
                    <AppText style={{ color: "#DC2626", fontSize: 13, fontFamily: "Mandali", fontWeight: "600", textAlign: "center" }}>
                        {newMonthError}
                    </AppText>
                </View>
            )}

            <View style={styles.modalButtonsStandard}>
              <TouchableOpacity activeOpacity={0.8} style={styles.modalCancelBtnStandard} onPress={() => setShowNewMonthModal(false)}>
                <AppText style={styles.modalCancelTextStandard}>{language === "te" ? "రద్దు చేయి" : "Cancel"}</AppText>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.8} style={styles.modalConfirmBtnStandard} onPress={handleStartNewMonth}>
                <AppText style={styles.modalConfirmTextStandard}>{language === "te" ? "ప్రారంభించు" : "Start"}</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* CLEAR MODAL */}
      <Modal visible={!!clearId} transparent animationType="fade">
        <View style={styles.modalOverlayStandard}>
          <View style={styles.modalContentStandard}>
            <View style={[styles.modalIconBgStandard, { backgroundColor: "#DCFCE7" }]}>
              <Ionicons name="checkmark-done" size={36} color="#16A34A" />
            </View>
            <AppText style={[styles.modalTitleStandard, { color: "#16A34A" }]}>
              {language === "te" ? "చెల్లింపు పూర్తయ్యిందా?" : "Confirm Clearance"}
            </AppText>
            <AppText style={styles.modalSubStandard}>
              {language === "te"
                ? "లాక్ చేసిన తర్వాత మళ్లీ మార్చలేరు. డ్రైవర్ కి పూర్తి డబ్బులు ఇస్తేనే లాక్ చేయండి."
                : "Once locked, it cannot be changed. Turn this on only if you have paid the driver in full."}
            </AppText>
            <View style={styles.modalButtonsStandard}>
              <TouchableOpacity activeOpacity={0.8} style={styles.modalCancelBtnStandard} onPress={() => setClearId(null)}>
                <AppText style={styles.modalCancelTextStandard}>{language === "te" ? "రద్దు చేయి" : "Cancel"}</AppText>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.8} style={[styles.modalConfirmBtnStandard, { backgroundColor: "#16A34A" }]} onPress={handleToggleClear}>
                <AppText style={styles.modalConfirmTextStandard}>{language === "te" ? "అవును" : "Confirm"}</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MISSING DAYS WARNING MODAL */}
      <Modal visible={showMissingDaysWarning} transparent animationType="fade">
        <View style={styles.modalOverlayStandard}>
          <View style={styles.modalContentStandard}>
            <View style={[styles.modalIconBgStandard, { backgroundColor: "#FEE2E2" }]}>
              <Ionicons name="warning-outline" size={36} color="#DC2626" />
            </View>
            <AppText style={[styles.modalTitleStandard, { color: "#DC2626" }]}>
              {language === "te" ? "హాజరు పెండింగ్" : "Attendance Pending"}
            </AppText>
            <AppText style={styles.modalSubStandard}>
              {language === "te"
                ? "ఈ నెలలో ఇంకా కొన్ని రోజులకు హాజరు వేయలేదు. దయచేసి అన్ని రోజులకూ హాజరు లేదా సెలవు వేసిన తర్వాతే లాక్ చేయండి."
                : "Please mark attendance or leave for all missing days before locking."}
            </AppText>
            <View style={styles.modalButtonsStandard}>
              <TouchableOpacity activeOpacity={0.8} style={[styles.modalConfirmBtnStandard, { backgroundColor: "#DC2626", width: "100%" }]} onPress={() => setShowMissingDaysWarning(false)}>
                <AppText style={styles.modalConfirmTextStandard}>{language === "te" ? "సరే" : "OK"}</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <DateTimePickerModal
        isVisible={showDatePicker}
        mode="date"
        onConfirm={(d) => { setOnboardDate(d); setShowDatePicker(false); }}
        onCancel={() => setShowDatePicker(false)}
      />
      <DateTimePickerModal
        isVisible={showNewMonthPicker}
        mode="date"
        onConfirm={(d) => { setNewMonthDate(d); setNewMonthError(""); setShowNewMonthPicker(false); }}
        onCancel={() => setShowNewMonthPicker(false)}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" }, 
  cropCard: { backgroundColor: "#fff", borderRadius: 16, marginBottom: 12, overflow: "hidden", borderWidth: 1, borderColor: "#E5E7EB", marginHorizontal: 4 },
  cropHeader: { flexDirection: "row", justifyContent: "space-between", padding: 16, backgroundColor: "#F9FAFB" },
  cropTitle: { fontSize: 18, fontWeight: "600", color: "#111827", fontFamily: "Mandali" },
  cropCount: { fontSize: 14, color: "#6B7280", marginTop: 2, fontFamily: "Mandali" },
  label: { fontSize: 14, color: "#6B7280", fontFamily: "Mandali" },
  value: { fontSize: 14, fontWeight: "600", color: "#111827", textAlign: "right" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  workCard: { padding: 14, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  date: { fontSize: 13, color: "#6B7280" },
  addBtn: { position: "absolute", bottom: 30, right: 20 },
  addGradient: { width: 60, height: 60, borderRadius: 30, justifyContent: "center", alignItems: "center" },
  statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  statusText: { fontSize: 14, fontWeight: "600", fontFamily: "Mandali" },
  toggle: { width: 44, height: 24, borderRadius: 22, padding: 2, justifyContent: "center" },
  toggleCircle: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff" },
  inputBox: { borderWidth: 1, borderColor: "#E5E7EB", padding: 12, borderRadius: 8, marginTop: 6, backgroundColor: "#F9FAFB" },
  modalOverlayStandard: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 999 },
  modalContentStandard: { width: "85%", backgroundColor: "white", borderRadius: 25, padding: 25, alignItems: "center" },
  modalTitleStandard: { fontSize: 20, fontWeight: "600", color: "#e2431f", marginVertical: 10, fontFamily: "Mandali" },
  modalSubStandard: { textAlign: "center", color: "#64748B", marginBottom: 20, fontFamily: "Mandali", lineHeight: 22 },
  modalButtonsStandard: { flexDirection: "row", gap: 10 },
  modalCancelBtnStandard: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#F1F5F9", alignItems: "center" },
  modalConfirmBtnStandard: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#EF4444", alignItems: "center" },
  modalCancelTextStandard: { color: "#64748B", fontWeight: "600" },
  modalConfirmTextStandard: { color: "white", fontWeight: "600" },
  modalIconBgStandard: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#f5e8e8", justifyContent: "center", alignItems: "center", marginBottom: 10 },
});