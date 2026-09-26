/** The web build cannot tell mobile data from Wi-Fi reliably; it never holds covers back. */
export async function isOnMobileData(): Promise<boolean> {
  return false;
}
