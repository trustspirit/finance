import { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react'
import { useTranslation } from 'react-i18next'

export interface SignaturePadRef {
  clear: () => void
}

interface Props {
  width?: number
  height?: number
  initialData?: string
  onChange?: (dataUrl: string) => void
}

const SignaturePad = forwardRef<SignaturePadRef, Props>(function SignaturePad({ width = 400, height = 150, initialData, onChange }, ref) {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [isEmpty, setIsEmpty] = useState(!initialData)
  const initializedRef = useRef(false)

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    return ctx
  }, [])

  // Initialize canvas once on mount (or when dimensions change)
  useEffect(() => {
    const ctx = getCtx()
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    initializedRef.current = false
  }, [getCtx, width, height])

  // Load initial data only once
  useEffect(() => {
    if (initializedRef.current || !initialData) return
    const ctx = getCtx()
    if (!ctx) return
    const img = new Image()
    img.onload = () => {
      const currentCtx = getCtx()
      if (currentCtx) currentCtx.drawImage(img, 0, 0)
      initializedRef.current = true
    }
    img.src = initialData
  }, [getCtx, initialData])

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = width / rect.width
    const scaleY = height / rect.height

    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const ctx = getCtx()
    if (!ctx) return
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    setIsDrawing(true)
    setIsEmpty(false)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (!isDrawing) return
    const ctx = getCtx()
    if (!ctx) return
    const pos = getPos(e)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
  }

  const endDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    setIsDrawing(false)
    if (onChange && canvasRef.current) {
      onChange(canvasRef.current.toDataURL('image/png'))
    }
  }

  const clear = () => {
    const ctx = getCtx()
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    setIsEmpty(true)
    onChange?.('')
  }

  useImperativeHandle(ref, () => ({ clear }), [clear]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="border border-gray-300 rounded inline-block" style={{ touchAction: 'none' }}>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="cursor-crosshair"
          style={{ width: '100%', maxWidth: width, height: 'auto', aspectRatio: `${width}/${height}` }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
      </div>
      {isEmpty && <p className="text-xs text-gray-400 mt-1">{t('approval.signDescription')}</p>}
    </div>
  )
})

export default SignaturePad
