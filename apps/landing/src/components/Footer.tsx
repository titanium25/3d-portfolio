import { Gamepad2 } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-border-subtle py-8 px-6">
      <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="font-mono text-xs text-text-dim">
          &copy; 2026 Alexander Lazarovich &middot; Built with TypeScript, React
          &amp; Three.js
        </p>
        <a
          href="/explore"
          className="flex items-center gap-2 font-mono text-xs text-text-dim hover:text-accent-cyan transition-colors"
        >
          <Gamepad2 size={14} />
          Experience the 3D version &rarr;
        </a>
      </div>
    </footer>
  );
}
