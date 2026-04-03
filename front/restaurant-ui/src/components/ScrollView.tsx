import React from "react";


export default function ScrollView({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-transparent">
      <div className="min-h-full">{children}</div>
    </div>
  );
}
