import { ArrowLeftRight } from "lucide-react";

export function BrandMark() {
  return (
    <span
      aria-hidden="true"
      className="flex size-10 items-center justify-center rounded-xl bg-emerald-800 text-white shadow-sm"
    >
      <ArrowLeftRight size={20} strokeWidth={2.2} />
    </span>
  );
}
