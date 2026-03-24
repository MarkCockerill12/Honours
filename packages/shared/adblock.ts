import { COMPREHENSIVE_DOMAINS } from "./constants";

export const AD_BLOCK_LISTS = {
  EASYLIST: "https://easylist.to/easylist/easylist.txt",
  ADGUARD: "https://filters.adtidy.org/extension/chromium/filters/2.txt",
};

export const parseAdblockRules = (enabled: boolean) => {
  if (!enabled) return [];
  return COMPREHENSIVE_DOMAINS.map((domain) => ({
    domain,
    type: "block" as const,
  }));
};

export const getAdblockConfig = (enabled: boolean) => {
  return {
    active: enabled,
    rules: parseAdblockRules(enabled),
  };
};
