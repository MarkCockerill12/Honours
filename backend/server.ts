import express from "express";
import cors from "cors";
import axios from "axios";
import dotenv from "dotenv";
import { z } from "zod";
import { rateLimit } from 'express-rate-limit';
import { 
  EC2Client, 
  StartInstancesCommand, 
  StopInstancesCommand, 
  DescribeInstancesCommand,
  InstanceStateName
} from "@aws-sdk/client-ec2";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

const app = express();
const PORT = process.env.PORT || 8080;
const DEEPL_API_KEY = process.env.DEEPL_KEY;

// AWS Configuration
const ec2Client = new EC2Client({
  region: process.env.AWS_REGION || "eu-central-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

// Mock mapping for server IDs to EC2 Instance IDs
const SERVER_INSTANCE_MAP: Record<string, string> = {
  "uk": process.env.EC2_INSTANCE_ID_UK || "i-0123456789abcdef0",
  "us": process.env.EC2_INSTANCE_ID_US || "i-0fedcba9876543210",
  "aws-eu-1": process.env.EC2_INSTANCE_ID_GERMANY || "i-0987654321fedcba0",
};

// WireGuard Secure Storage (Simplified for demo - in production use AWS Secrets Manager)
const WG_PRIVATE_KEYS: Record<string, string> = {
  "uk": process.env.WG_PRIVATE_KEY_UK || "mE....your_key...",
  "us": process.env.WG_PRIVATE_KEY_US || "nE....your_key...",
  "aws-eu-1": process.env.WG_PRIVATE_KEY_GERMANY || "oE....your_key...",
};

// A3: Restrictive CORS policy
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedPatterns = [
      /^chrome-extension:\/\/([a-z]{32})$/,
      /^http:\/\/localhost:3000$/,
      /^http:\/\/127\.0\.0\.1:3000$/
    ];
    
    if (!origin || allowedPatterns.some(pattern => pattern.test(origin))) {
      callback(null, true);
    } else {
      console.warn(`[Backend] Blocked request from unauthorized origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());

// A3: Rate limiting to prevent quota abuse (DeepL limits)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests from this IP, please try again later.' }
});

app.use('/api/', limiter);

// Security Headers (Basic implementation)
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

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

const VpnConnectSchema = z.object({
  serverId: z.string(),
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
 * FEATURE: VPN CONNECT
 * Starts an EC2 instance, waits for it to be running, and returns WG config.
 */
app.post("/api/vpn/connect", async (req, res) => {
  try {
    const result = VpnConnectSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: "Invalid serverId" });
    }

    const { serverId } = result.data;
    const instanceId = SERVER_INSTANCE_MAP[serverId];

    if (!instanceId) {
      return res.status(404).json({ error: "Server configuration not found" });
    }

    console.log(`[VPN] Starting instance ${instanceId} for server ${serverId}...`);

    // 1. Start Instance
    await ec2Client.send(new StartInstancesCommand({ InstanceIds: [instanceId] }));

    // 2. Poll for Status & IP
    let publicIp = "";
    let attempts = 0;
    const maxAttempts = 30; // 5 minutes with 10s intervals

    while (attempts < maxAttempts) {
      const { Reservations } = await ec2Client.send(
        new DescribeInstancesCommand({ InstanceIds: [instanceId] })
      );

      const instance = Reservations?.[0]?.Instances?.[0];
      const state = instance?.State?.Name;

      if (state === InstanceStateName.running && instance?.PublicIpAddress) {
        publicIp = instance.PublicIpAddress;
        break;
      }

      console.log(`[VPN] Instance ${instanceId} state: ${state}. Waiting...`);
      await new Promise(resolve => setTimeout(resolve, 10000)); // Poll every 10s
      attempts++;
    }

    if (!publicIp) {
      return res.status(504).json({ error: "Failed to allocate dynamic IP in time." });
    }

    // 3. Generate WG Config
    const config = {
      Id: serverId,
      Endpoint: `${publicIp}:51820`,
      PublicKey: process.env.WG_SERVER_PUBLIC_KEY || "G+....", // Server's public key
      PrivateKey: WG_PRIVATE_KEYS[serverId] || "PRIVATE_KEY_HIDDEN",
      Address: "10.0.0.2/32",
      DNS: "1.1.1.1",
      AllowedIPs: "0.0.0.0/0",
      MTU: 1420
    };

    res.json({ success: true, config });
  } catch (error: any) {
    console.error("[VPN Connect Error]:", error.message);
    res.status(500).json({ error: "VPN Provisioning Failed", details: error.message });
  }
});

/**
 * FEATURE: VPN DISCONNECT
 * Stops the EC2 instance for the active server.
 */
app.post("/api/vpn/disconnect", async (req, res) => {
  try {
    const { serverId } = req.body;
    const instanceId = SERVER_INSTANCE_MAP[serverId];

    if (!instanceId) {
      return res.status(400).json({ error: "Invalid serverId" });
    }

    console.log(`[VPN] Stopping instance ${instanceId}...`);
    await ec2Client.send(new StopInstancesCommand({ InstanceIds: [instanceId] }));

    res.json({ success: true, message: "Disconnecting and shutting down server." });
  } catch (error: any) {
    console.error("[VPN Disconnect Error]:", error.message);
    res.status(500).json({ error: "VPN De-provisioning Failed" });
  }
});

/**
 * FEATURE: VPN STATUS
 * Simple check to see if VPN server is alive
 */
app.get("/api/vpn/status", (req, res) => {
  // TODO: Implement actual logic to check status of WireGuard and Dante services
  res.json({ status: "active", server: "EC2-Frankfurt", load: "12%" });
});

app.listen(PORT, () => {
  console.log(`Privacy Backend running on port ${PORT}`);
});
