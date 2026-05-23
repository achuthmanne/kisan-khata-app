import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import fetch from "node-fetch";

admin.initializeApp();

/* ---------------- HELPER: BATCH MESSAGING (PRODUCTION READY) ---------------- */
// ఫైర్‌బేస్ ఒక్కసారి 500 టోకెన్స్ మాత్రమే పంపుతుంది. సో, బ్యాచ్ లుగా విడగొట్టాలి.
const sendMulticastInBatches = async (tokens: string[], payload: any) => {
  const chunkSize = 500;
  for (let i = 0; i < tokens.length; i += chunkSize) {
    const chunk = tokens.slice(i, i + chunkSize);
    try {
      const response = await admin.messaging().sendEachForMulticast({ ...payload, tokens: chunk });
      
      // అన్‌ఇన్‌స్టాల్ చేసిన యూజర్స్ టోకెన్స్ క్లీనప్ (Database Health)
      if (response.failureCount > 0) {
        const failedTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const errCode = resp.error?.code;
            if (errCode === 'messaging/invalid-registration-token' || errCode === 'messaging/registration-token-not-registered') {
              failedTokens.push(chunk[idx]);
            }
          }
        });
        
        // పాత టోకెన్స్ ని ఫైర్‌స్టోర్ నుంచి తీసేయడం (ఇది రేపు బిల్ల్ తగ్గించడానికి హెల్ప్ అవుతుంది)
        if (failedTokens.length > 0) {
           const usersSnap = await admin.firestore().collection("users").where("fcmToken", "in", failedTokens).get();
           const batch = admin.firestore().batch();
           usersSnap.docs.forEach(doc => batch.update(doc.ref, { fcmToken: admin.firestore.FieldValue.delete() }));
           await batch.commit();
        }
      }
    } catch (error) {
      console.error("❌ Batch Send Error:", error);
    }
  }
};


