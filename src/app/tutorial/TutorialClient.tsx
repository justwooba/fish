"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CardKey, FishSetId, TeamId, DeclaredSet, LastAsk } from "@/lib/types";
import { setLabel, cardKeyLabel, getCardKeysInSet } from "@/lib/cards";
import CardDisplay from "@/components/game/CardDisplay";
import Scoreboard from "@/components/game/Scoreboard";
import Nav from "@/components/ui/Nav";

// ─── Types ───────────────────────────────────────────────────────────────────

type TutorialPlayer = {
  id: string; name: string; team: TeamId; seat: number; hand: CardKey[];
};

// ─── Initial State ───────────────────────────────────────────────────────────
// Score 4-2 (A leads). 3 sets remain: Low Hearts, High Diamonds, High Clubs.

const INITIAL_PLAYERS: TutorialPlayer[] = [
  { id: "you",   name: "You",   team: "A", seat: 0, hand: ["3:hearts", "5:hearts", "10:diamonds"] },
  { id: "carol", name: "Carol", team: "B", seat: 1, hand: ["9:diamonds", "9:clubs", "10:clubs", "J:clubs"] },
  { id: "alice", name: "Alice", team: "A", seat: 2, hand: ["7:hearts", "J:diamonds", "Q:diamonds", "K:diamonds", "A:diamonds"] },
  { id: "dave",  name: "Dave",  team: "B", seat: 3, hand: ["2:hearts", "4:hearts", "6:hearts", "Q:clubs", "K:clubs"] },
  { id: "bob",   name: "Bob",   team: "A", seat: 4, hand: [] },
  { id: "eve",   name: "Eve",   team: "B", seat: 5, hand: ["A:clubs"] },
];

const INITIAL_DECLARED: DeclaredSet[] = [
  { set_id: "low_spades",    awarded_to: "A", declared_by: "you",   was_correct: true },
  { set_id: "high_spades",   awarded_to: "A", declared_by: "alice", was_correct: true },
  { set_id: "low_clubs",     awarded_to: "B", declared_by: "carol", was_correct: true },
  { set_id: "high_hearts",   awarded_to: "A", declared_by: "alice", was_correct: true },
  { set_id: "low_diamonds",  awarded_to: "A", declared_by: "you",   was_correct: true },
  { set_id: "eights_jokers", awarded_to: "B", declared_by: "eve",   was_correct: true },
];

// ─── Steps ───────────────────────────────────────────────────────────────────

type StepType =
  | { kind: "popup" }
  | { kind: "ask"; target: string; card: CardKey }
  | { kind: "opponent_ask"; asker: string; target: string; card: CardKey; success: boolean }
  | { kind: "opponent_declare"; declarer: string; setId: FishSetId; assignments: Record<string, CardKey[]>; team: TeamId }
  | { kind: "choose_turn"; chosen: string }
  | { kind: "declare"; setId: FishSetId }
  | { kind: "end" };

interface Step {
  action: StepType;
  title: string;
  message: string;
  highlight?: string;
}

