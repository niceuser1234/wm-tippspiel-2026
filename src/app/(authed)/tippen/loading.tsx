import { Skeleton } from "@/components/ui/skeleton";

export default function TippenLoading() {
  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-8 w-32 rounded-xl" />
        <Skeleton className="h-4 w-48 rounded-xl" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
    </div>
  );
}
