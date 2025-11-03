import React from "react";


export default function ScrollView({ children }: { children: React.ReactNode }) {
return (
<div className="h-[calc(100vh-57px)] w-full overflow-auto bg-gradient-to-b from-white to-gray-50">
{children}
</div>
);
}