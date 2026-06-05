import Anthropic from "@anthropic-ai/sdk";
import type { Env, Card, CardIdentification } from "../types";

const SUPPORTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...Array.from(bytes.subarray(i, i + 8192)));
  }
  return btoa(binary);
}

async function identifyCard(
  base64Image: string,
  mediaType: string,
  apiKey: string
): Promise<CardIdentification> {
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType as
                | "image/jpeg"
                | "image/png"
                | "image/webp"
                | "image/gif",
              data: base64Image,
            },
          },
          {
            type: "text",
            text: `Analyze this Pokémon TCG card image and respond ONLY with a JSON object using this exact structure:
{
  "name": "Pokémon or card name (e.g. Pikachu, Charizard EX)",
  "set_name": "Set name (e.g. Base Set, Scarlet & Violet, Temporal Forces) or null if not visible",
  "set_number": "Card number printed on card (e.g. 58/102, 025/091) or null if not visible",
  "rarity": "Rarity (Common, Uncommon, Rare, Holo Rare, Ultra Rare, Secret Rare, etc.) or null if not visible",
  "card_condition": "Card condition based on visible wear: Mint, Near Mint, Lightly Played, Moderately Played, Heavily Played, or Damaged",
  "raw_description": "One sentence describing the card"
}

Respond with ONLY the JSON object. No markdown, no code blocks, no extra text.`,
          },
        ],
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text.trim() : "";

  try {
    return JSON.parse(text) as CardIdentification;
  } catch {
    return {
      name: "Unknown Card",
      set_name: null,
      set_number: null,
      rarity: null,
      card_condition: null,
      raw_description: text || "Could not identify card",
    };
  }
}

export async function handleScan(
  request: Request,
  env: Env
): Promise<Response> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      { error: "Request must be multipart/form-data" },
      { status: 400 }
    );
  }

  const imageFile = formData.get("image") as File | null;
  if (!imageFile) {
    return Response.json({ error: "Missing 'image' field" }, { status: 400 });
  }

  const mediaType = imageFile.type || "image/jpeg";
  if (!SUPPORTED_TYPES.has(mediaType)) {
    return Response.json(
      {
        error: `Unsupported image type: ${mediaType}. Use jpeg, png, webp, or gif.`,
      },
      { status: 400 }
    );
  }

  const imageBuffer = await imageFile.arrayBuffer();
  const base64Image = toBase64(imageBuffer);
  const imagenBase64 = `data:${mediaType};base64,${base64Image}`;

  const identification = await identifyCard(
    base64Image,
    mediaType,
    env.ANTHROPIC_API_KEY
  );

  const cardId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await env.DB.prepare(
    `INSERT INTO cards (id, name, set_name, set_number, rarity, card_condition, imagen_base64, raw_description, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      cardId,
      identification.name,
      identification.set_name,
      identification.set_number,
      identification.rarity,
      identification.card_condition,
      imagenBase64,
      identification.raw_description,
      now
    )
    .run();

  const card = await env.DB.prepare("SELECT * FROM cards WHERE id = ?")
    .bind(cardId)
    .first<Card>();

  return Response.json({ card }, { status: 201 });
}

export async function handleList(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    "SELECT * FROM cards ORDER BY created_at DESC"
  ).all<Card>();
  return Response.json({ cards: results, total: results.length });
}

export async function handleGetById(
  id: string,
  env: Env
): Promise<Response> {
  const card = await env.DB.prepare("SELECT * FROM cards WHERE id = ?")
    .bind(id)
    .first<Card>();

  if (!card) {
    return Response.json({ error: "Card not found" }, { status: 404 });
  }

  return Response.json({ card });
}
