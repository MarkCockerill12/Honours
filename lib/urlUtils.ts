/**
 * Checks if a URL points to a PDF document.
 * @param url The URL to check.
 * @returns True if the URL ends with .pdf (ignoring query parameters).
 */
export const isPdfUrl = (url: string | undefined | null): boolean => {
  if (!url) return false;
  try {
    const cleanUrl = url.split("?")[0].split("#")[0].toLowerCase();
    return cleanUrl.endsWith(".pdf");
  } catch {
    return false;
  }
};

/**
 * Checks if a URL has the bypass parameter.
 * @param url The URL to check.
 * @returns True if the URL contains 'bypass=true'.
 */
export const hasBypassParam = (url: string | undefined | null): boolean => {
  if (!url) return false;
  return url.includes("bypass=true");
};
