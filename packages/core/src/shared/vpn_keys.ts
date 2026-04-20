import nacl from "tweetnacl";

export interface WgIdentity {
  privateKey: string;
  publicKey: string;
}

export interface PeerRegistrationResult {
  success: boolean;
  ip?: string;
  error?: string;
}

const PEER_API_PORT = 8443;
const PEER_API_SECRET = "PS_PEER_REG_2026";

function clampPrivateKey(key: Uint8Array): Uint8Array {
  key[0] &= 248;
  key[31] &= 127;
  key[31] |= 64;
  return key;
}

function uint8ToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function generateWireGuardKeyPair(): WgIdentity {
  const rawKeyPair = nacl.box.keyPair();
  const privateKey = clampPrivateKey(rawKeyPair.secretKey);
  const publicKey = rawKeyPair.publicKey;

  return {
    privateKey: uint8ToBase64(privateKey),
    publicKey: uint8ToBase64(publicKey),
  };
}

export async function getOrCreateIdentity(
  getStorage: () => Promise<string | null> | string | null,
  setStorage: (val: string) => Promise<void> | void
): Promise<WgIdentity> {
  const saved = await getStorage();
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.privateKey && parsed.publicKey) {
        return parsed as WgIdentity;
      }
    } catch {
      // Corrupted — regenerate
    }
  }

  const identity = generateWireGuardKeyPair();
  await setStorage(JSON.stringify(identity));
  return identity;
}

export async function registerPeer(
  spokeIp: string,
  publicKey: string
): Promise<PeerRegistrationResult> {
  const url = `http://${spokeIp}:${PEER_API_PORT}/register`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PS-Auth": PEER_API_SECRET,
      },
      body: JSON.stringify({ publicKey }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!resp.ok) {
      return { success: false, error: `Server returned ${resp.status}` };
    }
    const data = await resp.json();
    return { success: true, ip: data.ip };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
