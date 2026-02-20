import { useState, useRef, useEffect } from 'react'
import { useProject } from '../contexts/ProjectContext'
import { useTranslation } from 'react-i18next'
import { FolderIcon, ChevronDownIcon } from './Icons'

export default function ProjectSelector() {
  const { t } = useTranslation()
  const { currentProject, projects, setCurrentProject } = useProject()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Hide if only 1 project
  if (projects.length <= 1) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors max-w-[200px]"
      >
        <FolderIcon className="w-4 h-4 shrink-0" />
        <span className="truncate">{currentProject?.name || t('project.select')}</span>
        <ChevronDownIcon className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => { setCurrentProject(p); setOpen(false) }}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                currentProject?.id === p.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
