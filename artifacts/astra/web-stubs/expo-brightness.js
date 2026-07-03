// Web stub — expo-brightness is not supported on web.
// All functions return safe no-op values so the app doesn't crash.

export async function getBrightnessAsync() {
  return 0.5;
}

export async function setBrightnessAsync(_value) {
  // no-op on web
}

export async function getSystemBrightnessAsync() {
  return 0.5;
}

export async function setSystemBrightnessAsync(_value) {
  // no-op on web
}

export async function useSystemBrightnessAsync() {
  // no-op on web
}

export const BrightnessMode = {
  AUTOMATIC: 0,
  MANUAL: 1,
  UNKNOWN: 2,
};
