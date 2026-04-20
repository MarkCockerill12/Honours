import { DOMParser, Node } from "@xmldom/xmldom";

// Chrome Extension Service Workers (MV3) do not have a DOM or standard DOM globals.
// The AWS SDK v3 for EC2 (which is XML-based) requires DOMParser and Node when running in a browser environment.
// Since esbuild targets the browser, we provide these polyfills to satisfy the AWS SDK.

if (typeof (globalThis as any).DOMParser === "undefined") {
  (globalThis as any).DOMParser = DOMParser;
}

if (typeof (globalThis as any).Node === "undefined") {
  (globalThis as any).Node = Node;
}
