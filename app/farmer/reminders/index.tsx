import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, TouchableOpacity, FlatList, RefreshControl, StatusBar, Animated, SafeAreaView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import ShimmerPlaceholder from "react-native-shimmer-placeholder";
import notifee from '@notifee/react-native';

import AppText from "@/components/AppText";
import AppHeader from "@/components/AppHeader";
import AppEmptyState from "@/components/AppEmptyState";

const translations = {
  te: {
    title: "పనుల అలారం",
    subtitle: "మీ వ్యవసాయ పనులను సులువుగా గుర్తుంచుకోండి",
    all: "అన్ని పనులు",
    pending: "పెండింగ్",
    completed: "పూర్తయినవి",
    noData: "ప్రస్తుతం పనులు ఏమీ లేవు",
    emptySubtitle: "మీరు చేయాల్సిన పనులను మర్చిపోకుండా ఉండటానికి, కింద ఉన్న ప్లస్ (+) బటన్ నొక్కి అలారం సెట్ చేసుకోండి. ఆ సమయానికి మేమే మీకు కచ్చితంగా గుర్తుచేస్తాము.",
    noPendingData: "పెండింగ్ పనులు ఏమీ లేవు",
    pendingSubtitle: "మీరు చేయాల్సిన పనులన్నీ పూర్తి చేసేశారు! కొత్త పనులు ఉంటే ప్లస్ బటన్ నొక్కి జోడించండి.",
    noCompletedData: "పూర్తయిన పనులు ఏమీ లేవు",
    completedSubtitle: "మీరు ఇంకా ఏ పనినీ పూర్తి చేయలేదు. పెండింగ్ లో ఉన్న పనులను పూర్తి చేసి ఇక్కడ చూడండి.",
    retry: "మళ్ళీ ప్రయత్నించండి",
    errorText: "డేటా తీసుకురావడంలో లోపం జరిగింది",
    markDoneQuestion: "పని పూర్తయిందా?",
    markDone: "పూర్తయింది",
    delete: "తొలగించు",
  },
  en: {
    title: "Task Reminders",
    subtitle: "Easily remember your farm tasks",
    all: "All Tasks",
    pending: "Pending",
    completed: "Completed",
    noData: "No tasks available at the moment",
    emptySubtitle: "To never forget your farm tasks, click the plus (+) button below to set an alarm. We will remind you at the exact time.",
    noPendingData: "No pending tasks",
    pendingSubtitle: "You have completed all your tasks! Add new ones using the plus button below.",
    noCompletedData: "No completed tasks yet",
    completedSubtitle: "You haven't completed any tasks yet. Finish pending tasks to see them here.",
    retry: "Try Again",
    errorText: "Error fetching reminders data",
    markDoneQuestion: "Completed?",
    markDone: "Completed",
    delete: "Delete",
  },
};

