"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { CardKey, FishSetId, TeamId, DeclaredSet, LastAsk } from "@/lib/types";
import { setLabel, cardKeyLabel, getCardKeysInSet } from "@/lib/cards";
import CardDisplay from "@/components/game/CardDisplay";
import Scoreboard from "@/components/game/Scoreboard";
import CardFlyAnimation from "@/components/game/CardFlyAnimation";
import GameToast from "@/components/game/GameToast";
import type { Toast } from "@/components/game/GameToast";
import Nav from "@/components/ui/Nav";

// ─── Types ───────────────────────────────────────────────────────────────────

type TutorialPlayer = { id: string; name: string; team: TeamId; seat: number; hand: CardKey[] };
type StepType =
  | { kind: "popup" }
  | { kind: "ask"; target: string; card: CardKey }
  | { kind: "opponent_ask"; asker: string; target: string; card: CardKey; success: boolean }
  | { kind: "opponent_declare"; declarer: string; setId: FishSetId; assignments: Record<string, CardKey[]>; team: TeamId }
  | { kind: "choose_turn"; chosen: string }
  | { kind: "declare"; setId: FishSetId }
  | { kind: "end" };
interface Step { action: StepType; title: string; message: string; highlight?: string }

// ─── Initial State ───────────────────────────────────────────────────────────

const INITIAL_PLAYERS: TutorialPlayer[] = [
  { id: "you",   name: "You",   team: "A", seat: 0, hand: ["3:hearts", "5:hearts", "10:diamonds"] },
  { id: "carol", name: "Carol", team: "B", seat: 1, hand: ["9:diamonds", "9:clubs", "10:clubs", "J:clubs"] },
  { id: "alice", name: "Alice", team: "A", seat: 2, hand: ["7:hearts", "J:diamonds", "Q:diamonds", "K:diamonds", "A:diamonds"] },
  { id: "dave",  name: "Dave",  team: "B", seat: 3, hand: ["2:hearts", "4:hearts", "6:hearts", "Q:clubs", "K:clubs"] },
  { id: "bob",   name: "Bob",   team: "A", seat: 4, hand: [] },
  { id: "eve",   name: "Eve",   team: "B", seat: 5, hand: ["A:clubs"] },
];

const INITIAL_DECLARED: DeclaredSet[] = [
  { set_id: "low_spades", awarded_to: "A", declared_by: "you", was_correct: true },
  { set_id: "high_spades", awarded_to: "A", declared_by: "alice", was_correct: true },
  { set_id: "low_clubs", awarded_to: "B", declared_by: "carol", was_correct: true },
  { set_id: "high_hearts", awarded_to: "A", declared_by: "alice", was_correct: true },
  { set_id: "low_diamonds", awarded_to: "A", declared_by: "you", was_correct: true },
  { set_id: "eights_jokers", awarded_to: "B", declared_by: "eve", was_correct: true },
];

// ─── Steps ───────────────────────────────────────────────────────────────────