/* ---------------- వాతావరణం (Weather) ఫీచర్స్ కోసం హెల్పర్స్ ---------------- */
const getWeatherConfig = (main: string, lang: string) => {
  const m = main.toLowerCase();

  // 1. THUNDERSTORM
  if (m.includes("thunderstorm")) {
    if (m.includes("light")) return { icon: "thunderstorm-outline", color: "#6366F1", text: lang === "te" ? "ఉరుములతో కూడిన జల్లులు" : "Light Thunderstorm" };
    if (m.includes("heavy")) return { icon: "thunderstorm", color: "#4338CA", text: lang === "te" ? "భారీ పిడుగులతో వర్షం" : "Heavy Thunderstorm" };
    return { icon: "thunderstorm", color: "#4F46E5", text: lang === "te" ? "పిడుగులతో వర్షం" : "Thunderstorm" };
  }

  // 2. RAIN & DRIZZLE
  if (m.includes("drizzle")) return { icon: "rainy-outline", color: "#60A5FA", text: lang === "te" ? "సన్నపు చిరుజల్లులు" : "Light Drizzle" };
  if (m.includes("rain")) {
    if (m.includes("light")) return { icon: "rainy-outline", color: "#3B82F6", text: lang === "te" ? "తేలికపాటి వర్షం" : "Light Rain" };
    if (m.includes("heavy") || m.includes("extreme")) return { icon: "rainy", color: "#1D4ED8", text: lang === "te" ? "అతి భారీ వర్షం" : "Heavy Rain" };
    if (m.includes("freezing")) return { icon: "snow", color: "#93C5FD", text: lang === "te" ? "వడగండ్ల వాన" : "Freezing Rain" };
    return { icon: "rainy", color: "#2563EB", text: lang === "te" ? "వర్షం" : "Rain" };
  }

  // 3. CLOUDS
  if (m.includes("clouds")) {
    if (m.includes("few") || m.includes("scattered")) return { icon: "partly-sunny", color: "#9CA3AF", text: lang === "te" ? "పాక్షికంగా మబ్బులు" : "Partly Cloudy" };
    if (m.includes("broken")) return { icon: "cloudy", color: "#6B7280", text: lang === "te" ? "ఎక్కువ మబ్బులు" : "Mostly Cloudy" };
    if (m.includes("overcast")) return { icon: "cloud", color: "#4B5563", text: lang === "te" ? "దట్టమైన మబ్బులు" : "Overcast" };
    return { icon: "cloudy", color: "#64748B", text: lang === "te" ? "మబ్బులు పట్టింది" : "Cloudy" };
  }

  // 4. CLEAR / SUNNY
  if (m.includes("clear")) return { icon: "sunny", color: "#F59E0B", text: lang === "te" ? "నిర్మలమైన ఎండ" : "Clear & Sunny" };

  // 5. ATMOSPHERIC CONDITIONS
  if (m.includes("mist")) return { icon: "water-outline", color: "#94A3B8", text: lang === "te" ? "మసక బారింది" : "Mist" };
  if (m.includes("fog")) return { icon: "cloud-offline-outline", color: "#CBD5E1", text: lang === "te" ? "దట్టమైన పొగమంచు" : "Dense Fog" };
  if (m.includes("haze")) return { icon: "reorder-four-outline", color: "#D1D5DB", text: lang === "te" ? "పొగమంచు" : "Haze" };
  if (m.includes("dust") || m.includes("sand")) return { icon: "menu", color: "#D97706", text: lang === "te" ? "దుమ్ముతో కూడిన గాలి" : "Dust/Sand Storm" };
  if (m.includes("smoke")) return { icon: "flame-outline", color: "#6B7280", text: lang === "te" ? "పొగ పట్టింది" : "Smoke" };
  if (m.includes("squall") || m.includes("tornado")) return { icon: "warning", color: "#DC2626", text: lang === "te" ? "తుఫాను గాలి / సుడిగాలి" : "Squall/Tornado Warning" };

  // 6. SNOW
  if (m.includes("snow")) {
    if (m.includes("light")) return { icon: "snow-outline", color: "#BAE6FD", text: lang === "te" ? "తేలికపాటి మంచు" : "Light Snow" };
    return { icon: "snow", color: "#7DD3FC", text: lang === "te" ? "మంచు కురుస్తోంది" : "Snow" };
  }

  return { icon: "partly-sunny", color: "#F59E0B", text: main.charAt(0).toUpperCase() + main.slice(1) };
};

