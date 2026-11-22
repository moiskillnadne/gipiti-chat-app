import { Skeleton } from "@/components/ui/skeleton";

const SKELETON_ROW_KEYS = [1, 2, 3, 4, 5];

/** Loading state of TokenHistoryTable: the phone list below lg, the table from lg up. */
export function TokenHistorySkeleton() {
  return (
    <div className="space-y-4">
      <div className="divide-y lg:hidden">
        {SKELETON_ROW_KEYS.map((key) => (
          <div
            className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 py-3"
            key={key}
          >
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="col-span-2 h-4 w-40" />
          </div>
        ))}
      </div>
      <div className="hidden rounded-lg border lg:block">
        <div className="bg-muted/50 px-4 py-3">
          <div className="flex gap-8">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
        {SKELETON_ROW_KEYS.map((key) => (
          <div className="border-t px-4 py-3" key={key}>
            <div className="flex gap-8">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
