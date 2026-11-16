"use client";

import { useFormStatus } from "react-dom";
import { LoaderCircle, LogOut } from "lucide-react";

export function SignOutButton({ className }: { className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? <LoaderCircle aria-hidden="true" size={16} className="animate-spin" /> : <LogOut aria-hidden="true" size={16} />}
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
