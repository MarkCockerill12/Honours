/**
 * Privacy Sentinel - Security Hardening Utility
 * XOR + Hex obfuscation for sensitive keys (AWS, WireGuard).
 */

const SHIELD_MASK = "B4ST10N_PR0T0C0L";
const PREFIX = "SHIELD:";

/**
 * Encodes a string using an XOR mask and Hex.
 */
export function encodeKey(input: string): string {
  if (!input) return "";
  const cleanInput = input.trim();
  if (cleanInput.startsWith(PREFIX)) return cleanInput;
  
  const hex = cleanInput.split('').map((char, i) => {
    const code = char.charCodeAt(0) ^ SHIELD_MASK.charCodeAt(i % SHIELD_MASK.length);
    return code.toString(16).padStart(2, '0');
  }).join('');
  
  return PREFIX + hex;
}

/**
 * Decodes an obfuscated key for runtime use.
 */
export function decodeKey(obfuscated: string): string {
  if (!obfuscated) return "";
  const input = obfuscated.trim();
  
  // CRITICAL: If no prefix, it's plaintext. 
  // DO NOT XOR-mash plaintext keys.
  if (!input.startsWith(PREFIX)) {
    return input;
  }
  
  const payload = input.slice(PREFIX.length);
  let result = "";
  
  // Hex decoding
  for (let i = 0; i < payload.length; i += 2) {
    const hexPart = payload.slice(i, i + 2);
    const code = parseInt(hexPart, 16) ^ SHIELD_MASK.charCodeAt((i / 2) % SHIELD_MASK.length);
    result += String.fromCharCode(code);
  }
  
  return result.trim();
}
