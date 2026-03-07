export function TrajectoryCardSkeleton() {
  return (
    <div
      className="rounded-xl bg-card animate-pulse flex flex-col p-4"
      style={{ height: "55vh" }}
    >
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-3">
        <div className="h-5 w-32 rounded bg-border/30" />
        <div className="h-5 w-16 rounded-full bg-border/30" />
      </div>
      {/* Graph area skeleton */}
      <div className="flex-1 rounded-lg bg-border/10" />
      {/* Button skeleton */}
      <div className="mt-3 h-11 w-full rounded-lg bg-border/20" />
    </div>
  );
}