const STEPS: Step[] = [
  { action: { kind: "popup" }, title: "Welcome to Fish!", message: "You're on Team A (blue) with Alice and Bob. Your opponents are Carol, Dave, and Eve (red). Players alternate around the table." },
  { action: { kind: "popup" }, title: "The Goal", message: "Score is 4–2 — you need one more set to win! Three sets remain: Low Hearts (2–7♥), High Diamonds (9–A♦), and High Clubs (9–A♣)." },
  { action: { kind: "popup" }, title: "Your Hand", message: "You have 3♥, 5♥, and 10♦. You can ask opponents for cards from sets you hold cards in — Low Hearts and High Diamonds." },
  { action: { kind: "popup" }, title: "How Asking Works", message: "Pick an opponent and ask for a specific card. You must hold a card from the same set. If they have it, it's yours and you go again. If not, the turn passes to them." },
  { action: { kind: "ask", target: "carol", card: "9:diamonds" }, title: "Ask Carol for 9♦", message: "You hold 10♦, so you can ask for High Diamonds. Click the button to ask Carol for the 9♦.", highlight: "carol" },
  { action: { kind: "popup" }, title: "Got it!", message: "Carol had the 9♦! Since your ask succeeded, it's still your turn." },
  { action: { kind: "ask", target: "carol", card: "J:diamonds" }, title: "Ask Carol for J♦", message: "Let's see if Carol has more diamonds. Ask her for the Jack of Diamonds.", highlight: "carol" },
  { action: { kind: "popup" }, title: "Miss!", message: "Carol doesn't have the J♦. The turn passes to her — the opponent you asked." },
  { action: { kind: "popup" }, title: "Carol Declares High Clubs", message: "Carol's team has been collecting clubs. She declares High Clubs — assigning each card to the correct teammate." },
  { action: { kind: "opponent_declare", declarer: "carol", setId: "high_clubs", assignments: { carol: ["9:clubs", "10:clubs", "J:clubs"], dave: ["Q:clubs", "K:clubs"], eve: ["A:clubs"] }, team: "B" }, title: "Team B Scores!", message: "Carol's declaration was correct. Score is now 4–3. After scoring, the winning team picks who goes next." },
  { action: { kind: "choose_turn", chosen: "dave" }, title: "Dave's Turn", message: "Team B chose Dave. He's been collecting diamonds — watch out!" },
  { action: { kind: "opponent_ask", asker: "dave", target: "you", card: "10:diamonds", success: true }, title: "Dave Takes Your 10♦", message: "Dave asked you for 10♦ and you had it. When someone asks YOU, you must give the card if you have it." },
  { action: { kind: "opponent_ask", asker: "dave", target: "you", card: "9:diamonds", success: true }, title: "Dave Takes Your 9♦ Too", message: "Dave keeps going! This is the back-and-forth of Fish — when two players have cards in the same set, they trade asks." },
  { action: { kind: "opponent_ask", asker: "dave", target: "you", card: "J:diamonds", success: false }, title: "Dave Misses!", message: "Dave asked for J♦ but you don't have it (Alice does!). His ask tells you he has diamonds but NOT the J♦. Every ask reveals information!" },
  { action: { kind: "popup" }, title: "Your Options", message: "You only have 3♥ and 5♥ now — both Low Hearts. You can only ask from sets you hold cards in, so it's time to go after hearts." },
  { action: { kind: "popup" }, title: "Strategy Tip", message: "Keep asking the same opponent while they have cards in your set. If you switch too early, they can take cards back on their turn." },
  { action: { kind: "ask", target: "dave", card: "2:hearts" }, title: "Ask Dave for 2♥", message: "Dave has hearts. Ask him for the 2 of Hearts.", highlight: "dave" },
  { action: { kind: "popup" }, title: "Nice!", message: "Keep pressing Dave for hearts!" },
  { action: { kind: "ask", target: "dave", card: "4:hearts" }, title: "Ask Dave for 4♥", message: "Ask Dave for the 4 of Hearts.", highlight: "dave" },
  { action: { kind: "popup" }, title: "The 50/50", message: "You have 2♥, 3♥, 4♥, 5♥. The remaining hearts are 6♥ and 7♥. Dave's remaining cards are a mix of hearts and diamonds. Does he have 6♥, 7♥, or neither?" },
  { action: { kind: "popup" }, title: "Deduction", message: "Dave started with hearts and clubs. His clubs are gone (declared). He still has some hearts and diamonds. You need to guess — does he have the 6♥ or the 7♥? Let's try 6♥." },
  { action: { kind: "ask", target: "dave", card: "6:hearts" }, title: "Ask Dave for 6♥", message: "The 50/50 guess — ask Dave for the 6 of Hearts.", highlight: "dave" },
  { action: { kind: "popup" }, title: "Correct Guess!", message: "Dave had the 6♥! You now have 5 of 6 Low Hearts. Dave only has diamonds left, so the 7♥ must be with your teammate Alice." },
  { action: { kind: "popup" }, title: "How Declaring Works", message: "Assign each card in the set to the teammate who holds it. Get them all right = your team scores. Get one wrong = misdeclare. You can't take it back!" },
  { action: { kind: "declare", setId: "low_hearts" }, title: "Declare Low Hearts", message: "Assign your 5 hearts to yourself and the 7♥ to Alice." },
  { action: { kind: "end" }, title: "You Win! 🎉", message: "Team A scores Low Hearts — 5–3! You've learned asking, failed asks, reading information, back-and-forth, 50/50s, and declaring. Go play for real!" },
];

