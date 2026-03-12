import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();
app.use(cors()); // Allow your extension/app to talk to this
app.use(express.json());

// CONFIG
// TODO: Securely manage the DeepL API Key using environment variables or a secret manager
const DEEPL_API_KEY = process.env.DEEPL_KEY || "your-key-here";
const PORT = 8080;

/**
 * FEATURE: TRANSLATE
 * Privacy: User sends text here. We strip IP. We send to DeepL.
 * DeepL sees OUR IP, not the User's.
 */
app.post("/api/translate", async (req, res) => {
  try {
    const { text, targetLang } = req.body;

    // Call DeepL (Free Tier)
    const response = await axios.post(
      "https://api-free.deepl.com/v2/translate",
      null,
      {
        params: {
          auth_key: DEEPL_API_KEY,
          text: text,
          target_lang: targetLang || "EN",
        },
      },
    );

    res.json({ translated: response.data.translations[0].text });
  } catch (error) {
    console.error("Translation Error", error);
    res.status(500).json({ error: "Translation failed" });
  }
});

/**
 * FEATURE: VPN HANDSHAKE
 * Simple check to see if VPN server is alive
 */
app.get("/api/vpn/status", (req, res) => {
  // TODO: Implement actual logic to check status of WireGuard and Dante services
  // You could add logic here to check if WireGuard/Dante is running
  res.json({ status: "active", server: "EC2-Frankfurt", load: "12%" });
});

app.listen(PORT, () => {
  console.log(`Privacy Backend running on port ${PORT}`);
});
