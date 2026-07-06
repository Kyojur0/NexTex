import { WebGLShader } from "@/components/ui/web-gl-shader";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import { ArrowRight } from "lucide-react";

export default function App() {
  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-black">
      <WebGLShader />

      <div className="relative z-10 w-full px-6">
        <div className="mx-auto w-full max-w-3xl border border-white/10 bg-black/40 p-2 backdrop-blur-xl">
          <main className="relative border border-white/10 px-6 py-16 md:px-12 md:py-24">
            <div className="mb-6 flex items-center justify-center gap-2">
              <span className="relative flex h-3 w-3 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              <p className="text-xs font-medium tracking-wide text-emerald-400">
                Available for New Projects
              </p>
            </div>

            <h1 className="mb-5 text-center text-5xl font-extrabold tracking-tighter text-white md:text-7xl lg:text-8xl">
              LaTeX,
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-400">
                reimagined.
              </span>
            </h1>

            <p className="mx-auto max-w-xl text-center text-sm leading-relaxed text-white/50 md:text-base">
              NexTex is a modern LaTeX workspace — visual block editing, live
              PDF preview, and AI-assisted writing in one beautiful,
              minimal app.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <LiquidButton
                className="group rounded-full border border-white/20 px-8 text-white"
                size="xl"
              >
                <span className="flex items-center gap-2">
                  Try the demo
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </LiquidButton>

              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/10 bg-white/5 px-8 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                View on GitHub
              </a>
            </div>

            <div className="mx-auto mt-14 grid max-w-lg grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              {[
                { label: "Visual Blocks", value: "∞" },
                { label: "Live Preview", value: "0ms" },
                { label: "AI Power", value: "24/7" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="flex flex-col items-center justify-center px-4 py-5"
                >
                  <span className="text-xl font-bold text-white md:text-2xl">
                    {stat.value}
                  </span>
                  <span className="mt-1 text-[10px] uppercase tracking-wider text-white/40">
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
          </main>
        </div>

        <footer className="mt-8 text-center text-xs text-white/30">
          Built with Next.js, Tailwind, FastAPI, and Three.js.
        </footer>
      </div>
    </div>
  );
}
