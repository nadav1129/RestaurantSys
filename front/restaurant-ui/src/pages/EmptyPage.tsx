import React from "react";

type Props = {
  title?: string;
};

export default function EmptyPage({ title = "Coming soon" }: Props) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-gray-500">
        <div className="text-xl font-semibold mb-2">{title}</div>
        <div>This section isn’t implemented yet.</div>
      </div>
    </div>
  );
}
