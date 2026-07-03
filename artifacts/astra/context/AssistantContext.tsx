import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import * as Battery from "expo-battery";
import * as Brightness from "expo-brightness";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import * as Speech from "expo-speech";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Linking, Platform, Vibration } from "react-native";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CommandEntry {
  id: string;
  command: string;
  response: string;
  timestamp: Date;
  type: "success" | "error" | "info" | "warning";
}

/** A past conversation session archived to AsyncStorage */
export interface StoredSession {
  id: string;
  title: string;       // first user query (truncated)
  startedAt: string;   // ISO date string
  entries: Array<{
    id: string;
    command: string;
    response: string;
    timestamp: string;
    type: "success" | "error" | "info" | "warning";
  }>;
}

export type Language = "en" | "hi" | "bn";

export const LANG_LABELS: Record<Language, string> = {
  en: "EN",
  hi: "HI",
  bn: "BN",
};
export const LANG_CODES: Record<Language, string> = {
  en: "en-US",
  hi: "hi-IN",
  bn: "bn-IN",
};

interface AssistantContextValue {
  isListening: boolean;
  isProcessing: boolean;
  torchOn: boolean;
  language: Language;
  commandLog: CommandEntry[];
  sessions: StoredSession[];
  batteryLevel: number | null;
  songStatus: string;
  wakeMode: boolean;
  startListening: () => void;
  stopListening: () => void;
  processCommand: (text: string) => Promise<void>;
  toggleLanguage: () => void;
  clearLog: () => void;
  loadSession: (session: StoredSession) => void;
  speak: (text: string) => void;
  setWakeMode: (on: boolean) => void;
}

// ─── Environment keys ─────────────────────────────────────────────────────────

const TMDB_KEY  = process.env.EXPO_PUBLIC_TMDB_KEY ?? "";
const AUDD_KEY  = process.env.EXPO_PUBLIC_AUDD_KEY ?? "";
const TMDB_BASE = "https://api.themoviedb.org/3";

