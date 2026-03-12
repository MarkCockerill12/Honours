import { WebExtensionBlocker } from "@ghostery/adblocker-webextension";

async function check() {
  const blocker = await WebExtensionBlocker.fromPrebuiltAdsAndTracking(fetch);
  console.log("Keys:", Object.keys(blocker));
}

check().catch(console.error);
