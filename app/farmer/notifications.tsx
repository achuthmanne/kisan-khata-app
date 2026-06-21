import AppHeader from "@/components/AppHeader";
import { executeOfflineSafeRead, executeOfflineSafeWrite, executeOfflineSafeFetch } from "@/utils/offlineHelper";

import AppText from "@/components/AppText";
import AppEmptyState from "@/components/AppEmptyState"; // 🔥 మన గ్లోబల్ కాంపోనెంట్
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import firestore from "@react-native-firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import {
  Animated, FlatList, Linking, SafeAreaView,
  StatusBar,
  StyleSheet, TextInput, TouchableOpacity,
  View
} from "react-native";
import ShimmerPlaceholder from "react-native-shimmer-placeholder";

export default function Notifications() {

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [language, setLanguage] = useState<"te" | "en">("en");
  const [submittedMap, setSubmittedMap] = useState<{[key:string]: boolean}>({});
  const [ratingMap, setRatingMap] = useState<{[key:string]: number}>({});
  const [feedbackMap, setFeedbackMap] = useState<{[key:string]: string}>({});
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 6,
      useNativeDriver: true
    }).start();
  }, [submittedMap]);

  useEffect(() => {
    const loadLang = async () => {
      const lang = await AsyncStorage.getItem("APP_LANG");
      if (lang) setLanguage(lang as "te" | "en");
    };

    loadLang();
  }, []);

  /* ---------------- FETCH + AUTO DELETE ---------------- */
  useEffect(() => {
    const unsub = firestore()
      .collection("notifications")
      .onSnapshot(async snap => {

        const list: any[] = [];
        const now = new Date();
        const phone = await AsyncStorage.getItem("USER_PHONE");

        if (!phone) return; // 🔥 important
        const hiddenSnap = await executeOfflineSafeRead(firestore()
          .collection("users")
          .doc(phone)
          .collection("hiddenNotifications"), true
          );

        const userDoc = await executeOfflineSafeRead(firestore()
          .collection("users")
          .doc(phone), true
          );

        const userState = userDoc.data()?.state;
        const hiddenIds = hiddenSnap.docs.map((d: any) => d.id);
        const normalize = (s:any) => (s || "").trim().toLowerCase();

        for (const doc of snap.docs) {
          const data = doc.data();
          let deleteTime = null;

          // 🔥 SKIP hidden
          if (hiddenIds.includes(doc.id)) {
            continue;
          }

          // 🔥 SAFE CONVERSION
          if (data.deleteAt && typeof data.deleteAt.toDate === "function") {
            deleteTime = data.deleteAt.toDate();
          }

          if (deleteTime && now > deleteTime) {
            continue;
          }

          if (data.userId === "all") {
            // show
          }
          else if (data.state) {
            if (!userState || normalize(data.state) !== normalize(userState)) {
              continue;
            }
          }
          else if (data.userId && data.userId !== phone) {
            continue;
          }

          list.push({ id: doc.id, ...data });
        }

        // 🔥 SORT MANUALLY
        list.sort((a, b) => {
          const aTime = a.createdAt?.toDate?.()?.getTime() || 0;
          const bTime = b.createdAt?.toDate?.()?.getTime() || 0;
          return bTime - aTime;
        });

        setData(list);
        setLoading(false);
      });

    return () => unsub();
  }, []);

  /* ---------------- FEEDBACK SAVE ---------------- */
  const submitFeedback = async (itemId:string) => {
    if (!ratingMap[itemId]) return;
    const phone = await AsyncStorage.getItem("USER_PHONE");
    if (!phone) return;

    const userDoc = await executeOfflineSafeRead(firestore()
      .collection("users")
      .doc(phone), true
      );

    const userData = userDoc.data();

    await executeOfflineSafeWrite(firestore().collection("feedback").add({
      rating: ratingMap[itemId],
      feedback: ratingMap[itemId] < 5 ? (feedbackMap[itemId] || "") : "",
      userName: userData?.name || "Farmer",
      phone: phone || "",
      notificationId: itemId,
      createdAt: firestore.FieldValue.serverTimestamp()
    }));

    // 🔥 HIDE NOTIFICATION
    await executeOfflineSafeWrite(firestore()
      .collection("users")
      .doc(phone)
      .collection("hiddenNotifications")
      .doc(itemId)
      .set({
        hiddenAt: firestore.FieldValue.serverTimestamp()
      }));

    setSubmittedMap(prev => ({
      ...prev,
      [itemId]: true
    }));

    Animated.timing(scaleAnim, {
      toValue: 0.8,
      duration: 300,
      useNativeDriver: true
    }).start();

    // ⏳ delay hide (smooth UX)
    setTimeout(() => {
      setData(prev => prev.filter(n => n.id !== itemId));
    }, 2000); // 🔥 1.8 sec perfect feel
  };

  const openLink = async (url: string) => {
    if (!url) return;
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      console.log("Invalid URL");
    }
  };

  /* ---------------- SHIMMER ---------------- */
  const ShimmerCard = () => (
    <View style={styles.card}>
      {/* 🔹 TITLE */}
      <ShimmerPlaceholder
        LinearGradient={LinearGradient}
        duration={1600}
        shimmerColors={["#E5E7EB", "#F3F4F6", "#E5E7EB"]}
        style={{ height: 14, width: "55%", borderRadius: 4, marginBottom: 10 }}
      />
      {/* 🔹 MESSAGE LINE 1 */}
      <ShimmerPlaceholder
        LinearGradient={LinearGradient}
        duration={1600}
        shimmerColors={["#E5E7EB", "#F3F4F6", "#E5E7EB"]}
        style={{ height: 14, width: "95%", borderRadius: 4, marginBottom: 10 }}
      />
      {/* 🔹 MESSAGE LINE 2 */}
      <ShimmerPlaceholder
        LinearGradient={LinearGradient}
        duration={1600}
        shimmerColors={["#E5E7EB", "#F3F4F6", "#E5E7EB"]}
        style={{ height: 14, width: "85%", borderRadius: 4, marginBottom: 10 }}
      />
      {/* 🔹 MESSAGE LINE 3 */}
      <ShimmerPlaceholder
        LinearGradient={LinearGradient}
        duration={1600}
        shimmerColors={["#E5E7EB", "#F3F4F6", "#E5E7EB"]}
        style={{ height: 14, width: "75%", borderRadius: 4, marginBottom: 10 }}
      />
      {/* 🔹 DATE */}
      <ShimmerPlaceholder
        LinearGradient={LinearGradient}
        duration={1600}
        shimmerColors={["#E5E7EB", "#F3F4F6", "#E5E7EB"]}
        style={{ height: 14, width: "40%", borderRadius: 4, marginBottom: 10 }}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      <AppHeader
        title={language === "te" ? "నోటిఫికేషన్లు" : "Notifications"}
        language={language}
      />

      {loading ? (
        <FlatList
          data={[1,2,3]}
          keyExtractor={(i) => i.toString()}
          renderItem={() => <ShimmerCard />}
          contentContainerStyle={{ padding: 16 }}
        />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          /* 🔥 OUR NEW GLOBAL EMPTY STATE COMPONENT */
          ListEmptyComponent={
            <AppEmptyState
              iconName="notifications-outline"
              title={language === "te" ? "నోటిఫికేషన్లు లేవు" : "No Notifications"}
              subtitle={language === "te" ? "ఇక్కడ మీ అప్డేట్స్ కనిపిస్తాయి" : "You’ll see updates here"}
              language={language}
            />
          }
          contentContainerStyle={[
            { padding: 16, paddingBottom: 100 },
            // 🔥 డేటా లేనప్పుడు సెంటర్ లో రావడానికి ఫ్లెక్స్ లాజిక్
            data.length === 0 && { flexGrow: 1, justifyContent: 'center' }
          ]}
          renderItem={({ item }) => {
            const rating = ratingMap[item.id] || 0;
            const feedbackText = feedbackMap[item.id] || "";
            const isOpen = expanded === item.id;

            return (
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.card}
               onPress={async () => {
                  setExpanded(isOpen ? null : item.id);
                  // 🔥 NEW LOGIC: మెయిన్ డాక్యుమెంట్ మార్చకుండా, యూజర్ సబ్-కలెక్షన్ లో "seen" రికార్డ్ యాడ్ చేస్తున్నాం
                  const phone = await AsyncStorage.getItem("USER_PHONE");
                  if (phone && !item.seenLocally) {
                    await executeOfflineSafeWrite(firestore()
                      .collection("users")
                      .doc(phone)
                      .collection("seenNotifications") // కొత్త కలెక్షన్: యూజర్ చూసిన నోటిఫికేషన్ల జాబితా
                      .doc(item.id)
                      .set({ seenAt: firestore.FieldValue.serverTimestamp() }));
                    
                    // కరెంట్ లిస్ట్ లో వెంటనే అప్‌డేట్ అవ్వడానికి (UI కోసం)
                    setData(prev => prev.map(n => n.id === item.id ? { ...n, seenLocally: true } : n));
                  }
                }}
              >
                <AppText style={styles.title}>
                  {item.title}
                </AppText>

                <AppText
                  numberOfLines={isOpen ? undefined : 2}
                  ellipsizeMode="tail"
                  style={styles.message}
                >
                  {item.message}
                </AppText>

                {/* ⭐ FEEDBACK */}
                {item.ratingRequired && (
                  <View style={styles.ratingBox}>
                    {!submittedMap[item.id] ? (
                      <>
                        {/* ⭐ STARS */}
                        <View style={styles.starRow}>
                          {[1,2,3,4,5].map(i => (
                            <TouchableOpacity key={i} onPress={() =>
                              setRatingMap(prev => ({ ...prev, [item.id]: i }))
                            }>
                              <Ionicons
                                name={i <= rating ? "star" : "star-outline"}
                                size={30}
                                color="#F59E0B"
                              />
                            </TouchableOpacity>
                          ))}
                        </View>

                        {/* ✍️ FEEDBACK INPUT (ONLY <5) */}
                        {rating > 0 && rating < 5 && (
                          <TextInput
                            placeholder={
                              language === "te"
                                ? "మీ అభిప్రాయం చెప్పండి..."
                                : "Tell us what can be improved..."
                            }
                            value={feedbackText}
                            cursorColor={'green'}
                            placeholderTextColor={'black'}
                            onChangeText={(text) => 
                              setFeedbackMap(prev => ({ ...prev, [item.id]: text }))
                            }
                            multiline
                            style={[styles.feedbackInput, { fontFamily: "Mandali" }]}
                          />
                        )}

                        {/* SUBMIT */}
                        <TouchableOpacity activeOpacity={0.8}
                          style={[
                            styles.submitBtn,
                            { opacity: rating ? 1 : 0.5 }
                          ]}
                          disabled={!rating}
                          onPress={() => submitFeedback(item.id)}
                        >
                          <AppText style={styles.submitText}>
                            {language === "te" ? "సమర్పించండి" : "Submit"}
                          </AppText>
                        </TouchableOpacity>
                      </>
                    ) : (
                      /* ✅ THANK YOU */
                      <Animated.View style={[styles.thankBox, { transform: [{ scale: scaleAnim }] }]}>
                        <View style={styles.successCircle}>
                          <Ionicons name="checkmark" size={20} color="#fff" />
                        </View>
                        <AppText style={styles.thankTitle}>
                          {language === "te" ? "ధన్యవాదాలు!" : "Thank You!"}
                        </AppText>
                        <AppText style={styles.thankSub}>
                          {language === "te" ? "మీ అభిప్రాయం మాకు ఎంతో సహాయపడుతుంది" : "Your feedback helps us improve better"}
                        </AppText>
                      </Animated.View>
                    )}
                  </View>
                )}

                {item.link && (
                  <TouchableOpacity
                    style={styles.linkBtn}
                    activeOpacity={0.8}
                    onPress={() => openLink(item.link)}
                  >
                    <Ionicons name="link-outline" size={16} color="#fff" />
                    <AppText style={styles.linkText}>
                      {language === "te" ? "లింక్ తెరవండి" : "Open Link"}
                    </AppText>
                  </TouchableOpacity>
                )}

                <AppText style={styles.date}>
                  {item.createdAt ? item.createdAt?.toDate?.()?.toDateString() || "" : ""}
                </AppText>
              </TouchableOpacity>
            );
          }}
        />
      )}

    </SafeAreaView>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({

  safe: { flex: 1, backgroundColor: "#F6F7F6" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB"
  },

  title: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827"
  },

  message: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 6
  },

  date: {
    fontSize: 11,
    color: "#076906",
    marginTop: 6
  },
  ratingBox: {
    marginTop: 16,
    alignItems: "center"
  },
  thankBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16
  },

  successCircle: {
    width: 30,
    height: 30,
    borderRadius: 30,
    backgroundColor: "#16A34A",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10
  },

  thankTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827"
  },

  thankSub: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 4,
    textAlign: "center"
  },

  starRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12, 
    marginBottom: 12
  },

  submitBtn: {
    backgroundColor: "#0a740c",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12
  },

  submitText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600"
  },
  feedbackInput: {
    width: "100%",
    marginTop: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    textAlignVertical: "top", 
    minHeight: 70
  },
  linkBtn: {
    marginTop: 10,
    backgroundColor: "#2563EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6
  },

  linkText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600"
  },

  thankText: {
    marginTop: 6,
    fontSize: 14,
    color: "#16A34A",
    fontWeight: "600",
    textAlign: "center"
  }

});