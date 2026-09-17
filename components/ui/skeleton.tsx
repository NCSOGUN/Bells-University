function Block({ className }: { className: string }) {
  return <div className={`rounded-2xl bg-line/70 ${className}`} />;
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
