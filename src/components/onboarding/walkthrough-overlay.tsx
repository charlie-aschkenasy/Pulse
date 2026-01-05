'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { X, Sparkles, ArrowRight, GripVertical, MousePointer2 } from 'lucide-react'
import { useWalkthrough, WalkthroughStep } from './walkthrough-context'

interface StepConfig {
  targetSelector: string | null
  title: string
  message: string
  position: 'top' | 'bottom' | 'left' | 'right' | 'center'
  showNextButton?: boolean
  icon?: React.ReactNode
  allowInteraction?: boolean
  requiredPath?: string
}

const stepConfigs: Record<WalkthroughStep, StepConfig> = {
  idle: {
    targetSelector: null,
    title: '',
    message: '',
    position: 'center',
  },
  welcome: {
    targetSelector: null,
    title: 'Welcome to Pulse!',
    message: "Let's take an interactive tour where you'll actually use the app. You'll create a task, move it around, and explore different views. Ready?",
    position: 'center',
    showNextButton: true,
    icon: <Sparkles className="h-8 w-8 text-primary" />,
  },
  'click-new-task': {
    targetSelector: '#tour-new-task-button',
    title: 'Create Your First Task',
    message: 'Click the "New Task" button to create a task.',
    position: 'bottom',
    icon: <MousePointer2 className="h-5 w-5" />,
    allowInteraction: true,
  },
  'fill-task-form': {
    targetSelector: '[data-walkthrough="task-modal"]',
    title: 'Fill in Task Details',
    message: 'Give your task a title (like "My First Task"), make sure "Daily" is selected, then click "Create Task".',
    position: 'right',
    allowInteraction: true,
  },
  'task-created': {
    targetSelector: '#tour-task-columns',
    title: 'Task Created!',
    message: "Your task now appears in the Daily column. Tasks are organized by timeframe.",
    position: 'top',
    showNextButton: true,
  },
  'drag-to-weekly': {
    targetSelector: '#tour-task-columns',
    title: 'Try Drag & Drop',
    message: 'Now drag your task from Daily to Weekly. Grab it by the handle on the left and drop it in the Weekly column.',
    position: 'top',
    icon: <GripVertical className="h-5 w-5" />,
    allowInteraction: true,
  },
  'task-moved': {
    targetSelector: '#tour-task-columns',
    title: 'Nice Work!',
    message: "You've moved the task to Weekly. This is how you reschedule tasks between timeframes.",
    position: 'top',
    showNextButton: true,
  },
  'click-projects': {
    targetSelector: '#tour-projects-link',
    title: 'Explore Projects',
    message: 'Projects help organize related tasks. Click "Projects" in the navigation.',
    position: 'bottom',
    icon: <MousePointer2 className="h-5 w-5" />,
    allowInteraction: true,
  },
  'on-projects': {
    targetSelector: null,
    title: 'Projects View',
    message: 'Here you can create projects and assign tasks to them. Each project can have its own color for easy identification.',
    position: 'center',
    showNextButton: true,
  },
  'click-matrix': {
    targetSelector: '#tour-matrix-link',
    title: 'Check Out the Matrix',
    message: 'The Covey Matrix helps prioritize tasks. Click "Matrix" to see it.',
    position: 'bottom',
    icon: <MousePointer2 className="h-5 w-5" />,
    allowInteraction: true,
  },
  'on-matrix': {
    targetSelector: null,
    title: 'Covey Matrix',
    message: 'Tasks are organized in 4 quadrants based on urgency and importance. Drag tasks between quadrants to re-prioritize.',
    position: 'center',
    showNextButton: true,
  },
  'click-task-detail': {
    targetSelector: null,
    title: 'Open Task Details',
    message: 'Click on your task to view its detail page where you can add rich notes.',
    position: 'center',
    icon: <MousePointer2 className="h-5 w-5" />,
    allowInteraction: true,
  },
  'on-task-detail': {
    targetSelector: '[data-walkthrough="notes-editor"]',
    title: 'Task Detail Page',
    message: 'This is the task detail page. You can see all task info and add detailed notes.',
    position: 'top',
    showNextButton: true,
  },
  'type-in-editor': {
    targetSelector: '[data-walkthrough="notes-editor"]',
    title: 'Try the Rich Editor',
    message: 'Click in the notes area and type something. Your notes auto-save!',
    position: 'top',
    allowInteraction: true,
  },
  'editor-typed': {
    targetSelector: '[data-walkthrough="notes-editor"]',
    title: 'Notes Saved!',
    message: 'Your notes are automatically saved. Now let\'s clean up this practice task.',
    position: 'top',
    showNextButton: true,
  },
  'click-delete': {
    targetSelector: '[data-walkthrough="delete-button"]',
    title: 'Delete Practice Task',
    message: 'Click the delete button to remove this practice task. Don\'t worry, this is just for the tutorial!',
    position: 'left',
    icon: <MousePointer2 className="h-5 w-5" />,
    allowInteraction: true,
  },
  complete: {
    targetSelector: null,
    title: "You're All Set!",
    message: "Congratulations! You now know how to use Pulse. Create your first real task whenever you're ready.",
    position: 'center',
    showNextButton: true,
    icon: <Sparkles className="h-8 w-8 text-primary" />,
  },
}

