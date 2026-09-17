import { SearchX } from "lucide-react";

interface RecordNotFoundProps {
  title: string;
  message: string;
}

export function RecordNotFound({ title, message }: RecordNotFoundProps) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-6 text-center sm:p-10">
      <SearchX aria-hidden className="mx-auto size-10 text-navy" />
      <h1 className="mt-4 text-h1 font-bold">{title}</h1>
      <p className="mx-auto mt-2 max-w-md">{message}</p>
    </div>
  );
}
