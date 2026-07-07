import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { ClerkLoaded, ClerkLoading, ClerkProvider } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary }  from "@/components/ErrorBoundary";
import { UpdateModal }    from "@/components/UpdateModal";
import { AssistantProvider } from "@/context/AssistantContext";
import { useOTAUpdate }  from "@/hooks/useOTAUpdate";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
const clerkProxyUrl = process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined;
const hasClerk = !!clerkPublishableKey;

// Use the app icon — square logo with rounded corners baked in
const astraLogo = require("../assets/images/astra-logo.png");

const ICON_SIZE = Math.round(Dimensions.get("window").width * 0.55);

// ── Custom splash ─────────────────────────────────────────────────────────────

function CustomSplash() {
  // Gentle fade-in only — no scale pulse (caused flickering)
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 400,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <View style={s.root}>
      <Animated.Image
        source={astraLogo}
        style={{ width: ICON_SIZE, height: ICON_SIZE, opacity }}
        resizeMode="contain"
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
});

// ── Clerk timeout fallback — renders app if Clerk doesn't load in 4s ──────────

function ClerkFallback() {
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 4000);
    return () => clearTimeout(t);
  }, []);
  if (!timedOut) return null;
  return <AppContent />;
}

// ── App content (providers + nav) ─────────────────────────────────────────────

function AppContent() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <KeyboardProvider>
            <AssistantProvider>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              </Stack>
            </AssistantProvider>
          </KeyboardProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

// ── Root layout ───────────────────────────────────────────────────────────────

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const [splashVisible, setSplashVisible] = useState(true);
  const splashOpacity = useRef(new Animated.Value(1)).current;
  const dismissed     = useRef(false);
  const [splashDone, setSplashDone] = useState(false);

  const fontsReady = fontsLoaded || !!fontError;

  const dismissSplash = useRef(() => {
    if (dismissed.current) return;
    dismissed.current = true;
    SplashScreen.hideAsync().catch(() => {});
    Animated.timing(splashOpacity, {
      toValue:         0,
      duration:        500,
      easing:          Easing.out(Easing.ease),
      useNativeDriver: Platform.OS !== "web",
    }).start(() => { setSplashVisible(false); setSplashDone(true); });
  }).current;

  // Normal path: dismiss after fonts are ready
  useEffect(() => {
    if (!fontsReady) return;
    const delay = Platform.OS === "web" ? 800 : 2800;
    const t = setTimeout(dismissSplash, delay);
    return () => clearTimeout(t);
  }, [fontsReady]);

  // Safety valve: always dismiss after 5s
  useEffect(() => {
    const t = setTimeout(dismissSplash, 5000);
    return () => clearTimeout(t);
  }, []);

  // OTA update check — only after splash is gone
  const ota = useOTAUpdate(splashDone);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#000000" }}>
      {fontsReady && (
        hasClerk ? (
          <ClerkProvider
            publishableKey={clerkPublishableKey}
            tokenCache={tokenCache}
            proxyUrl={clerkProxyUrl}
          >
            {/* ClerkLoading: render app immediately if Clerk takes >4s */}
            <ClerkLoading>
              <ClerkFallback />
            </ClerkLoading>
            <ClerkLoaded>
              <AppContent />
            </ClerkLoaded>
          </ClerkProvider>
        ) : (
          <AppContent />
        )
      )}

      {/* Splash — always on top until dismissed */}
      {splashVisible && (
        <Animated.View
          style={[StyleSheet.absoluteFillObject, { opacity: splashOpacity }]}
          pointerEvents="none"
        >
          <CustomSplash />
        </Animated.View>
      )}

      {/* OTA Update modal — shown after splash exits */}
      <UpdateModal
        visible={ota.showModal}
        latestVersion={ota.latestVersion}
        changelog={ota.changelog}
        downloadUrl={ota.downloadUrl}
        forced={ota.forced}
        onDismiss={ota.dismiss}
      />
    </GestureHandlerRootView>
  );
}
