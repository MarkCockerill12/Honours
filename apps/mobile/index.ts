import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

// Minimal polyfill for TextEncoder/TextDecoder required by AWS SDK
if (typeof global.TextEncoder === 'undefined') {
  (global as any).TextEncoder = class TextEncoder {
    encode(str: string) {
      const arr = new Uint8Array(str.length);
      for (let i = 0; i < str.length; i++) {
        const charCode = str.charCodeAt(i);
        if (charCode > 127) {
          // This is a naive ASCII-only encoder, but AWS EC2 API only requires ASCII signatures.
          // For full UTF-8 support, use a package like 'fast-text-encoding'.
        }
        arr[i] = charCode & 0xFF;
      }
      return arr;
    }
  };
}

if (typeof global.TextDecoder === 'undefined') {
  (global as any).TextDecoder = class TextDecoder {
    decode(arr: Uint8Array) {
      if (!arr || arr.length === 0) return "";
      let res = "";
      const CHUNK_SIZE = 8192;
      for (let i = 0; i < arr.length; i += CHUNK_SIZE) {
        const chunk = arr.subarray(i, i + CHUNK_SIZE);
        res += String.fromCharCode.apply(null, Array.from(chunk));
      }
      return res;
    }
  };
}

import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