// ─── Styling ─────────────────────────────────────────────────────────────────

const SUIT_SYMBOLS: Record<string, string> = { spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣" };
const SUIT_COLORS: Record<string, string> = { spades: "text-gray-200", clubs: "text-gray-200", hearts: "text-red-400", diamonds: "text-red-400" };
const TEAM_COLORS: Record<TeamId, { bg: string; border: string; text: string }> = {
  A: { bg: "bg-sky-500/10", border: "border-sky-500/30", text: "text-sky-400" },
  B: { bg: "bg-rose-500/10", border: "border-rose-500/30", text: "text-rose-400" },
};

// ─── Flying card types ───────────────────────────────────────────────────────

interface FlyingCard { cardKey: CardKey; fromX: number; fromY: number; toX: number; toY: number; id: number }
let flyIdCounter = 0;

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
  const [declareMode, setDeclareMode] = useState(false);
  const [declareAssignments, setDeclareAssignments] = useState<Record<string, CardKey[]>>({});
  const [flyingCards, setFlyingCards] = useState<FlyingCard[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);
  const seatRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const cur = STEPS[step];
  const myHand = players.find(p => p.id === "you")?.hand ?? [];
  const getP = (id: string) => players.find(p => p.id === id);

  function addToast(message: string, type: Toast["type"]) {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
  }
  function removeToast(id: number) { setToasts(prev => prev.filter(t => t.id !== id)); }

  function getSeatPos(playerId: string) {
    const el = seatRefs.current[playerId];
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function moveCard(from: string, to: string, card: CardKey) {
    setPlayers(prev => prev.map(p => {
      if (p.id === from) return { ...p, hand: p.hand.filter(c => c !== card) };
      if (p.id === to) return { ...p, hand: [...p.hand, card] };
      return p;
    }));
  }

  function triggerFlyAnimation(from: string, to: string, card: CardKey) {
    const fromPos = getSeatPos(from);
    const toPos = getSeatPos(to);
    if (fromPos && toPos) {
      const id = ++flyIdCounter;
      setFlyingCards(prev => [...prev, { cardKey: card, fromX: fromPos.x, fromY: fromPos.y, toX: toPos.x, toY: toPos.y, id }]);
    }
  }

  function removeSetFromHands(setId: FishSetId) {
    const cards = getCardKeysInSet(setId);
    setPlayers(prev => prev.map(p => ({ ...p, hand: p.hand.filter(c => !cards.includes(c)) })));
  }

  function advance() {
    const next = step + 1;
    if (next >= STEPS.length) return;
    const ns = STEPS[next];

    if (ns.action.kind === "opponent_ask") {
      const act = ns.action as { kind: "opponent_ask"; asker: string; target: string; card: CardKey; success: boolean };
      if (act.success) {
        triggerFlyAnimation(act.target, act.asker, act.card);
        moveCard(act.target, act.asker, act.card);
        addToast(`${getP(act.asker)?.name} took ${cardKeyLabel(act.card)} from ${getP(act.target)?.name}`, "success");
      } else {
        addToast(`${getP(act.asker)?.name} asked ${getP(act.target)?.name} for ${cardKeyLabel(act.card)} — miss`, "fail");
      }
      setLastAsk({ asker_id: act.asker, target_id: act.target, card: act.card, success: act.success });
      setCurrentTurn(act.success ? act.asker : act.target);
      setStep(next); setShowPopup(true);
    } else if (ns.action.kind === "opponent_declare") {
      const act = ns.action as { kind: "opponent_declare"; declarer: string; setId: FishSetId; assignments: Record<string, CardKey[]>; team: TeamId };
      removeSetFromHands(act.setId);
      setDeclared(prev => [...prev, { set_id: act.setId, awarded_to: act.team, declared_by: act.declarer, was_correct: true }]);
      if (act.team === "A") setScoreA(s => s + 1); else setScoreB(s => s + 1);
      addToast(`${getP(act.declarer)?.name} declared ${setLabel(act.setId)} — Team ${act.team} scores!`, "declare_correct");
      setStep(next); setShowPopup(true);
    } else if (ns.action.kind === "choose_turn") {
      const act = ns.action as { kind: "choose_turn"; chosen: string };
      setCurrentTurn(act.chosen);
      setStep(next); setShowPopup(true);
    } else {
      setStep(next);
      setShowPopup(ns.action.kind === "popup" || ns.action.kind === "end");
    }
  }

  function handlePopupNext() { setShowPopup(false); advance(); }

  function handleAskSubmit() {
    if (!cur || cur.action.kind !== "ask") return;
    const act = cur.action as { kind: "ask"; target: string; card: CardKey };
    const targetP = getP(act.target);
    const hasCard = targetP?.hand.includes(act.card);
    if (hasCard) {
      triggerFlyAnimation(act.target, "you", act.card);
      moveCard(act.target, "you", act.card);
      setLastAsk({ asker_id: "you", target_id: act.target, card: act.card, success: true });
      setCurrentTurn("you");
      addToast(`You took ${cardKeyLabel(act.card)} from ${getP(act.target)?.name}`, "success");
    } else {
      setLastAsk({ asker_id: "you", target_id: act.target, card: act.card, success: false });
      setCurrentTurn(act.target);
      addToast(`You asked ${getP(act.target)?.name} for ${cardKeyLabel(act.card)} — miss`, "fail");
    }
    setStep(s => s + 1); setShowPopup(true);
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
    setScoreA(5); setDeclareMode(false);
    addToast("You declared Low Hearts — Team A scores!", "declare_correct");
    setStep(s => s + 1); setShowPopup(true);
  }

  // ─── Derived ───────────────────────────────────────────────────────────

  const isAskStep = cur?.action.kind === "ask";
  const isDeclareStep = cur?.action.kind === "declare";
  const allAssigned = Object.values(declareAssignments).flat();
  const declareReady = isDeclareStep && declareMode && allAssigned.length === 6;
  const declareCorrect = declareReady && (() => {
    const y = declareAssignments["you"] ?? []; const a = declareAssignments["alice"] ?? [];
    return y.length === 5 && ["2:hearts", "3:hearts", "4:hearts", "5:hearts", "6:hearts"].every(c => y.includes(c)) && a.length === 1 && a[0] === "7:hearts";
  })();

  const askTarget = isAskStep ? (cur.action as { target: string }).target : null;
  const askCard = isAskStep ? (cur.action as { card: CardKey }).card : null;
  const askCardSet = askCard ? (() => {
    const [rank, suit] = askCard.split(":");
    if (suit === "joker") return "eights_jokers" as FishSetId;
    const isLow = ["2", "3", "4", "5", "6", "7"].includes(rank);
    return `${isLow ? "low" : "high"}_${suit}` as FishSetId;
  })() : null;

  // Table
  const sorted = [...players].sort((a, b) => a.seat - b.seat);
  const myIdx = sorted.findIndex(p => p.id === "you");
  const rotated: TutorialPlayer[] = [];
  for (let i = 0; i < 6; i++) rotated.push(sorted[(myIdx + i) % 6]);

  const teamASets = declared.filter(ds => ds.awarded_to === "A");
  const teamBSets = declared.filter(ds => ds.awarded_to === "B");

  const SEATS = [
    { pos: "col-start-2 row-start-1 z-10", idx: 2 },
    { pos: "col-start-3 row-start-1 z-10", idx: 3 },
    { pos: "col-start-1 row-start-2 row-span-2 z-10", idx: 1 },
    { pos: "col-start-4 row-start-2 row-span-2 z-10", idx: 4 },
    { pos: "col-start-2 row-start-4 z-10", idx: 0 },
    { pos: "col-start-3 row-start-4 z-10", idx: 5 },
  ];

  return (
    <main className="min-h-dvh flex flex-col items-center px-4 py-6 relative">
      <Nav showHome />
      <div className="w-full max-w-2xl flex flex-col gap-5 mt-10">
        <div className="text-center">
          <span className="text-[10px] px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wider font-medium">Tutorial</span>
        </div>

        <Scoreboard scoreA={scoreA} scoreB={scoreB} winner={scoreA >= 5 ? "A" : null} />

        {/* Popup */}
        {showPopup && cur && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-4 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[8px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono">{step + 1}/{STEPS.length}</span>
              <h2 className="text-sm font-medium text-amber-200">{cur.title}</h2>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">{cur.message}</p>
            <button onClick={handlePopupNext}
              className="text-xs px-4 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-all cursor-pointer font-medium">
              {cur.action.kind === "end" ? "Finish" : "Continue"}
            </button>
          </div>
        )}

        {/* Phase text */}
        {!showPopup && !isAskStep && !isDeclareStep && (
          <div className="text-center">
            <p className={`text-sm font-medium ${currentTurn === "you" ? "text-amber-400" : "text-gray-400"}`}>
              {currentTurn === "you" ? "Your turn" : `${getP(currentTurn)?.name ?? "?"}'s turn`}
            </p>
          </div>
        )}

        {/* Table */}
        <div className="grid items-center justify-items-center gap-x-1 gap-y-2"
          style={{ gridTemplateColumns: "minmax(80px,1fr) minmax(80px,1fr) minmax(80px,1fr) minmax(80px,1fr)", gridTemplateRows: "auto 1fr 1fr auto" }}>
          {SEATS.map(({ pos, idx }) => {
            const p = rotated[idx]; if (!p) return null;
            const isMe = p.id === "you";
            const isHL = cur?.highlight === p.id && !showPopup;
            const colors = TEAM_COLORS[p.team];
            return (
              <div key={p.id} className={pos}>
                <div ref={el => { seatRefs.current[p.id] = el; }}
                  className={`relative flex flex-col items-center gap-1 p-3 rounded-xl border transition-all duration-200 min-w-[80px]
                    ${isHL ? `${colors.border} ${colors.bg} ring-2 ring-amber-400/40 animate-pulse`
                      : currentTurn === p.id ? `${colors.border} ${colors.bg} ring-1 ring-amber-400/30`
                      : "border-white/[0.06] bg-white/[0.02]"}`}>
                  {currentTurn === p.id && <div className="absolute -top-1.5 left-1/2 -translate-x-1/2"><div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" /></div>}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold ${isMe ? "bg-amber-500/20 text-amber-400" : `${colors.bg} ${colors.text}`}`}>{p.name.charAt(0)}</div>
                  <span className={`text-xs ${isMe ? "text-amber-200" : "text-gray-300"}`}>{p.name}</span>
                  <span className="text-[10px] text-gray-600">{p.hand.length} card{p.hand.length !== 1 ? "s" : ""}</span>
                  <span className={`text-[9px] font-medium uppercase tracking-wider ${colors.text}`}>Team {p.team}</span>
                </div>
              </div>
            );
          })}

          {/* Table surface with declared sets */}
          <div className="col-start-2 col-span-2 row-start-2 row-span-2 w-full h-full min-h-[120px] rounded-[40%/50%] bg-emerald-900/15 border border-emerald-800/25 flex flex-col items-center justify-center px-4 py-3 gap-2">
            {(teamASets.length > 0 || teamBSets.length > 0) ? (
              <div className="flex gap-3 items-start">
                {teamASets.length > 0 && (
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="flex items-center gap-1">
                      <div className="w-5 h-5 rounded-full bg-sky-500/20 border border-sky-500/30 flex items-center justify-center">
                        <span className="text-[9px] font-bold text-sky-400">{teamASets.length}</span>
                      </div>
                      <span className="text-[8px] text-sky-400/60 uppercase font-medium">A</span>
                    </div>
                    {teamASets.map((ds, i) => (
                      <span key={i} className="text-[8px] text-sky-400/50 leading-none">{setLabel(ds.set_id)}</span>
                    ))}
                  </div>
                )}
                {teamASets.length > 0 && teamBSets.length > 0 && <div className="w-px h-8 bg-white/[0.06] self-center" />}
                {teamBSets.length > 0 && (
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="flex items-center gap-1">
                      <div className="w-5 h-5 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center">
                        <span className="text-[9px] font-bold text-rose-400">{teamBSets.length}</span>
                      </div>
                      <span className="text-[8px] text-rose-400/60 uppercase font-medium">B</span>
                    </div>
                    {teamBSets.map((ds, i) => (
                      <span key={i} className="text-[8px] text-rose-400/50 leading-none">{setLabel(ds.set_id)}</span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <span className="text-[10px] text-emerald-700/40 uppercase tracking-widest font-medium">Fish</span>
            )}
          </div>
        </div>

        {/* Last ask banner */}
        {lastAsk && (
          <div className={`w-full px-4 py-2.5 rounded-xl text-sm text-center ${lastAsk.success ? "bg-emerald-500/[0.08] border border-emerald-500/20 text-emerald-300" : "bg-white/[0.03] border border-white/[0.06] text-gray-400"}`}>
            <span className="font-medium text-gray-200">{getP(lastAsk.asker_id)?.name}</span> asked <span className="font-medium text-gray-200">{getP(lastAsk.target_id)?.name}</span> for the <span className="font-medium text-gray-200">{cardKeyLabel(lastAsk.card)}</span> — <span className={lastAsk.success ? "text-emerald-400 font-medium" : "text-gray-500"}>{lastAsk.success ? "got it!" : "nope"}</span>
          </div>
        )}

        {/* Ask UI */}
        {!showPopup && isAskStep && askTarget && askCard && askCardSet && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-4">
            <h3 className="text-base text-gray-200" style={{ fontFamily: "var(--font-display)" }}>
              Ask {getP(askTarget)?.name} for the {cardKeyLabel(askCard)}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {getCardKeysInSet(askCardSet).map(ck => {
                const [rank, suit] = ck.split(":");
                const isJ = suit === "joker";
                const iHave = myHand.includes(ck);
                const isTarget = ck === askCard;
                const col = isJ ? (rank === "red" ? "text-red-400" : "text-gray-300") : (SUIT_COLORS[suit] ?? "text-gray-300");
                const sym = SUIT_SYMBOLS[suit] ?? "";
                const content = isJ
                  ? <span className="text-[8px] font-bold uppercase">JKR</span>
                  : <><span className="leading-none text-sm">{rank}</span><span className="leading-none text-lg mt-0.5">{sym}</span></>;

                if (iHave) return (
                  <div key={ck} className={`w-12 h-[68px] rounded-lg border flex flex-col items-center justify-center text-xs font-semibold border-white/[0.08] bg-white/[0.05] ${col} opacity-40`}>{content}</div>
                );
                if (isTarget) return (
                  <div key={ck} className="w-12 h-[68px] rounded-lg border-2 border-solid border-blue-400 bg-blue-500/20 ring-1 ring-blue-400/30 scale-105 flex flex-col items-center justify-center text-xs font-semibold text-blue-300">{content}</div>
                );
                return (
                  <div key={ck} className={`w-12 h-[68px] rounded-lg border-2 border-dashed border-white/[0.08] flex flex-col items-center justify-center text-xs font-semibold ${col} opacity-20`}>{content}</div>
                );
              })}
            </div>
            <button onClick={handleAskSubmit}
              className="px-5 py-2.5 rounded-xl bg-blue-500 text-white font-semibold text-sm hover:bg-blue-400 transition-all cursor-pointer">
              Ask for {cardKeyLabel(askCard)}
            </button>
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
            <h3 className="text-base text-gray-200" style={{ fontFamily: "var(--font-display)" }}>Declaring Low Hearts</h3>
            <p className="text-xs text-gray-500">Assign each card to the teammate who holds it. Your cards are auto-assigned.</p>
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
                          cl[pid] = [...(cl[pid] ?? []), ck]; return cl;
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

        {/* End */}
        {cur?.action.kind === "end" && !showPopup && (
          <div className="text-center">
            <button onClick={() => router.push("/")} className="px-6 py-3 rounded-xl bg-blue-500 text-white font-semibold hover:bg-blue-400 transition-all cursor-pointer">Play for Real</button>
          </div>
        )}
      </div>

      {/* Toasts */}
      <GameToast toasts={toasts} onRemove={removeToast} />

      {/* Flying cards */}
      {flyingCards.map(fc => (
        <CardFlyAnimation key={fc.id} cardKey={fc.cardKey} fromX={fc.fromX} fromY={fc.fromY} toX={fc.toX} toY={fc.toY}
          onComplete={() => setFlyingCards(prev => prev.filter(f => f.id !== fc.id))} />
      ))}
    </main>
  );
}