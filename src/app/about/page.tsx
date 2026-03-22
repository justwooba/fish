import Nav from "@/components/ui/Nav";

export default function AboutPage() {
  return (
    <main className="min-h-dvh flex flex-col items-center px-4 py-16">
      <Nav showHome />

      <div className="w-full max-w-2xl space-y-8 mt-8">
        <div className="text-center">
          <h1
            className="text-4xl font-normal tracking-tight mb-2"
            style={{ fontFamily: "var(--font-display)" }}
          >
            About
          </h1>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-white/[0.04] bg-white/[0.02] px-6 py-5 space-y-3">
            <h2 className="text-lg text-gray-200" style={{ fontFamily: "var(--font-display)" }}>
              What is Fish?
            </h2>
            <p className="text-sm text-gray-400 leading-relaxed">
              Fish (also known as Literature or Canadian Fish) is a team card game
              that combines elements of Go Fish with strategic deduction. Unlike most
              card games, Fish rewards communication, memory, and teamwork over luck.
            </p>

          </section>

          <section className="rounded-2xl border border-white/[0.04] bg-white/[0.02] px-6 py-5 space-y-3">
            <h2 className="text-lg text-gray-200" style={{ fontFamily: "var(--font-display)" }}>
              This App
            </h2>
            <p className="text-sm text-gray-400 leading-relaxed">
              Immediately prior to the creation of this web app, its creator had just returned from a weeklong trip
              to Finland. Upon landing in America, he was immediately struck by an depression uncurable by no means
              other than Fish. He decided to take matters into his own hands, and hence this web app was born.
            </p>
            <p className="text-sm text-gray-400 leading-relaxed">
              Built with Next.js, Supabase, and Tailwind CSS. Deployed on Vercel. If there are bugs, it is due to the
              creator not knowing how APIs work.
            </p>
          </section>

          <section className="rounded-2xl border border-white/[0.04] bg-white/[0.02] px-6 py-5 space-y-3">
            <h2 className="text-lg text-gray-200" style={{ fontFamily: "var(--font-display)" }}>
              Credits
            </h2>
            <p className="text-sm text-gray-400 leading-relaxed">
              Built by Wooba Song &apos;26. Inspired by leipajuusto and cloudberry jam.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}