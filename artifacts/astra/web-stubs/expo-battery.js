// Web stub — expo-battery is not supported on web.
// All functions return safe no-op values so the app doesn't crash.

export const BatteryState = {
  UNDETERMINED: 0,
  UNPLUGGED: 1,
  CHARGING: 2,
  FULL: 3,
  UNKNOWN: -1,
};

export async function getBatteryLevelAsync() {
  return -1;
}

export async function getBatteryStateAsync() {
  return BatteryState.UNDETERMINED;
}

export function addBatteryLevelListener(_callback) {
  return { remove: () => {} };
}

export function addBatteryStateListener(_callback) {
  return { remove: () => {} };
}
