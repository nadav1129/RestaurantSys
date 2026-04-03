import { createElement, useState } from "react";
import Button from "../components/Button";
import { SparklesIcon } from "../components/icons";

type LandingPageProps = {
  onContinue: () => void;
};

export default function LandingPage({ onContinue }: LandingPageProps) {
  const [tabletName, setTabletName] = useState("");

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-app px-6 py-10 text-[var(--foreground)]">
      <div className="absolute inset-0">
        {createElement("spline-viewer", {
          url: "https://prod.spline.design/HB-rf3G5ZuE7DPLy/scene.splinecode",
          className: "h-full w-full scale-[1.08] opacity-90",
        })}
      </div>

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(7,12,24,0.18),rgba(7,12,24,0.48))]" />

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8%] top-[-10%] h-72 w-72 rounded-full bg-[color:color-mix(in_srgb,var(--accent)_55%,transparent)] blur-3xl" />
        <div className="absolute bottom-[-14%] right-[-6%] h-80 w-80 rounded-full bg-[color:color-mix(in_srgb,var(--primary)_20%,transparent)] blur-3xl" />
      </div>

      <section className="rs-surface relative z-10 w-full max-w-xl bg-[color:color-mix(in_srgb,var(--card)_88%,rgba(10,15,28,0.28))] p-8 sm:p-10">
        <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-[1.4rem] bg-[var(--accent)] text-[var(--accent-foreground)]">
          <SparklesIcon className="h-6 w-6" />
        </div>

        <div className="space-y-4">
          <div className="rs-eyebrow">RestaurantSys</div>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-[var(--foreground)] sm:text-5xl">
            Welcome
          </h1>
          <p className="max-w-md text-base leading-7 text-[var(--muted-foreground)]">
            Enter the tablet name for this device, then continue into the main
            application.
          </p>
        </div>

        <div className="mt-8 space-y-3">
          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
              Tablet Name
            </span>
            <input
              className="rs-input"
              value={tabletName}
              onChange={(e) => setTabletName(e.target.value)}
              placeholder="Tablet 01"
            />
          </label>
          <div className="text-sm text-[var(--muted-foreground)]">
            UI only for now. The tablet name is not saved yet.
          </div>
        </div>

        <div className="mt-8">
          <Button size="lg" className="min-w-[180px]" onClick={onContinue}>
            Continue
          </Button>
        </div>
      </section>
    </main>
  );
}
