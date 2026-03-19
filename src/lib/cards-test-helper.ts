/**
 * This file re-exports card functions using relative imports
 * so that cards.test.ts can run under tsx (which doesn't resolve
 * the @/ path alias). This file is ONLY used for testing.
 */
import type { Card, CardKey, FishSetId, Suit } from "./types";
import { toCardKey } from "./types";

const SUITS: Suit[] = ["spades", "hearts", "diamonds", "clubs"];
const LOW_RANKS = ["2", "3", "4", "5", "6", "7"] as const;
const HIGH_RANKS = ["9", "10", "J", "Q", "K", "A"] as const;
const ALL_RANKS = [...LOW_RANKS, "8", ...HIGH_RANKS] as const;

export function getCardsInSet(setId: FishSetId): Card[] {
  if (setId === "eights_jokers") {
    return [
      ...SUITS.map((suit): Card => ({ suit, rank: "8" })),
      { suit: "joker", rank: "red" },
      { suit: "joker", rank: "black" },
    ];
  }
  const [half, suitName] = setId.split("_") as ["low" | "high", Suit];
  const ranks = half === "low" ? LOW_RANKS : HIGH_RANKS;
  return ranks.map((rank): Card => ({ suit: suitName, rank }));
}

export function getCardKeysInSet(setId: FishSetId): CardKey[] {
  return getCardsInSet(setId).map(toCardKey);
}

export function getSetForCard(card: Card): FishSetId {
  if (card.suit === "joker" || card.rank === "8") return "eights_jokers";
  const isLow = (LOW_RANKS as readonly string[]).includes(card.rank);
  return `${isLow ? "low" : "high"}_${card.suit}` as FishSetId;
}

export function getSetForCardKey(key: CardKey): FishSetId {
  const [rank, suit] = key.split(":");
  if (suit === "joker" || rank === "8") return "eights_jokers";
  const isLow = (LOW_RANKS as readonly string[]).includes(rank);
  return `${isLow ? "low" : "high"}_${suit}` as FishSetId;
}

export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of ALL_RANKS) {
      deck.push({ suit, rank });
    }
  }
  deck.push({ suit: "joker", rank: "red" });
  deck.push({ suit: "joker", rank: "black" });
  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function setsInHand(hand: CardKey[]): FishSetId[] {
  const sets = new Set<FishSetId>();
  for (const key of hand) {
    sets.add(getSetForCardKey(key));
  }
  return [...sets];
}