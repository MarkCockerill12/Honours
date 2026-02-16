// packages/core/src/adblock.ts

export const AD_BLOCK_LISTS = {
  EASYLIST: "https://easylist.to/easylist/easylist.txt",
  ADGUARD: "https://filters.adtidy.org/extension/chromium/filters/2.txt"
};

// This function returns generic rules that any app (Mobile/Ext) can use
// TODO: Implement full Manifest V3 Rule generation logic and persistent IDs
export const parseAdblockRules = (enabled: boolean) => {
  if (!enabled) return [];

  return [
    { domain: "doubleclick.net", type: "block" },
    { domain: "google-analytics.com", type: "block" },
    { domain: "facebook.com/tr/", type: "block" }
  ];
};

// TODO: Align rule format with specific platform requirements (e.g. Android Webview vs. Chrome DNR)
export const getAdblockConfig = (enabled: boolean) => {
  return {
    active: enabled,
    rules: parseAdblockRules(enabled)
  };
};