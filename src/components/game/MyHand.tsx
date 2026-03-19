"use client";

import { useState, useEffect, useRef } from "react";
import type { CardKey, FishSetId } from "@/lib/types";
import { ALL_RANKS } from "@/lib/types";
import { getSetForCardKey, setLabel } from "@/lib/cards";
import CardDisplay from "./CardDisplay";

type SortMode = "set" | "rank" | "custom";

interface MyHandProps {
  hand: CardKey[];
  selectedCard?: CardKey | null;
  onSelectCard?: (cardKey: CardKey) => void;
  disabledCards?: Set<string>;
}

const SET_ORDER: Record<FishSetId, number> = {
  low_spades: 0, high_spades: 1,
  low_hearts: 2, high_hearts: 3,
  low_diamonds: 4, high_diamonds: 5,
  low_clubs: 6, high_clubs: 7,
  eights_jokers: 8,
};

const RANK_ORDER: Record<string, number> = {};
ALL_RANKS.forEach((r, i) => { RANK_ORDER[r] = i; });
RANK_ORDER["red"] = 100;
RANK_ORDER["black"] = 101;

const SUIT_ORDER: Record<string, number> = {
  spades: 0, hearts: 1, diamonds: 2, clubs: 3, joker: 4,
};

function sortBySet(a: CardKey, b: CardKey): number {
  const setA = SET_ORDER[getSetForCardKey(a)] ?? 99;
  const setB = SET_ORDER[getSetForCardKey(b)] ?? 99;
  if (setA !== setB) return setA - setB;
  const [rankA] = a.split(":");
  const [rankB] = b.split(":");
  return (RANK_ORDER[rankA] ?? 0) - (RANK_ORDER[rankB] ?? 0);
}

function sortByRank(a: CardKey, b: CardKey): number {
  const [rankA, suitA] = a.split(":");
  const [rankB, suitB] = b.split(":");
  const rA = RANK_ORDER[rankA] ?? 0;
  const rB = RANK_ORDER[rankB] ?? 0;
  if (rA !== rB) return rA - rB;
  return (SUIT_ORDER[suitA] ?? 0) - (SUIT_ORDER[suitB] ?? 0);
}

type DragItem =
  | { type: "card"; index: number }
  | { type: "set"; setId: FishSetId };

type DragTarget = "pills" | "cards" | null;

interface DropIndicator {
  x: number;  // relative to container
  y: number;
  height: number;
}

