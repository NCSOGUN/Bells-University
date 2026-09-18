function Block({ className }: { className: string }) {
  return (
    <div
      className={`rounded-2xl bg-line/70 bg-[linear-gradient(100deg,transparent_20%,rgba(255,255,255,0.65)_40%,transparent_60%)] bg-[length:200%_100%] motion-safe:animate-shimmer ${className}`}
    />
  );
}

/** Placeholder shown until saved demo state has been read in the browser. */
export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="space-y-4">
      <Block className="h-6 w-40" />
      <Block className="h-48" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Block className="h-40" />
        <Block className="h-40" />
      </div>
      <Block className="h-64" />
    </div>
  );
}
