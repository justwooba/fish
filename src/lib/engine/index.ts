/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Fish Game Engine — Pure, authoritative game logic
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * This module is the single source of truth for all Fish rules. It is:
 *   - Pure: no side effects, no database, no network, no UI
 *   - Deterministic: given the same inputs, always the same outputs
 *     (shuffleDeck is the sole exception — it uses Math.random)
 *   - Authoritative: the server calls these functions; clients never do
 *
 * Every function that mutates game state returns a new state object (or an
 * error string). The caller decides what to do with it (persist to DB, etc).
 */

import {
  type Card,
  type CardKey,
  type FishSetId,
  type TeamId,
  type Player,
  type RoomSettings,
  type ServerGameState,
  type GamePhase,
  type AskAction,
  type DeclareAction,
  type ChooseTurnAction,
  type DeclaredSet,
  type LastAsk,
  type GameAction,
  FISH_SET_IDS,
  SUITS,
  LOW_RANKS,
  HIGH_RANKS,
  ALL_RANKS,
  toCardKey,
} from "@/lib/types";

// ─── Result type ─────────────────────────────────────────────────────────────
// Every mutation returns either a new state or an error message.

export type EngineResult =
  | { ok: true; state: ServerGameState }
  | { ok: false; error: string };

// ─── Deck Construction ───────────────────────────────────────────────────────

/** Builds the standard 54-card deck (52 suited cards + 2 jokers). */
export function createDeck(): Card[] {
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

/** Fisher-Yates shuffle. Returns a NEW array; does not mutate input. */
export function shuffleDeck(deck: Card[]): Card[] {
  const out = [...deck];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ─── Set Helpers ─────────────────────────────────────────────────────────────

/** Which FishSetId does this CardKey belong to? */
export function getSetIdForCard(key: CardKey): FishSetId {
  const [rank, suit] = key.split(":");
  if (suit === "joker" || rank === "8") return "eights_jokers";
  const isLow = (LOW_RANKS as readonly string[]).includes(rank);
  return `${isLow ? "low" : "high"}_${suit}` as FishSetId;
}

/** Returns the 6 CardKeys that belong to a set. */
export function getCardsForSet(setId: FishSetId): CardKey[] {
  if (setId === "eights_jokers") {
    return [
      ...SUITS.map((s) => toCardKey({ suit: s, rank: "8" })),
      toCardKey({ suit: "joker", rank: "red" }),
      toCardKey({ suit: "joker", rank: "black" }),
    ];
  }
  const [half, suit] = setId.split("_") as ["low" | "high", (typeof SUITS)[number]];
  const ranks = half === "low" ? LOW_RANKS : HIGH_RANKS;
  return ranks.map((r) => toCardKey({ suit, rank: r }));
}

/** Has this set already been declared (successfully or not)? */
export function isSetDeclared(state: ServerGameState, setId: FishSetId): boolean {
  return state.declared_sets.some((ds) => ds.set_id === setId);
}

/** Which sets have NOT yet been declared? */
export function undeclaredSets(state: ServerGameState): FishSetId[] {
  return FISH_SET_IDS.filter((id) => !isSetDeclared(state, id));
}

// ─── Player / Team Helpers ───────────────────────────────────────────────────

/** Returns the TeamId for a player, or throws if not found. */
export function getPlayerTeam(
  playerId: string,
  players: Player[]
): TeamId {
  const p = players.find((pl) => pl.id === playerId);
  if (!p || !p.team) throw new Error(`Player ${playerId} has no team`);
  return p.team;
}

/** Returns all player IDs on a given team. */
export function teamPlayerIds(team: TeamId, players: Player[]): string[] {
  return players.filter((p) => p.team === team).map((p) => p.id);
}

/** Returns the opposing team. */
export function opposingTeam(team: TeamId): TeamId {
  return team === "A" ? "B" : "A";
}

/** Returns player IDs on the opposing team. */
export function opponentIds(playerId: string, players: Player[]): string[] {
  const team = getPlayerTeam(playerId, players);
  return teamPlayerIds(opposingTeam(team), players);
}

/** Returns teammate IDs (including the player themselves). */
export function teammateIds(playerId: string, players: Player[]): string[] {
  const team = getPlayerTeam(playerId, players);
  return teamPlayerIds(team, players);
}

/** Does this player currently hold any cards? */
export function playerHasCards(state: ServerGameState, playerId: string): boolean {
  return (state.hands[playerId]?.length ?? 0) > 0;
}

/** Which FishSetIds does a player hold at least one card from? */
export function setsInHand(hand: CardKey[]): FishSetId[] {
  const sets = new Set<FishSetId>();
  for (const key of hand) sets.add(getSetIdForCard(key));
  return [...sets];
}

/**
 * Can a player hold only complete sets?
 * This matters because if every set the player has cards in is fully held
 * by them alone, they cannot legally ask (they'd be asking for a card they
 * already have or one from a set they don't hold). In this case they MUST
 * declare.
 */
export function handIsOnlyCompleteSets(hand: CardKey[]): boolean {
  if (hand.length === 0) return false;
  const setIds = setsInHand(hand);
  for (const setId of setIds) {
    const fullSet = getCardsForSet(setId);
    const heldInSet = hand.filter((k) => getSetIdForCard(k) === setId);
    if (heldInSet.length !== fullSet.length) return false;
  }
  return true;
}

// ─── Game Initialization ─────────────────────────────────────────────────────

/**
 * Deal cards evenly to 6 players. Players must be provided in seat order
 * (seats 0–5). Returns a hands map: playerId → CardKey[].
 */
export function dealCards(
  playerIds: string[]
): Record<string, CardKey[]> {
  if (playerIds.length !== 6) {
    throw new Error(`Need exactly 6 players, got ${playerIds.length}`);
  }

  const deck = shuffleDeck(createDeck());
  const hands: Record<string, CardKey[]> = {};
  for (const pid of playerIds) hands[pid] = [];

  for (let i = 0; i < deck.length; i++) {
    hands[playerIds[i % 6]].push(toCardKey(deck[i]));
  }

  return hands;
}

/**
 * Creates the initial ServerGameState after dealing.
 *
 * `players` must be the 6 players with seats and teams assigned.
 * `firstPlayerId` is whoever goes first (often chosen randomly or by
 * the host; the API layer decides this).
 */
export function createInitialGameState(
  gameId: string,
  roomId: string,
  players: Player[],
  firstPlayerId: string
): ServerGameState {
  const seated = players.filter((p) => p.seat !== null);
  if (seated.length !== 6) {
    throw new Error(`Need 6 seated players, got ${seated.length}`);
  }

  const playerIds = seated
    .sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0))
    .map((p) => p.id);

  const hands = dealCards(playerIds);

  return {
    id: gameId,
    room_id: roomId,
    phase: "asking",
    current_turn: firstPlayerId,
    hands,
    last_ask: null,
    declared_sets: [],
    score_a: 0,
    score_b: 0,
    action_log: [],
    winner: null,
    version: 0,
  };
}

