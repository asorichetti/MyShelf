import * as Network from 'expo-network';

/** Whether the phone is on mobile data right now (not Wi-Fi). False when it cannot tell. */
export async function isOnMobileData(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return state.type === Network.NetworkStateType.CELLULAR;
  } catch {
    return false;
  }
}
