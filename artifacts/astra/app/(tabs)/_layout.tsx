import { useAuth } from "@clerk/expo";
import { Redirect, Slot } from "expo-router";
import React, { useEffect, useState } from "react";
import { View } from "react-native";

// Whether Clerk is configured in this environment
const hasClerk = !!process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function TabLayout() {
  // If no Clerk key is set, skip auth entirely and show the app
  if (!hasClerk) {
    return <Slot />;
  }
  return <AuthenticatedTabLayout />;
}

// Only rendered when ClerkProvider is above us in the tree
function AuthenticatedTabLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  // If Clerk takes too long (slow network / misconfigured), stop waiting
  useEffect(() => {
    if (isLoaded) return;
    const t = setTimeout(() => setTimedOut(true), 4000);
    return () => clearTimeout(t);
  }, [isLoaded]);

  if (!isLoaded && !timedOut) {
    return <View style={{ flex: 1, backgroundColor: "#000000" }} />;
  }

  if (!isSignedIn) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return <Slot />;
}