// Gemini calls go through our Express proxy — key stays server-side, no CORS issues
const GEMINI_PROXY =
  process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api/gemini`
    : "/api/gemini";

// ─── Localised static strings ─────────────────────────────────────────────────

const R: Record<string, Record<Language, string>> = {
  hello: {
    en: "Hello! I am Astra, your personal voice assistant. How can I help you?",
    hi: "Namaste! Main Astra hoon. Kaise madad kar sakti hoon?",
    bn: "Namaskar! Ami Astra. Apnar ki upokar korte pari?",
  },
  torchOn:  { en: "Turning on the flashlight.", hi: "Torch jalaa rahi hoon.", bn: "Torch jhaliye dichi." },
  torchOff: { en: "Turning off the flashlight.", hi: "Torch band kar rahi hoon.", bn: "Torch nibe dichi." },
  help: {
    en: "Commands: hello, time, date, year, battery, day or night, brightness [0-100], call [number], text [number], open [youtube/maps/whatsapp/settings], vibrate, timer [minutes], what song, movie [name], notifications, torch on/off, speak louder/quieter, help, stop.",
    hi: "Commands: hello, time, date, year, battery, din ya raat, brightness [0-100], call [number], text [number], open [youtube/maps/whatsapp/settings], vibrate, timer [minutes], kaun sa gana, movie [naam], notifications, torch on/off, zyada bolein/dhire bolein, help, stop.",
    bn: "Commands: hello, time, date, year, battery, din na raat, brightness [0-100], call [number], text [number], open [youtube/maps/whatsapp/settings], vibrate, timer [minutes], kaun sa gana, movie [naam], notifications, torch on/off, jore bolun/aste bolun, help, stop.",
  },
  stop: {
    en: "Going to sleep. Tap the wave to wake me up.",
    hi: "Main so rahi hoon. Mujhe jagane ke liye wave tap karein.",
    bn: "Ami ghum dite jachchi. Wave tap korun.",
  },
  unknown: {
    en: "Sorry, I didn't understand that. Say 'help' to see available commands.",
    hi: "Maafi chahti hoon. 'help' bolein commands dekhne ke liye.",
    bn: "Maaf korben. 'help' bolun commands dekhte.",
  },
  wifiLimit: {
    en: "Toggling Wi-Fi or mobile data is blocked by Android 10 and above for third-party apps. I cannot do that, but I can open your settings so you can change it manually.",
    hi: "Wi-Fi ya mobile data toggle karna Android 10 mein allowed nahi hai. Main settings khol deti hoon.",
    bn: "Wi-Fi ba mobile data toggle kora Android 10 e allowed na. Ami settings khule dichi.",
  },
  accessibilityLimit: {
    en: "Auto-scrolling or auto-answering calls requires a native Android Accessibility Service, which is not available in this version of Astra.",
    hi: "Auto-scroll aur auto-call answer ke liye native Android Accessibility Service chahiye. Yeh is version mein available nahi hai.",
    bn: "Auto-scroll ebong auto-call answer er jonno native Android Accessibility Service dorkar. Eta ei version e nei.",
  },
  noMovieKey: {
    en: "Searching for movie info...",
    hi: "Movie information dhundh rahi hoon...",
    bn: "Movie information khujchhi...",
  },
  songListening: {
    en: "Listening to the song for 7 seconds...",
    hi: "7 seconds ke liye gana sun rahi hoon...",
    bn: "7 second dhore gana shunchhi...",
  },
  songIdentifying: {
    en: "Identifying the song...",
    hi: "Gana pehchaan rahi hoon...",
    bn: "Gana chinchhi...",
  },
  songNotFound: {
    en: "Sorry, I couldn't identify this song. Make sure the music is audible and try again.",
    hi: "Maafi, yeh gana pehchan nahi paaya. Music clearly sunaaye aur dobara try karein.",
    bn: "Maaf korun, gana chinite parini. Music shuddho shuniye abar try korun.",
  },
  songError: {
    en: "Song identification failed. Please grant microphone permission and try again.",
    hi: "Song pehchan mein error aayi. Microphone permission check karein.",
    bn: "Song chinon e error. Microphone permission check korun.",
  },
  noAuddKey: {
    en: "Song recognition requires an AudD API key. Add EXPO_PUBLIC_AUDD_KEY to Replit secrets for reliable results.",
    hi: "Song recognition ke liye AudD API key chahiye. Replit secrets mein EXPO_PUBLIC_AUDD_KEY add karein.",
    bn: "Song recognition er jonno AudD API key dorkar. Replit secrets e EXPO_PUBLIC_AUDD_KEY add korun.",
  },
  vibrated: {
    en: "Vibrating!",
    hi: "Vibrate kar raha hai!",
    bn: "Vibrate korchhe!",
  },
  brightnessWeb: {
    en: "Brightness control is not available on web.",
    hi: "Web par brightness control available nahi hai.",
    bn: "Web e brightness control nei.",
  },
  brightnessErr: {
    en: "Could not change brightness. Please grant system settings permission.",
    hi: "Brightness badal nahi paaya. System settings permission dijiye.",
    bn: "Brightness badlano gelo na. System settings permission dirun.",
  },
  appNotFound: {
    en: "Sorry, I don't know how to open that app yet.",
    hi: "Maafi, woh app abhi nahi khol sakti.",
    bn: "Maaf korun, oi app ekhon khulte parbo na.",
  },
  timerInvalid: {
    en: "Please say a valid duration, like 'timer 5 minutes'.",
    hi: "Valid duration bolein, jaise 'timer 5 minutes'.",
    bn: "Valid duration bolun, jemon 'timer 5 minutes'.",
  },
  speakLouder: {
    en: "I'll speak a bit louder now.",
    hi: "Main ab thoda zyada awaaz mein boluungi.",
    bn: "Ami ekhon ektu jore bolbo.",
  },
  speakQuieter: {
    en: "I'll speak more softly now.",
    hi: "Main ab dhire bolungi.",
    bn: "Ami ekhon aste bolbo.",
  },
  geminiThinking: {
    en: "Let me think about that...",
    hi: "Soch rahi hoon...",
    bn: "Vabchhi...",
  },
  geminiError: {
    en: "I couldn't connect to get an answer right now. Please try again.",
    hi: "Abhi jawab nahi mil raha. Dobara try karein.",
    bn: "Ekhon uttar porte parini. Abar try korun.",
  },
};

// ─── App URL schemes ──────────────────────────────────────────────────────────

const APP_URLS: Record<string, string> = {
  youtube:      "vnd.youtube://",
  maps:         "geo:0,0",
  camera:       "content://media/external",
  settings:     "android.settings.SETTINGS",
  whatsapp:     "whatsapp://send",
  instagram:    "instagram://app",
  spotify:      "spotify://",
  gmail:        "googlegmail://",
  chrome:       "googlechrome://",
  calculator:   "android-app://com.google.android.calculator",
  clock:        "android-app://com.google.android.deskclock",
  photos:       "content://media/external/images/media",
  play:         "market://",
  facebook:     "fb://",
  twitter:      "twitter://",
  telegram:     "tg://",
};

function extractAppName(text: string): string | null {
  const m =
    text.match(/open\s+(\w+)/i) ??
    text.match(/kholo?\s+(\w+)/i) ??
    text.match(/chalu\s+(\w+)/i) ??
    text.match(/launch\s+(\w+)/i);
  return m?.[1]?.toLowerCase() ?? null;
}

async function openApp(appKey: string, lang: Language): Promise<string> {
  if (Platform.OS === "web") {
    return lang === "en"
      ? "Opening apps is not available on web. Please build the APK."
      : lang === "hi"
      ? "Web par apps nahi khul sakti. APK build karein."
      : "Web e app khola jay na. APK build korun.";
  }
  const url = APP_URLS[appKey];
  if (!url) return R.appNotFound[lang];
  const appLabel = appKey.charAt(0).toUpperCase() + appKey.slice(1);
  const opened =
    lang === "en"
      ? `Opening ${appLabel}.`
      : lang === "hi"
      ? `${appLabel} khol rahi hoon.`
      : `${appLabel} khulchhi.`;
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
      return opened;
    }
    await Linking.openURL(
      `intent://${appKey}#Intent;scheme=https;package=com.${appKey};end`
    );
    return opened;
  } catch {
    return R.appNotFound[lang];
  }
}

// ─── Movie / TV search (TMDB + TVMaze free fallback) ─────────────────────────

