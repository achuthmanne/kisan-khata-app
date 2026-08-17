import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { GoogleGenerativeAI, Schema, SchemaType } from "@google/generative-ai";
import Parser from "rss-parser";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const parser = new Parser();

const schemeSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    isAgriScheme: {
      type: SchemaType.BOOLEAN,
      description: "True ONLY if this news article is explicitly announcing a government agriculture scheme, subsidy, or loan waiver for farmers. False if it is general political news or weather.",
    },
    title: {
      type: SchemaType.STRING,
      description: "A short, clear title for the scheme in Telugu.",
    },
    shortDesc: {
      type: SchemaType.STRING,
      description: "A 2-3 sentence description of the scheme in Telugu.",
    },
    benefits: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "Array of specific benefits or financial assistance provided by the scheme in Telugu.",
    },
    eligibility: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "Array of eligibility criteria points in Telugu.",
    },
    documentsRequired: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "Array of required documents (e.g., Aadhaar, Pattadar Passbook) in Telugu.",
    },
    howToApply: {
      type: SchemaType.STRING,
      description: "Instructions on how to apply in Telugu.",
    },
    state: {
      type: SchemaType.STRING,
      description: "Which state does this apply to? MUST be one of: 'AP', 'TS', or 'BOTH'.",
    }
  },
  required: ["isAgriScheme"],
};

export const runAIWeeklyScraper = functions.scheduler.onSchedule(
  {
    schedule: "0 9 * * 0", // Every Sunday at 9:00 AM
    timeZone: "Asia/Kolkata",
    timeoutSeconds: 300,
  },
  async (event) => {
    try {
      console.log("Starting Weekly AI Scheme Scraper...");
      
      const rssUrls = [
        "https://news.google.com/rss/search?q=agriculture+scheme+subsidy+Andhra+Pradesh+OR+Telangana&hl=en-IN&gl=IN&ceid=IN:en",
      ];

      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schemeSchema,
        },
      });

      const db = admin.firestore();

      for (const url of rssUrls) {
        const feed = await parser.parseURL(url);
        
        // Take top 5 recent news to avoid high API costs
        const recentItems = feed.items.slice(0, 5);

        for (const item of recentItems) {
          const prompt = `
            Analyze the following news snippet.
            Title: ${item.title}
            Snippet: ${item.contentSnippet || item.content}
            Link: ${item.link}

            Extract the agriculture scheme details. If it's not a scheme, set isAgriScheme to false.
          `;

          const result = await model.generateContent(prompt);
          const responseText = result.response.text();
          
          if (responseText) {
            const data = JSON.parse(responseText);
            
            if (data.isAgriScheme) {
              // Check if we already drafted this to avoid duplicates
              const existing = await db.collection("draft_schemes")
                .where("applyLink", "==", item.link)
                .get();

              if (existing.empty) {
                await db.collection("draft_schemes").add({
                  title: data.title || "New Scheme",
                  shortDesc: data.shortDesc || "",
                  benefits: data.benefits || [],
                  eligibility: data.eligibility || [],
                  documentsRequired: data.documentsRequired || [],
                  howToApply: data.howToApply || "",
                  applyLink: item.link || "",
                  state: data.state || "BOTH",
                  bannerImage: "", // Left blank for manual upload
                  isActive: false,
                  status: "Draft",
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                console.log(`Drafted new scheme: ${data.title}`);
              }
            }
          }
        }
      }
      
      console.log("Scraping completed successfully.");
    } catch (error) {
      console.error("Error running AI scraper:", error);
    }
  }
);
