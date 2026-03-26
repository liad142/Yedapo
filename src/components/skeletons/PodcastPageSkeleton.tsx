import { Skeleton } from '@/components/ui/skeleton';

export function PodcastPageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Back button */}
        <Skeleton className="h-9 w-32 mb-6" />

        {/* Immersive header */}
        <div className="rounded-3xl bg-slate-900 p-8 md:p-12 mb-8">
          <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
            <Skeleton className="w-48 h-48 md:w-56 md:h-56 rounded-2xl shrink-0" />
            <div className="flex-1 space-y-4 w-full">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-6 w-16" />
              </div>
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        </div>

        {/* Episodes section */}
        <Skeleton className="h-7 w-32 mb-6" />
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