function extractMovieQuery(text: string): string {
  const patterns = [
    // "Stranger Things release date" — title comes BEFORE "release date"
    /^(.+?)\s+(?:release date|kab aayega|release kab|release kobe)\s*$/i,
    // "release date of Stranger Things"
    /(?:release date of|when does|when will|kab aayega|release kab hai|ber date of)\s+(.+?)(?:\s+release|\s+come out|\s+aana|\s*$)/i,
    // "movie/film/show Stranger Things"
    /(?:movie|film|show|series|search)\s+(.+)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return text;
}

async function fetchMovieInfoFree(
  query: string,
  lang: Language
): Promise<string> {
  try {
    const res = await fetch(
      `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`
    );
    if (res.ok) {
      const data = (await res.json()) as Array<{
        score: number;
        show: {
          name: string;
          premiered?: string;
          ended?: string;
          type?: string;
        };
      }>;
      if (data?.length > 0) {
        const show = data[0].show;
        if (show.premiered) {
          const formatted = new Date(show.premiered).toLocaleDateString(
            "en-US",
            { year: "numeric", month: "long", day: "numeric" }
          );
          return lang === "en"
            ? `The show "${show.name}" premiered on ${formatted}.`
            : lang === "hi"
            ? `"${show.name}" ka premiere ${formatted} ko hua tha.`
            : `"${show.name}" er premiere ${formatted} e hoyechilo.`;
        }
        return lang === "en"
          ? `"${show.name}" was found but no air date is available yet.`
          : lang === "hi"
          ? `"${show.name}" mila lekin premiere date nahi hai.`
          : `"${show.name}" pawa giyeche kintu date nei.`;
      }
    }
  } catch {}
  return lang === "en"
    ? `No results found for "${query}".`
    : lang === "hi"
    ? `"${query}" ke liye koi result nahi mila.`
    : `"${query}" er jonno kono result pawa jainee.`;
}

async function fetchMovieInfo(rawQuery: string, lang: Language): Promise<string> {
  const query = extractMovieQuery(rawQuery);

  if (TMDB_KEY) {
    try {
      const res = await fetch(
        `${TMDB_BASE}/search/multi?api_key=${TMDB_KEY}&query=${encodeURIComponent(
          query
        )}&language=en-US&page=1`
      );
      if (res.ok) {
        const data = (await res.json()) as {
          results: Array<{
            title?: string;
            name?: string;
            release_date?: string;
            first_air_date?: string;
            media_type?: string;
          }>;
        };
        if (data.results?.length) {
          const item = data.results[0];
          const title = item.title ?? item.name ?? query;
          const rawDate = item.release_date ?? item.first_air_date;
          const type = item.media_type === "tv" ? "series" : "movie";
          if (rawDate) {
            const formatted = new Date(rawDate).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            });
            return lang === "en"
              ? `The ${type} "${title}" was released on ${formatted}.`
              : lang === "hi"
              ? `"${title}" ${formatted} ko release hua tha.`
              : `"${title}" ${formatted} e release hoyechilo.`;
          }
          return lang === "en"
            ? `"${title}" was found but no release date is available yet.`
            : lang === "hi"
            ? `"${title}" mila lekin release date abhi available nahi hai.`
            : `"${title}" pawa giyeche kintu release date ekhono nei.`;
        }
      }
    } catch {}
  }

  return fetchMovieInfoFree(query, lang);
}

// ─── Gemini AI — multi-turn with chat history ────────────────────────────────

async function askGemini(
  text: string,
  lang: Language,
  history: CommandEntry[],
  extraContext?: string
): Promise<string> {
  const now = new Date();
  const timeStr = now.toLocaleTimeString(
    lang === "en" ? "en-US" : lang === "hi" ? "hi-IN" : "bn-IN",
    { hour: "2-digit", minute: "2-digit", hour12: true }
  );
  const dateStr = now.toLocaleDateString(
    lang === "en" ? "en-US" : lang === "hi" ? "hi-IN" : "bn-IN",
    { weekday: "long", year: "numeric", month: "long", day: "numeric" }
  );

  const systemPrompt =
    lang === "en"
      ? `You are Astra, a warm, knowledgeable AI voice assistant. Today is ${dateStr} and the time is ${timeStr}.${extraContext ? " " + extraContext : ""} Reply in 1-3 concise sentences — natural, friendly, perfect for voice. No bullet points or markdown.`
      : lang === "hi"
      ? `Aap Astra hain, ek helpful AI voice assistant. Aaj ${dateStr} hai aur abhi ${timeStr} baj rahe hain.${extraContext ? " " + extraContext : ""} 1-3 chhote sentences mein jawab dein — sahaj, dost-vaala, voice ke liye perfect. Koi bullet ya markdown nahi.`
      : `Apni Astra, ekti helpful AI voice assistant. Aaj ${dateStr} ebong ekhon ${timeStr}.${extraContext ? " " + extraContext : ""} 1-3 chhoto sentence e uttor dao — sahaj, bondhur moto, voice er jonno perfect. Kono bullet ba markdown noy.`;

  // Build multi-turn history: reverse newest-first log → oldest first, max 10 pairs
  const recentEntries = [...history].reverse().slice(-10);
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [
    { role: "user",  parts: [{ text: systemPrompt }] },
    { role: "model", parts: [{ text: "Understood! I'm Astra, ready to help." }] },
  ];
  for (const entry of recentEntries) {
    contents.push({ role: "user",  parts: [{ text: entry.command }] });
    contents.push({ role: "model", parts: [{ text: entry.response }] });
  }
  contents.push({ role: "user", parts: [{ text: text }] });

  try {
    const res = await fetch(GEMINI_PROXY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: {
          maxOutputTokens: 300,
          temperature: 0.75,
          topP: 0.9,
        },
      }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      console.error("[Gemini proxy] error:", res.status, errBody);
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (reply?.trim()) return reply.trim();
    return R.unknown[lang];
  } catch (err) {
    console.error("[askGemini] failed:", err);
    return R.geminiError[lang];
  }
}

// ─── AudD song identification ─────────────────────────────────────────────────

const SONG_DURATION_MS = 7000;

