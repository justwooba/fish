import Link from "next/link";

interface NavProps {
  showHome?: boolean;
}

export default function Nav({ showHome }: NavProps) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 py-3">
      <div>
        {showHome && (
          <Link
            href="/"
            className="text-sm text-gray-600 hover:text-gray-300 transition-colors"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Fish
          </Link>
        )}
      </div>
      <div className="flex items-center gap-4">
        <Link
          href="/tutorial"
          className="text-xs text-amber-500/70 hover:text-amber-400 transition-colors"
        >
          Tutorial
        </Link>
        <Link
          href="/rules"
          className="text-xs text-gray-600 hover:text-gray-300 transition-colors"
        >
          Rules
        </Link>
        <Link
          href="/about"
          className="text-xs text-gray-600 hover:text-gray-300 transition-colors"
        >
          About
        </Link>
      </div>
    </nav>
  );
}