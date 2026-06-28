import { useLayoutEffect, useRef, useState } from 'react'

type ScaledLayout = {
  scale: number
  width: number
  height: number
}

type WorksheetPreviewScalerProps = {
  children: React.ReactNode
  measureKey: string
}

export function WorksheetPreviewScaler({ children, measureKey }: WorksheetPreviewScalerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<ScaledLayout>({ scale: 1, width: 0, height: 0 })

  useLayoutEffect(() => {
    const container = containerRef.current
    const content = contentRef.current
    if (!container || !content) return

    function measure() {
      const available = container.clientWidth
      const naturalWidth = content.offsetWidth
      const naturalHeight = content.offsetHeight
      if (available === 0 || naturalWidth === 0) return

      const scale = Math.min(1, available / naturalWidth)
      setLayout({
        scale,
        width: naturalWidth * scale,
        height: naturalHeight * scale,
      })
    }

    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(container)
    observer.observe(content)

    return () => observer.disconnect()
  }, [measureKey])

  return (
    <div ref={containerRef} className="w-full overflow-x-hidden">
      <div
        className="mx-auto overflow-hidden"
        style={{
          width: layout.width > 0 ? layout.width : undefined,
          height: layout.height > 0 ? layout.height : undefined,
        }}
      >
        <div
          ref={contentRef}
          className="inline-block origin-top-left"
          style={{ transform: `scale(${layout.scale})` }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
