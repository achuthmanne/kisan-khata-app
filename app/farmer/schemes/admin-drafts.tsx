import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Alert,
  FlatList,
  Image,
  ScrollView,
  ActivityIndicator
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from 'expo-image-picker';

import AppHeader from "@/components/AppHeader";
import AppText from "@/components/AppText";

export default function AdminDraftsScreen() {
  const router = useRouter();
  const [language, setLanguage] = useState<"te" | "en">("te");
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  // For the selected draft modal/view
  const [selectedDraft, setSelectedDraft] = useState<any>(null);
  const [bannerImage, setBannerImage] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem("APP_LANG").then((l) => {
      if (l) setLanguage(l as "te" | "en");
    });
    fetchDrafts();
  }, []);

  const fetchDrafts = async () => {
    setLoading(true);
    try {
      const snap = await firestore().collection("draft_schemes").orderBy("createdAt", "desc").get();
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDrafts(docs);
    } catch (error) {
      console.log("Error fetching drafts:", error);
    }
    setLoading(false);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(language === "te" ? "అనుమతి నిరాకరించబడింది" : "Permission Denied");
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

  const handlePublish = async () => {
    if (!bannerImage) {
      Alert.alert(language === "te" ? "ఇమేజ్ లేదు" : "No Image", language === "te" ? "దయచేసి ఒక బ్యానర్ ఇమేజ్ అప్‌లోడ్ చేయండి" : "Please upload a banner image");
      return;
    }

    setPublishing(true);
    try {
      let finalImageUrl = "";
      if (bannerImage && !bannerImage.startsWith("http")) {
        const filename = bannerImage.substring(bannerImage.lastIndexOf('/') + 1);
        const storageRef = storage().ref(`schemes/${Date.now()}_${filename}`);
        await storageRef.putFile(bannerImage);
        finalImageUrl = await storageRef.getDownloadURL();
      }

      const schemeData = {
        title: selectedDraft.title,
        shortDesc: selectedDraft.shortDesc,
        bannerImage: finalImageUrl,
        state: selectedDraft.state || "BOTH",
        howToApply: selectedDraft.howToApply || "",
        applyLink: selectedDraft.applyLink || "",
        benefits: selectedDraft.benefits || [],
        eligibility: selectedDraft.eligibility || [],
        documentsRequired: selectedDraft.documentsRequired || [],
        isActive: true,
        createdAt: firestore.FieldValue.serverTimestamp(),
      };

      // 1. Add to live schemes
      await firestore().collection("schemes").add(schemeData);
      
      // 2. Delete from drafts
      await firestore().collection("draft_schemes").doc(selectedDraft.id).delete();

      Alert.alert(language === "te" ? "విజయవంతం" : "Success", language === "te" ? "పథకం పబ్లిష్ చేయబడింది!" : "Scheme Published!");
      setSelectedDraft(null);
      setBannerImage(null);
      fetchDrafts();

    } catch (error) {
      console.log("Publish error:", error);
      Alert.alert("Error", "Failed to publish.");
    }
    setPublishing(false);
  };

  const handleReject = async (id: string) => {
    Alert.alert(
      language === "te" ? "తొలగించు" : "Delete",
      language === "te" ? "ఈ డ్రాఫ్ట్ ని తొలగించాలనుకుంటున్నారా?" : "Are you sure you want to delete this draft?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: async () => {
            await firestore().collection("draft_schemes").doc(id).delete();
            fetchDrafts();
        }}
      ]
    );
  };

  const renderDraftItem = ({ item }: { item: any }) => (
    <View style={styles.draftCard}>
      <AppText style={styles.draftTitle}>{item.title}</AppText>
      <AppText style={styles.draftDesc} numberOfLines={2}>{item.shortDesc}</AppText>
      
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.reviewBtn} onPress={() => {
          setSelectedDraft(item);
          setBannerImage(null);
        }}>
          <AppText style={styles.reviewBtnText}>{language === "te" ? "సమీక్షించండి (Review)" : "Review"}</AppText>
        </TouchableOpacity>
        <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(item.id)}>
          <Ionicons name="trash" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      <AppHeader
        title={language === "te" ? "AI స్కీమ్ డ్రాఫ్ట్స్" : "AI Scheme Drafts"}
        subtitle={language === "te" ? "అడ్మిన్ అప్రూవల్" : "Admin Approval"}
        language={language}
      />

      {selectedDraft ? (
        <ScrollView contentContainerStyle={styles.detailContainer}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setSelectedDraft(null)}>
             <Ionicons name="arrow-back" size={24} color="#1F2937" />
             <AppText style={styles.backText}>{language === "te" ? "వెనక్కి" : "Back"}</AppText>
          </TouchableOpacity>

          <AppText style={styles.detailTitle}>{selectedDraft.title}</AppText>
          <AppText style={styles.detailDesc}>{selectedDraft.shortDesc}</AppText>

          <AppText style={styles.sectionTitle}>{language === "te" ? "ప్రయోజనాలు" : "Benefits"}</AppText>
          {selectedDraft.benefits?.map((ben: string, idx: number) => (
             <AppText key={idx} style={styles.bulletPoint}>• {ben}</AppText>
          ))}

          <AppText style={styles.sectionTitle}>{language === "te" ? "అర్హతలు" : "Eligibility"}</AppText>
          {selectedDraft.eligibility?.map((el: string, idx: number) => (
             <AppText key={idx} style={styles.bulletPoint}>• {el}</AppText>
          ))}

          <AppText style={styles.sectionTitle}>{language === "te" ? "పత్రాలు" : "Documents"}</AppText>
          {selectedDraft.documentsRequired?.map((doc: string, idx: number) => (
             <AppText key={idx} style={styles.bulletPoint}>• {doc}</AppText>
          ))}

          <AppText style={styles.sectionTitle}>{language === "te" ? "బ్యానర్ అప్‌లోడ్" : "Upload Banner"}</AppText>
          <TouchableOpacity style={styles.imageUploadBox} onPress={pickImage} activeOpacity={0.8}>
            {bannerImage ? (
              <Image source={{ uri: bannerImage }} style={styles.previewImage} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="cloud-upload-outline" size={32} color="#16A34A" />
                <AppText style={styles.imagePlaceholderText}>
                  {language === "te" ? "ఫోటో అప్‌లోడ్ చేయడానికి ఇక్కడ నొక్కండి" : "Tap to upload banner (16:9)"}
                </AppText>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.publishBtn} onPress={handlePublish} disabled={publishing}>
            {publishing ? <ActivityIndicator color="#fff" /> : <AppText style={styles.publishText}>{language === "te" ? "అప్రూవ్ & పబ్లిష్" : "Approve & Publish"}</AppText>}
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <View style={{flex:1}}>
          {loading ? (
            <ActivityIndicator size="large" color="#16A34A" style={{marginTop: 50}} />
          ) : drafts.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="document-text-outline" size={50} color="#D1D5DB" />
              <AppText style={styles.emptyText}>{language === "te" ? "ప్రస్తుతం ఏ డ్రాఫ్ట్స్ లేవు." : "No AI drafts right now."}</AppText>
            </View>
          ) : (
            <FlatList
              data={drafts}
              keyExtractor={item => item.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={renderDraftItem}
            />
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F9FAFB" },
  draftCard: { backgroundColor: "#fff", padding: 16, borderRadius: 12, marginBottom: 16, elevation: 2, borderWidth: 1, borderColor: "#E5E7EB" },
  draftTitle: { fontSize: 16, fontWeight: "bold", color: "#111827", marginBottom: 6 },
  draftDesc: { fontSize: 14, color: "#6B7280", marginBottom: 12 },
  actionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  reviewBtn: { backgroundColor: "#DBEAFE", paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  reviewBtnText: { color: "#2563EB", fontWeight: "600" },
  rejectBtn: { padding: 8, backgroundColor: "#FEF2F2", borderRadius: 8 },
  emptyBox: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { color: "#6B7280", marginTop: 10, fontSize: 16 },

  detailContainer: { padding: 20, paddingBottom: 60 },
  backBtn: { flexDirection: "row", alignItems: "center", marginBottom: 16, alignSelf: "flex-start" },
  backText: { fontSize: 16, color: "#1F2937", marginLeft: 8, fontWeight: "600" },
  detailTitle: { fontSize: 20, fontWeight: "bold", color: "#111827", marginBottom: 10 },
  detailDesc: { fontSize: 15, color: "#4B5563", marginBottom: 16, lineHeight: 22 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#1F2937", marginTop: 12, marginBottom: 8 },
  bulletPoint: { fontSize: 14, color: "#4B5563", marginLeft: 8, marginBottom: 4 },

  imageUploadBox: { width: "100%", height: 180, backgroundColor: "#F3F4F6", borderRadius: 16, borderWidth: 2, borderColor: "#E5E7EB", borderStyle: "dashed", justifyContent: "center", alignItems: "center", marginVertical: 16, overflow: "hidden" },
  previewImage: { width: "100%", height: "100%", resizeMode: "cover" },
  imagePlaceholder: { alignItems: "center", justifyContent: "center" },
  imagePlaceholderText: { color: "#6B7280", marginTop: 8, fontSize: 14 },
  publishBtn: { backgroundColor: "#16A34A", paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 10 },
  publishText: { color: "#fff", fontWeight: "bold", fontSize: 16 }
});