const getAgriAdvice = (main: string, temp: number, windSpeed: number, humidity: number, rainChance: number, lang: string, hour: number) => {
  const m = main.toLowerCase();
  const isNight = hour >= 19 || hour < 5;
  const isMorning = hour >= 5 && hour < 11;
  const isAfternoon = hour >= 11 && hour < 16;

  // 1. Extreme Danger (Lightning / Storms)
  if (m.includes("thunderstorm") || m.includes("storm") || m.includes("tornado") || m.includes("squall")) {
     return lang === "te" 
       ? "⚠️ పిడుగులు పడే ప్రమాదం ఉంది. పొలంలో చెట్ల కింద ఉండకండి. తక్షణమే సురక్షిత ప్రాంతానికి వెళ్ళండి." 
       : "⚠️ Danger of lightning/storm. Do not stand under trees. Go to a safe place immediately.";
  }

  // 2. Rain / Rain Chance (Wastes pesticide)
  if (m.includes("rain") || m.includes("drizzle") || m.includes("snow") || rainChance >= 40) {
     return lang === "te" 
       ? "🌧️ వర్షం పడే అవకాశం ఉంది. ఇప్పుడు మందులు కొడితే కడిగిపోయి డబ్బులు వృధా అవుతాయి. వాతావరణం చూసి పిచికారీ చేయండి." 
       : "🌧️ Rain expected. Spraying now will wash away pesticides and waste money. Do not spray.";
  }

  // 3. Time Sense: NIGHT
  if (isNight) {
     return lang === "te" 
       ? "🌙 చీకటి పడింది. రాత్రి పూట పొలంలో పాములు/విష కీటకాల ప్రమాదం ఉంటుంది. వ్యవసాయ పనులకు విశ్రాంతి ఇవ్వండి." 
       : "🌙 It's night time. High risk of snake/insect bites in the field. Rest and plan for tomorrow.";
  }

  // 4. High Wind (Causes drift)
  if (windSpeed > 15) {
     return lang === "te" 
       ? "💨 గాలి తీవ్రత ఎక్కువగా ఉంది. ఇప్పుడు మందు కొడితే పక్క పొలాలకు లేదా మీ కళ్ళలో పడే ప్రమాదం ఉంది. గాలి తగ్గాకే పిచికారీ చేయండి." 
       : "💨 High wind. Spraying now risks chemical drift to other fields or into your eyes. Wait for wind to stop.";
  }

  // 5. Extreme Heat (Evaporation & Leaf Burn)
  if (temp > 35) {
     if (isAfternoon) {
        return lang === "te" 
          ? "🔥 మండుటెండలో మందు కొట్టకండి. ఆకులు మాడిపోతాయి మరియు మందు ఆవిరైపోతుంది. సాయంత్రం 4 తర్వాతే పిచికారీ చేయండి." 
          : "🔥 High heat. Do not spray now as leaves may burn and chemicals will evaporate. Wait until evening.";
     } else if (isMorning) {
        return lang === "te" 
          ? "🔥 ఈరోజు ఎండ తీవ్రత ఎక్కువగా ఉంటుంది. మందు కొడితే త్వరగా ఆవిరైపోతుంది. ఉదయం 10 లోపే పిచికారీ పూర్తి చేయండి." 
          : "🔥 Today will be very hot. Finish spraying before 10 AM before the sun gets too strong.";
     } else {
        return lang === "te" 
          ? "🔥 ఎండ ఇంకా తీవ్రంగానే ఉంది. కొద్దిగా చల్లబడ్డాక మందు కొట్టండి." 
          : "🔥 It is still hot. Wait for it to cool down a bit before spraying.";
     }
  }

  // 6. Dew / Cold (Chemicals drip off)
  if (temp < 15 || (isMorning && humidity > 85)) {
     return lang === "te" 
       ? "❄️ ఆకుల మీద మంచు ఎక్కువగా ఉంది. మంచు ఆరిన తర్వాతే మందు కొట్టండి, లేదంటే మందు కింద పడిపోతుంది." 
       : "❄️ Heavy dew. Wait for dew to dry before spraying, else pesticide will drip off into the soil.";
  }

  // 7. High Humidity / Fungus Risk
  if (humidity > 85 && (m.includes("clouds") || m.includes("mist") || m.includes("haze") || m.includes("fog"))) {
     return lang === "te" 
       ? "☁️ గాలిలో తేమ ఎక్కువగా ఉండి మబ్బులు పట్టాయి. బూజు/ఫంగస్ తెగుళ్లు వేగంగా వ్యాపిస్తాయి. పొలాన్ని జాగ్రత్తగా గమనించండి." 
       : "☁️ High humidity and cloudy. High risk of fungal diseases spreading. Monitor your crops closely.";
  }

  // 8. Perfect Conditions
  return lang === "te" 
    ? "✅ వాతావరణం చాలా అనుకూలంగా ఉంది. మందులు కొట్టడానికి, ఎరువులు వేయడానికి ఇది సరైన సమయం." 
    : "✅ Perfect weather conditions. Excellent time for spraying pesticides or applying fertilizers.";
};

