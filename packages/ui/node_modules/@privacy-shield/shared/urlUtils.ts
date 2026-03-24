export const isPdfUrl = (url: string | undefined | null): boolean => {
  if (!url) return false;
  try {
    const lowerUrl = url.toLowerCase();
    // Check if path ends in .pdf or if a query param ends in .pdf
    return lowerUrl.split('?')[0].split('#')[0].endsWith('.pdf') || 
           lowerUrl.includes('.pdf?') || 
           lowerUrl.endsWith('.pdf');
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