// ─── Asking ──────────────────────────────────────────────────────────────────

/**
 * Validates whether an ask is legal. Returns null if legal, or an error string.
 *
 * Rules enforced:
 *  1. Game must be in "asking" phase
 *  2. It must be the asker's turn
 *  3. Asker must have cards
 *  4. Target must be on the opposing team
 *  5. Target must have cards (no point asking someone with 0 cards)
 *  6. Asker must NOT already have the requested card
 *  7. Asker must hold at least one card from the same set as the requested card
 *  8. The requested card's set must not already be declared
 */
export function canAsk(
  state: ServerGameState,
  players: Player[],
  askerId: string,
  targetId: string,
  cardKey: CardKey
): string | null {
  if (state.phase !== "asking") {
    return "Not in the asking phase";
  }
  if (state.current_turn !== askerId) {
    return "It is not your turn";
  }

  const askerHand = state.hands[askerId];
  if (!askerHand || askerHand.length === 0) {
    return "You have no cards";
  }

  // Target must be on opposing team
  const askerTeam = getPlayerTeam(askerId, players);
  const targetTeam = getPlayerTeam(targetId, players);
  if (askerTeam === targetTeam) {
    return "You can only ask players on the opposing team";
  }

  // Target must have cards
  const targetHand = state.hands[targetId];
  if (!targetHand || targetHand.length === 0) {
    return "That player has no cards";
  }

  // Cannot ask for a card you already hold
  if (askerHand.includes(cardKey)) {
    return "You already have that card";
  }

  // Must hold at least one card from the same set
  const requestedSet = getSetIdForCard(cardKey);
  if (!askerHand.some((k) => getSetIdForCard(k) === requestedSet)) {
    return "You must hold at least one card from that set to ask for it";
  }

  // Set must not already be declared
  if (isSetDeclared(state, requestedSet)) {
    return "That set has already been declared";
  }

  return null; // legal
}