const STEPS: Step[] = [
  // 0
  { action: { kind: "popup" }, title: "Welcome to Fish!",
    message: "Fish is a 6-player team card game. You're on Team A (blue) with Alice and Bob. Your opponents on Team B (red) are Carol, Dave, and Eve. Players sit in alternating team order around the table — you'll always be between two opponents." },
  // 1
  { action: { kind: "popup" }, title: "The Goal",
    message: "The 54-card deck is split into 9 sets of 6 cards each. Teams take turns asking for cards and declaring completed sets. The score is 4–2 — your team needs just one more set to win! Three sets remain: Low Hearts (2–7♥), High Diamonds (9–A♦), and High Clubs (9–A♣)." },
  // 2
  { action: { kind: "popup" }, title: "Your Hand",
    message: "You have 3 cards: 3♥, 5♥, and 10♦. The 3♥ and 5♥ are from Low Hearts, and the 10♦ is from High Diamonds. You can ask opponents for cards from any set you hold a card in." },
  // 3
  { action: { kind: "popup" }, title: "How Asking Works",
    message: "On your turn, pick an opponent and ask for a specific card. The rule: you must already hold at least one card from the same set. You can NEVER ask a teammate. If the opponent has the card, it's yours and you go again. If not, the turn passes to them." },
  // 4
  { action: { kind: "ask", target: "carol", card: "9:diamonds" }, title: "Your First Ask",
    message: "It's your turn! Let's ask Carol for the 9 of Diamonds — you can ask because you hold the 10♦ (same set: High Diamonds). Click Carol on the table, pick the High Diamonds set, and click the 9♦.",
    highlight: "carol" },
  // 5
  { action: { kind: "popup" }, title: "Got it!",
    message: "Carol had the 9♦! It's in your hand now, and since the ask succeeded, it's still your turn. Let's keep going with High Diamonds." },
  // 6
  { action: { kind: "ask", target: "carol", card: "J:diamonds" }, title: "Ask Again",
    message: "Let's try asking Carol for the Jack of Diamonds. She had one diamond — maybe she has more.",
    highlight: "carol" },
  // 7
  { action: { kind: "popup" }, title: "Miss!",
    message: "Carol doesn't have the J♦. When your ask fails, the turn passes to the opponent you asked — Carol now has the turn. Watch what happens next..." },
  // 8
  { action: { kind: "popup" }, title: "Carol is Declaring",
    message: "Carol is declaring High Clubs! She's announcing which player on her team holds each card in the set. If she assigns every card correctly, Team B scores the set. Her team has been collecting clubs throughout the game." },
  // 9
  { action: { kind: "opponent_declare", declarer: "carol", setId: "high_clubs",
    assignments: { carol: ["9:clubs", "10:clubs", "J:clubs"], dave: ["Q:clubs", "K:clubs"], eve: ["A:clubs"] },
    team: "B" },
    title: "Set Declared!",
    message: "Carol correctly declared High Clubs! Team B scores, making it 4–3. After scoring a set, the winning team picks which of their players goes next." },
  // 10
  { action: { kind: "choose_turn", chosen: "dave" }, title: "Dave's Turn",
    message: "Team B chose Dave to go next. Dave has been collecting diamonds — watch out." },
  // 11
  { action: { kind: "opponent_ask", asker: "dave", target: "you", card: "10:diamonds", success: true },
    title: "Dave Asks You",
    message: "Dave asks you for the 10♦ — and you have it! The card goes to Dave. Since he succeeded, it's still his turn." },
  // 12
  { action: { kind: "opponent_ask", asker: "dave", target: "you", card: "9:diamonds", success: true },
    title: "Dave Keeps Going",
    message: "Dave asks for your 9♦ too — and gets it. He's stripping your diamonds! This is the back-and-forth of Fish: when two players both have cards in a set, they trade asks until one side runs out." },
  // 13
  { action: { kind: "opponent_ask", asker: "dave", target: "you", card: "J:diamonds", success: false },
    title: "Dave Misses!",
    message: "Dave asks you for the J♦, but you don't have it (Alice does!). The turn passes to you. Notice: Dave's ask tells you he has at least one High Diamond but NOT the J♦. Every ask reveals information — pay attention!" },
  // 14
  { action: { kind: "popup" }, title: "Your Options",
    message: "It's your turn again. You now only have 3♥ and 5♥ — both Low Hearts. You can't ask for diamonds anymore since you don't hold any. In Fish, you can only ask from sets where you hold at least one card. Time to go after Low Hearts!" },
  // 15
  { action: { kind: "popup" }, title: "Strategy: Keep Pressing",
    message: "A key strategy: keep asking the same opponent until you think they're out of cards in your set. If you switch opponents too early, the first opponent remembers what you asked for and can take cards back when it's their turn." },
  // 16
  { action: { kind: "ask", target: "dave", card: "2:hearts" }, title: "Ask Dave",
    message: "Dave had hearts earlier in the game. Ask him for the 2♥.",
    highlight: "dave" },
  // 17
  { action: { kind: "popup" }, title: "Nice!",
    message: "Dave had the 2♥! Keep going — press the same opponent while they still have cards in your set." },
  // 18
  { action: { kind: "ask", target: "dave", card: "4:hearts" }, title: "Keep Pressing Dave",
    message: "Ask Dave for the 4♥. He's been holding hearts.",
    highlight: "dave" },
  // 19
  { action: { kind: "popup" }, title: "The 50/50",
    message: "You now have 2♥, 3♥, 4♥, 5♥ — four of the six Low Hearts. The remaining cards are the 6♥ and the 7♥. Dave asked you for diamonds, so you know some of his remaining cards are diamonds. He might have one heart left — but which one? And where's the other? This situation is called a \"50/50\" — you need to deduce or guess." },
  // 20
  { action: { kind: "popup" }, title: "Deduction",
    message: "Think about it: Dave started with hearts and clubs. His clubs were just declared, so his remaining cards are hearts and diamonds. He had 3 hearts originally (you just took 2). Does he still have one? You need to guess whether his last heart is the 6♥ or the 7♥. If he doesn't have it at all, then Alice (your teammate) must have both. Let's guess that Dave has the 6♥." },
  // 21
  { action: { kind: "ask", target: "dave", card: "6:hearts" }, title: "The Guess",
    message: "Ask Dave for the 6♥. If you're right, you'll have 5 of 6 Low Hearts!",
    highlight: "dave" },
  // 22
  { action: { kind: "popup" }, title: "Correct Guess!",
    message: "You got the 6♥! Now you have 5 Low Hearts: 2♥, 3♥, 4♥, 5♥, 6♥. The only missing card is the 7♥. Since Dave now only has diamonds left, and Carol and Eve have no cards, the 7♥ must be with your teammate Alice. Time to declare!" },
  // 23
  { action: { kind: "popup" }, title: "How Declaring Works",
    message: "To score a set, you DECLARE it by assigning each of the 6 cards to the teammate who holds it. If every assignment is correct, your team scores. If even one card is wrong, it's a misdeclare and the other team could score instead. Once you start declaring, you can't take it back — so be sure!" },
  // 24
  { action: { kind: "declare", setId: "low_hearts" }, title: "Declare Low Hearts!",
    message: "Assign your 5 hearts to yourself, and the 7♥ to Alice. Bob has no cards. Click 'Declare a Set' to begin." },
  // 25
  { action: { kind: "end" }, title: "You Win! 🎉",
    message: "Correct declaration! Team A scores Low Hearts — that's 5 sets, and Team A wins the game! You've learned asking, failed asks, reading information, the back-and-forth, 50/50 deduction, and declaring. Now go play for real!" },
];

