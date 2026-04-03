import Button from "../components/Button";
import { SparklesIcon } from "../components/icons";

type LandingPageProps = {
  onContinue: () => void;
};

export default function LandingPage({ onContinue }: LandingPageProps) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-app px-6 py-10 text-[var(--foreground)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8%] top-[-10%] h-72 w-72 rounded-full bg-[color:color-mix(in_srgb,var(--accent)_65%,transparent)] blur-3xl" />
        <div className="absolute bottom-[-14%] right-[-6%] h-80 w-80 rounded-full bg-[color:color-mix(in_srgb,var(--primary)_22%,transparent)] blur-3xl" />
      </div>

      <section className="rs-surface relative w-full max-w-xl p-8 sm:p-10">
        <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-[1.4rem] bg-[var(--accent)] text-[var(--accent-foreground)]">
          <SparklesIcon className="h-6 w-6" />
        </div>

        <div className="space-y-4">
          <div className="rs-eyebrow">RestaurantSys</div>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-[var(--foreground)] sm:text-5xl">
            Welcome
          </h1>
          <p className="max-w-md text-base leading-7 text-[var(--muted-foreground)]">
            Temporary landing page for the current build. Continue to enter the
            main application.
          </p>
        </div>

        <div className="mt-10">
          <Button size="lg" className="min-w-[180px]" onClick={onContinue}>
            Continue
          </Button>
        </div>
      </section>
    </main>
  );
}