export default function MyHand({ hand, selectedCard, onSelectCard, disabledCards }: MyHandProps) {
  const [sortMode, setSortMode] = useState<SortMode>("set");
  const [customOrder, setCustomOrder] = useState<CardKey[]>([]);
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [dragTarget, setDragTarget] = useState<DragTarget>(null);
  const [dropSlot, setDropSlot] = useState<number | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);
  const [pillDropSlot, setPillDropSlot] = useState<number | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const cardContainerRef = useRef<HTMLDivElement | null>(null);
  const pillRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    setCustomOrder((prev) => {
      const existing = prev.filter((ck) => hand.includes(ck));
      const newCards = hand.filter((ck) => !prev.includes(ck));
      if (newCards.length === 0 && existing.length === hand.length) return prev;
      return [...existing, ...newCards];
    });
  }, [hand]);

  if (hand.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-gray-600 text-sm italic">You have no cards</p>
      </div>
    );
  }

  let displayOrder: CardKey[];
  if (sortMode === "set") {
    displayOrder = [...hand].sort(sortBySet);
  } else if (sortMode === "rank") {
    displayOrder = [...hand].sort(sortByRank);
  } else {
    displayOrder = customOrder.filter((ck) => hand.includes(ck));
  }

  function handleSort(mode: SortMode) {
    if (mode === "set") {
      setCustomOrder([...hand].sort(sortBySet));
    } else if (mode === "rank") {
      setCustomOrder([...hand].sort(sortByRank));
    }
    setSortMode(mode);
  }

  const setGroups: Record<string, CardKey[]> = {};
  const setOrder: FishSetId[] = [];
  for (const ck of displayOrder) {
    const s = getSetForCardKey(ck);
    if (!setGroups[s]) { setGroups[s] = []; setOrder.push(s); }
    setGroups[s].push(ck);
  }
  const allSets = setOrder.map((s) => [s, setGroups[s]] as [string, CardKey[]]);

  const dragCardIndex = dragItem?.type === "card" ? dragItem.index : null;
  const dragSetId = dragItem?.type === "set" ? dragItem.setId : null;

  function resetDrag() {
    setDragItem(null);
    setDragTarget(null);
    setDropSlot(null);
    setDropIndicator(null);
    setPillDropSlot(null);
    lastDropSlotRef.current = null;
  }

  // ── Compute drop slot using 2D distance ────────────────────────────────

  const lastDropSlotRef = useRef<number | null>(null);

  function computeCardDropSlot(e: React.DragEvent) {
    const container = cardContainerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();

    const mouseX = e.clientX;
    const mouseY = e.clientY;
    let bestSlot = 0;
    let bestDist = Infinity;
    let bestIndicator: DropIndicator | null = null;

    for (let i = 0; i <= displayOrder.length; i++) {
      let slotX: number;
      let slotY: number;
      let slotH: number;

      if (i === 0) {
        const el = cardRefs.current[0];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        slotX = rect.left;
        slotY = rect.top;
        slotH = rect.height;
      } else if (i === displayOrder.length) {
        const el = cardRefs.current[displayOrder.length - 1];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        slotX = rect.right;
        slotY = rect.top;
        slotH = rect.height;
      } else {
        const prev = cardRefs.current[i - 1];
        const next = cardRefs.current[i];
        if (!prev || !next) continue;
        const prevRect = prev.getBoundingClientRect();
        const nextRect = next.getBoundingClientRect();

        // Different rows? Use end-of-row and start-of-row as two candidate slots
        if (Math.abs(prevRect.top - nextRect.top) > 10) {
          // End of previous row
          const d1 = Math.hypot(mouseX - prevRect.right, mouseY - (prevRect.top + prevRect.height / 2));
          if (d1 < bestDist) {
            bestDist = d1;
            bestSlot = i;
            bestIndicator = {
              x: prevRect.right - containerRect.left + 2,
              y: prevRect.top - containerRect.top,
              height: prevRect.height,
            };
          }
          // Start of next row
          const d2 = Math.hypot(mouseX - nextRect.left, mouseY - (nextRect.top + nextRect.height / 2));
          if (d2 < bestDist) {
            bestDist = d2;
            bestSlot = i;
            bestIndicator = {
              x: nextRect.left - containerRect.left - 4,
              y: nextRect.top - containerRect.top,
              height: nextRect.height,
            };
          }
          continue;
        }

        slotX = (prevRect.right + nextRect.left) / 2;
        slotY = prevRect.top;
        slotH = prevRect.height;
      }

      const dist = Math.hypot(mouseX - slotX, mouseY - (slotY + slotH / 2));
      if (dist < bestDist) {
        bestDist = dist;
        bestSlot = i;
        bestIndicator = {
          x: slotX - containerRect.left,
          y: slotY - containerRect.top,
          height: slotH,
        };
      }
    }

    // Only update if slot changed to avoid re-render storm
    if (bestSlot !== lastDropSlotRef.current) {
      lastDropSlotRef.current = bestSlot;
      setDropSlot(bestSlot);
      setDropIndicator(bestIndicator);
      if (dragTarget !== "cards") {
        setPillDropSlot(null);
        setDragTarget("cards");
      }
    }
  }

  // ── Card drag ──────────────────────────────────────────────────────────

  function handleCardDragStart(e: React.DragEvent, index: number) {
    setDragItem({ type: "card", index });
    e.dataTransfer.effectAllowed = "move";
    if (e.currentTarget instanceof HTMLElement) {
      e.dataTransfer.setDragImage(e.currentTarget, 28, 40);
    }
  }

  function handleSetDragStart(e: React.DragEvent, setId: FishSetId) {
    setDragItem({ type: "set", setId });
    e.dataTransfer.effectAllowed = "move";
  }

  function handleCardContainerDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    computeCardDropSlot(e);
  }

  function handleCardContainerDrop(e: React.DragEvent) {
    e.preventDefault();
    if (!dragItem || dropSlot === null) { resetDrag(); return; }

    if (dragItem.type === "card") {
      const fromIndex = dragItem.index;
      const toSlot = dropSlot > fromIndex ? dropSlot - 1 : dropSlot;
      if (fromIndex !== toSlot) {
        const newOrder = [...displayOrder];
        const [moved] = newOrder.splice(fromIndex, 1);
        newOrder.splice(toSlot, 0, moved);
        setCustomOrder(newOrder);
        setSortMode("custom");
      }
    } else if (dragItem.type === "set") {
      const setCards = displayOrder.filter((ck) => getSetForCardKey(ck) === dragItem.setId);
      const otherCards = displayOrder.filter((ck) => getSetForCardKey(ck) !== dragItem.setId);
      let insertIdx = 0;
      for (let i = 0; i < dropSlot && i < displayOrder.length; i++) {
        if (getSetForCardKey(displayOrder[i]) !== dragItem.setId) insertIdx++;
      }
      const newOrder = [...otherCards];
      newOrder.splice(Math.min(insertIdx, newOrder.length), 0, ...setCards);
      setCustomOrder(newOrder);
      setSortMode("custom");
    }
    resetDrag();
  }

  // ── Pill bar drag ──────────────────────────────────────────────────────

  function computePillDropSlot(e: React.DragEvent) {
    const mouseX = e.clientX;
    let bestSlot = 0;
    let bestDist = Infinity;

    for (let i = 0; i <= allSets.length; i++) {
      let slotX: number;
      if (i === 0) {
        const el = pillRefs.current[0];
        if (el) slotX = el.getBoundingClientRect().left;
        else continue;
      } else if (i === allSets.length) {
        const el = pillRefs.current[allSets.length - 1];
        if (el) slotX = el.getBoundingClientRect().right;
        else continue;
      } else {
        const prev = pillRefs.current[i - 1];
        const next = pillRefs.current[i];
        if (prev && next) {
          slotX = (prev.getBoundingClientRect().right + next.getBoundingClientRect().left) / 2;
        } else continue;
      }
      const dist = Math.abs(mouseX - slotX);
      if (dist < bestDist) { bestDist = dist; bestSlot = i; }
    }

    setPillDropSlot(bestSlot);
    setDropSlot(null);
    setDropIndicator(null);
    setDragTarget("pills");
  }

  function handlePillBarDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragItem?.type === "set") computePillDropSlot(e);
  }

  function handlePillBarDrop(e: React.DragEvent) {
    e.preventDefault();
    if (!dragItem || dragItem.type !== "set" || pillDropSlot === null) { resetDrag(); return; }

    const draggedSetId = dragItem.setId;
    const currentSetOrder = [...setOrder];
    const fromIdx = currentSetOrder.indexOf(draggedSetId);
    if (fromIdx === -1) { resetDrag(); return; }

    currentSetOrder.splice(fromIdx, 1);
    const toIdx = pillDropSlot > fromIdx ? pillDropSlot - 1 : pillDropSlot;
    currentSetOrder.splice(toIdx, 0, draggedSetId);

    const newCardOrder: CardKey[] = [];
    for (const sid of currentSetOrder) {
      const cardsInSet = displayOrder.filter((ck) => getSetForCardKey(ck) === sid);
      newCardOrder.push(...cardsInSet);
    }
    setCustomOrder(newCardOrder);
    setSortMode("custom");
    resetDrag();
  }

  function groupSet(setId: string) {
    const current = sortMode === "custom" ? customOrder.filter((ck) => hand.includes(ck)) : [...displayOrder];
    const setCards = current.filter((ck) => getSetForCardKey(ck) === setId);
    const otherCards = current.filter((ck) => getSetForCardKey(ck) !== setId);
    const firstIdx = current.findIndex((ck) => getSetForCardKey(ck) === setId);
    const result = [...otherCards];
    result.splice(Math.min(firstIdx, result.length), 0, ...setCards);
    setCustomOrder(result);
    setSortMode("custom");
  }

  function isCardDragging(index: number): boolean {
    if (dragCardIndex === index) return true;
    if (dragSetId && getSetForCardKey(displayOrder[index]) === dragSetId) return true;
    return false;
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          Your Hand ({hand.length})
        </h3>
        <div className="flex gap-1">
          {(["set", "rank", "custom"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => handleSort(mode)}
              className={`
                text-[10px] px-2.5 py-1 rounded-md transition-all cursor-pointer capitalize
                ${sortMode === mode
                  ? "bg-white/[0.08] text-gray-200"
                  : "text-gray-600 hover:text-gray-400"
                }
              `}
            >
              {mode === "custom" ? "Custom" : `By ${mode}`}
            </button>
          ))}
        </div>
      </div>

      {/* Set pills */}
      {allSets.length > 0 && (
        <div
          className="flex flex-wrap items-center"
          onDragOver={handlePillBarDragOver}
          onDragLeave={() => { if (dragTarget === "pills") setPillDropSlot(null); }}
          onDrop={handlePillBarDrop}
        >
          <span className="text-[9px] text-gray-600 mr-1.5 py-1">Sets:</span>
          {allSets.map(([setId, cards], pillIndex) => {
            const isDraggingThis = dragSetId === setId;
            const showGapBefore = dragItem?.type === "set" && dragTarget === "pills"
              && pillDropSlot === pillIndex && !isDraggingThis;
            const showGapAfter = dragItem?.type === "set" && dragTarget === "pills"
              && pillDropSlot === allSets.length && pillIndex === allSets.length - 1 && !isDraggingThis;

            return (
              <div key={setId} className="flex items-center">
                {showGapBefore && (
                  <div className="w-4 mx-0.5 flex items-center justify-center shrink-0 transition-all duration-200">
                    <div className="w-0.5 h-5 rounded-full bg-blue-400/60" />
                  </div>
                )}
                <div
                  ref={(el) => { pillRefs.current[pillIndex] = el; }}
                  draggable
                  onDragStart={(e) => handleSetDragStart(e, setId as FishSetId)}
                  onDragEnd={resetDrag}
                  onClick={() => groupSet(setId)}
                  className={`
                    text-[9px] px-2.5 py-1 rounded-md border mx-[3px]
                    transition-all cursor-grab active:cursor-grabbing
                    select-none flex items-center gap-1
                    ${isDraggingThis
                      ? "opacity-30 scale-95 border-blue-400/30 bg-blue-500/10"
                      : "border-white/[0.06] bg-white/[0.03] text-gray-400 hover:text-gray-200 hover:bg-white/[0.06] hover:border-white/[0.1]"
                    }
                  `}
                  title="Click to group · Drag to reorder"
                >
                  <span>{setLabel(setId as FishSetId)}</span>
                  <span className="text-gray-600">{cards.length}</span>
                </div>
                {showGapAfter && (
                  <div className="w-4 mx-0.5 flex items-center justify-center shrink-0 transition-all duration-200">
                    <div className="w-0.5 h-5 rounded-full bg-blue-400/60" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Cards — no inline gap elements, overlay indicator instead */}
      <div
        ref={cardContainerRef}
        className="relative flex flex-wrap gap-1.5"
        onDragOver={handleCardContainerDragOver}
        onDragLeave={() => { if (dragTarget === "cards") { setDropSlot(null); setDropIndicator(null); } }}
        onDrop={handleCardContainerDrop}
      >
        {displayOrder.map((cardKey, index) => {
          const dragging = isCardDragging(index);
          return (
            <div
              key={cardKey}
              ref={(el) => { cardRefs.current[index] = el; }}
              draggable
              onDragStart={(e) => handleCardDragStart(e, index)}
              onDragEnd={resetDrag}
              className={`transition-all duration-150 ${dragging ? "opacity-20 scale-90" : ""}`}
            >
              <CardDisplay
                cardKey={cardKey}
                selected={selectedCard === cardKey}
                onClick={() => onSelectCard?.(cardKey)}
                disabled={disabledCards?.has(cardKey)}
              />
            </div>
          );
        })}

        {/* Overlay drop indicator — absolute positioned, doesn't affect layout */}
        {dragItem && dragTarget === "cards" && dropIndicator && (
          <div
            className="absolute pointer-events-none transition-all duration-150 ease-out"
            style={{
              left: dropIndicator.x - 1,
              top: dropIndicator.y,
              height: dropIndicator.height,
            }}
          >
            <div className="w-0.5 h-full rounded-full bg-blue-400/70 shadow-[0_0_6px_rgba(96,165,250,0.4)]" />
          </div>
        )}
      </div>

      <p className="text-[9px] text-gray-700">Drag cards to reorder · Drag set pills to reorder groups</p>
    </div>
  );
}