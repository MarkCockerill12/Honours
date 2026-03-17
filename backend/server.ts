import express from "express";
import cors from "cors";
import axios from "axios";
import dotenv from "dotenv";
import { z } from "zod";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

const app = express();

// SECURITY: Use a restrictive CORS policy in production
// For now, allowing all for ease of development, but adding a note.
app.use(cors());
app.use(express.json());

// Security Headers (Basic implementation)
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

// CONFIG
const DEEPL_API_KEY = process.env.DEEPL_KEY;
const PORT = process.env.PORT || 8080;

if (!DEEPL_API_KEY) {
  console.warn(
    "WARNING: DEEPL_KEY is not set in environment variables. Translation will fail.",
  );
}

// VALIDATION SCHEMAS
const TranslateSchema = z.object({
  text: z.string().min(1).max(5000), // Protect against overly large requests
  targetLang: z.string().length(2).default("EN"),
});

/**
 * FEATURE: TRANSLATE
 * Privacy: User sends text here. We strip IP. We send to DeepL.
 * DeepL sees OUR IP, not the User's.
 */
app.post("/api/translate", async (req, res) => {
  try {
    // Validate request body
    const result = TranslateSchema.safeParse(req.body);
    if (!result.success) {
      return res
        .status(400)
        .json({
          error: "Invalid request data",
          details: result.error.format(),
        });
    }

    const { text, targetLang } = result.data;

    if (!DEEPL_API_KEY) {
      return res
        .status(503)
        .json({ error: "Translation service unavailable (misconfigured)" });
    }

    // Call DeepL (Free Tier)
    const response = await axios.post(
      "https://api-free.deepl.com/v2/translate",
      null,
      {
        params: {
          auth_key: DEEPL_API_KEY,
          text: text,
          target_lang: targetLang.toUpperCase(),
        },
      },
    );

    res.json({ translated: response.data.translations[0].text });
  } catch (error: any) {
    console.error("Translation Error:", error.message);
    res.status(500).json({ error: "Translation failed" });
  }
});

/**
 * FEATURE: VPN HANDSHAKE
 * Simple check to see if VPN server is alive
 */
app.get("/api/vpn/status", (req, res) => {
  // TODO: Implement actual logic to check status of WireGuard and Dante services
  res.json({ status: "active", server: "EC2-Frankfurt", load: "12%" });
});

app.listen(PORT, () => {
  console.log(`Privacy Backend running on port ${PORT}`);
});