/**
 * Performs an ask. Returns the new game state.
 *
 * If the target has the card → card moves to asker, asker keeps the turn.
 * If the target doesn't → turn passes to the target.
 *
 * After the ask resolves, we check whether the new current player must
 * declare (hand is only complete sets) or has no legal ask. If so, the
 * phase moves to "declaring".
 */
export function performAsk(
  state: ServerGameState,
  players: Player[],
  settings: RoomSettings,
  askerId: string,
  targetId: string,
  cardKey: CardKey,
  timestamp: string
): EngineResult {
  const err = canAsk(state, players, askerId, targetId, cardKey);
  if (err) return { ok: false, error: err };

  // Clone state
  const next: ServerGameState = structuredClone(state);
  const targetHand = next.hands[targetId];
  const askerHand = next.hands[askerId];

  const success = targetHand.includes(cardKey);

  if (success) {
    // Move card from target to asker
    next.hands[targetId] = targetHand.filter((k) => k !== cardKey);
    askerHand.push(cardKey);
    // Asker keeps the turn
    next.current_turn = askerId;
  } else {
    // Turn passes to the target
    next.current_turn = targetId;
  }

  // Record the ask
  const action: AskAction = {
    type: "ask",
    asker_id: askerId,
    target_id: targetId,
    card: cardKey,
    success,
    timestamp,
  };
  next.action_log.push(action);
  next.last_ask = {
    asker_id: askerId,
    target_id: targetId,
    card: cardKey,
    success,
  };

  // Determine phase for the new current player
  next.phase = determinePhaseForPlayer(next, players, next.current_turn);

  return { ok: true, state: next };
}

/**
 * Can the current player make ANY legal ask?
 *
 * A player has a legal ask if:
 *  - They have cards
 *  - There exists at least one undeclared set for which they hold a card
 *  - There exists at least one card in that set they DON'T hold
 *  - There exists at least one opponent with cards
 */
export function hasAnyLegalAsk(
  state: ServerGameState,
  players: Player[],
  playerId: string
): boolean {
  const hand = state.hands[playerId];
  if (!hand || hand.length === 0) return false;

  // Must have at least one opponent with cards
  const opponents = opponentIds(playerId, players);
  const opponentsWithCards = opponents.some(
    (oid) => (state.hands[oid]?.length ?? 0) > 0
  );
  if (!opponentsWithCards) return false;

  // For each undeclared set we hold a card in, is there a card we DON'T hold?
  const heldSets = setsInHand(hand);
  for (const setId of heldSets) {
    if (isSetDeclared(state, setId)) continue;
    const fullSet = getCardsForSet(setId);
    const missing = fullSet.filter((k) => !hand.includes(k));
    if (missing.length > 0) return true;
  }

  return false;
}

// ─── Declaring ───────────────────────────────────────────────────────────────

/**
 * Validates whether a declaration attempt is legal. Returns null if legal.
 *
 * Rules:
 *  1. Game phase must allow declaring
 *  2. Declarer must be on the team whose turn it is
 *     - If settings.team_declare, any teammate can declare on their team's turn
 *     - Otherwise, only the current_turn player can declare
 *  3. The set must not already be declared
 *  4. The declarer's team must be claiming all 6 cards
 *  5. Every card in assignments must actually belong to the declared set
 *  6. Only teammates (including self) may appear in assignments
 */
