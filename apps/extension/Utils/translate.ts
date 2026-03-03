// Backend API configuration
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080/api/translate";

export const translateText = async (text: string, targetLang: string = 'EN') => {
  try {
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLang })
    });

    if (!response.ok) throw new Error('Network error');
    
    const data = await response.json();
    return data.translated;
  } catch (error) {
    console.error("Translation Failed", error);
    return text; // Fallback: return original text
  }
};