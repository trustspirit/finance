import { ChevronDownIcon } from './Icons'

type SelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'className'> & {
  label?: string
  wrapperClassName?: string
  selectClassName?: string
}

export default function Select({ label, wrapperClassName = '', selectClassName = '', children, ...props }: SelectProps) {
  return (
    <div className={wrapperClassName}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <div className="relative">
        <select
          {...props}
          className={`appearance-none border border-gray-300 rounded pl-3 pr-9 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-400 ${selectClassName}`}
        >
          {children}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      </div>
    </div>
  )
}
