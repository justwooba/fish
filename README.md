# Fish

A realtime multiplayer web app for the card game **Fish** (also known as Literature). Two teams of three compete to collect sets of cards through strategic asking and declaring.

**Live at [pafish.vercel.app](https://pafish.vercel.app)**

## How to Play

Fish is played with a standard 54-card deck (including jokers) split into 9 sets of 6 cards each. Six players sit in alternating team order (A-B-A-B-A-B) around a table. On your turn, you ask an opponent for a specific card — but you must already hold at least one card from that set. If they have it, you get the card and go again. If not, it becomes their turn.

At any point during your turn, you can **declare** a set by announcing which teammate holds each of the 6 cards. If you're right, your team scores the set. If you're wrong, the other team scores it instead (or the set is nullified, depending on game settings).

First team to win 5 sets wins the game.

### The 9 Sets
 
| Set | Cards |
|-----|-------|
| Low Spades | 2♠ 3♠ 4♠ 5♠ 6♠ 7♠ |
| High Spades | 9♠ 10♠ J♠ Q♠ K♠ A♠ |
| Low Hearts | 2♥ 3♥ 4♥ 5♥ 6♥ 7♥ |
| High Hearts | 9♥ 10♥ J♥ Q♥ K♥ A♥ |
| Low Diamonds | 2♦ 3♦ 4♦ 5♦ 6♦ 7♦ |
| High Diamonds | 9♦ 10♦ J♦ Q♦ K♦ A♦ |
| Low Clubs | 2♣ 3♣ 4♣ 5♣ 6♣ 7♣ |
| High Clubs | 9♣ 10♣ J♣ Q♣ K♣ A♣ |
| Eights & Jokers | 8♠ 8♥ 8♦ 8♣ Red Joker Black Joker |

## Features

- **Realtime multiplayer** — all game actions update instantly for all players via Supabase Realtime
- **No accounts needed** — anonymous auth, just enter a name and play
- **Room system** — create a room, share the code or invite link, teammates join and pick sides
- **Interactive table** — click opponents on the table to ask them for cards
- **Card fly animation** — watch cards fly across the table on successful asks
- **Drag-and-drop hand** — reorder your cards by dragging, sort by set or rank
- **Declaration flow** — multi-step commitment process mirrors the real game (once you start declaring, you can't take it back)
- **Live declaring indicator** — all players see when someone is in the middle of declaring
- **Game timer** — tracks total game time and per-turn time with a toggleable display
- **Postgame log** — full action history with timestamps, card names, and turn numbers
- **Play again** — host can reset the game, keeping teams and settings intact
- **Presence tracking** — green/gray dots show who's connected
- **Admin dashboard** — password-protected panel to view all games, move cards, change turns, award sets, and end games

### Rule Variations (configurable per room)

| Setting | Description |
|---------|-------------|
| Team Declare | Any teammate can declare on their team's turn (not just the turn player) |
| Nullify Misdeclare | If your team holds all 6 cards but you assign them wrong, the set is nullified instead of going to the opponent |
| No Turn on Misdeclare | Opponent still scores the misdeclared set, but play continues from the current turn instead of the opponent choosing |
| Play All Sets | Game continues until all 9 sets are declared (not just first to 5) |

## Tech Stack

- **Next.js 16** with App Router and Turbopack
- **TypeScript** throughout
- **Tailwind CSS v4** for styling
- **Supabase** — Postgres database, anonymous auth, Realtime subscriptions, Presence
- **Vercel** for deployment

## Architecture

The game engine is a **pure function layer** (`src/lib/engine/`) with no I/O — it validates rules and computes state transitions. Server-side API routes load the current state, run the engine, and save the result with **optimistic locking** (version column) to prevent race conditions.

Each player's hand is **never exposed to other clients**. The `toClientGameState()` function strips all hands except the requesting player's before sending data. Realtime change events trigger a re-fetch of the sanitized state — clients never read the raw realtime payload.

```
Client clicks "Ask" → POST /api/game/{id}/ask
  → loadGameContext() (auth + load state)
  → engine.performAsk() (pure validation + state transition)
  → saveGameState() (optimistic lock write + auto-skip empty players)
  → Supabase Realtime notifies all clients
  → Each client re-fetches their own sanitized state
```

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Landing page
│   ├── room/[code]/page.tsx        # Lobby
│   ├── game/[roomId]/page.tsx      # Game
│   ├── admin/page.tsx              # Admin dashboard
│   └── api/
│       ├── auth/anon/              # Anonymous auth
│       ├── rooms/[code]/           # Room CRUD, teams, settings, start, kick
│       ├── game/[roomId]/          # Ask, declare, choose-turn, state, reset
│       └── admin/                  # Admin API
├── components/
│   ├── game/                       # Game UI components
│   ├── lobby/                      # Lobby UI components
│   └── ui/                         # Shared UI primitives
├── hooks/
│   ├── useGame.ts                  # Game state + realtime + presence
│   └── useRoom.ts                  # Room/lobby state + realtime
└── lib/
    ├── engine/index.ts             # Pure game engine (all Fish rules)
    ├── cards.ts                    # Card/set utilities
    ├── types/game.ts               # All TypeScript types
    └── supabase/                   # Supabase client, auth, game context
```