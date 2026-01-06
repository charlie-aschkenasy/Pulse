'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { searchTasks } from '@/app/actions/tasks'
import { Search, Loader2, Calendar, CheckCircle2, Circle, Clock } from 'lucide-react'
import type { TaskWithProject } from '@/types/database'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

const RECENT_SEARCHES_KEY = 'pulse-recent-searches'
const MAX_RECENT_SEARCHES = 5

interface SearchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SearchModal({ open, onOpenChange }: SearchModalProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TaskWithProject[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'completed'>('all')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Load recent searches on mount
  useEffect(() => {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY)
    if (stored) {
      try {
        setRecentSearches(JSON.parse(stored))
      } catch {
        // Ignore invalid JSON
      }
    }
  }, [])

  // Save recent search
  const saveRecentSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) return

    setRecentSearches((prev) => {
      const filtered = prev.filter((s) => s !== searchQuery)
      const updated = [searchQuery, ...filtered].slice(0, MAX_RECENT_SEARCHES)
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  // Perform search with debounce
  const performSearch = useCallback(
    async (searchQuery: string, filter: 'all' | 'open' | 'completed') => {
      if (!searchQuery.trim()) {
        setResults([])
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      const { data, error } = await searchTasks(searchQuery, { status: filter })

      if (!error && data) {
        setResults(data)
      } else {
        setResults([])
      }
      setIsLoading(false)
    },
    []
  )

  // Debounced search effect
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (!query.trim()) {
      setResults([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    debounceRef.current = setTimeout(() => {
      performSearch(query, statusFilter)
    }, 300)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [query, statusFilter, performSearch])

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [results])

  // Navigate to task
  const navigateToTask = useCallback(
    (task: TaskWithProject) => {
      saveRecentSearch(query)
      onOpenChange(false)
      router.push(`/tasks/${task.id}`)
    },
    [query, router, onOpenChange, saveRecentSearch]
  )

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault()
        navigateToTask(results[selectedIndex])
      } else if (e.key === 'Escape') {
        onOpenChange(false)
      }
    },
    [results, selectedIndex, navigateToTask, onOpenChange]
  )

  // Use recent search
  const useRecentSearch = (searchQuery: string) => {
    setQuery(searchQuery)
    inputRef.current?.focus()
  }

  // Highlight matching text
  const highlightMatch = (text: string, searchQuery: string) => {
    if (!searchQuery.trim()) return text

    const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = text.split(regex)

    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-primary/20 text-primary rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    )
  }

  // Status icon
  const StatusIcon = ({ status }: { status: string }) => {
    if (status === 'completed') {
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    }
    return <Circle className="h-4 w-4 text-muted-foreground" />
  }

  // Priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-500/10 text-red-500 border-red-500/20'
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
      case 'low':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
      default:
        return ''
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[550px] p-0 gap-0 overflow-hidden"
        showCloseButton={false}
      >
        {/* Search header */}
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Search className="h-5 w-5 text-muted-foreground shrink-0" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search tasks..."
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-auto text-base"
          />
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as 'all' | 'open' | 'completed')}
          >
            <SelectTrigger className="w-[100px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results area */}
        <ScrollArea className="max-h-[400px]">
          {/* Recent searches - show when no query */}
          {!query.trim() && recentSearches.length > 0 && (
            <div className="p-3">
              <p className="text-xs text-muted-foreground mb-2 px-1">Recent searches</p>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((search, i) => (
                  <button
                    key={i}
                    onClick={() => useRecentSearch(search)}
                    className="text-xs px-2 py-1 rounded-md bg-muted hover:bg-muted/80 transition-colors"
                  >
                    {search}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Initial state */}
          {!query.trim() && recentSearches.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Start typing to search tasks</p>
              <p className="text-xs mt-1">Search by title across all your tasks</p>
            </div>
          )}

          {/* No results */}
          {query.trim() && !isLoading && results.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              <p className="text-sm">No tasks found for &quot;{query}&quot;</p>
              <p className="text-xs mt-1">Try a different search term</p>
            </div>
          )}

          {/* Results list */}
          {results.length > 0 && (
            <div className="p-2">
              {results.map((task, index) => (
                <button
                  key={task.id}
                  onClick={() => navigateToTask(task)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={cn(
                    'w-full text-left p-3 rounded-lg transition-colors',
                    index === selectedIndex ? 'bg-muted' : 'hover:bg-muted/50'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <StatusIcon status={task.status} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {highlightMatch(task.title, query)}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {task.project && (
                          <Badge
                            variant="outline"
                            className="text-xs"
                            style={{
                              borderColor: task.project.color || undefined,
                              color: task.project.color || undefined,
                            }}
                          >
                            {task.project.name}
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={cn('text-xs', getPriorityColor(task.priority))}
                        >
                          {task.priority}
                        </Badge>
                        {task.due_date && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(task.due_date), 'MMM d')}
                          </span>
                        )}
                        {task.duration_minutes && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {task.duration_minutes}m
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer with keyboard hints */}
        <div className="border-t px-4 py-2 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">↑</kbd>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Enter</kbd>
            open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Esc</kbd>
            close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