// ─── Styling constants ───────────────────────────────────────────────────────

const SUIT_SYMBOLS: Record<string, string> = { spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣" };
const SUIT_COLORS: Record<string, string> = { spades: "text-gray-200", clubs: "text-gray-200", hearts: "text-red-400", diamonds: "text-red-400" };
const TEAM_COLORS: Record<TeamId, { bg: string; border: string; text: string }> = {
  A: { bg: "bg-sky-500/10", border: "border-sky-500/30", text: "text-sky-400" },
  B: { bg: "bg-rose-500/10", border: "border-rose-500/30", text: "text-rose-400" },
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function TutorialClient() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [players, setPlayers] = useState<TutorialPlayer[]>(INITIAL_PLAYERS.map(p => ({ ...p, hand: [...p.hand] })));
  const [declared, setDeclared] = useState<DeclaredSet[]>([...INITIAL_DECLARED]);
  const [scoreA, setScoreA] = useState(4);
  const [scoreB, setScoreB] = useState(2);
  const [lastAsk, setLastAsk] = useState<LastAsk | null>(null);
  const [currentTurn, setCurrentTurn] = useState("you");
  const [showPopup, setShowPopup] = useState(true);

  // Ask UI
  const [selectedOpponent, setSelectedOpponent] = useState<string | null>(null);
  const [expandedSet, setExpandedSet] = useState<FishSetId | null>(null);
  const [selectedCard, setSelectedCard] = useState<CardKey | null>(null);

  // Declare UI
  const [declareMode, setDeclareMode] = useState(false);
  const [declareAssignments, setDeclareAssignments] = useState<Record<string, CardKey[]>>({});

  const cur = STEPS[step];
  const myHand = players.find(p => p.id === "you")?.hand ?? [];
  const getP = (id: string) => players.find(p => p.id === id);

  function moveCard(from: string, to: string, card: CardKey) {
    setPlayers(prev => prev.map(p => {
      if (p.id === from) return { ...p, hand: p.hand.filter(c => c !== card) };
      if (p.id === to) return { ...p, hand: [...p.hand, card] };
      return p;
    }));
  }

  function removeSetFromHands(setId: FishSetId) {
    const cards = getCardKeysInSet(setId);
    setPlayers(prev => prev.map(p => ({ ...p, hand: p.hand.filter(c => !cards.includes(c)) })));
  }

  function advance() {
    const next = step + 1;
    if (next >= STEPS.length) return;
    const ns = STEPS[next];

    // Auto-execute opponent actions
    if (ns.action.kind === "opponent_ask") {
      const act = ns.action as { kind: "opponent_ask"; asker: string; target: string; card: CardKey; success: boolean };
      if (act.success) moveCard(act.target, act.asker, act.card);
      setLastAsk({ asker_id: act.asker, target_id: act.target, card: act.card, success: act.success });
      setCurrentTurn(act.success ? act.asker : act.target);
      setStep(next);
      setShowPopup(true);
    } else if (ns.action.kind === "opponent_declare") {
      const act = ns.action as { kind: "opponent_declare"; declarer: string; setId: FishSetId; assignments: Record<string, CardKey[]>; team: TeamId };
      removeSetFromHands(act.setId);
      setDeclared(prev => [...prev, { set_id: act.setId, awarded_to: act.team, declared_by: act.declarer, was_correct: true }]);
      if (act.team === "A") setScoreA(s => s + 1); else setScoreB(s => s + 1);
      setStep(next);
      setShowPopup(true);
    } else if (ns.action.kind === "choose_turn") {
      const act = ns.action as { kind: "choose_turn"; chosen: string };
      setCurrentTurn(act.chosen);
      setStep(next);
      setShowPopup(true);
    } else {
      setStep(next);
      setShowPopup(ns.action.kind === "popup" || ns.action.kind === "end");
    }
  }

  function handlePopupNext() {
    setShowPopup(false);
    advance();
  }

  function handleAskSubmit() {
    if (!cur || cur.action.kind !== "ask") return;
    const { target, card } = cur.action;
    if (selectedOpponent !== target || selectedCard !== card) return;

    const targetP = getP(target);
    const hasCard = targetP?.hand.includes(card);

    if (hasCard) {
      moveCard(target, "you", card);
      setLastAsk({ asker_id: "you", target_id: target, card, success: true });
      setCurrentTurn("you");
    } else {
      setLastAsk({ asker_id: "you", target_id: target, card, success: false });
      setCurrentTurn(target);
    }

    setSelectedOpponent(null);
    setExpandedSet(null);
    setSelectedCard(null);
    setStep(s => s + 1);
    setShowPopup(true);
  }

  function handleDeclareSubmit() {
    const youCards = declareAssignments["you"] ?? [];
    const aliceCards = declareAssignments["alice"] ?? [];
    const correct = youCards.length === 5 &&
      ["2:hearts", "3:hearts", "4:hearts", "5:hearts", "6:hearts"].every(c => youCards.includes(c)) &&
      aliceCards.length === 1 && aliceCards[0] === "7:hearts";
    if (!correct) return;

    removeSetFromHands("low_hearts");
    setDeclared(prev => [...prev, { set_id: "low_hearts", awarded_to: "A", declared_by: "you", was_correct: true }]);
    setScoreA(5);
    setDeclareMode(false);
    setStep(s => s + 1);
    setShowPopup(true);
  }

  // ── Derived ────────────────────────────────────────────────────────────

  const isAskStep = cur?.action.kind === "ask";
  const requiredTarget = isAskStep ? (cur.action as { target: string }).target : null;
  const requiredCard = isAskStep ? (cur.action as { card: CardKey }).card : null;
  const askReady = selectedOpponent === requiredTarget && selectedCard === requiredCard;
  const isDeclareStep = cur?.action.kind === "declare";
  const allAssigned = Object.values(declareAssignments).flat();
  const declareReady = isDeclareStep && declareMode && allAssigned.length === 6;
  const declareCorrect = declareReady && (() => {
    const y = declareAssignments["you"] ?? [];
    const a = declareAssignments["alice"] ?? [];
    return y.length === 5 && ["2:hearts", "3:hearts", "4:hearts", "5:hearts", "6:hearts"].every(c => y.includes(c)) && a.length === 1 && a[0] === "7:hearts";
  })();

  // Compute sets in hand
  const mySets: FishSetId[] = [];
  const seen = new Set<string>();
  for (const ck of myHand) {
    const [rank, suit] = ck.split(":");
    if (suit === "joker") { if (!seen.has("eights_jokers")) { seen.add("eights_jokers"); mySets.push("eights_jokers"); } }
    else {
      const isLow = ["2", "3", "4", "5", "6", "7"].includes(rank);
      const setId = `${isLow ? "low" : "high"}_${suit}` as FishSetId;
      if (!seen.has(setId)) { seen.add(setId); mySets.push(setId); }
    }
  }

  // Table layout
  const sorted = [...players].sort((a, b) => a.seat - b.seat);
  const myIdx = sorted.findIndex(p => p.id === "you");
  const rotated: TutorialPlayer[] = [];
  for (let i = 0; i < 6; i++) rotated.push(sorted[(myIdx + i) % 6]);

  const SEAT_LAYOUT = [
    { pos: "col-start-2 row-start-1 z-10", idx: 2 },
    { pos: "col-start-3 row-start-1 z-10", idx: 3 },
    { pos: "col-start-1 row-start-2 row-span-2 z-10", idx: 1 },
    { pos: "col-start-4 row-start-2 row-span-2 z-10", idx: 4 },
    { pos: "col-start-2 row-start-4 z-10", idx: 0 },
    { pos: "col-start-3 row-start-4 z-10", idx: 5 },
  ];

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <main className="min-h-dvh flex flex-col items-center px-4 py-6 relative">
      <Nav showHome />
      <div className="w-full max-w-2xl flex flex-col gap-5 mt-10">
        <div className="text-center">
          <span className="text-[10px] px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wider font-medium">Tutorial</span>
        </div>

        <Scoreboard scoreA={scoreA} scoreB={scoreB} winner={scoreA >= 5 ? "A" : null} />

        {/* Phase text */}
        {!showPopup && (
          <div className="text-center">
            <p className={`text-sm font-medium ${currentTurn === "you" ? "text-amber-400" : "text-gray-400"}`}>
              {currentTurn === "you" ? (cur?.title ?? "Your turn") : `${getP(currentTurn)?.name ?? "?"}'s turn`}
            </p>
          </div>
        )}

        {/* Table */}
        <div className="grid items-center justify-items-center gap-x-1 gap-y-2"
          style={{ gridTemplateColumns: "minmax(80px,1fr) minmax(80px,1fr) minmax(80px,1fr) minmax(80px,1fr)", gridTemplateRows: "auto 1fr 1fr auto" }}>
          {SEAT_LAYOUT.map(({ pos, idx }) => {
            const p = rotated[idx]; if (!p) return null;
            const isMe = p.id === "you";
            const isOpp = p.team !== "A";
            const isHL = cur?.highlight === p.id && !showPopup;
            const isSel = selectedOpponent === p.id;
            const canSel = isAskStep && isOpp && p.hand.length > 0 && !showPopup;
            const colors = TEAM_COLORS[p.team];

            return (
              <div key={p.id} className={pos}>
                <button onClick={canSel ? () => { setSelectedOpponent(p.id); setExpandedSet(null); setSelectedCard(null); } : undefined}
                  disabled={!canSel}
                  className={`relative flex flex-col items-center gap-1 p-3 rounded-xl border transition-all duration-200 min-w-[80px]
                    ${isSel ? "border-blue-400 bg-blue-500/15 ring-2 ring-blue-400/40 scale-105"
                      : isHL ? `${colors.border} ${colors.bg} ring-2 ring-amber-400/40 animate-pulse`
                      : currentTurn === p.id ? `${colors.border} ${colors.bg} ring-1 ring-amber-400/30`
                      : "border-white/[0.06] bg-white/[0.02]"}
                    ${canSel ? "cursor-pointer hover:scale-105" : "cursor-default"}`}>
                  {currentTurn === p.id && <div className="absolute -top-1.5 left-1/2 -translate-x-1/2"><div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" /></div>}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold ${isMe ? "bg-amber-500/20 text-amber-400" : `${colors.bg} ${colors.text}`}`}>{p.name.charAt(0)}</div>
                  <span className={`text-xs ${isMe ? "text-amber-200" : "text-gray-300"}`}>{p.name}</span>
                  <span className="text-[10px] text-gray-600">{p.hand.length} card{p.hand.length !== 1 ? "s" : ""}</span>
                  <span className={`text-[9px] font-medium uppercase tracking-wider ${colors.text}`}>Team {p.team}</span>
                </button>
              </div>
            );
          })}
          <div className="col-start-2 col-span-2 row-start-2 row-span-2 w-full h-full min-h-[120px] rounded-[40%/50%] bg-emerald-900/15 border border-emerald-800/25 flex items-center justify-center">
            <span className="text-[10px] text-emerald-700/40 uppercase tracking-widest font-medium">Fish</span>
          </div>
        </div>

        {/* Last ask */}
        {lastAsk && !showPopup && (
          <div className={`w-full px-4 py-2.5 rounded-xl text-sm text-center ${lastAsk.success ? "bg-emerald-500/[0.08] border border-emerald-500/20 text-emerald-300" : "bg-white/[0.03] border border-white/[0.06] text-gray-400"}`}>
            <span className="font-medium text-gray-200">{getP(lastAsk.asker_id)?.name}</span> asked <span className="font-medium text-gray-200">{getP(lastAsk.target_id)?.name}</span> for the <span className="font-medium text-gray-200">{cardKeyLabel(lastAsk.card)}</span> — <span className={lastAsk.success ? "text-emerald-400 font-medium" : "text-gray-500"}>{lastAsk.success ? "got it!" : "nope"}</span>
          </div>
        )}

        {/* Ask UI */}
        {!showPopup && isAskStep && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-4">
            {selectedOpponent ? (
              <>
                <div className="flex items-center gap-3">
                  <h3 className="text-lg text-gray-200" style={{ fontFamily: "var(--font-display)" }}>Asking {getP(selectedOpponent)?.name}</h3>
                  <button onClick={() => { setSelectedOpponent(null); setExpandedSet(null); setSelectedCard(null); }}
                    className="text-xs px-2.5 py-1 rounded-md border border-white/[0.06] text-gray-400 hover:text-gray-200 hover:bg-white/[0.06] transition-all cursor-pointer">Change</button>
                </div>
                <p className="text-[10px] text-gray-600 -mt-2">Pick a set, then click the card you want</p>

                <div className="flex flex-wrap gap-1.5">
                  {mySets.map(setId => {
                    const all = getCardKeysInSet(setId);
                    const missing = all.filter(ck => !myHand.includes(ck));
                    if (missing.length === 0) return null;
                    const suit = setId === "eights_jokers" ? "mixed" : setId.split("_")[1];
                    const symbol = suit === "mixed" ? "" : SUIT_SYMBOLS[suit] ?? "♠";
                    const half = setId.split("_")[0];
                    const isExp = expandedSet === setId;
                    const color = SUIT_COLORS[suit] ?? "text-gray-200";
                    return (
                      <button key={setId} onClick={() => { setExpandedSet(isExp ? null : setId); setSelectedCard(null); }}
                        className={`w-12 h-[68px] rounded-lg border flex flex-col items-center justify-center transition-all cursor-pointer
                          ${isExp ? "border-blue-400 bg-blue-500/15 ring-1 ring-blue-400/30 scale-105" : "border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.10] hover:scale-105"}`}>
                        {setId === "eights_jokers" ? <span className={`text-[8px] font-bold text-center uppercase ${isExp ? "text-blue-300" : "text-gray-200"}`}>8&apos;s &amp;<br/>JKRs</span> : <>
                          <span className={`text-xl leading-none ${isExp ? "text-blue-300" : color}`}>{symbol}</span>
                          <span className={`text-[9px] font-bold uppercase mt-1 ${isExp ? "text-blue-300" : "text-gray-200"}`}>{half === "low" ? "Low" : "High"}</span>
                        </>}
                      </button>
                    );
                  })}
                </div>

                {expandedSet && (
                  <div className="flex flex-wrap gap-1.5">
                    {getCardKeysInSet(expandedSet).map(ck => {
                      const [rank, suit] = ck.split(":");
                      const iHave = myHand.includes(ck);
                      const isSel = selectedCard === ck;
                      const isJ = suit === "joker";
                      const col = isJ ? (rank === "red" ? "text-red-400" : "text-gray-300") : (SUIT_COLORS[suit] ?? "text-gray-300");
                      const sym = SUIT_SYMBOLS[suit] ?? "";
                      if (iHave) return (
                        <div key={ck} className={`w-12 h-[68px] rounded-lg border flex flex-col items-center justify-center text-xs font-semibold border-white/[0.08] bg-white/[0.05] ${col} opacity-40`}>
                          {isJ ? <span className="text-[8px] font-bold uppercase">JKR</span> : <><span className="leading-none text-sm">{rank}</span><span className="leading-none text-lg mt-0.5">{sym}</span></>}
                        </div>
                      );
                      return (
                        <button key={ck} onClick={() => setSelectedCard(isSel ? null : ck)}
                          className={`w-12 h-[68px] rounded-lg flex flex-col items-center justify-center text-xs font-semibold transition-all cursor-pointer
                            ${isSel ? "border-2 border-solid border-blue-400 bg-blue-500/20 ring-1 ring-blue-400/30 scale-105 text-blue-300" : `border-2 border-dashed border-white/[0.15] hover:bg-white/[0.06] hover:border-white/[0.3] hover:scale-105 ${col}`}`}>
                          {isJ ? <span className="text-[8px] font-bold uppercase">JKR</span> : <><span className="leading-none text-sm">{rank}</span><span className="leading-none text-lg mt-0.5">{sym}</span></>}
                        </button>
                      );
                    })}
                  </div>
                )}

                {selectedCard && (
                  <button onClick={handleAskSubmit} disabled={!askReady}
                    className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all cursor-pointer ${askReady ? "bg-blue-500 text-white hover:bg-blue-400" : "bg-white/[0.04] text-gray-600 cursor-not-allowed"}`}>
                    Ask for {cardKeyLabel(selectedCard)}
                  </button>
                )}
                {selectedCard && !askReady && (
                  <p className="text-xs text-amber-400/70">Hint: ask {getP(requiredTarget!)?.name} for the {cardKeyLabel(requiredCard!)}</p>
                )}
              </>
            ) : (
              <p className="text-center text-sm text-blue-400/70 animate-pulse">Click an opponent on the table to ask them</p>
            )}
          </div>
        )}

        {/* Declare UI */}
        {!showPopup && isDeclareStep && !declareMode && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <button onClick={() => {
              setDeclareMode(true);
              const lh = getCardKeysInSet("low_hearts");
              setDeclareAssignments({ you: lh.filter(ck => myHand.includes(ck)) });
            }} className="w-full py-3 rounded-xl border border-dashed border-white/[0.1] text-sm text-gray-400 hover:text-gray-200 hover:border-white/[0.2] hover:bg-white/[0.03] transition-all cursor-pointer">
              Declare a Set
            </button>
          </div>
        )}

        {!showPopup && declareMode && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-4">
            <h3 className="text-lg text-gray-200" style={{ fontFamily: "var(--font-display)" }}>Declaring Low Hearts</h3>
            <p className="text-xs text-gray-500">Assign each card to the teammate who holds it</p>

            {["you", "alice", "bob"].map(pid => {
              const p = getP(pid); if (!p) return null;
              const assigned = declareAssignments[pid] ?? [];
              const isMe = pid === "you";
              const myLH = getCardKeysInSet("low_hearts").filter(ck => myHand.includes(ck));
              const unassigned = getCardKeysInSet("low_hearts").filter(ck => !Object.values(declareAssignments).flat().includes(ck) && !myHand.includes(ck));
              return (
                <div key={pid} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-medium ${isMe ? "text-amber-300" : "text-gray-300"}`}>{p.name}</span>
                    <span className="text-[10px] text-gray-600">({isMe ? myLH.length : assigned.length} cards)</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 min-h-[36px]">
                    {isMe ? myLH.map(ck => <CardDisplay key={ck} cardKey={ck} size="sm" selected disabled />) : (
                      <>
                        {assigned.map(ck => <CardDisplay key={ck} cardKey={ck} size="sm" selected onClick={() => setDeclareAssignments(prev => ({ ...prev, [pid]: prev[pid]?.filter(c => c !== ck) ?? [] }))} />)}
                        {unassigned.map(ck => <CardDisplay key={`a-${ck}`} cardKey={ck} size="sm" onClick={() => setDeclareAssignments(prev => {
                          const cl: Record<string, CardKey[]> = {};
                          for (const [k, v] of Object.entries(prev)) cl[k] = k === "you" ? v : v.filter(c => c !== ck);
                          cl[pid] = [...(cl[pid] ?? []), ck];
                          return cl;
                        })} />)}
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {declareReady && (
              <button onClick={handleDeclareSubmit} disabled={!declareCorrect}
                className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all cursor-pointer ${declareCorrect ? "bg-blue-500 text-white hover:bg-blue-400" : "bg-white/[0.04] text-gray-600 cursor-not-allowed"}`}>
                Submit Declaration
              </button>
            )}
            {declareReady && !declareCorrect && <p className="text-xs text-amber-400/70">Hint: Alice holds the 7♥</p>}
          </div>
        )}

        {/* Hand */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Your Hand ({myHand.length})</h3>
          <div className="flex flex-wrap gap-1.5">
            {myHand.map(ck => <CardDisplay key={ck} cardKey={ck} />)}
            {myHand.length === 0 && <p className="text-sm text-gray-600 italic">No cards</p>}
          </div>
        </div>

        {/* Play for real button */}
        {cur?.action.kind === "end" && !showPopup && (
          <div className="text-center">
            <button onClick={() => router.push("/")} className="px-6 py-3 rounded-xl bg-blue-500 text-white font-semibold hover:bg-blue-400 transition-all cursor-pointer">Play for Real</button>
          </div>
        )}
      </div>

      {/* Popup */}
      {showPopup && cur && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-gray-900 p-6 space-y-4 shadow-2xl">
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wider font-medium">
              Step {step + 1}/{STEPS.length}
            </span>
            <h2 className="text-xl text-gray-100" style={{ fontFamily: "var(--font-display)" }}>{cur.title}</h2>
            <p className="text-sm text-gray-400 leading-relaxed">{cur.message}</p>
            <button onClick={handlePopupNext}
              className="w-full py-2.5 rounded-xl bg-blue-500 text-white font-semibold hover:bg-blue-400 transition-all cursor-pointer">
              {cur.action.kind === "end" ? "Finish" : "Got it"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}