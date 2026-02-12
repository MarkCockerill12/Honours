export const AD_BLOCK_LISTS = {
  EASYLIST: "https://easylist.to/easylist/easylist.txt",
  ADGUARD: "https://filters.adtidy.org/extension/chromium/filters/2.txt"
};

export const parseAdblockRules = (toggleState: boolean) => {
  if (!toggleState) return [];

  // In a real app, this would return the Rule ID set for Manifest V3
  // For the report: We return the configuration object
  return [
    {
      id: 1,
      priority: 1,
      action: { type: "block" },
      condition: { 
        urlFilter: "||doubleclick.net^", 
        resourceTypes: ["script", "image", "xmlhttprequest"] 
      }
    },
    // ... extensive list would be generated here
  ];
};