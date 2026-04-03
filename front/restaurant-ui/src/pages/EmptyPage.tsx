type Props = {
  title?: string;
};

export default function EmptyPage({ title = "Coming soon" }: Props) {
  return (
    <div className="mx-auto w-full max-w-[1480px] px-4 py-10 lg:px-6">
      <div className="rs-empty-state text-center">
        <div className="font-display text-2xl font-semibold text-[var(--foreground)]">
          {title}
        </div>
        <div className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
          This section is still being redesigned, but the app shell and theme system are already in place.
        </div>
      </div>
    </div>
  );
}
