"use client";

type HeaderProps = {
  bulletCount: number;
};

export function Header({ bulletCount }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/20 font-bold text-white tracking-wider text-base">
            J
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white">
                JATA
              </span>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Studio AI
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Job Application Tailoring Assistant
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {bulletCount > 0 && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-zinc-400">Bank:</span>
              <span className="font-semibold text-zinc-200">
                {bulletCount} Bullets
              </span>
            </div>
          )}
          <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 flex items-center gap-1.5">
            <span>Demo limit: 10 gen / hr</span>
          </span>
          <span className="hidden sm:inline-flex text-xs font-medium px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400">
            ⚡ Gemini Powered
          </span>
        </div>
      </div>
    </header>
  );
}