export function canDeclare(
  state: ServerGameState,
  players: Player[],
  settings: RoomSettings,
  declarerId: string,
  setId: FishSetId,
  assignments: Record<string, CardKey[]>
): string | null {
  // Phase check: allow during "asking" or "declaring"
  if (state.phase !== "asking" && state.phase !== "declaring") {
    return "Cannot declare in the current phase";
  }

  const declarerTeam = getPlayerTeam(declarerId, players);
  const turnPlayerTeam = getPlayerTeam(state.current_turn, players);

  // Must be this team's turn
  if (declarerTeam !== turnPlayerTeam) {
    return "It is not your team's turn";
  }

  // If team_declare is off, only the current turn player can declare
  if (!settings.team_declare && state.current_turn !== declarerId) {
    return "Only the player whose turn it is can declare";
  }

  // Set must not be declared yet
  if (isSetDeclared(state, setId)) {
    return "That set has already been declared";
  }

  // Collect all assigned cards
  const allAssigned: CardKey[] = [];
  const teammates = new Set(teammateIds(declarerId, players));

  for (const [pid, cards] of Object.entries(assignments)) {
    // Only teammates can be listed
    if (!teammates.has(pid)) {
      return `Player ${pid} is not on your team`;
    }
    for (const ck of cards) {
      // Every card must belong to the declared set
      if (getSetIdForCard(ck) !== setId) {
        return `Card ${ck} does not belong to set ${setId}`;
      }
      allAssigned.push(ck);
    }
  }

  // Must assign exactly the 6 cards in the set
  const fullSet = getCardsForSet(setId);
  if (allAssigned.length !== fullSet.length) {
    return `Must assign exactly ${fullSet.length} cards, got ${allAssigned.length}`;
  }

  // No duplicates
  if (new Set(allAssigned).size !== allAssigned.length) {
    return "Duplicate cards in assignment";
  }

  // Every card from the full set must appear
  for (const ck of fullSet) {
    if (!allAssigned.includes(ck)) {
      return `Missing card ${ck} from the set`;
    }
  }

  return null;
}

/**
 * Performs a declaration and resolves it.
 *
 * ── Base rules ──
 * Correct declaration → team scores, cards are removed from hands,
 *   phase → "choosing_turn" (winning team picks who goes next).
 *
 * Incorrect declaration → opposing team gets the point, cards removed,
 *   phase → "choosing_turn" (opposing team picks who goes next).
 *
 * ── Optional variations ──
 *
 * nullify_misdeclare: If the declaring team collectively holds all 6 cards
 *   but assigned them to the wrong teammates, the set is nullified (no point).
 *   Play continues from the current turn.
 *
 * no_turn_on_misdeclare: When an opponent misdeclares, the opposing team
 *   still gets the point, but play continues from the last turn instead of
 *   the opposing team choosing the next turn.
 */
export function performDeclaration(
  state: ServerGameState,
  players: Player[],
  settings: RoomSettings,
  declarerId: string,
  setId: FishSetId,
  assignments: Record<string, CardKey[]>,
  timestamp: string
): EngineResult {
  const err = canDeclare(state, players, settings, declarerId, setId, assignments);
  if (err) return { ok: false, error: err };

  const next: ServerGameState = structuredClone(state);
  const declarerTeam = getPlayerTeam(declarerId, players);
  const otherTeam = opposingTeam(declarerTeam);
  const fullSetCards = getCardsForSet(setId);

  // ── Check correctness ──
  // A declaration is correct IFF every card is assigned to the player who
  // actually holds it.
  let isCorrect = true;
  for (const [pid, claimed] of Object.entries(assignments)) {
    for (const ck of claimed) {
      if (!next.hands[pid]?.includes(ck)) {
        isCorrect = false;
        break;
      }
    }
    if (!isCorrect) break;
  }

  // ── Does the declaring team collectively hold all 6 cards? ──
  const teamPids = teammateIds(declarerId, players);
  const teamCards = teamPids.flatMap((pid) => next.hands[pid] ?? []);
  const teamHoldsAll = fullSetCards.every((ck) => teamCards.includes(ck));

  // ── Determine outcome ──
  let awardedTo: TeamId | null;
  let nextPhase: GamePhase;
  let nextTurn = next.current_turn;

  if (isCorrect) {
    // ✅ Correct: declaring team scores
    awardedTo = declarerTeam;
    nextPhase = "choosing_turn";
  } else if (settings.nullify_misdeclare && teamHoldsAll) {
    // 🟡 Nullified: team had all cards but wrong assignment
    awardedTo = null;
    // Play continues from the current turn; no "choosing_turn"
    nextPhase = "asking";
  } else {
    // ❌ Incorrect: opposing team scores
    awardedTo = otherTeam;

    if (settings.no_turn_on_misdeclare) {
      // Play continues from the current turn
      nextPhase = "asking";
    } else {
      // Opposing team gets to choose who goes next
      nextPhase = "choosing_turn";
    }
  }

  // ── Remove the set's cards from all hands ──
  // (unless nullified — then cards stay)
  if (awardedTo !== null) {
    for (const pid of Object.keys(next.hands)) {
      next.hands[pid] = next.hands[pid].filter(
        (k) => !fullSetCards.includes(k)
      );
    }
  }

  // ── Update scores ──
  if (awardedTo === "A") next.score_a++;
  if (awardedTo === "B") next.score_b++;

  // ── Record the declared set ──
  const declaredSet: DeclaredSet = {
    set_id: setId,
    awarded_to: awardedTo,
    declared_by: declarerId,
    was_correct: isCorrect,
  };
  next.declared_sets.push(declaredSet);

  // ── Log the action ──
  const action: DeclareAction = {
    type: "declare",
    declarer_id: declarerId,
    set_id: setId,
    assignments,
    success: isCorrect,
    awarded_to: awardedTo,
    timestamp,
  };
  next.action_log.push(action);

  // ── Check for game over ──
  next.phase = nextPhase;
  next.current_turn = nextTurn;

  const gameOverResult = checkGameOver(next, settings);
  if (gameOverResult) {
    next.phase = "finished";
    next.winner = gameOverResult;
  } else if (nextPhase === "asking") {
    // If we're continuing play, check if current player must declare
    next.phase = determinePhaseForPlayer(next, players, next.current_turn);
  }

  return { ok: true, state: next };
}