async function identifySong(
  lang: Language,
  onStatus: (s: string) => void
): Promise<string> {
  if (Platform.OS === "web") {
    return lang === "en"
      ? "Song identification is not available on web."
      : lang === "hi"
      ? "Web par song identification available nahi hai."
      : "Web e song identification nei.";
  }
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });
    onStatus(R.songListening[lang]);

    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    await new Promise((r) => setTimeout(r, SONG_DURATION_MS));
    await recording.stopAndUnloadAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

    const uri = recording.getURI();
    if (!uri) throw new Error("No URI");

    onStatus(R.songIdentifying[lang]);

    const body = new FormData();
    body.append("file", { uri, type: "audio/m4a", name: "song.m4a" } as any);
    if (AUDD_KEY) body.append("api_token", AUDD_KEY);

    const res = await fetch("https://api.audd.io/", { method: "POST", body });
    const data = (await res.json()) as {
      status: string;
      result?: {
        title?: string;
        artist?: string;
        album?: string;
        release_date?: string;
      };
    };

    if (data.status === "success" && data.result) {
      const { title, artist, album } = data.result;
      return lang === "en"
        ? `This is "${title}" by ${artist}${album ? `, from the album "${album}"` : ""}.`
        : lang === "hi"
        ? `Yeh gana "${title}" hai, ${artist} ka${album ? `, album "${album}" se` : ""}.`
        : `Ei gana holo "${title}", ${artist} er${album ? `, album "${album}" theke` : ""}.`;
    }
    return R.songNotFound[lang];
  } catch {
    return R.songError[lang];
  }
}

// ─── Battery helper ───────────────────────────────────────────────────────────

async function getBatteryResponse(lang: Language): Promise<string> {
  if (Platform.OS === "web") {
    return lang === "en"
      ? "Battery info is not available on web. Please use the APK build."
      : lang === "hi"
      ? "Web par battery info nahi hai. APK build use karein."
      : "Web e battery info nei. APK build use korun.";
  }
  try {
    const level = await Battery.getBatteryLevelAsync();
    const state = await Battery.getBatteryStateAsync();
    const pct = Math.round(level * 100);
    const charging =
      state === Battery.BatteryState.CHARGING ||
      state === Battery.BatteryState.FULL;
    return lang === "en"
      ? charging
        ? `Battery is at ${pct}% and charging.`
        : `Battery is at ${pct}%.`
      : lang === "hi"
      ? charging
        ? `Battery ${pct}% hai aur charge ho rahi hai.`
        : `Battery ${pct}% hai.`
      : charging
      ? `Battery ${pct}% ache ebong charge hochhe.`
      : `Battery ${pct}% ache.`;
  } catch {
    return lang === "en"
      ? "Unable to read battery level."
      : lang === "hi"
      ? "Battery level nahi mila."
      : "Battery level pora gelo na.";
  }
}

// ─── Notification helper ──────────────────────────────────────────────────────

async function getNotificationResponse(lang: Language): Promise<string> {
  if (Platform.OS === "web") {
    return lang === "en"
      ? "Notifications not available on web."
      : lang === "hi"
      ? "Web par notifications nahi hain."
      : "Web e notifications nei.";
  }
  try {
    const list = await Notifications.getPresentedNotificationsAsync();
    const count = list.length;
    if (count === 0) {
      return lang === "en"
        ? "No active Astra notifications. Note: reading system-wide unread notifications requires a native Android Notification Listener Service."
        : lang === "hi"
        ? "Koi active Astra notification nahi. System notifications ke liye native Android service chahiye."
        : "Kono active Astra notification nei. System notifications er jonno native Android service dorkar.";
    }
    const titles = list
      .map((n) => n.request.content.title ?? "Untitled")
      .slice(0, 3)
      .join(", ");
    return lang === "en"
      ? `You have ${count} Astra notification${count > 1 ? "s" : ""}: ${titles}.`
      : lang === "hi"
      ? `Astra ke ${count} notifications hain: ${titles}.`
      : `Astra er ${count}ti notification ache: ${titles}.`;
  } catch {
    return lang === "en"
      ? "Unable to read notifications."
      : lang === "hi"
      ? "Notifications nahi mili."
      : "Notifications pora gelo na.";
  }
}

// ─── Day / Night ──────────────────────────────────────────────────────────────

function getDayNightResponse(lang: Language): string {
  const hour = new Date().getHours();
  const isDay = hour >= 6 && hour < 20;
  const period =
    hour >= 5 && hour < 12
      ? "morning"
      : hour >= 12 && hour < 17
      ? "afternoon"
      : hour >= 17 && hour < 20
      ? "evening"
      : "night";
  const periodHi: Record<string, string> = {
    morning: "subah",
    afternoon: "dopahar",
    evening: "shaam",
    night: "raat",
  };
  const periodBn: Record<string, string> = {
    morning: "sokal",
    afternoon: "dupur",
    evening: "bikaley",
    night: "raat",
  };
  return lang === "en"
    ? isDay
      ? `It is currently ${period}. The sun is up.`
      : `It is currently ${period}. The sun is down.`
    : lang === "hi"
    ? isDay
      ? `Abhi ${periodHi[period]} hai. Din hai.`
      : `Abhi ${periodHi[period]} hai. Raat hai.`
    : isDay
    ? `Ekhon ${periodBn[period]}. Din ache.`
    : `Ekhon ${periodBn[period]}. Raat ache.`;
}

// ─── Brightness helper ────────────────────────────────────────────────────────

