export interface Env {
  DB: D1Database;
  ANTHROPIC_API_KEY: string;
  ENVIRONMENT: string;
}

export interface Card {
  id: string;
  name: string;
  set_name: string | null;
  set_number: string | null;
  rarity: string | null;
  card_condition: string | null;
  imagen_base64: string;
  raw_description: string | null;
  created_at: number;
}

export interface CardIdentification {
  name: string;
  set_name: string | null;
  set_number: string | null;
  rarity: string | null;
  card_condition: string | null;
  raw_description: string;
}