interface SpotlightRect {
  top: number
  left: number
  width: number
  height: number
}

interface TooltipStyle {
  top?: number
  left?: number
  right?: number
  bottom?: number
  transform?: string
}

export function WalkthroughOverlay() {
  const { isActive, currentStep, isPaused, advanceStep, endWalkthrough } = useWalkthrough()
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null)
  const [tooltipStyle, setTooltipStyle] = useState<TooltipStyle>({})
  const [isAnimating, setIsAnimating] = useState(false)
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()

  const config = stepConfigs[currentStep]

  useEffect(() => {
    setMounted(true)
  }, [])

  // Calculate positions
  const updatePositions = useCallback(() => {
    if (!config) return

    if (!config.targetSelector || config.position === 'center') {
      setSpotlightRect(null)
      setTooltipStyle({
        top: window.innerHeight / 2,
        left: window.innerWidth / 2,
        transform: 'translate(-50%, -50%)',
      })
      return
    }

    const element = document.querySelector(config.targetSelector)
    if (!element) {
      setTimeout(updatePositions, 200)
      return
    }

    const rect = element.getBoundingClientRect()
    const padding = 12

    setSpotlightRect({
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    })

    const gap = 16
    let style: TooltipStyle = {}

    switch (config.position) {
      case 'top':
        style = {
          bottom: window.innerHeight - rect.top + gap,
          left: rect.left + rect.width / 2,
          transform: 'translateX(-50%)',
        }
        break
      case 'bottom':
        style = {
          top: rect.bottom + gap,
          left: rect.left + rect.width / 2,
          transform: 'translateX(-50%)',
        }
        break
      case 'left':
        style = {
          top: rect.top + rect.height / 2,
          right: window.innerWidth - rect.left + gap,
          transform: 'translateY(-50%)',
        }
        break
      case 'right':
        style = {
          top: rect.top + rect.height / 2,
          left: rect.right + gap,
          transform: 'translateY(-50%)',
        }
        break
    }

    // Keep tooltip on screen
    const tooltipWidth = 340
    const tooltipHeight = 180

    if (style.left !== undefined && typeof style.left === 'number') {
      const maxLeft = window.innerWidth - tooltipWidth - 16
      if (style.left > maxLeft) {
        style.left = maxLeft
        style.transform = style.transform?.replace('translateX(-50%)', '') || undefined
      }
      if (style.left < 16) {
        style.left = 16
        style.transform = style.transform?.replace('translateX(-50%)', '') || undefined
      }
    }

    if (style.top !== undefined && typeof style.top === 'number') {
      if (style.top > window.innerHeight - tooltipHeight - 16) {
        style.top = window.innerHeight - tooltipHeight - 16
      }
      if (style.top < 16) style.top = 16
    }

    setTooltipStyle(style)
  }, [config])

  useEffect(() => {
    if (!isActive || isPaused) return

    setIsAnimating(true)
    updatePositions()

    const timer = setTimeout(() => setIsAnimating(false), 300)
    return () => clearTimeout(timer)
  }, [currentStep, isActive, isPaused, updatePositions])

  useEffect(() => {
    if (!isActive || isPaused) return

    const handleResize = () => updatePositions()
    const handleScroll = () => updatePositions()

    window.addEventListener('resize', handleResize)
    window.addEventListener('scroll', handleScroll, true)

    const interval = setInterval(updatePositions, 500)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', handleScroll, true)
      clearInterval(interval)
    }
  }, [isActive, isPaused, updatePositions])

  // Handle page-based step advancement
  useEffect(() => {
    if (!isActive) return

    if (currentStep === 'click-projects' && pathname === '/projects') {
      advanceStep('on-projects')
    } else if (currentStep === 'click-matrix' && pathname === '/matrix') {
      advanceStep('on-matrix')
    } else if (currentStep === 'click-task-detail' && pathname.startsWith('/tasks/')) {
      advanceStep('on-task-detail')
    }
  }, [pathname, currentStep, isActive, advanceStep])

  const handleNext = () => {
    if (currentStep === 'complete') {
      endWalkthrough()
    } else {
      advanceStep()
    }
  }

  const handleSkip = () => {
    if (confirm('Are you sure you want to skip the tutorial? You can restart it from Settings.')) {
      endWalkthrough()
    }
  }

  if (!mounted || !isActive || isPaused || currentStep === 'idle') return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {/* Dark overlay with spotlight */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-auto"
        style={{ opacity: isAnimating ? 0.8 : 1 }}
        onClick={(e) => {
          // Allow clicks through the spotlight area
          if (config.allowInteraction && spotlightRect) {
            const x = e.clientX
            const y = e.clientY
            if (
              x >= spotlightRect.left &&
              x <= spotlightRect.left + spotlightRect.width &&
              y >= spotlightRect.top &&
              y <= spotlightRect.top + spotlightRect.height
            ) {
              return // Let the click through
            }
          }
          e.stopPropagation()
        }}
      >
        <defs>
          <mask id="walkthrough-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {spotlightRect && (
              <rect
                x={spotlightRect.left}
                y={spotlightRect.top}
                width={spotlightRect.width}
                height={spotlightRect.height}
                rx="12"
                fill="black"
                className="transition-all duration-300 ease-out"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.7)"
          mask="url(#walkthrough-mask)"
          style={{ pointerEvents: config.allowInteraction ? 'none' : 'auto' }}
        />
      </svg>

      {/* Spotlight glow effect */}
      {spotlightRect && (
        <div
          className="absolute rounded-xl ring-2 ring-primary/50 ring-offset-4 ring-offset-transparent pointer-events-none transition-all duration-300 ease-out animate-pulse"
          style={{
            top: spotlightRect.top,
            left: spotlightRect.left,
            width: spotlightRect.width,
            height: spotlightRect.height,
          }}
        />
      )}

      {/* Make spotlight area interactive */}
      {spotlightRect && config.allowInteraction && (
        <div
          className="absolute pointer-events-auto"
          style={{
            top: spotlightRect.top,
            left: spotlightRect.left,
            width: spotlightRect.width,
            height: spotlightRect.height,
          }}
        />
      )}

      {/* Tooltip */}
      <div
        className={cn(
          'absolute z-10 w-[340px] bg-card border-2 border-primary/20 rounded-2xl shadow-2xl p-6 pointer-events-auto transition-all duration-300 ease-out',
          isAnimating && 'opacity-0 scale-95',
          !isAnimating && 'opacity-100 scale-100'
        )}
        style={tooltipStyle}
      >
        {/* Icon */}
        {config.icon && (
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              {config.icon}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {config.title}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {config.message}
          </p>
        </div>

        {/* Progress bar */}
        <div className="mt-5 mb-4">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500 ease-out rounded-full"
              style={{
                width: `${((Object.keys(stepConfigs).indexOf(currentStep)) / (Object.keys(stepConfigs).length - 2)) * 100}%`,
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Step {Object.keys(stepConfigs).indexOf(currentStep)} of {Object.keys(stepConfigs).length - 2}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Skip
          </Button>

          {config.showNextButton && (
            <Button size="sm" onClick={handleNext} className="px-6">
              {currentStep === 'complete' ? 'Get Started' : 'Next'}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}

          {!config.showNextButton && config.allowInteraction && (
            <div className="text-xs text-primary font-medium animate-pulse flex items-center gap-1">
              <MousePointer2 className="h-3 w-3" />
              Waiting for action...
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