/* ---------------- 1. ADVANCED WEATHER ---------------- */
export const getAdvancedWeather = functions.https.onRequest(async (req, res) => {
  try {
    const lat = req.query.lat as string;
    const lon = req.query.lon as string;
    const lang = (req.query.lang as string) || "te";

    if (!lat || !lon) {
      res.status(400).json({ error: "Latitude and Longitude are required" });
      return;
    }

    const OPENWEATHER_API_KEY = process.env.WEATHER_API_KEY || ""; 
    const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "";

    let exactLocation = "Location";

    try {
      if (GOOGLE_MAPS_API_KEY !== process.env.GOOGLE_MAPS_API_KEY) {
        const geoRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${GOOGLE_MAPS_API_KEY}&language=${lang}`);
        const geoData = await geoRes.json();
        
        if (geoData.results && geoData.results.length > 0) {
          const addressComponents = geoData.results[0].address_components;
          let village = "";
          let mandal = "";
          
          addressComponents.forEach((comp: any) => {
            if (comp.types.includes("locality") || comp.types.includes("sublocality")) village = comp.long_name;
            if (comp.types.includes("administrative_area_level_3")) mandal = comp.long_name;
          });
          exactLocation = village ? (mandal ? `${village}, ${mandal}` : village) : geoData.results[0].formatted_address.split(",")[0];
        }
      }
    } catch (e) {
      console.log("Geocoding failed", e);
    }

    const currentRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_API_KEY}&lang=${lang}`);
    const forecastRes = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_API_KEY}&lang=${lang}`);

    const currentData = await currentRes.json();
    const forecastData = await forecastRes.json();

    if (exactLocation === "Location" && currentData.name) {
      exactLocation = currentData.name; 
    }
    const istTime = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const currentHour = istTime.getHours();

    const currentMain = currentData.weather[0].main;
    const currentConfig = getWeatherConfig(currentMain, lang);
    const windKmH = Math.round(currentData.wind.speed * 3.6);
    const rainChanceVal = forecastData.list[0]?.pop ? Math.round(forecastData.list[0].pop * 100) : 0;
    
    const current = {
      temp: Math.round(currentData.main.temp),
      condition: currentConfig.text,
      icon: currentConfig.icon,
      color: currentConfig.color,
      humidity: currentData.main.humidity,
      wind: windKmH,
      pressure: currentData.main.pressure,
      visibility: (currentData.visibility / 1000).toFixed(1),
      advice: getAgriAdvice(currentMain, currentData.main.temp, windKmH, currentData.main.humidity, rainChanceVal, lang, currentHour),
      isGood: !["rain", "storm", "thunderstorm", "drizzle"].includes(currentMain.toLowerCase()) && windKmH < 15 && currentData.main.temp <= 35 && rainChanceVal < 40,
      uv: 6,
      rainChance: rainChanceVal
    };

    const hourly = forecastData.list.slice(0, 8).map((item: any) => {
      const date = new Date(item.dt * 1000);
      let hours = date.getHours();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const config = getWeatherConfig(item.weather[0].main, lang);
      return { time: `${hours} ${ampm}`, temp: Math.round(item.main.temp), icon: config.icon, color: config.color };
    });

    const dailyMap = new Map();
    forecastData.list.forEach((item: any) => {
      const date = item.dt_txt.split(" ")[0];
      if (!dailyMap.has(date)) {
        dailyMap.set(date, { min: item.main.temp_min, max: item.main.temp_max, main: item.weather[0].main });
      } else {
        const existing = dailyMap.get(date);
        existing.min = Math.min(existing.min, item.main.temp_min);
        existing.max = Math.max(existing.max, item.main.temp_max);
      }
    });

    const daily = Array.from(dailyMap.keys()).map((dateKey) => {
      const dayData = dailyMap.get(dateKey);
      const config = getWeatherConfig(dayData.main, lang);
      const dateObj = new Date(dateKey);
      const dayName = new Intl.DateTimeFormat(lang === "te" ? "te-IN" : "en-US", { weekday: "short" }).format(dateObj);
      return { day: dayName, min: Math.round(dayData.min), max: Math.round(dayData.max), icon: config.icon, color: config.color };
    }).slice(0, 5);

    res.status(200).json({ exactLocation, current, hourly, daily });
  } catch (error) {
    console.error("Cloud Function Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/* ---------------- 2. BASIC WEATHER ---------------- */
export const getWeather = functions.https.onRequest(async (req, res) => {
  try {
    const lat = req.query.lat || "17.3850";
    const lon = req.query.lon || "78.4867";
    const API_KEY = process.env.WEATHER_API_KEY || "";
    const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`);
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      res.status(500).json({ error: "Invalid API response" });
      return; 
    }
    if (!data || !data.main) {
      res.status(400).json({ error: "Weather data not found" });
      return; 
    }
    res.json(data); 
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error fetching weather" });
  }
});

