import { Router } from "express";

const router = Router();

const GEMINI_KEY = process.env.GEMINI_KEY ?? "";
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

/**
 * POST /api/gemini
 * Proxy for Gemini API — keeps the key server-side, avoids browser CORS issues.
 * Body: { contents, generationConfig }
 */
router.post("/gemini", async (req, res) => {
  if (!GEMINI_KEY) {
    res.status(503).json({ error: "Gemini API key not configured on server." });
    return;
  }

  try {
    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();

    if (!response.ok) {
      res.status(response.status).json(data);
      return;
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to reach Gemini API." });
  }
});

export default router;
