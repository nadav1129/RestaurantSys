// File: src/pages/HomePage.tsx
import React, { useState } from "react";
import Button from "../components/Button";

type Props = {
  title?: string;             // optional title, defaults to "Home"
  onStart?: () => void;       // optional callbacks
  onEnd?: () => void;
};

export default function HomePage({
  title = "Home",
  onStart,
  onEnd,
}: Props) {
  const [brief, setBrief] = useState("");

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h2 className="mb-3 text-2xl font-semibold tracking-tight">{title}</h2>

      <div className="mb-4 flex gap-2">
        <Button
          onClick={onStart}
          type="button"
          variant="primary"
        >
          Start Shift
        </Button>

        <Button
          onClick={onEnd}
          type="button"
          variant="ghost"
        >
          End Shift
        </Button>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="mb-2 text-sm font-semibold text-gray-700">Brief</div>
        <textarea
          className="min-h-[120px] w-full resize-y rounded-xl border border-gray-300 p-3 text-sm"
          placeholder="Notes for the shift..."
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
        />
      </div>
    </div>
  );
}
