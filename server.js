import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, "public")));

const anthropic = new Anthropic();

app.post("/api/generate-word", async (req, res) => {
  try {
    const { word1, word2, history, usedWords = [], playerName } = req.body;
    const usedWordsSet = new Set(usedWords.map((w) => w.toLowerCase()));

    let prompt;
    if (!word1 && !word2) {
      // First round - generate a random starting word
      const categories = [
        "nature", "food", "technology", "sports", "music", "animals",
        "places", "emotions", "weather", "household items", "hobbies",
        "science", "art", "transportation", "clothing"
      ];
      const randomCategory = categories[Math.floor(Math.random() * categories.length)];
      const randomSeed = Math.floor(Math.random() * 10000);

      prompt = `You are playing a word association game called Mind Meld. Generate a single random word to start the game.

For variety, lean towards something related to: ${randomCategory} (but not required).
Random seed for uniqueness: ${randomSeed}

Rules:
- Respond with ONLY the single word, nothing else
- No punctuation, no explanation
- Make it interesting but not obscure
- Pick something DIFFERENT from common starting words like "ocean", "music", "love"`;
    } else {
      // Subsequent rounds - find a word that connects the two
      const historyContext =
        history && history.length > 0
          ? `\n\nPrevious rounds:\n${history.map((h) => `Round ${h.round}: "${h.word1}" + "${h.word2}"`).join("\n")}`
          : "";

      const forbiddenWordsContext =
        usedWords.length > 0
          ? `\n\nFORBIDDEN WORDS (do NOT use any of these): ${usedWords.join(", ")}`
          : "";

      prompt = `You are playing a word association game called Mind Meld. Two words were just said:
- Word 1: "${word1}"
- Word 2: "${word2}"

Your task: Think of ONE word that connects, combines, or is associated with BOTH of these words. The goal is to find common ground.${historyContext}${forbiddenWordsContext}

Rules:
- Respond with ONLY the single word, nothing else
- No punctuation, no explanation
- The word should genuinely relate to BOTH input words
- Be creative but logical in finding connections
- NEVER use any word from the forbidden list above
- Common nouns, verbs, places, concepts are all fair game`;
    }

    // Try up to 3 times to get a word that hasn't been used
    let word;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 50,
        temperature: 1,
        messages: [{ role: "user", content: prompt }],
      });

      word = message.content[0].text.trim().toLowerCase();

      if (!usedWordsSet.has(word)) {
        break; // Found a valid word
      }

      attempts++;
      // Add the repeated word to the prompt for next attempt
      prompt += `\n\nYou said "${word}" but that was already used. Pick a DIFFERENT word.`;
    }

    res.json({ word, playerName });
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ error: "Failed to generate word" });
  }
});

// Endpoint to check if words match (for multiple AI players)
app.post("/api/check-match", async (req, res) => {
  const { words } = req.body;
  const uniqueWords = [...new Set(words.map((w) => w.toLowerCase().trim()))];
  const isMatch = uniqueWords.length === 1;
  res.json({ isMatch, matchedWord: isMatch ? uniqueWords[0] : null });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Mind Meld server running at http://localhost:${PORT}`);
});