async function handleBrightness(text: string, lang: Language): Promise<string> {
  if (Platform.OS === "web") return R.brightnessWeb[lang];
  try {
    const current = await Brightness.getBrightnessAsync();
    let target = current;

    if (
      /\b(max|maximum|full|poori|sabse zyada|subochch)\b/.test(text)
    ) {
      target = 1.0;
    } else if (
      /\b(min|minimum|lowest|bilkul kam|sab se kam|nyunotom)\b/.test(text)
    ) {
      target = 0.05;
    } else if (
      /\b(up|increase|badha|barhao|zyada|baro)\b/.test(text)
    ) {
      target = Math.min(1, current + 0.25);
    } else if (
      /\b(down|decrease|kam kar|ghata|kam|kom koro)\b/.test(text)
    ) {
      target = Math.max(0.05, current - 0.25);
    } else {
      const numMatch = text.match(/(\d+)/);
      if (numMatch)
        target =
          Math.min(100, Math.max(1, parseInt(numMatch[1]))) / 100;
      else target = 0.5;
    }

    await Brightness.setBrightnessAsync(target);
    const pct = Math.round(target * 100);
    return lang === "en"
      ? `Screen brightness set to ${pct}%.`
      : lang === "hi"
      ? `Screen brightness ${pct}% kar diya.`
      : `Screen brightness ${pct}% kora holo.`;
  } catch {
    return R.brightnessErr[lang];
  }
}

// ─── Phone number extractor ───────────────────────────────────────────────────

function extractNumber(text: string): string | null {
  const m = text.match(/[\d\s\-+()]{7,}/);
  return m ? m[0].replace(/\s/g, "").trim() : null;
}

// ─── Timer helper ─────────────────────────────────────────────────────────────

async function setTimer(text: string, lang: Language): Promise<string> {
  const match = text.match(/(\d+)\s*(?:minute|min|minut|मिनट|মিনিট)?/i);
  if (!match) return R.timerInvalid[lang];
  const minutes = parseInt(match[1]);
  if (isNaN(minutes) || minutes <= 0) return R.timerInvalid[lang];

  Vibration.vibrate(200);

  if (Platform.OS !== "web") {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "⏱ Astra Timer",
          body:
            lang === "en"
              ? `${minutes} minute timer is done!`
              : lang === "hi"
              ? `${minutes} minute ka timer khatam!`
              : `${minutes} minit er timer sesh!`,
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: minutes * 60,
        },
      });
    } catch {}
  }

  return lang === "en"
    ? `Timer set for ${minutes} minute${minutes > 1 ? "s" : ""}.`
    : lang === "hi"
    ? `${minutes} minute ka timer set kar diya.`
    : `${minutes} minit er timer set kora holo.`;
}

// ─── TTS voice selector ───────────────────────────────────────────────────────