// ─── Choosing Turn ───────────────────────────────────────────────────────────

/**
 * After a set is won (phase="choosing_turn"), the winning team picks
 * who takes the next turn. The chosen player must:
 *  - Be on the winning team
 *  - Have at least one card (unless everyone on the team is empty,
 *    which would mean the game should already be over or nearly over)
 */
export function chooseNextTurn(
  state: ServerGameState,
  players: Player[],
  settings: RoomSettings,
  choosingTeam: TeamId,
  chosenPlayerId: string,
  timestamp: string
): EngineResult {
  if (state.phase !== "choosing_turn") {
    return { ok: false, error: "Not in choosing_turn phase" };
  }

  // The last declared set tells us which team should be choosing
  const lastDeclared = state.declared_sets[state.declared_sets.length - 1];
  if (!lastDeclared) {
    return { ok: false, error: "No declared set found" };
  }

  // Who gets to choose? The team that was awarded the set.
  // (For incorrect declarations under base rules, that's the opposing team.)
  const expectedTeam = lastDeclared.awarded_to;
  if (expectedTeam !== choosingTeam) {
    return { ok: false, error: `Team ${choosingTeam} does not get to choose` };
  }

  // Chosen player must be on that team
  const chosenTeam = getPlayerTeam(chosenPlayerId, players);
  if (chosenTeam !== choosingTeam) {
    return { ok: false, error: "Chosen player is not on your team" };
  }

  // Prefer players with cards, but allow empty-handed if all are empty
  const teamPids = teamPlayerIds(choosingTeam, players);
  const teamWithCards = teamPids.filter(
    (pid) => (state.hands[pid]?.length ?? 0) > 0
  );

  if (
    teamWithCards.length > 0 &&
    (state.hands[chosenPlayerId]?.length ?? 0) === 0
  ) {
    return {
      ok: false,
      error: "Choose a teammate who still has cards",
    };
  }

  const next: ServerGameState = structuredClone(state);
  next.current_turn = chosenPlayerId;

  const action: ChooseTurnAction = {
    type: "choose_turn",
    team: choosingTeam,
    chosen_player_id: chosenPlayerId,
    timestamp,
  };
  next.action_log.push(action);

  // Determine phase for the newly chosen player
  next.phase = determinePhaseForPlayer(next, players, chosenPlayerId);

  return { ok: true, state: next };
}

// ─── Game Over ───────────────────────────────────────────────────────────────

/**
 * Checks if the game is over. Returns the winning TeamId, or null if ongoing.
 *
 * Base rule: first team to 5 sets wins.
 * play_all_sets: game continues until all 9 sets are declared.
 */
export function checkGameOver(
  state: ServerGameState,
  settings: RoomSettings
): TeamId | null {
  if (settings.play_all_sets) {
    // All 9 sets must be declared
    const declared = state.declared_sets.filter((ds) => ds.awarded_to !== null);
    if (declared.length < 9) {
      // But if all 9 sets have been addressed (some may be nullified)
      if (state.declared_sets.length < 9) return null;
      // If some were nullified they can be re-declared, so check undeclared count
      const remaining = undeclaredSets(state);
      if (remaining.length > 0) return null;
    }
    // Whoever has more sets wins
    if (state.score_a > state.score_b) return "A";
    if (state.score_b > state.score_a) return "B";
    // Tie is possible if nullifications happened — keep playing
    if (undeclaredSets(state).length > 0) return null;
    // True tie with all sets done: higher score wins, or A wins tie
    return state.score_a >= state.score_b ? "A" : "B";
  }

  // Standard: first to 5
  if (state.score_a >= 5) return "A";
  if (state.score_b >= 5) return "B";

  // Edge: all 9 sets declared but nobody reached 5 (possible with nullified sets)
  if (undeclaredSets(state).length === 0) {
    if (state.score_a > state.score_b) return "A";
    if (state.score_b > state.score_a) return "B";
    return state.score_a >= state.score_b ? "A" : "B";
  }

  return null;
}

