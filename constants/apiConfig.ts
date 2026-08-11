import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const getApiBaseUrl = () => {
  if (__DEV__) {
    // In dev mode, use the explicit local Wi-Fi IP address or an environment variable.
    // Expo Constants for hostUri is unreliable on physical devices in recent SDKs.
    return process.env.EXPO_PUBLIC_API_URL || "http://172.22.43.228:3000";
  }
  
  // PRODUCTION DOMAIN
  // Replace this with your actual production domain when you deploy Next.js (e.g. kisankhata.in)
  return "https://kisan-khata-web.vercel.app";
};

export const API_URLS = {
  VALIDATE_INTERN: `${getApiBaseUrl()}/api/internship/validate`,
  TRACK_EVENT: `${getApiBaseUrl()}/api/tracking/event`
};