/* ---------------- 3. GET PRICES ---------------- */
export const getPrices = functions.https.onRequest(async (req, res) => {
  try {
    const DATA_GOV_API_KEY = process.env.DATA_GOV_API_KEY || "579b464db66ec23bdd0000012deb5555117e4ebe4ffd6df74e6ae0d8";
    const AP_API = `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=${DATA_GOV_API_KEY}&format=json&filters[state]=Andhra Pradesh&limit=100`;
    const TS_API = `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=${DATA_GOV_API_KEY}&format=json&filters[state]=Telangana&limit=100`;
    
    const ap = await fetch(AP_API);
    const ts = await fetch(TS_API);
    const apData = await ap.json();
    const tsData = await ts.json();
    const combined = [...(apData.records || []), ...(tsData.records || [])];
    res.json(combined.slice(0, 10));
  } catch (e) {
    res.status(500).json({ error: "Price fetch failed" });
  }
});


/* ---------------- 3.5 ADVANCED PRICES ---------------- */
export const getAdvancedPrices = functions.https.onRequest(async (req, res) => {
  try {
    const DATA_GOV_API_KEY = process.env.DATA_GOV_API_KEY || "579b464db66ec23bdd0000012deb5555117e4ebe4ffd6df74e6ae0d8";
    const AP_API = `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=${DATA_GOV_API_KEY}&format=json&filters[state]=Andhra Pradesh&limit=100`;
    const TS_API = `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?api-key=${DATA_GOV_API_KEY}&format=json&filters[state]=Telangana&limit=100`;
    
    const [apRes, tsRes] = await Promise.all([fetch(AP_API), fetch(TS_API)]);
    
    const apData = await apRes.json();
    const tsData = await tsRes.json();
    
    const combinedRecords = [...(apData.records || []), ...(tsData.records || [])];
    const sorted = combinedRecords.sort(
      (a: any, b: any) => new Date(b.arrival_date).getTime() - new Date(a.arrival_date).getTime()
    );

    const grouped: any = {};
    sorted.forEach((item: any) => {
      const key = `${item.market}-${item.commodity}`; 
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(item);
    });

    const finalPrices = Object.keys(grouped).map((key) => {
      const items = grouped[key];
      return {
        state: items[0].state,
        market: items[0].market,
        commodity: items[0].commodity,
        min_price: items[0].min_price,
        max_price: items[0].max_price,
        modal_price: items[0].modal_price,
        arrival_date: items[0].arrival_date,
        prevPrice: items[1]?.modal_price || items[0].modal_price 
      };
    });

    res.status(200).json(finalPrices);
  } catch (error) {
    console.error("Advanced Price Fetch Error:", error);
    res.status(500).json({ error: "Failed to fetch advanced prices" });
  }
});

/* ---------------- 4. PUSH NOTIFICATION (PRODUCTION READY) ---------------- */
export const pushNotification = onDocumentCreated(
  "notifications/{id}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data();

    const normalize = (s: any) => (s || "").trim().toLowerCase();
    const targetUserId = data.userId;
    const targetState = data.state;
    const isGlobal = targetUserId === "all" || (!targetUserId && !targetState);
    let tokens: string[] = [];

    if (isGlobal) {
      const users = await admin.firestore().collection("users").get();
      users.forEach(doc => {
        const t = doc.data()?.fcmToken;
        if (t) tokens.push(t);
      });
    } else if (targetState) {
      const state = normalize(targetState);
      const users = await admin.firestore().collection("users").get();
      users.forEach(doc => {
        const userState = normalize(doc.data()?.state);
        if (userState === state) {
          const t = doc.data()?.fcmToken;
          if (t) tokens.push(t);
        }
      });
    } else if (targetUserId) {
      const userDoc = await admin.firestore().collection("users").doc(targetUserId).get();
      const token = userDoc.data()?.fcmToken;
      if (token) tokens.push(token);
    }
    
    tokens = [...new Set(tokens)];
    if (tokens.length === 0) {
      console.log("❌ No tokens found");
      return;
    }

    console.log("✅ Sending to tokens:", tokens.length);
    
    // 🔥 New Logic: Batched Sending (Safe for >500 users)
    const payload = {
        notification: {
          title: data.title || "Kisan Khata", // 🔥 BRAND NAME UPDATED
          body: data.message || "",
        },
        android: {
        priority: "high" as const,
        notification: { 
            channelId: "default", 
            sound: "default",
            color: "#FFFFFF" 
        },
    },
        apns: {
          payload: { aps: { sound: "default" } },
        },
        data: {
          screen: "notifications",
        },
    };
    
    await sendMulticastInBatches(tokens, payload);
  }
);