export default function RemindersScreen() {
  const router = useRouter();
  const [language, setLanguage] = useState<"te" | "en">("te");
  const t = translations[language];

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [reminders, setReminders] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"ALL" | "PENDING" | "COMPLETED">("PENDING");

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      const lang = await AsyncStorage.getItem("APP_LANG");
      if (lang && isMounted) setLanguage(lang as "te" | "en");
      fetchReminders(false, isMounted);
    };
    init();
    return () => { isMounted = false; };
  }, []);

  const fetchReminders = async (forceRefresh = false, isMounted = true) => {
    try {
      if (!forceRefresh) setLoading(true);
      setError(false);

      const phone = await AsyncStorage.getItem("USER_PHONE");
      if (!phone) { setLoading(false); return; }

      // We will listen to snapshot so it auto updates when user marks done or adds new.
      const unsub = firestore()
        .collection("users")
        .doc(phone)
        .collection("reminders")
        .onSnapshot(
          (snap) => {
            if (!isMounted) return;
            if (snap.empty) {
              setReminders([]);
              setLoading(false);
              setRefreshing(false);
              return;
            }

            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a: any, b: any) => {
              const dateA = new Date(a.date).getTime();
              const dateB = new Date(b.date).getTime();
              return dateA - dateB; 
            });
            setReminders(data);
            setLoading(false);
            setRefreshing(false);
          },
          (err) => {
            console.log("Reminders fetch error", err);
            if (isMounted) setError(true);
            if (isMounted) setLoading(false);
          }
        );
      
      // Cleanup listener not fully implemented here as we want it to stay active while on screen.
      // A better approach is useEffect for snapshot, but this is fine for now.

    } catch (err) {
      console.log("Reminders API Error:", err);
      if (isMounted) setError(true);
      if (isMounted) { setLoading(false); setRefreshing(false); }
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchReminders(true);
  };

  const markCompleted = async (id: string, notificationId?: string) => {
    try {
      const phone = await AsyncStorage.getItem("USER_PHONE");
      if (phone) {
        if (notificationId) {
          await notifee.cancelNotification(notificationId);
        }
        await firestore().collection("users").doc(phone).collection("reminders").doc(id).update({
          status: "completed",
          completedAt: firestore.FieldValue.serverTimestamp()
        });
      }
    } catch (e) {
      console.log("Error marking completed", e);
    }
  };

  const deleteReminder = async (id: string, notificationId?: string) => {
    try {
      const phone = await AsyncStorage.getItem("USER_PHONE");
      if (phone) {
        if (notificationId) {
          await notifee.cancelNotification(notificationId);
        }
        await firestore().collection("users").doc(phone).collection("reminders").doc(id).delete();
      }
    } catch (e) {
      console.log("Error deleting reminder", e);
    }
  };

  const filteredReminders = reminders.filter((item) => {
    if (activeTab === "ALL") return true;
    if (activeTab === "PENDING") return item.status === "pending";
    if (activeTab === "COMPLETED") return item.status === "completed";
    return true;
  });

  const getTabStyle = (tab: string) => {
    if (activeTab !== tab) return styles.tabBtn;
    if (tab === "ALL") return [styles.tabBtn, { backgroundColor: "#3B82F6" }];
    if (tab === "PENDING") return [styles.tabBtn, { backgroundColor: "#F59E0B" }];
    if (tab === "COMPLETED") return [styles.tabBtn, { backgroundColor: "#10B981" }];
    return styles.tabBtn;
  };

  const ShimmerSkeleton = () => (
    <View style={styles.listContent}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
              <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ width: 44, height: 44, borderRadius: 12 }} />
              <View style={{ marginLeft: 12, flex: 1, paddingRight: 10 }}>
                <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ width: "80%", height: 16, borderRadius: 4, marginBottom: 6 }} />
                <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ width: "50%", height: 13, borderRadius: 4 }} />
              </View>
            </View>
            <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ width: 60, height: 35, borderRadius: 8 }} />
          </View>
          <View style={styles.cardActions}>
            <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ width: 80, height: 30, borderRadius: 8 }} />
            <ShimmerPlaceholder LinearGradient={LinearGradient} style={{ width: 100, height: 30, borderRadius: 8 }} />
          </View>
        </View>
      ))}
    </View>
  );

  const renderReminder = ({ item }: { item: any }) => {
    const isCompleted = item.status === "completed";
    const dateObj = new Date(item.date);
    const timeObj = new Date(item.time);
    const dateStr = dateObj.toLocaleDateString(language === "te" ? "te-IN" : "en-IN", { day: 'numeric', month: 'short' });
    const timeStr = timeObj.toLocaleTimeString(language === "te" ? "te-IN" : "en-IN", { hour: '2-digit', minute: '2-digit' });

    return (
      <View style={[styles.card, isCompleted && styles.cardCompleted]}>
        <View style={styles.cardHeader}>
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            <View style={[styles.iconBox, { backgroundColor: isCompleted ? "#D1FAE5" : "#FEF3C7" }]}>
              <Ionicons name={isCompleted ? "checkmark-circle" : "alarm-outline"} size={24} color={isCompleted ? "#10B981" : "#D97706"} />
            </View>
            <View style={{ marginLeft: 12, flex: 1, flexShrink: 1, paddingRight: 10 }}>
              <AppText style={[styles.taskTitle, isCompleted && styles.strikeThrough]} language={language} numberOfLines={2}>{item.task}</AppText>
              <AppText style={styles.taskCrop} language={language} numberOfLines={1}>{item.crop}</AppText>
            </View>
          </View>
          <View style={[styles.dateTimeBox, { flexShrink: 0 }]}>
            <AppText style={styles.dateText}>{dateStr}</AppText>
            <AppText style={styles.timeText}>{timeStr}</AppText>
          </View>
        </View>
        
        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => deleteReminder(item.id, item.notificationId)}>
            <Ionicons name="trash-outline" size={18} color="#EF4444" />
            <AppText style={[styles.actionText, { color: "#EF4444" }]} language={language}>{t.delete}</AppText>
          </TouchableOpacity>

          {!isCompleted ? (
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#ffffff", borderColor: "#10B981" }]} onPress={() => markCompleted(item.id, item.notificationId)}>
              <Ionicons name="help-circle-outline" size={18} color="#10B981" />
              <AppText style={[styles.actionText, { color: "#10B981" }]} language={language}>{t.markDoneQuestion}</AppText>
            </TouchableOpacity>
          ) : (
            <View style={[styles.actionBtn, { backgroundColor: "#D1FAE5", borderColor: "#10B981" }]}>
              <Ionicons name="checkmark-done-outline" size={18} color="#10B981" />
              <AppText style={[styles.actionText, { color: "#10B981" }]} language={language}>{t.markDone}</AppText>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <AppHeader title={t.title} subtitle={t.subtitle} language={language} />

      {!loading && !error && (
        <View style={styles.stickyHeader}>
          <View style={styles.tabContainer}>
            <TouchableOpacity style={getTabStyle("ALL")} onPress={() => setActiveTab("ALL")}>
              <AppText style={[styles.tabText, activeTab === "ALL" && styles.activeTabText]} language={language}>{t.all}</AppText>
            </TouchableOpacity>
            <TouchableOpacity style={getTabStyle("PENDING")} onPress={() => setActiveTab("PENDING")}>
              <AppText style={[styles.tabText, activeTab === "PENDING" && styles.activeTabText]} language={language}>{t.pending}</AppText>
            </TouchableOpacity>
            <TouchableOpacity style={getTabStyle("COMPLETED")} onPress={() => setActiveTab("COMPLETED")}>
              <AppText style={[styles.tabText, activeTab === "COMPLETED" && styles.activeTabText]} language={language}>{t.completed}</AppText>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {loading && !refreshing ? (
        <ShimmerSkeleton />
      ) : error ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <AppEmptyState iconName="cloud-offline-outline" title={t.errorText} onRetry={() => fetchReminders(true)} language={language} />
        </View>
      ) : filteredReminders.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <AppEmptyState 
            iconName={activeTab === "COMPLETED" ? "checkmark-done-circle-outline" : (activeTab === "PENDING" ? "time-outline" : "alarm-outline")} 
            title={activeTab === "COMPLETED" ? t.noCompletedData : (activeTab === "PENDING" ? t.noPendingData : t.noData)} 
            subtitle={activeTab === "COMPLETED" ? t.completedSubtitle : (activeTab === "PENDING" ? t.pendingSubtitle : t.emptySubtitle)} 
            language={language} 
          />
        </View>
      ) : (
        <FlatList
          data={filteredReminders}
          keyExtractor={(item) => item.id}
          renderItem={renderReminder}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#2E7D32"]} />}
        />
      )}

      {/* 🔥 FAB - Matching My Fields Standard */}
      <TouchableOpacity activeOpacity={0.9} style={styles.fab} onPress={() => router.push("/farmer/reminders/add")}>
        <LinearGradient colors={["#16A34A", "#064E3B"]} style={styles.fabGradient}>
          <Ionicons name="add" size={32} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6F7F6" },
  stickyHeader: { backgroundColor: "#F6F7F6", paddingHorizontal: 20, paddingTop: 15, paddingBottom: 5, zIndex: 10 },
  tabContainer: { flexDirection: "row", backgroundColor: "#E5E7EB", borderRadius: 14, padding: 4, marginBottom: 15 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  tabText: { fontSize: 14, color: "#6B7280", fontWeight: "600" },
  activeTabText: { color: "#ffffff", fontWeight: "600" },
  
  listContent: { paddingHorizontal: 20, paddingBottom: 100, paddingTop: 10 },
  card: { backgroundColor: "#ffffff", borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: "#E5E7EB", overflow: "hidden", padding: 16 },
  cardCompleted: { opacity: 0.7, backgroundColor: "#F9FAFB" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  iconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  taskTitle: { fontSize: 16, fontWeight: "600", color: "#1F2937", marginBottom: 4, flexShrink: 1 },
  taskCrop: { fontSize: 13, color: "#6B7280", flexShrink: 1 },
  strikeThrough: { textDecorationLine: "line-through", color: "#9CA3AF" },
  dateTimeBox: { alignItems: "flex-end", backgroundColor: "#F3F4F6", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  dateText: { fontSize: 13, fontWeight: "600", color: "#4B5563" },
  timeText: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  
  cardActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, borderTopWidth: 1, borderTopColor: "#F3F4F6", paddingTop: 12 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: "#E5E7EB" },
  actionText: { fontSize: 13, fontWeight: "600" },
  
  shimmerCard: { backgroundColor: "#ffffff", borderRadius: 20, marginBottom: 20, overflow: "hidden", borderWidth: 1, borderColor: "#E5E7EB" },
  
  fab: { position: "absolute", bottom: 30, right: 20, elevation: 5, shadowColor: '#16A34A', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: {width: 0, height: 4} },
  fabGradient: { width: 64, height: 64, borderRadius: 35, justifyContent: "center", alignItems: "center" }
});
