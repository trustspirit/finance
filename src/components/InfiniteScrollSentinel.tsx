import { useEffect, useRef } from 'react'

interface Props {
  hasNextPage: boolean | undefined
  isFetchingNextPage: boolean
  fetchNextPage: () => void
  rootRef?: React.RefObject<HTMLElement | null>
}

export default function InfiniteScrollSentinel({ hasNextPage, isFetchingNextPage, fetchNextPage, rootRef }: Props) {
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { root: rootRef?.current ?? null, rootMargin: '100px' },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, rootRef])

  if (!hasNextPage) return null

  return (
    <div ref={sentinelRef} className="flex justify-center py-4">
      {isFetchingNextPage && (
        <div className="w-5 h-5 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
      )}
    </div>
  )
}