/* ---------------- 5. INACTIVE NOTIFICATIONS (PRODUCTION READY) ---------------- */
export const sendInactiveNotifications = onSchedule({
  schedule: "0 9 * * *",
  timeZone: "Asia/Kolkata"
},
  async () => {
    const now = new Date();
    const usersSnap = await admin.firestore().collection("users").get();

    for (const doc of usersSnap.docs) {
      const data = doc.data();
      if (!data.lastActiveAt) continue;

      const lastActive = data.lastActiveAt.toDate();
      const daysInactive = Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));
      
      let selectedMsg = null;

      if (daysInactive >= 5 && daysInactive < 7) {
        selectedMsg = {
          title: "👋 రైతు సోదరా, బాగున్నారా?",
          body: "చాలా రోజులయ్యింది Kisan Khata తెరిచి! మీ వాతావరణం మరియు మార్కెట్ ధరలు ఒకసారి చూడండి.", // 🔥 BRAND NAME UPDATED
          screen: "weather"
        };
      } else if (daysInactive >= 7 && daysInactive < 10) {
        selectedMsg = {
          title: "📈 మీ పంట ధరలు పెరిగాయా?",
          body: "లేటెస్ట్ మార్కెట్ యార్డ్ ధరలు అప్డేట్ అయ్యాయి. ఇప్పుడే చెక్ చేయండి!",
          screen: "market"
        };
      } else if (daysInactive >= 10 && (daysInactive - 10) % 3 === 0) {
        const cycle = Math.floor((daysInactive - 10) / 3);
        const rotation = [
          { t: "👥 కూలీల హాజరు వేయండి", b: "ఈరోజు మీ పొలం పనులకు వచ్చిన కూలీల అటెండెన్స్ Kisan Khata లో మార్క్ చేయడం మర్చిపోకండి.", s: "attendance" }, // 🔥 BRAND NAME UPDATED
          { t: "💰 పంట అమ్మకాల వివరాలు", b: "మీరు ఈరోజు అమ్మిన పంట వివరాలను, వచ్చిన ఆదాయాన్ని వెంటనే యాప్‌లో నమోదు చేయండి.", s: "sales" },
          { t: "📒 సాగు ఖర్చుల లెక్క", b: "విత్తనాలు, మందులు మరియు ఇతర పెట్టుబడి ఖర్చులను డిజిటల్ ఖాతాలో నోట్ చేసుకోండి.", s: "expenses" },
          { t: "📰 నేటి వ్యవసాయ వార్తలు", b: "ప్రభుత్వ నిర్ణయాలు మరియు ఆధునిక సాగు పద్ధతుల గురించి తాజా వార్తలు ఇక్కడ చదవండి.", s: "(tabs)/news" },
          { t: "🚜 ట్రాక్టర్ కావాలా?", b: "దున్నడానికి లేదా ఇతర పనుల కోసం యంత్రాలు కావాలంటే Kisan Khata లో ఇప్పుడే సెర్చ్ చేయండి.", s: "bookings" }, // 🔥 BRAND NAME UPDATED
          { t: "🌦️ వాతావరణ సమాచారం", b: "వచ్చే మూడు రోజుల్లో మీ ప్రాంతంలో వాతావరణం ఎలా ఉండబోతుందో ఇప్పుడే తెలుసుకోండి.", s: "weather" },
          { t: "📈 మార్కెట్ ధరల అప్డేట్", b: "మీ జిల్లాలోని మార్కెట్ యార్డులలో వివిధ పంటలకు ఉన్న తాజా ధరలను చెక్ చేయండి.", s: "market" },
          { t: "🌾 మీ పంట సారాంశం", b: "ఈ సీజన్ సాగులో మీ పెట్టుబడి, ఆదాయం మరియు లాభాల రిపోర్టును ఒకసారి చూడండి.", s: "summary" },
          { t: "💡 రైతులకు కొత్త పథకాలు", b: "ప్రభుత్వం అందిస్తున్న కొత్త సబ్సిడీలు మరియు పథకాల వివరాలు Kisan Khata లో సిద్ధంగా ఉన్నాయి.", s: "schemes" }, // 🔥 BRAND NAME UPDATED
          { t: "💸 బాకీల వివరాలు", b: "మీరు ఇతరులకు ఇవ్వాల్సిన లేదా మీకు రావాల్సిన పేమెంట్స్ ఒకసారి సరిచూసుకోండి.", s: "payments" },
          { t: "🗺️ పొలాల నిర్వహణ", b: "మీ వివిధ పొలాల్లో జరుగుతున్న పనుల వివరాలను ఎప్పటికప్పుడు అప్డేట్ చేయండి.", s: "fields" },
        ];
        const pick = rotation[cycle % rotation.length];
        selectedMsg = { title: pick.t, body: pick.b, screen: pick.s };
      }

      if (!selectedMsg) continue;

      const lastSent = data.lastInactiveNotificationSentAt?.toDate();
      if (lastSent) {
        const diff = now.getTime() - lastSent.getTime();
        if (diff < 24 * 60 * 60 * 1000) continue; 
      }

      const token = data.fcmToken;
      if (!token) continue;

      try {
        await admin.firestore().collection("users").doc(doc.id).update({
          lastInactiveNotificationSentAt: admin.firestore.FieldValue.serverTimestamp()
        });

        await admin.messaging().send({
          token,
          notification: { title: selectedMsg.title, body: selectedMsg.body },
          data: { screen: selectedMsg.screen },
          android: { priority: "high", notification: { channelId: "default", sound: "default" } }
        });

      } catch (error: any) {
        // 🔥 Invalid Token Cleanup
        if (error.code === "messaging/registration-token-not-registered" || error.code === "messaging/invalid-registration-token") {
          await admin.firestore().collection("users").doc(doc.id).update({ fcmToken: admin.firestore.FieldValue.delete() });
        }
      }
    } 
  } 
);