async function selectBestVoice(
  lang: Language
): Promise<string | undefined> {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const code   = LANG_CODES[lang];   // e.g. "hi-IN", "en-US"
    const prefix = code.split("-")[0]; // e.g. "hi", "en"

    const matchLang = voices.filter(
      (v) => v.language?.startsWith(code) || v.language?.startsWith(prefix)
    );

    // Priority 1 — WaveNet / Studio (highest quality Google neural)
    const wavenet = matchLang.find((v) =>
      /wavenet|studio/i.test(v.name ?? "")
    );
    if (wavenet) return wavenet.identifier;

    // Priority 2 — Google neural female (warm, natural)
    const googleFemale = matchLang.find((v) => {
      const n = (v.name ?? "").toLowerCase();
      return n.includes("google") && /female|woman|girl/i.test(v.name ?? "");
    });
    if (googleFemale) return googleFemale.identifier;

    // Priority 3 — any Google voice
    const google = matchLang.find((v) => v.name?.toLowerCase().includes("google"));
    if (google) return google.identifier;

    // Priority 4 — premium / enhanced / neural quality
    const premiumKw = ["premium", "enhanced", "natural", "neural", "eloquent", "samantha", "zira", "aria", "jenny"];
    const premium = matchLang.find(
      (v) =>
        (v as any).quality === "EnhancedQuality" ||
        (v as any).quality === "Enhanced"        ||
        premiumKw.some((k) => v.name?.toLowerCase().includes(k))
    );
    if (premium) return premium.identifier;

    // Fallback — first matching language voice
    return matchLang[0]?.identifier;
  } catch {
    return undefined;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AssistantContext = createContext<AssistantContextValue | null>(null);
const LANG_ORDER:   Language[] = ["en", "hi", "bn"];
const STORAGE_KEY   = "@astra_command_log";
const SESSIONS_KEY  = "@astra_sessions";

export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [language, setLanguage] = useState<Language>("en");
  const [commandLog, setCommandLog] = useState<CommandEntry[]>([]);
  const [sessions,   setSessions]   = useState<StoredSession[]>([]);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [songStatus, setSongStatus] = useState("");
  const [wakeMode, setWakeMode] = useState(false);
  const ttsVolumeRef    = useRef(0.95);
  const ttsRateRef      = useRef(0.82);
  const ttsVoiceRef     = useRef<string | undefined>(undefined);
  // Always-current reference so STT callbacks don't capture stale processCommand
  const processCommandRef = useRef<((text: string) => Promise<void>) | null>(null);
  // Web Speech API instance ref
  const webRecognitionRef = useRef<any>(null);
  // Monotonically-increasing session ID — stale callbacks self-cancel
  const sttSessionRef = useRef(0);

  useEffect(() => {
    (async () => {
      try {
        // Load current session
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as CommandEntry[];
          setCommandLog(
            parsed.map((e) => ({ ...e, timestamp: new Date(e.timestamp) }))
          );
        }
        // Load archived sessions
        const storedSessions = await AsyncStorage.getItem(SESSIONS_KEY);
        if (storedSessions) {
          setSessions(JSON.parse(storedSessions) as StoredSession[]);
        }
      } catch {}
    })();
  }, []);

  // Pre-load best TTS voice when language changes
  useEffect(() => {
    selectBestVoice(language).then((id) => {
      ttsVoiceRef.current = id;
    });
  }, [language]);

  // Live battery subscription
  useEffect(() => {
    if (Platform.OS === "web") return;
    let sub: Battery.Subscription | null = null;
    (async () => {
      try {
        const lvl = await Battery.getBatteryLevelAsync();
        setBatteryLevel(Math.round(lvl * 100));
        sub = Battery.addBatteryLevelListener(({ batteryLevel: l }) =>
          setBatteryLevel(Math.round(l * 100))
        );
      } catch {}
    })();
    return () => sub?.remove();
  }, []);

  // Setup notifications handler
  useEffect(() => {
    if (Platform.OS === "web") return;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }, []);

  const saveLog = useCallback(async (log: CommandEntry[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(log));
    } catch {}
  }, []);

  // ── TTS ───────────────────────────────────────────────────────────────────

  const speak = useCallback(
    (text: string) => {
      // Warm, natural parameters — slightly slower rate, gentle pitch
      const rate   = ttsRateRef.current;   // 0.82 default
      const volume = ttsVolumeRef.current; // 0.95 default
      // Pitch: slightly below 1.0 for a warmer, fuller tone on English;
      // Hindi/Bengali sit naturally a touch higher
      const pitch  = language === "hi" ? 1.05
                   : language === "bn" ? 1.02
                   : 0.95;

      if (Platform.OS === "web") {
        if (typeof window === "undefined" || !window.speechSynthesis) return;
        window.speechSynthesis.cancel();

        // voices() list may be empty on first call — retry once after a tick
        const doSpeak = () => {
          const utterance  = new SpeechSynthesisUtterance(text);
          utterance.lang   = LANG_CODES[language];
          utterance.rate   = rate;
          utterance.volume = volume;
          utterance.pitch  = pitch;

          const voices     = window.speechSynthesis.getVoices();
          const langCode   = LANG_CODES[language];
          const prefix     = langCode.split("-")[0];
          const langVoices = voices.filter(
            (v) => v.lang.startsWith(langCode) || v.lang.startsWith(prefix)
          );
          // Priority: WaveNet → Google female → any Google → premium female → first
          const pick =
            langVoices.find((v) => /wavenet|studio/i.test(v.name))              ??
            langVoices.find((v) => v.name.toLowerCase().includes("google") && /female|woman/i.test(v.name)) ??
            langVoices.find((v) => v.name.toLowerCase().includes("google"))      ??
            langVoices.find((v) => /zira|samantha|aria|jenny|female|woman/i.test(v.name)) ??
            langVoices[0] ??
            null;
          utterance.voice = pick;
          window.speechSynthesis.speak(utterance);
        };

        if (window.speechSynthesis.getVoices().length === 0) {
          window.speechSynthesis.onvoiceschanged = () => { doSpeak(); window.speechSynthesis.onvoiceschanged = null; };
        } else {
          doSpeak();
        }
        return;
      }

      // Native (Android / iOS): expo-speech
      Speech.stop();
      Speech.speak(text, {
        language: LANG_CODES[language],
        rate,
        volume,
        pitch,
        voice: ttsVoiceRef.current,
      });
    },
    [language]
  );

  const addEntry = useCallback(
    (
      command: string,
      response: string,
      type: CommandEntry["type"] = "success"
    ) => {
      const entry: CommandEntry = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        command,
        response,
        timestamp: new Date(),
        type,
      };
      setCommandLog((prev) => {
        const updated = [entry, ...prev].slice(0, 60);
        saveLog(updated);
        return updated;
      });
    },
    [saveLog]
  );

  // ── Start / Stop listening ─────────────────────────────────────────────────

  const startListening = useCallback(async () => {
    // Guard: don't start a new session while one is already active
    if (isListening || isProcessing) {
      console.log("[STT] Already active — ignoring start");
      return;
    }

    // Bump session ID; stale callbacks will compare and self-cancel
    const sessionId = ++sttSessionRef.current;

    if (Platform.OS === "web") {
      if (typeof window === "undefined") return;
      const SR =
        (window as any).SpeechRecognition ??
        (window as any).webkitSpeechRecognition;
      if (!SR) {
        console.log("[STT] SpeechRecognition not supported in this browser");
        return;
      }
      // Cancel any lingering prior session
      if (webRecognitionRef.current) {
        try { webRecognitionRef.current.abort(); } catch {}
        webRecognitionRef.current = null;
      }
      const recognition = new SR();
      recognition.lang           = LANG_CODES[language];
      recognition.continuous     = false;
      recognition.interimResults = false;
      recognition.onstart = () => {
        console.log("[STT] Web recognition started, session", sessionId);
        setIsListening(true);
      };
      recognition.onresult = async (ev: any) => {
        if (sttSessionRef.current !== sessionId) return; // stale
        const transcript = ev.results[0]?.[0]?.transcript ?? "";
        console.log("[STT] Web result:", transcript);
        if (transcript.trim()) {
          setIsListening(false);
          await processCommandRef.current?.(transcript.trim());
        }
      };
      recognition.onerror = (ev: any) => {
        if (sttSessionRef.current !== sessionId) return;
        console.log("[STT] Web error:", ev.error);
        setIsListening(false);
      };
      recognition.onend = () => {
        if (sttSessionRef.current !== sessionId) return;
        console.log("[STT] Web recognition ended");
        setIsListening(false);
      };
      webRecognitionRef.current = recognition;
      try {
        recognition.start();
        setIsListening(true);
      } catch (e) {
        console.log("[STT] Web start error:", e);
        webRecognitionRef.current = null;
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      return;
    }

    // Native: expo-speech-recognition
    console.log("[STT] Requesting mic permission...");
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      console.log("[STT] Microphone permission denied");
      return;
    }
    console.log("[STT] Starting recognition, session", sessionId, "lang:", LANG_CODES[language]);
    try {
      ExpoSpeechRecognitionModule.start({
        lang:            LANG_CODES[language],
        interimResults:  true,
        maxAlternatives: 1,
        continuous:      false,
        requiresOnDeviceRecognition: false,
      });
      setIsListening(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {
      console.log("[STT] Native start error:", e);
    }
  }, [language, isListening, isProcessing]);

  const stopListening = useCallback(() => {
    if (Platform.OS === "web") {
      webRecognitionRef.current?.stop();
      webRecognitionRef.current = null;
    } else {
      try { ExpoSpeechRecognitionModule.stop(); } catch {}
    }
    setIsListening(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const processCommand = useCallback(
    async (rawText: string) => {
      const text = rawText.trim().toLowerCase();
      if (!text) return;

      setIsListening(false);
      setIsProcessing(true);
      setSongStatus("");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      await new Promise((r) => setTimeout(r, 200));

      let response = "";
      let type: CommandEntry["type"] = "success";

      // ─────────────────────────────────────────────────────────────────────
      // DEVICE-ACTION handlers — only these require hardware access.
      // Everything else goes straight to Gemini with full chat history.
      // ─────────────────────────────────────────────────────────────────────

      // ── Torch on ──────────────────────────────────────────────────────────
      if (
        /(torch|flashlight|bati|alo)\s*(on|jala|chalu)/i.test(text) ||
        /^(on|jala|chalu)\s+(torch|flashlight|bati|alo)/i.test(text)
      ) {
        if (Platform.OS === "web") {
          response = language === "en"
            ? "Torch is only available in the native APK build."
            : language === "hi" ? "Torch sirf APK build mein hai."
            : "Torch shudhu APK build e pawa jabe.";
        } else {
          setTorchOn(true);
          response = R.torchOn[language];
        }

      // ── Torch off ─────────────────────────────────────────────────────────
      } else if (
        /(torch|flashlight|bati|alo)\s*(off|band|bujha|nibao)/i.test(text) ||
        /^(off|band|bujha|nibao)\s+(torch|flashlight|bati|alo)/i.test(text)
      ) {
        setTorchOn(false);
        response = R.torchOff[language];

      // ── TTS volume up ─────────────────────────────────────────────────────
      } else if (
        /(speak louder|louder|zyada awaaz|zyada bolein|jore bolo|awaz badha)/.test(text)
      ) {
        ttsVolumeRef.current = Math.min(1.0, ttsVolumeRef.current + 0.1);
        response = R.speakLouder[language];

      // ── TTS volume down ───────────────────────────────────────────────────
      } else if (
        /(speak quieter|quieter|softer|dhire bolo|dhire bolein|aste bolo|kam awaaz|awaz kam)/.test(text)
      ) {
        ttsVolumeRef.current = Math.max(0.3, ttsVolumeRef.current - 0.1);
        response = R.speakQuieter[language];

      // ── Brightness ────────────────────────────────────────────────────────
      } else if (/(brightness|ujala|chamak|roshan)/.test(text)) {
        response = await handleBrightness(text, language);

      // ── Vibrate ───────────────────────────────────────────────────────────
      } else if (/(^vibrate$|^buzz$|vibrate phone|phone hilao|kampao)/.test(text)) {
        Vibration.vibrate([0, 300, 100, 300, 100, 500]);
        response = R.vibrated[language];

      // ── Song identification ───────────────────────────────────────────────
      } else if (
        /(what song|which song|kaun sa gana|song name|gana pehchano|identify song|gana batao|shazam|kono gaan)/.test(text)
      ) {
        type = "info";
        response = await identifySong(language, setSongStatus);
        setSongStatus("");

      // ── Call ──────────────────────────────────────────────────────────────
      } else if (
        /\b(call|dial|ring|phone karo|call karo|phan koro)\b/.test(text) &&
        /\d{5,}/.test(text)
      ) {
        if (Platform.OS === "web") {
          response = language === "en" ? "Calling is not available on web."
            : language === "hi" ? "Web par call nahi ho sakti."
            : "Web e call hoy na.";
        } else {
          const num = extractNumber(text);
          if (num) {
            await Linking.openURL(`tel:${num}`);
            response = language === "en" ? `Calling ${num}.`
              : language === "hi" ? `${num} pe call kar rahi hoon.`
              : `${num} e call korchhi.`;
          } else {
            response = language === "en" ? "Please say the phone number."
              : language === "hi" ? "Phone number bolein."
              : "Phone number bolun.";
          }
        }

      // ── SMS ───────────────────────────────────────────────────────────────
      } else if (
        /\b(text|sms|message karo|sms karo|sms koro)\b/.test(text) &&
        /\d{5,}/.test(text)
      ) {
        if (Platform.OS === "web") {
          response = language === "en" ? "SMS is not available on web."
            : language === "hi" ? "Web par SMS nahi hoga."
            : "Web e SMS hoy na.";
        } else {
          const num = extractNumber(text);
          if (num) {
            await Linking.openURL(`sms:${num}`);
            response = language === "en" ? `Opening messages for ${num}.`
              : language === "hi" ? `${num} ke liye messages khol raha hoon.`
              : `${num} er jonno messages khulchhi.`;
          } else {
            response = language === "en" ? "Please say the phone number."
              : language === "hi" ? "Number bolein." : "Number bolun.";
          }
        }

      // ── Open app ──────────────────────────────────────────────────────────
      } else if (
        /\b(open|launch|kholo|start karo|chalu karo|khola|shuru koro)\b/.test(text) &&
        /(youtube|maps|whatsapp|settings|chrome|camera|gallery|dialer|spotify|instagram|facebook|twitter)/.test(text)
      ) {
        const appName = extractAppName(text);
        type = "info";
        response = appName ? await openApp(appName, language) : R.appNotFound[language];

      // ── Timer (requires explicit number + unit to avoid misfires) ────────────
      } else if (
        /\b\d+\s*(minute|min|second|sec|hour|hr|घंटा|मिनट|সেকেন্ড|মিনিট)\b.*\b(timer|alarm|countdown)\b/.test(text) ||
        /\b(timer|alarm|countdown)\b.*\b\d+\s*(minute|min|second|sec|hour|hr|घंटा|मिनट|সেকেন্ড|মিনিট)\b/.test(text)
      ) {
        type = "info";
        response = await setTimer(text, language);

      // ── Wi-Fi / Data settings ─────────────────────────────────────────────
      } else if (
        /(wifi|wi-fi|mobile data|internet on|internet off|data on|data off|turn on wifi|turn off wifi)/.test(text)
      ) {
        type = "warning";
        response = R.wifiLimit[language];
        if (Platform.OS !== "web") {
          try { await Linking.openSettings(); } catch {}
        }

      // ── Battery (device sensor — needs local access) ───────────────────────
      } else if (
        /(battery|charge level|kitni battery|battery koto|charge koto)/.test(text)
      ) {
        response = await getBatteryResponse(language);

      // ─────────────────────────────────────────────────────────────────────
      // ALL OTHER QUERIES → Gemini with full conversation history
      // Gemini knows date, time, movies, general knowledge, jokes, etc.
      // ─────────────────────────────────────────────────────────────────────
      } else {
        type = "info";
        // Inject battery level so Gemini can answer battery questions naturally
        const battCtx = batteryLevel !== null
          ? (language === "en" ? `Device battery: ${batteryLevel}%.`
            : language === "hi" ? `Phone battery: ${batteryLevel}%.`
            : `Phone battery: ${batteryLevel}%.`)
          : undefined;
        response = await askGemini(rawText.trim(), language, commandLog, battCtx);
      }

      addEntry(rawText.trim(), response, type);
      speak(response);
      setIsProcessing(false);
    },
    [language, commandLog, batteryLevel, addEntry, speak]
  );

  const toggleLanguage = useCallback(() => {
    setLanguage((prev) => {
      const idx = LANG_ORDER.indexOf(prev);
      return LANG_ORDER[(idx + 1) % LANG_ORDER.length];
    });
    Haptics.selectionAsync();
  }, []);

  const clearLog = useCallback(() => {
    // Archive the current session before wiping it
    setCommandLog((prev) => {
      if (prev.length > 0) {
        // oldest entry = last in the newest-first array
        const oldest = prev[prev.length - 1];
        const session: StoredSession = {
          id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
          title: oldest.command.slice(0, 60),
          startedAt: oldest.timestamp.toISOString(),
          entries: prev.map((e) => ({
            id:        e.id,
            command:   e.command,
            response:  e.response,
            timestamp: e.timestamp.toISOString(),
            type:      e.type,
          })),
        };
        setSessions((prevSessions) => {
          const updated = [session, ...prevSessions].slice(0, 60);
          AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(updated)).catch(() => {});
          return updated;
        });
      }
      return [];
    });
    saveLog([]);
  }, [saveLog]);

  /** Restore a past archived session into the active commandLog */
  const loadSession = useCallback((session: StoredSession) => {
    const entries: CommandEntry[] = session.entries.map((e) => ({
      ...e,
      timestamp: new Date(e.timestamp),
    }));
    setCommandLog(entries);
    saveLog(entries);
  }, [saveLog]);

  // ── STT event handlers (native — expo-speech-recognition) ────────────────
  // Must be placed AFTER processCommand so the ref sync effect is valid.

  useSpeechRecognitionEvent("result", (event) => {
    if (Platform.OS === "web") return; // handled by Web Speech API callbacks
    const sessionId = sttSessionRef.current;
    const transcript = event.results[0]?.transcript ?? "";
    console.log("[STT] native result isFinal:", event.isFinal, "session:", sessionId, "text:", transcript);
    if (event.isFinal && transcript.trim()) {
      setIsListening(false);
      processCommandRef.current?.(transcript.trim());
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    if (Platform.OS === "web") return;
    console.log("[STT] native error:", event.error, event.message);
    setIsListening(false);
  });

  useSpeechRecognitionEvent("end", () => {
    if (Platform.OS === "web") return;
    console.log("[STT] native recognition ended");
    setIsListening(false);
  });

  // Keep processCommandRef current so STT callbacks never capture a stale closure
  useEffect(() => {
    processCommandRef.current = processCommand;
  }, [processCommand]);

  return (
    <AssistantContext.Provider
      value={{
        isListening,
        isProcessing,
        torchOn,
        language,
        commandLog,
        sessions,
        batteryLevel,
        songStatus,
        wakeMode,
        startListening,
        stopListening,
        processCommand,
        toggleLanguage,
        clearLog,
        loadSession,
        speak,
        setWakeMode,
      }}
    >
      {children}
    </AssistantContext.Provider>
  );
}

export function useAssistant() {
  const ctx = useContext(AssistantContext);
  if (!ctx)
    throw new Error("useAssistant must be used inside AssistantProvider");
  return ctx;
}
