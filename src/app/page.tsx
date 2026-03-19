import { CreateRoomButton, JoinRoomForm } from "@/components/home";
import { SuitSpade, SuitHeart, SuitDiamond, SuitClub } from "@/components/icons/Suits";

export default function Home() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-4 py-16 relative overflow-hidden">
      {/* ── Floating suit decorations ──────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <SuitSpade className="absolute top-[12%] left-[8%] w-8 h-8 text-white/[0.03] animate-float" />
        <SuitHeart className="absolute top-[20%] right-[12%] w-10 h-10 text-amber-500/[0.05] animate-float delay-2" />
        <SuitDiamond className="absolute bottom-[25%] left-[15%] w-6 h-6 text-white/[0.03] animate-float delay-4" />
        <SuitClub className="absolute bottom-[18%] right-[10%] w-9 h-9 text-amber-500/[0.04] animate-float delay-1" />
        <SuitHeart className="absolute top-[45%] left-[5%] w-5 h-5 text-white/[0.02] animate-float delay-3" />
        <SuitSpade className="absolute top-[60%] right-[7%] w-7 h-7 text-white/[0.03] animate-float delay-5" />
      </div>

      {/* ── Content ───────────────────────────────────────────────────── */}
      <div className="w-full max-w-sm flex flex-col items-center gap-12 relative z-10">

        {/* ── Title ─────────────────────────────────────────────────── */}
        <div className="text-center animate-fade-up">
          <h1
            className="text-7xl font-normal tracking-tight mb-3"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Fish
          </h1>
          <p className="text-[var(--color-text-muted)] text-base leading-relaxed">
            The six-player team card game
          </p>
        </div>

        {/* ── Actions ───────────────────────────────────────────────── */}
        <div className="w-full flex flex-col gap-6 animate-fade-up delay-2">
          <CreateRoomButton />

          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-white/[0.06]" />
            <span className="text-xs text-gray-600 uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>

          <JoinRoomForm />
        </div>

        {/* ── Description ───────────────────────────────────────────── */}
        <div className="animate-fade-up delay-4">
          <div
            className="
              rounded-2xl border border-white/[0.04]
              bg-white/[0.02]
              px-6 py-5
              space-y-3
            "
          >
            <h2
              className="text-lg text-gray-200"
              style={{ fontFamily: "var(--font-display)" }}
            >
              How it works
            </h2>
            <div className="space-y-2 text-sm text-gray-500 leading-relaxed">
              <p>
                Two teams of three compete to collect sets of cards.
                The 54-card deck is split into nine sets of six cards each.
              </p>
              <p>
                On your turn, ask an opponent for a specific card &mdash;
                but you must already hold one from the same set. If they have it,
                you keep going. If not, the turn passes to them.
              </p>
              <p>
                When your team has a complete set, declare it for a point.
                First team to five sets wins.
              </p>
            </div>
          </div>
        </div>

        {/* ── Footer ────────────────────────────────────────────────── */}
        <div className="text-center animate-fade-in delay-5 space-y-1">
          <p className="text-xs text-gray-700">
            Built by Wooba Song '26
          </p>
        </div>
      </div>
    </main>
  );
}