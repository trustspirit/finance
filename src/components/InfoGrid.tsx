interface InfoItem {
  label: string
  value: string | React.ReactNode
}

interface Props {
  items: InfoItem[]
  className?: string
}

export default function InfoGrid({ items, className = '' }: Props) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm ${className}`}>
      {items.map((item, i) => (
        <div key={i}>
          <span className="text-gray-500">{item.label}:</span> {item.value}
        </div>
      ))}
    </div>
  )
}
