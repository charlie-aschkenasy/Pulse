import { Suspense } from 'react'
import { MatrixContent } from './matrix-content'
import { Skeleton } from '@/components/ui/skeleton'

export default function MatrixPage() {
  return (
    <Suspense fallback={<MatrixSkeleton />}>
      <MatrixContent />
    </Suspense>
  )
}

function MatrixSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[calc(100vh-200px)]">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="rounded-lg" />
        ))}
      </div>
    </div>
  )
}
