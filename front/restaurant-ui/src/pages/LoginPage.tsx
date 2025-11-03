import React, { useState } from "react";
import Button from "../components/Button";


export default function LoginPage() {
const [profiles, setProfiles] = useState([
{ id: "w1", name: "Alice Cohen" },
{ id: "w2", name: "Ben Levi" },
{ id: "w3", name: "Dana Azulay" },
]);
const [selected, setSelected] = useState<string>("");
const [pin, setPin] = useState<string>("");
const [step, setStep] = useState<1 | 2>(1);


const [creating, setCreating] = useState(false);
const [newName, setNewName] = useState("");
const [newPin, setNewPin] = useState("");


const submit = () => {
if (step === 1 && selected) setStep(2);
else if (step === 2 && /^\d{4}$/.test(pin)) alert(`Login OK for ${profiles.find(p=>p.id===selected)?.name}`);
};


const createProfile = () => {
if (!newName || !/^\d{4}$/.test(newPin)) return;
const id = `w${Math.random().toString(36).slice(2,7)}`;
setProfiles((prev) => [...prev, { id, name: newName }]);
setSelected(id);
setStep(2);
setCreating(false);
};


return (
<div className="mx-auto max-w-md px-4 py-10">
<div className="mb-6 text-center text-2xl font-semibold">Login</div>
{step === 1 ? (
<div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6">
<div className="flex items-center justify-between">
<div className="text-sm text-gray-700">Choose profile</div>
<Button type="ghost" onClick={()=> setCreating((c)=>!c)}>{creating?"Cancel":"Create new"}</Button>
</div>
{!creating ? (
<div className="grid grid-cols-1 gap-2">
{profiles.map((p) => (
<label key={p.id} className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 ${selected===p.id?"border-indigo-600 bg-indigo-50":"border-gray-200 hover:bg-gray-50"}`}>
<span className="text-gray-800">{p.name}</span>
<input type="radio" name="profile" checked={selected===p.id} onChange={()=>setSelected(p.id)} />
</label>
))}
</div>
) : (
<div className="space-y-3">
<input
className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm"
placeholder="Full name"
value={newName}
onChange={(e)=>setNewName(e.target.value)}
/>
<input
className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm"
inputMode="numeric"
placeholder="4-digit PIN"
value={newPin}
maxLength={4}
onChange={(e)=>setNewPin(e.target.value.replace(/[^0-9]/g, "").slice(0,4))}
/>
<div className="text-right">
<Button onClick={createProfile} disabled={!newName || !/^\d{4}$/.test(newPin)}>Create</Button>
</div>
</div>
)}
{!creating && (
<div className="pt-2 text-right">
<Button onClick={submit} disabled={!selected}>Continue</Button>
</div>
)}
</div>
) : (
<div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6">
<div className="text-sm text-gray-700">Enter 4‑digit PIN</div>
<input
inputMode="numeric"
pattern="\\d*"
maxLength={4}
value={pin}
onChange={(e)=> setPin(e.target.value.replace(/[^0-9]/g, "").slice(0,4))}
className="w-full rounded-xl border border-gray-300 px-4 py-3 text-center text-2xl tracking-widest"
placeholder="••••"
/>
<div className="flex items-center justify-between">
<Button type="ghost" onClick={()=>{ setStep(1); setPin(""); }}>Back</Button>
<Button onClick={submit} disabled={!/^\d{4}$/.test(pin)}>Login</Button>
</div>
</div>
)}
</div>
);
}