/** Convenience: is the game finished? */
export function isGameOver(state: ServerGameState): boolean {
  return state.phase === "finished";
}

/** Returns the winner, or null if game isn't over. */
export function getWinner(state: ServerGameState): TeamId | null {
  return state.winner;
}

// ─── Phase Logic ─────────────────────────────────────────────────────────────

/**
 * After any action resolves, we need to figure out what the current player
 * should do next.
 *
 * If the player has no cards → they can't take a turn. We need to find
 * the next player on the same team who can act, or if nobody can, the
 * game may need to advance differently.
 *
 * If the player's hand consists only of complete sets → they MUST declare
 * (they can't legally ask for anything).
 *
 * If the player has no legal ask (e.g., all opponents are empty) → they
 * must declare.
 *
 * Otherwise → normal asking phase.
 */
export function determinePhaseForPlayer(
  state: ServerGameState,
  players: Player[],
  playerId: string
): GamePhase {
  // If game is already over
  if (state.phase === "finished") return "finished";
  if (state.winner) return "finished";

  const hand = state.hands[playerId];

  // Player has no cards — skip them. In practice the API should handle
  // advancing past empty-handed players before calling this, but we
  // return "asking" and let the API layer handle the skip.
  if (!hand || hand.length === 0) return "asking";

  // If hand is only complete sets → must declare
  if (handIsOnlyCompleteSets(hand)) return "declaring";

  // If player has no legal ask → must declare
  if (!hasAnyLegalAsk(state, players, playerId)) return "declaring";

  return "asking";
}

/**
 * If the current player has no cards, find the next player who does.
 * In Fish, when a player runs out of cards, they're skipped.
 *
 * `seatOrder` should be the 6 player IDs in seat order.
 * Returns the player ID who should take the turn, or null if nobody can act
 * (which means game should be over).
 */
export function findNextActivePlayer(
  state: ServerGameState,
  seatOrder: string[],
  startFromId: string
): string | null {
  const startIdx = seatOrder.indexOf(startFromId);
  if (startIdx === -1) return null;

  // Try up to 6 players (full cycle)
  for (let offset = 0; offset < 6; offset++) {
    const idx = (startIdx + offset) % 6;
    const pid = seatOrder[idx];
    if ((state.hands[pid]?.length ?? 0) > 0) {
      return pid;
    }
  }

  return null; // everyone is empty
}

/**
 * Get seat-ordered player IDs from the players array.
 */
export function getSeatOrder(players: Player[]): string[] {
  return players
    .filter((p) => p.seat !== null)
    .sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0))
    .map((p) => p.id);
}

// ─── Validation Utilities ────────────────────────────────────────────────────

/**
 * Validates that 6 players are correctly set up for a game:
 *  - Exactly 6 players
 *  - 3 on team A, 3 on team B
 *  - Seats 0–5 are all assigned
 *  - Teams alternate in seat order (A, B, A, B, A, B or B, A, B, A, B, A)
 */
export function validatePlayersForGameStart(players: Player[]): string | null {
  if (players.length !== 6) {
    return `Need exactly 6 players, got ${players.length}`;
  }

  const teamA = players.filter((p) => p.team === "A");
  const teamB = players.filter((p) => p.team === "B");
  if (teamA.length !== 3) return `Team A needs 3 players, has ${teamA.length}`;
  if (teamB.length !== 3) return `Team B needs 3 players, has ${teamB.length}`;

  // Check seats
  const seats = players.map((p) => p.seat).sort();
  for (let i = 0; i < 6; i++) {
    if (seats[i] !== i) return `Seat ${i} is not assigned`;
  }

  // Check alternating teams
  const sorted = [...players].sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0));
  const firstTeam = sorted[0].team;
  for (let i = 1; i < 6; i++) {
    const expected = i % 2 === 0 ? firstTeam : opposingTeam(firstTeam!);
    if (sorted[i].team !== expected) {
      return "Teams must alternate in seating order";
    }
  }

  return null;
}