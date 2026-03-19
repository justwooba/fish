// ─── Suits & Ranks ───────────────────────────────────────────────────────────

export const SUITS = ["spades", "hearts", "diamonds", "clubs"] as const;
export type Suit = (typeof SUITS)[number];

export const LOW_RANKS = ["2", "3", "4", "5", "6", "7"] as const;
export const HIGH_RANKS = ["9", "10", "J", "Q", "K", "A"] as const;
export const ALL_RANKS = [...LOW_RANKS, "8", ...HIGH_RANKS] as const;

export type LowRank = (typeof LOW_RANKS)[number];
export type HighRank = (typeof HIGH_RANKS)[number];
export type Rank = (typeof ALL_RANKS)[number];

// ─── Cards ───────────────────────────────────────────────────────────────────

export type SuitCard = {
  suit: Suit;
  rank: Rank;
};

export type JokerCard = {
  suit: "joker";
  rank: "red" | "black";
};

export type Card = SuitCard | JokerCard;

/** Serializable string form: "7:spades", "8:clubs", "red:joker" */
export type CardKey = string;

export function toCardKey(card: Card): CardKey {
  return card.suit === "joker"
    ? `${card.rank}:joker`
    : `${card.rank}:${card.suit}`;
}

export function fromCardKey(key: CardKey): Card {
  const [rank, suit] = key.split(":");
  if (suit === "joker") {
    return { suit: "joker", rank: rank as "red" | "black" };
  }
  return { suit: suit as Suit, rank: rank as Rank };
}

// ─── Fish Sets ───────────────────────────────────────────────────────────────

export const FISH_SET_IDS = [
  "low_spades",
  "high_spades",
  "low_hearts",
  "high_hearts",
  "low_diamonds",
  "high_diamonds",
  "low_clubs",
  "high_clubs",
  "eights_jokers",
] as const;

export type FishSetId = (typeof FISH_SET_IDS)[number];

export type HalfSuitSetId = Exclude<FishSetId, "eights_jokers">;

// ─── Teams ───────────────────────────────────────────────────────────────────

export type TeamId = "A" | "B";

// ─── Players ─────────────────────────────────────────────────────────────────

export type Player = {
  id: string;           // uuid — primary key in players table
  room_id: string;
  user_id: string;      // auth.users id
  display_name: string;
  team: TeamId | null;  // null = unassigned
  seat: number | null;  // 0–5, assigned at game start (alternating teams)
  card_count: number;   // public — how many cards this player currently holds
  is_connected: boolean;
};

// ─── Room Settings (optional rule variations) ────────────────────────────────

export type RoomSettings = {
  /** Any teammate may declare on their team's turn, not just the active player */
  team_declare: boolean;
  /** Misdeclare when team owns all 6 cards → set is nullified (no point awarded) */
  nullify_misdeclare: boolean;
  /** After opponent misdeclares, play continues from last turn (opponent doesn't pick turn) */
  no_turn_on_misdeclare: boolean;
  /** Play all 9 sets instead of stopping at 5 */
  play_all_sets: boolean;
};

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  team_declare: true,
  nullify_misdeclare: true,
  no_turn_on_misdeclare: false,
  play_all_sets: true,
};

// ─── Room ────────────────────────────────────────────────────────────────────

export type RoomStatus = "waiting" | "playing" | "finished";

export type Room = {
  id: string;
  code: string;          // 4-char join code, e.g. "A3KX"
  host_id: string;       // user_id of the room creator
  status: RoomStatus;
  settings: RoomSettings;
  created_at: string;
};

// ─── Game Phase ──────────────────────────────────────────────────────────────
// Fine-grained sub-phases within a "playing" game.

export type GamePhase =
  | "asking"             // Active player is choosing whom to ask and for what card
  | "choosing_turn"      // A team just won a set and must pick who takes the next turn
  | "declaring"          // Active player (or teammate, if team_declare) is declaring a set
  | "finished";          // All done

// ─── Actions (the events that move the game forward) ─────────────────────────

export type AskAction = {
  type: "ask";
  asker_id: string;      // player who asked
  target_id: string;     // opposing player who was asked
  card: CardKey;         // which card was requested
  success: boolean;      // did the target have it?
  timestamp: string;
};

export type DeclareAction = {
  type: "declare";
  declarer_id: string;
  set_id: FishSetId;
  /** player_id → CardKey[] — who the declarer claims holds each card */
  assignments: Record<string, CardKey[]>;
  success: boolean;
  /** Which team received the point (could be the opposing team on a misdeclare) */
  awarded_to: TeamId | null;  // null if set was nullified
  timestamp: string;
};

export type ChooseTurnAction = {
  type: "choose_turn";
  team: TeamId;
  chosen_player_id: string;
  timestamp: string;
};

export type GameAction = AskAction | DeclareAction | ChooseTurnAction;

// ─── Declared Set Record ─────────────────────────────────────────────────────

export type DeclaredSet = {
  set_id: FishSetId;
  awarded_to: TeamId | null;  // null = nullified
  declared_by: string;        // player_id
  was_correct: boolean;
};

// ─── Last Ask (the ONE public piece of ask history) ──────────────────────────

export type LastAsk = {
  asker_id: string;
  target_id: string;
  card: CardKey;
  success: boolean;
};

// ─── Game State — Server (authoritative, includes secrets) ───────────────────

export type ServerGameState = {
  id: string;
  room_id: string;
  phase: GamePhase;
  current_turn: string;                  // player_id
  hands: Record<string, CardKey[]>;      // SECRET — player_id → their cards
  last_ask: LastAsk | null;
  declared_sets: DeclaredSet[];
  score_a: number;
  score_b: number;
  action_log: GameAction[];              // full history — hidden during play
  winner: TeamId | null;
  version: number;                       // optimistic locking counter
};

// ─── Game State — Client (what gets sent to each player) ─────────────────────
// This is what a single player sees. `my_hand` is ONLY their own cards.

export type ClientGameState = {
  id: string;
  room_id: string;
  phase: GamePhase;
  current_turn: string;
  my_hand: CardKey[];                    // only this player's cards
  player_card_counts: Record<string, number>; // everyone's card count
  last_ask: LastAsk | null;
  declared_sets: DeclaredSet[];
  score_a: number;
  score_b: number;
  action_log: GameAction[] | null;       // null during play, populated postgame
  winner: TeamId | null;
};

// ─── Helper: strip server state down to client state for a specific player ───

export function toClientGameState(
  server: ServerGameState,
  playerId: string,
  includeLog: boolean = false
): ClientGameState {
  const playerCardCounts: Record<string, number> = {};
  for (const [pid, hand] of Object.entries(server.hands)) {
    playerCardCounts[pid] = hand.length;
  }

  return {
    id: server.id,
    room_id: server.room_id,
    phase: server.phase,
    current_turn: server.current_turn,
    my_hand: server.hands[playerId] ?? [],
    player_card_counts: playerCardCounts,
    last_ask: server.last_ask,
    declared_sets: server.declared_sets,
    score_a: server.score_a,
    score_b: server.score_b,
    action_log: includeLog ? server.action_log : null,
    winner: server.winner,
  };
}