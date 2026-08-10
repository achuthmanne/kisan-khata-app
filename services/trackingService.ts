import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { API_URLS } from "../constants/apiConfig";

/**
 * Generate a pseudo-random UUID for device ID if not exists.
 */
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * Get or create a persistent Device ID for fraud prevention.
 */
export const getDeviceId = async () => {
  try {
    let deviceId = await AsyncStorage.getItem("KISAN_DEVICE_ID");
    if (!deviceId) {
      deviceId = generateUUID();
      await AsyncStorage.setItem("KISAN_DEVICE_ID", deviceId);
    }
    return deviceId;
  } catch (error) {
    console.error("Error getting device ID", error);
    return "UNKNOWN_DEVICE";
  }
};

/**
 * Sync an event to the web dashboard.
 * @param eventType "FARMER_ONBOARDED" | "AGRICONNECT_USAGE" | "DATA_ENTRY_USAGE"
 * @param metadata Additional data like { villageName: "X" }
 */
export const syncTrackingEvent = async (eventType: string, metadata: any = {}) => {
  try {
    const referralCode = await AsyncStorage.getItem("INTERN_REFERRAL_CODE");
    
    // Only track if a referral code exists (organic users are ignored by the tracker)
    if (!referralCode) {
      console.log("No referral code found, skipping tracking.");
      return;
    }

    const farmerFirebaseUid = await AsyncStorage.getItem("USER_PHONE");
    const deviceId = await getDeviceId();

    const payload = {
      internReferralCode: referralCode,
      farmerFirebaseUid: farmerFirebaseUid || "UNKNOWN",
      deviceId,
      eventType,
      metadata
    };

    console.log("Syncing tracking event:", payload);

    await axios.post(API_URLS.TRACK_EVENT, payload);
    console.log("Event synced successfully.");
  } catch (error) {
    console.error("Error syncing tracking event:", error);
    // Silent fail so we don't crash the mobile app for a tracking error
  }
};
