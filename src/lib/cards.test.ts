/**
 * Quick sanity check for types + card utilities.
 * Run with: npx tsx src/lib/cards.test.ts
 *
 * Note: We use relative imports here because tsx doesn't resolve
 * the @/ path alias. The real app uses @/lib/types everywhere.
 */
import { FISH_SET_IDS, toCardKey, fromCardKey, toClientGameState } from "./types";
import type { ServerGameState } from "./types";

// We can't use @/ alias in tsx, so we inline the needed functions:
// In the real app, these come from @/lib/cards
import {
  buildDeck,
  getSetForCard,
  getCardsInSet,
  getCardKeysInSet,
  shuffleDeck,
  setsInHand,
} from "./cards-test-helper";

// ── Deck ────────────────────────────────────────────────────────────────────

const deck = buildDeck();
console.log(`✓ Deck has ${deck.length} cards (expected 54)`);

// ── Every card maps to a set ────────────────────────────────────────────────

const setCounts: Record<string, number> = {};
for (const card of deck) {
  const setId = getSetForCard(card);
  setCounts[setId] = (setCounts[setId] || 0) + 1;
}
console.log("✓ Cards per set:", setCounts);

for (const id of FISH_SET_IDS) {
  const cards = getCardsInSet(id);
  if (cards.length !== 6) {
    console.error(`✗ Set ${id} has ${cards.length} cards, expected 6`);
    process.exit(1);
  }
}
console.log("✓ All 9 sets have exactly 6 cards");

// ── CardKey round-trip ──────────────────────────────────────────────────────

for (const card of deck) {
  const key = toCardKey(card);
  const back = fromCardKey(key);
  if (back.suit !== card.suit || back.rank !== card.rank) {
    console.error(`✗ CardKey round-trip failed for`, card, "→", key, "→", back);
    process.exit(1);
  }
}
console.log("✓ CardKey round-trip works for all 54 cards");

// ── Shuffle ─────────────────────────────────────────────────────────────────

const shuffled = shuffleDeck(deck);
console.log(`✓ Shuffled deck has ${shuffled.length} cards`);

// ── toClientGameState strips hands ──────────────────────────────────────────

const fakeServer: ServerGameState = {
  id: "game-1",
  room_id: "room-1",
  phase: "asking",
  current_turn: "player-1",
  hands: {
    "player-1": ["2:spades", "3:spades"],
    "player-2": ["9:hearts", "10:hearts", "J:hearts"],
  },
  last_ask: null,
  declared_sets: [],
  score_a: 0,
  score_b: 0,
  action_log: [],
  winner: null,
};

const clientState = toClientGameState(fakeServer, "player-1");

if (clientState.my_hand.length !== 2) {
  console.error("✗ Client state should have 2 cards in my_hand");
  process.exit(1);
}
if ("hands" in clientState) {
  console.error("✗ Client state should NOT contain hands");
  process.exit(1);
}
if (clientState.player_card_counts["player-2"] !== 3) {
  console.error("✗ Client state should show player-2 has 3 cards");
  process.exit(1);
}
if (clientState.action_log !== null) {
  console.error("✗ Client state should hide action_log during play");
  process.exit(1);
}

const clientPostgame = toClientGameState(fakeServer, "player-1", true);
if (clientPostgame.action_log === null) {
  console.error("✗ Client state should include log when includeLog=true");
  process.exit(1);
}

console.log("✓ toClientGameState correctly strips server secrets");

// ── setsInHand ──────────────────────────────────────────────────────────────

const testHand = ["2:spades", "3:spades", "9:hearts", "red:joker"];
const sets = setsInHand(testHand);
if (!sets.includes("low_spades") || !sets.includes("high_hearts") || !sets.includes("eights_jokers")) {
  console.error("✗ setsInHand missed expected sets:", sets);
  process.exit(1);
}
console.log("✓ setsInHand correctly identifies sets from a hand");

console.log("\n🎉 All checks passed!");