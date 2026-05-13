export function SkeletonLoader() {
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header Skeleton */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="h-8 bg-gray-200 rounded-md w-3/4 animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded-md w-1/2 mt-2 animate-pulse"></div>
      </div>

      {/* Progress Bar Skeleton */}
      <div className="px-6 py-4">
        <div className="flex items-center justify-between mb-2">
          <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-gray-300 rounded-full animate-pulse" style={{ width: '40%' }}></div>
        </div>
      </div>

      {/* Question Section Skeleton */}
      <div className="flex-1 px-6 py-6">
        {/* Question Number */}
        <div className="h-5 bg-gray-200 rounded w-32 mb-4 animate-pulse"></div>

        {/* Question Text */}
        <div className="space-y-3 mb-8">
          <div className="h-5 bg-gray-200 rounded w-full animate-pulse"></div>
          <div className="h-5 bg-gray-200 rounded w-5/6 animate-pulse"></div>
          <div className="h-5 bg-gray-200 rounded w-4/5 animate-pulse"></div>
        </div>

        {/* Options Skeleton */}
        <div className="space-y-4">
          {['A', 'B', 'C', 'D'].map((option, index) => (
            <div
              key={option}
              className="flex items-start gap-3 p-4 border-2 border-gray-200 rounded-lg animate-pulse"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="w-6 h-6 bg-gray-200 rounded-full flex-shrink-0"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Navigation Skeleton */}
      <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
        <div className="h-12 bg-gray-200 rounded-lg flex-1 animate-pulse"></div>
        <div className="h-12 bg-gray-200 rounded-lg flex-1 animate-pulse"></div>
      </div>

      {/* Timer Skeleton (floating) */}
      <div className="absolute top-20 right-6">
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-lg border border-gray-200">
          <div className="w-5 h-5 bg-gray-200 rounded-full animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-12 animate-pulse"></div>
        </div>
      </div>
    </div>
  );
}
