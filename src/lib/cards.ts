import {
  Card,
  CardKey,
  FishSetId,
  Suit,
  SUITS,
  LOW_RANKS,
  HIGH_RANKS,
  ALL_RANKS,
  toCardKey,
} from "@/lib/types";

/**
 * Returns all 6 cards belonging to a given set.
 */
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

/**
 * Returns the CardKeys for all 6 cards in a set.
 */
export function getCardKeysInSet(setId: FishSetId): CardKey[] {
  return getCardsInSet(setId).map(toCardKey);
}

/**
 * Determines which set a card belongs to.
 */
export function getSetForCard(card: Card): FishSetId {
  if (card.suit === "joker" || card.rank === "8") {
    return "eights_jokers";
  }
  const isLow = (LOW_RANKS as readonly string[]).includes(card.rank);
  return `${isLow ? "low" : "high"}_${card.suit}` as FishSetId;
}

/**
 * Determines which set a CardKey belongs to.
 */
export function getSetForCardKey(key: CardKey): FishSetId {
  const [rank, suit] = key.split(":");
  if (suit === "joker" || rank === "8") return "eights_jokers";
  const isLow = (LOW_RANKS as readonly string[]).includes(rank);
  return `${isLow ? "low" : "high"}_${suit}` as FishSetId;
}

/**
 * Builds the full 54-card deck.
 */
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

/**
 * Fisher-Yates shuffle — returns a new shuffled copy.
 */
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Returns a human-readable label for a card.
 * E.g. "7 of spades" or "Red Joker"
 */
export function cardLabel(card: Card): string {
  if (card.suit === "joker") {
    return `${card.rank === "red" ? "Red" : "Black"} Joker`;
  }
  return `${card.rank} of ${card.suit}`;
}

/**
 * Returns a human-readable label for a CardKey.
 */
export function cardKeyLabel(key: CardKey): string {
  const [rank, suit] = key.split(":");
  if (suit === "joker") {
    return `${rank === "red" ? "Red" : "Black"} Joker`;
  }
  return `${rank} of ${suit}`;
}

/**
 * Returns a human-readable label for a set.
 * E.g. "Low Spades", "Eights & Jokers"
 */
export function setLabel(setId: FishSetId): string {
  if (setId === "eights_jokers") return "Eights & Jokers";
  const [half, suit] = setId.split("_");
  return `${half.charAt(0).toUpperCase() + half.slice(1)} ${suit.charAt(0).toUpperCase() + suit.slice(1)}`;
}

/**
 * Compares two cards for equality.
 */
export function cardsEqual(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

/**
 * Checks if a hand (as CardKey[]) contains at least one card from a given set.
 */
export function handHasCardInSet(hand: CardKey[], setId: FishSetId): boolean {
  return hand.some((key) => getSetForCardKey(key) === setId);
}

/**
 * Returns which sets a hand has at least one card from.
 */
export function setsInHand(hand: CardKey[]): FishSetId[] {
  const sets = new Set<FishSetId>();
  for (const key of hand) {
    sets.add(getSetForCardKey(key));
  }
  return [...sets];
}

/**
 * Checks if a hand contains a specific card.
 */
export function handHasCard(hand: CardKey[], cardKey: CardKey): boolean {
  return hand.includes(cardKey);
}