/* ---------------- 6. NEW SCHEME NOTIFICATION (PRODUCTION READY) ---------------- */
export const notifyNewScheme = onDocumentCreated(
  "schemes/{schemeId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    
    const scheme = snap.data();
    const schemeId = event.params.schemeId;

    const schemeState = scheme.state; 
    const title = scheme.title || "కొత్త ప్రభుత్వ పథకం";
    
    let tokens: string[] = [];
    
    const usersSnap = await admin.firestore().collection("users").get();
    
    usersSnap.forEach((doc) => {
      const userData = doc.data();
      const userState = (userData.state || "").trim().toUpperCase();
      const token = userData.fcmToken;

      if (token) {
        if (schemeState === "BOTH") {
          tokens.push(token);
        } else if (schemeState === "AP" && userState === "AP") {
          tokens.push(token);
        } else if (schemeState === "TS" && (userState === "TS" || userState === "TELANGANA")) {
          tokens.push(token);
        }
      }
    });

    tokens = [...new Set(tokens)];
    
    if (tokens.length === 0) {
      console.log(`❌ No tokens found for ${schemeState} state`);
      return;
    }

    console.log(`✅ Sending Scheme Notification to ${tokens.length} users in ${schemeState}`);

    // 🔥 Batched Sending
    const payload = {
        notification: {
          title: "🎉 కొత్త ప్రభుత్వ పథకం!",
          body: `${title} - అర్హతలు, కావాల్సిన పత్రాలు మరియు దరఖాస్తు విధానం కోసం ఇప్పుడే Kisan Khata లో చూడండి.`, // 🔥 BRAND NAME UPDATED
        },
        android: {
          priority: "high" as const,
          notification: { channelId: "default", sound: "default" },
        },
        data: {
          screen: `/farmer/schemes/${schemeId}`, 
        },
    };
    
    await sendMulticastInBatches(tokens, payload);
  }
);

