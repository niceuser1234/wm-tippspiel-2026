import { Skeleton } from "@/components/ui/skeleton";

export default function UebersichtLoading() {
  return (
    <div className="px-4 py-6 max-w-xl mx-auto">
      <Skeleton className="h-8 w-36 rounded-xl mb-6" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
    </div>
  );
}
