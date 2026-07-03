/**
 * Astra — Google Sign-In screen
 * Matches the dark splash aesthetic: #060612 background, gradient orb logo.
 * Uses Clerk's useSSO() hook with Google OAuth (works in Expo Go + production builds).
 */

import * as AuthSession from "expo-auth-session";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
  Svg,
} from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSSO } from "@clerk/expo";

const hasClerk = !!process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

// Handle any pending auth sessions from the OS browser
WebBrowser.maybeCompleteAuthSession();

// Warm up the Android browser for faster OAuth launch
function useWarmUpBrowser() {
  useEffect(() => {
    if (Platform.OS !== "android") return;
    WebBrowser.warmUpAsync();
    return () => { WebBrowser.coolDownAsync(); };
  }, []);
}

// ── Astra gradient orb (same visual as splash) ────────────────────────────────
function AstraLogo({ size = 90 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id="rg" cx="35%" cy="30%" r="70%">
          <Stop offset="0%"   stopColor="#C084FC" />
          <Stop offset="40%"  stopColor="#7C3AED" />
          <Stop offset="100%" stopColor="#1E0845" />
        </RadialGradient>
        <RadialGradient id="hi" cx="38%" cy="28%" r="50%">
          <Stop offset="0%"   stopColor="#E9D5FF" stopOpacity={0.7} />
          <Stop offset="100%" stopColor="#7C3AED" stopOpacity={0} />
        </RadialGradient>
        <LinearGradient id="sg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%"   stopColor="#60A5FA" />
          <Stop offset="50%"  stopColor="#A78BFA" />
          <Stop offset="100%" stopColor="#F472B6" />
        </LinearGradient>
      </Defs>
      <Circle cx={50} cy={50} r={48} fill="url(#rg)" />
      <Circle cx={50} cy={50} r={48} fill="url(#hi)" />
      <Path
        d="M50,20 C50,25.5 27,50 21.5,50 C27,50 50,75 50,80 C50,75 73,50 78.5,50 C73,50 50,25.5 50,20 Z"
        fill="url(#sg)"
        opacity={0.95}
      />
    </Svg>
  );
}

// ── Google "G" colour logo ────────────────────────────────────────────────────
function GoogleG({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 488 488">
      <Path
        d="M488 244c0-16.5-1.5-33-4.3-49H244v93h136.5c-5.9 31.4-23.5 58-50 75.8v63h80.8C459.7 384.3 488 318.8 488 244z"
        fill="#4285F4"
      />
      <Path
        d="M244 488c67.6 0 124.4-22.4 165.8-60.7l-80.8-63c-22.4 15-51 23.8-85 23.8-65.3 0-120.7-44.1-140.5-103.3H20.3v64.6C61.5 433.4 148.3 488 244 488z"
        fill="#34A853"
      />
      <Path
        d="M103.5 285.3c-5-15-7.9-31-7.9-47.3s2.9-32.3 7.9-47.3v-64.6H20.3C7.3 152.6 0 197.5 0 244s7.3 91.4 20.3 118l83.2-76.7z"
        fill="#FBBC04"
      />
      <Path
        d="M244 95.4c36.8 0 69.8 12.7 95.8 37.4l71.8-71.8C373.5 22.4 316.6 0 244 0 148.3 0 61.5 54.6 20.3 126l83.2 76.7C123.3 143.5 178.7 95.4 244 95.4z"
        fill="#EA4335"
      />
    </Svg>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function SignInScreen() {
  // Route to the correct implementation based on whether Clerk is configured
  if (hasClerk) return <ClerkSignInScreen />;
  return <NoAuthSignInScreen />;
}

// Shown when no Clerk key is configured — lets user continue without sign-in
function NoAuthSignInScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <SignInLayout insets={insets}>
      <TouchableOpacity
        style={[s.googleBtn, { opacity: 0.45 }]}
        disabled
        activeOpacity={1}
      >
        <GoogleG size={22} />
        <Text style={s.googleBtnText}>Continue with Google</Text>
      </TouchableOpacity>
      <Text style={[s.errorText, { marginTop: 8 }]}>
        Google sign-in requires Clerk setup.{"\n"}Add CLERK_PUBLISHABLE_KEY in Replit Secrets.
      </Text>
      <TouchableOpacity style={s.skipBtn} onPress={() => router.replace("/")} activeOpacity={0.7}>
        <Text style={s.skipText}>Continue without signing in</Text>
      </TouchableOpacity>
    </SignInLayout>
  );
}

