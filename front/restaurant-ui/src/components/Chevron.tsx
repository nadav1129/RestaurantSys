import React from "react";


export default function Chevron({ open }: { open: boolean }) {
return (
<svg viewBox="0 0 20 20" className={`h-4 w-4 transition-transform ${open ? "rotate-90" : "rotate-0"}`}>
<path d="M7 5l6 5-6 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
</svg>
);
}