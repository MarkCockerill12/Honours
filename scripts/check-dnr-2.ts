import { FiltersEngine } from "@ghostery/adblocker";

async function check() {
  const engine = await FiltersEngine.fromPrebuiltAdsAndTracking(fetch);
  console.log("FiltersEngine Keys:", Object.keys(engine));
  console.log("Methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(engine)));
}

check().catch(console.error);