/* ---------------- 7. DRIVER ATTENDANCE REMINDERS (PRODUCTION READY) ---------------- */
export const sendDriverAttendanceReminders = onSchedule({
  schedule: "0 19 * * *", // Runs EXACTLY ONCE a day at 7:00 PM
  timeZone: "Asia/Kolkata"
},
  async () => {
    const now = new Date();
    // Get today's date in IST
    const istTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const todayDD = String(istTime.getDate()).padStart(2, '0');
    const todayMM = String(istTime.getMonth() + 1).padStart(2, '0');
    const todayYYYY = istTime.getFullYear();
    const formattedToday = `${todayDD}-${todayMM}-${todayYYYY}`; // e.g., 24-05-2026

    const usersSnap = await admin.firestore().collection("users").get();

    for (const doc of usersSnap.docs) {
      const userData = doc.data();
      const phone = doc.id;
      const token = userData.fcmToken;
      
      if (!token) continue; // No token, skip
      
      const lang = userData.language || "te";
      
      // Determine active session
      let activeSession = userData.activeSession;
      if (!activeSession) {
         const year = istTime.getFullYear();
         const startYear = istTime.getMonth() >= 5 ? year : year - 1;
         activeSession = `${startYear}-${(startYear + 1).toString().slice(-2)}`;
      }

      // Fetch vehicles
      const vehiclesSnap = await admin.firestore().collection("users").doc(phone).collection("vehicles").get();
      const missedDrivers: string[] = [];

      for (const vDoc of vehiclesSnap.docs) {
        const driversSnap = await admin.firestore()
          .collection("users").doc(phone)
          .collection("vehicles").doc(vDoc.id)
          .collection("drivers")
          .where("session", "==", activeSession)
          .where("paymentType", "==", "monthly")
          .get();
          
        for (const dDoc of driversSnap.docs) {
          const driverData = dDoc.data();
          const driverName = driverData.driverName || "Driver";
          
          // Check if today's attendance exists
          const entriesSnap = await admin.firestore()
            .collection("users").doc(phone)
            .collection("vehicles").doc(vDoc.id)
            .collection("drivers").doc(dDoc.id)
            .collection("entries")
            .where("date", "==", formattedToday)
            .limit(1)
            .get();

          if (entriesSnap.empty) {
            missedDrivers.push(driverName);
          }
        }
      }

      if (missedDrivers.length > 0) {
        // Construct names string cleanly
        const namesStr = missedDrivers.join(", ");
        
        const title = lang === "te" 
           ? "⚠️ ఈ రోజు హాజరు మర్చిపోయారు!" 
           : "⚠️ Forgot Today's Attendance!";
           
        const body = lang === "te" 
           ? `ఈ రోజు మీరు ${namesStr} డ్రైవర్ల హాజరు ఇంకా వేయలేదు. వెంటనే Kisan Khata లో రికార్డ్ చేయండి.`
           : `You haven't marked attendance for ${namesStr} today. Please record it in Kisan Khata immediately.`;

        try {
          await admin.messaging().send({
            token,
            notification: { title, body },
            data: { screen: "/farmer/vechiles" }, // Deep links to vehicles/drivers screen
            android: { priority: "high", notification: { channelId: "default", sound: "default" } }
          });
        } catch (error: any) {
          // 🔥 Cleanup bad tokens to save future resources
          if (error.code === "messaging/registration-token-not-registered" || error.code === "messaging/invalid-registration-token") {
            await admin.firestore().collection("users").doc(phone).update({ fcmToken: admin.firestore.FieldValue.delete() });
          }
        }
      }
    }
  }
);