import Nav from "@/components/ui/Nav";

export default function RulesPage() {
  return (
    <main className="min-h-dvh flex flex-col items-center px-4 py-16">
      <Nav showHome />

      <div className="w-full max-w-2xl space-y-8 mt-8">
        <div className="text-center">
          <h1
            className="text-4xl font-normal tracking-tight mb-2"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Rules
          </h1>
          <p className="text-gray-500 text-sm">How to play Fish</p>
        </div>

        <div className="space-y-6 text-sm text-gray-400 leading-relaxed">
          {/* Overview */}
          <section className="rounded-2xl border border-white/[0.04] bg-white/[0.02] px-6 py-5 space-y-3">
            <h2 className="text-lg text-gray-200" style={{ fontFamily: "var(--font-display)" }}>
              Overview
            </h2>
            <p>
              Fish (also known as Literature) is a team card game for exactly six players,
              split into two teams of three. Players sit in alternating team order around
              the table (A-B-A-B-A-B). The goal is to collect complete sets of cards
              through asking and deduction.
            </p>
            <p>
              The game uses a standard 54-card deck (52 cards + 2 jokers), divided into
              9 sets of 6 cards each. Each player is dealt 9 cards at the start.
              First team to win 5 sets wins (or all 9 in extended play).
            </p>
          </section>

          {/* The Sets */}
          <section className="rounded-2xl border border-white/[0.04] bg-white/[0.02] px-6 py-5 space-y-3">
            <h2 className="text-lg text-gray-200" style={{ fontFamily: "var(--font-display)" }}>
              The 9 Sets
            </h2>
            <p>Each suit is split into a low set and a high set. The 8s and jokers form their own set.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div className="space-y-2">
                <h3 className="text-xs text-gray-500 uppercase tracking-wider">Low Sets (2–7)</h3>
                <div className="space-y-1 text-gray-300">
                  <p>Low Spades: 2♠ 3♠ 4♠ 5♠ 6♠ 7♠</p>
                  <p>Low Hearts: 2♥ 3♥ 4♥ 5♥ 6♥ 7♥</p>
                  <p>Low Diamonds: 2♦ 3♦ 4♦ 5♦ 6♦ 7♦</p>
                  <p>Low Clubs: 2♣ 3♣ 4♣ 5♣ 6♣ 7♣</p>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-xs text-gray-500 uppercase tracking-wider">High Sets (9–A)</h3>
                <div className="space-y-1 text-gray-300">
                  <p>High Spades: 9♠ 10♠ J♠ Q♠ K♠ A♠</p>
                  <p>High Hearts: 9♥ 10♥ J♥ Q♥ K♥ A♥</p>
                  <p>High Diamonds: 9♦ 10♦ J♦ Q♦ K♦ A♦</p>
                  <p>High Clubs: 9♣ 10♣ J♣ Q♣ K♣ A♣</p>
                </div>
              </div>
            </div>
            <p className="text-gray-300 mt-2">Eights &amp; Jokers: 8♠ 8♥ 8♦ 8♣ Red Joker Black Joker</p>
          </section>

          {/* Asking */}
          <section className="rounded-2xl border border-white/[0.04] bg-white/[0.02] px-6 py-5 space-y-3">
            <h2 className="text-lg text-gray-200" style={{ fontFamily: "var(--font-display)" }}>
              Asking for Cards
            </h2>
            <p>
              On your turn, you ask one opponent for a specific card. You must already
              hold at least one card from the same set as the card you&apos;re asking for.
              You cannot ask a teammate.
            </p>
            <p>
              If the opponent has the card, they give it to you and you go again.
              If they don&apos;t have it, the turn passes to that opponent.
            </p>
            <p className="text-gray-500 italic">
              Only the most recent ask is visible to all players. Past asks are hidden
              during the game — memory is a key part of the strategy.
            </p>
          </section>

          {/* Declaring */}
          <section className="rounded-2xl border border-white/[0.04] bg-white/[0.02] px-6 py-5 space-y-3">
            <h2 className="text-lg text-gray-200" style={{ fontFamily: "var(--font-display)" }}>
              Declaring Sets
            </h2>
            <p>
              At any point during your turn, you can declare a set. To declare, you
              announce which teammate holds each of the 6 cards in the set. Once you
              begin declaring, you cannot take it back.
            </p>
            <p>
              If every card is assigned to the correct player, your team scores the set.
              If any assignment is wrong, it&apos;s a misdeclare.
            </p>
            <p>
              If you have no legal asks available (for example, all opponents are out
              of cards in your sets), you must declare.
            </p>
          </section>

          {/* Misdeclares */}
          <section className="rounded-2xl border border-white/[0.04] bg-white/[0.02] px-6 py-5 space-y-3">
            <h2 className="text-lg text-gray-200" style={{ fontFamily: "var(--font-display)" }}>
              Misdeclares
            </h2>
            <p>
              What happens on a misdeclare depends on the game settings:
            </p>
            <div className="space-y-2 mt-2">
              <div>
                <span className="text-gray-300 font-medium">Default:</span>
                <span className="ml-1">The opposing team scores the set and chooses who goes next.</span>
              </div>
              <div>
                <span className="text-gray-300 font-medium">Nullify Misdeclare:</span>
                <span className="ml-1">
                  If your team held all 6 cards but assigned them to the wrong teammates,
                  the set is nullified — no one scores it. Play continues from the current turn.
                </span>
              </div>
              <div>
                <span className="text-gray-300 font-medium">No Turn on Misdeclare:</span>
                <span className="ml-1">
                  The opposing team still scores, but play continues from the current turn
                  instead of the opponents choosing.
                </span>
              </div>
            </div>
          </section>

          {/* Choosing Turn */}
          <section className="rounded-2xl border border-white/[0.04] bg-white/[0.02] px-6 py-5 space-y-3">
            <h2 className="text-lg text-gray-200" style={{ fontFamily: "var(--font-display)" }}>
              Choosing the Next Turn
            </h2>
            <p>
              After a set is scored (either by correct declaration or opponent misdeclare),
              the winning team chooses which of their players takes the next turn.
              Only players who still have cards can be chosen.
            </p>
          </section>

          {/* Winning */}
          <section className="rounded-2xl border border-white/[0.04] bg-white/[0.02] px-6 py-5 space-y-3">
            <h2 className="text-lg text-gray-200" style={{ fontFamily: "var(--font-display)" }}>
              Winning
            </h2>
            <p>
              The first team to win 5 out of 9 sets wins the game. With the
              &ldquo;Play All Sets&rdquo; setting enabled, the game continues until all
              9 sets are declared.
            </p>
          </section>

          {/* Settings */}
          <section className="rounded-2xl border border-white/[0.04] bg-white/[0.02] px-6 py-5 space-y-3">
            <h2 className="text-lg text-gray-200" style={{ fontFamily: "var(--font-display)" }}>
              Game Settings
            </h2>
            <div className="space-y-3 mt-2">
              <div>
                <span className="text-gray-300 font-medium">Team Declare:</span>
                <span className="ml-1">
                  Any teammate can declare on their team&apos;s turn, not just the turn player.
                </span>
              </div>
              <div>
                <span className="text-gray-300 font-medium">Nullify Misdeclare:</span>
                <span className="ml-1">
                  Misdeclares where your team held all cards are nullified instead of
                  going to the opponent.
                </span>
              </div>
              <div>
                <span className="text-gray-300 font-medium">No Turn on Misdeclare:</span>
                <span className="ml-1">
                  Opponent scores the misdeclared set but doesn&apos;t get to choose the next turn.
                </span>
              </div>
              <div>
                <span className="text-gray-300 font-medium">Play All Sets:</span>
                <span className="ml-1">
                  Game continues until all 9 sets are declared, not just first to 5.
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}