// Shown when Clerk is configured — real Google OAuth
function ClerkSignInScreen() {
  useWarmUpBrowser();

  const insets  = useSafeAreaInsets();
  const router  = useRouter();
  const { startSSOFlow } = useSSO();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const handleGoogleSignIn = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { createdSessionId, setActive } = await startSSOFlow({
        strategy:    "oauth_google",
        redirectUrl: AuthSession.makeRedirectUri({ scheme: "astra" }),
      });

      if (createdSessionId && setActive) {
        await setActive({
          session: createdSessionId,
          navigate: async ({ decorateUrl }) => {
            router.replace(decorateUrl("/") as any);
          },
        });
      }
    } catch (err: any) {
      console.error("[Auth] Google sign-in error:", err);
      setError("Sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [startSSOFlow, router]);

  return (
    <SignInLayout insets={insets}>
      <TouchableOpacity
        style={[s.googleBtn, loading && s.googleBtnDisabled]}
        onPress={handleGoogleSignIn}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? <ActivityIndicator size="small" color="#4285F4" /> : <GoogleG size={22} />}
        <Text style={s.googleBtnText}>{loading ? "Signing in…" : "Continue with Google"}</Text>
      </TouchableOpacity>
      {error ? <Text style={s.errorText}>{error}</Text> : null}
      <TouchableOpacity style={s.skipBtn} onPress={() => router.replace("/")} activeOpacity={0.7}>
        <Text style={s.skipText}>Continue without signing in</Text>
      </TouchableOpacity>
    </SignInLayout>
  );
}

// ── Shared layout wrapper ─────────────────────────────────────────────────────

function SignInLayout({ insets, children }: { insets: { top: number; bottom: number }; children: React.ReactNode }) {
  return (
    <View style={[s.root, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}>
      <View style={s.brandArea}>
        <AstraLogo size={96} />
        <Text style={s.appName}>Astra</Text>
        <Text style={s.tagline}>Your intelligent voice assistant</Text>
      </View>
      <View style={s.card}>
        <Text style={s.cardTitle}>Get started</Text>
        <Text style={s.cardSubtitle}>
          Sign in to save your conversations{"\n"}and access Astra across devices
        </Text>
        {children}
      </View>
      <Text style={s.legalText}>
        By continuing, you agree to our Terms of Service{"\n"}and Privacy Policy
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: "#060612",
    alignItems:      "center",
    justifyContent:  "space-between",
    paddingHorizontal: 24,
  },

  // Brand
  brandArea: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
    gap:            14,
    paddingBottom:  20,
  },
  appName: {
    fontSize:      40,
    fontFamily:    "Inter_700Bold",
    color:         "#FFFFFF",
    letterSpacing: -1,
    marginTop:     4,
  },
  tagline: {
    fontSize:      15,
    fontFamily:    "Inter_400Regular",
    color:         "#666",
    letterSpacing: 0.2,
  },

  // Sign-in card
  card: {
    width:           "100%",
    backgroundColor: "#0F0A2A",
    borderRadius:    24,
    padding:         28,
    alignItems:      "center",
    gap:             14,
    borderWidth:     1,
    borderColor:     "#1E1145",
  },
  cardTitle: {
    fontSize:      22,
    fontFamily:    "Inter_700Bold",
    color:         "#FFFFFF",
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontSize:      14,
    fontFamily:    "Inter_400Regular",
    color:         "#888",
    textAlign:     "center",
    lineHeight:    20,
  },

  // Google button
  googleBtn: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "center",
    gap:               12,
    backgroundColor:   "#FFFFFF",
    borderRadius:      14,
    paddingVertical:   15,
    paddingHorizontal: 24,
    width:             "100%",
    marginTop:         6,
    shadowColor:       "#000",
    shadowOffset:      { width: 0, height: 2 },
    shadowOpacity:     0.25,
    shadowRadius:      8,
    elevation:         4,
  },
  googleBtnDisabled: { opacity: 0.7 },
  googleBtnText: {
    fontSize:      16,
    fontFamily:    "Inter_600SemiBold",
    color:         "#1a1a1a",
    letterSpacing: -0.1,
  },

  errorText: {
    fontSize:   13,
    color:      "#EA4335",
    fontFamily: "Inter_400Regular",
    textAlign:  "center",
  },

  skipBtn: { paddingVertical: 8, paddingHorizontal: 16 },
  skipText: {
    fontSize:      13,
    fontFamily:    "Inter_400Regular",
    color:         "#555",
    textDecorationLine: "underline",
  },

  // Legal
  legalText: {
    fontSize:      11,
    fontFamily:    "Inter_400Regular",
    color:         "#333",
    textAlign:     "center",
    lineHeight:    16,
    marginTop:     20,
  },
});
