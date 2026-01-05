'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

const ONBOARDING_STORAGE_KEY = 'pulse_onboarding_complete'

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right'

interface TourStep {
  target: string | null // null for centered welcome modal
  title: string
  description: string
  position: TooltipPosition
}

const tourSteps: TourStep[] = [
  {
    target: null, // Centered modal
    title: 'Welcome to Pulse!',
    description: "Let's take a quick tour of the main features to help you get started managing your tasks effectively.",
    position: 'bottom',
  },
  {
    target: '#tour-task-columns',
    title: 'Organize by Timeframe',
    description: 'Your tasks are organized into Daily, Weekly, and Monthly columns. Drag and drop tasks between columns to reschedule them.',
    position: 'top',
  },
  {
    target: '#tour-new-task-button',
    title: 'Create Tasks',
    description: 'Click here to create a new task. You can set due dates, priorities, and assign tasks to projects.',
    position: 'bottom',
  },
  {
    target: '#tour-projects-link',
    title: 'Projects',
    description: 'Group related tasks into Projects for better organization. Each project can have its own color.',
    position: 'bottom',
  },
  {
    target: '#tour-matrix-link',
    title: 'Covey Matrix',
    description: 'Use the Covey Matrix to prioritize tasks by urgency and importance. Drag tasks between quadrants.',
    position: 'bottom',
  },
  {
    target: '#tour-task-columns',
    title: 'Task Details',
    description: "Click any task to open its detail page with rich notes, due dates, and more options. You're all set!",
    position: 'top',
  },
]

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

interface OnboardingTourProps {
  onComplete?: () => void
  forceStart?: boolean
}

export function OnboardingTour({ onComplete, forceStart = false }: OnboardingTourProps) {
  const [isActive, setIsActive] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null)
  const [tooltipStyle, setTooltipStyle] = useState<TooltipStyle>({})
  const [isAnimating, setIsAnimating] = useState(false)
  const [mounted, setMounted] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const step = tourSteps[currentStep]

  // Check if should show tour on mount
  useEffect(() => {
    setMounted(true)
    const hasSeenOnboarding = localStorage.getItem(ONBOARDING_STORAGE_KEY)

    // Show tour if forced or if user hasn't seen it
    if (forceStart || !hasSeenOnboarding) {
      // Delay to ensure DOM is ready
      const timer = setTimeout(() => {
        setCurrentStep(0) // Reset to first step
        setIsActive(true)
      }, 600)
      return () => clearTimeout(timer)
    }
  }, [forceStart])

  // Calculate spotlight and tooltip positions
  const updatePositions = useCallback(() => {
    if (!step) return

    // Centered modal for welcome step
    if (!step.target) {
      setSpotlightRect(null)
      setTooltipStyle({
        top: window.innerHeight / 2,
        left: window.innerWidth / 2,
        transform: 'translate(-50%, -50%)',
      })
      return
    }

    const element = document.querySelector(step.target)
    if (!element) {
      // Element not found, try again shortly
      setTimeout(updatePositions, 100)
      return
    }

    const rect = element.getBoundingClientRect()
    const padding = 8

    // Set spotlight rectangle
    setSpotlightRect({
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    })

    // Calculate tooltip position
    const tooltipWidth = 320
    const tooltipHeight = 160
    const gap = 16
    let style: TooltipStyle = {}

    switch (step.position) {
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
    if (style.left !== undefined && typeof style.left === 'number') {
      const maxLeft = window.innerWidth - tooltipWidth - 16
      const minLeft = 16
      if (style.left > maxLeft) {
        style.left = maxLeft
        style.transform = undefined
      } else if (style.left < minLeft) {
        style.left = minLeft
        style.transform = undefined
      }
    }

    if (style.top !== undefined && typeof style.top === 'number') {
      const maxTop = window.innerHeight - tooltipHeight - 16
      const minTop = 16
      if (style.top > maxTop) style.top = maxTop
      if (style.top < minTop) style.top = minTop
    }

    setTooltipStyle(style)
  }, [step])

  // Update positions on step change and window resize
  useEffect(() => {
    if (!isActive) return

    setIsAnimating(true)
    updatePositions()

    const timer = setTimeout(() => setIsAnimating(false), 300)
    return () => clearTimeout(timer)
  }, [currentStep, isActive, updatePositions])

  useEffect(() => {
    if (!isActive) return

    const handleResize = () => updatePositions()
    const handleScroll = () => updatePositions()

    window.addEventListener('resize', handleResize)
    window.addEventListener('scroll', handleScroll, true)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [isActive, updatePositions])

  const completeTour = useCallback(() => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true')
    setIsActive(false)
    onComplete?.()
  }, [onComplete])

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      completeTour()
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSkip = () => {
    completeTour()
  }

  if (!mounted || !isActive) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999]">
      {/* Dark overlay with spotlight hole */}
      <svg
        className="absolute inset-0 w-full h-full transition-opacity duration-300"
        style={{ opacity: isAnimating ? 0.8 : 1 }}
      >
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {spotlightRect && (
              <rect
                x={spotlightRect.left}
                y={spotlightRect.top}
                width={spotlightRect.width}
                height={spotlightRect.height}
                rx="8"
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
          fill="rgba(0, 0, 0, 0.75)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* Spotlight border glow */}
      {spotlightRect && (
        <div
          className="absolute rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-transparent pointer-events-none transition-all duration-300 ease-out"
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
        ref={tooltipRef}
        className={cn(
          'absolute z-10 w-80 bg-card border rounded-xl shadow-2xl p-5 transition-all duration-300 ease-out',
          isAnimating && 'opacity-0 scale-95',
          !isAnimating && 'opacity-100 scale-100'
        )}
        style={tooltipStyle}
      >
        {/* Close button */}
        <button
          onClick={handleSkip}
          className="absolute top-3 right-3 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Close tour"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Content */}
        <div className="pr-6">
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {step.title}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {step.description}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-5 pt-4 border-t">
          {/* Progress dots */}
          <div className="flex items-center gap-1.5">
            {tourSteps.map((_, index) => (
              <div
                key={index}
                className={cn(
                  'w-2 h-2 rounded-full transition-colors',
                  index === currentStep
                    ? 'bg-primary'
                    : index < currentStep
                      ? 'bg-primary/50'
                      : 'bg-muted-foreground/30'
                )}
              />
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="h-8 px-3"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleNext}
              className="h-8 px-4"
            >
              {currentStep === tourSteps.length - 1 ? (
                'Get Started'
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Step counter */}
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-muted-foreground/70">
          {currentStep + 1} of {tourSteps.length}
        </div>
      </div>

      {/* Skip link for first step */}
      {currentStep === 0 && (
        <button
          onClick={handleSkip}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-sm text-white/70 hover:text-white transition-colors underline underline-offset-2"
        >
          Skip tour
        </button>
      )}
    </div>,
    document.body
  )
}

// Utility to reset onboarding (for settings page)
export function resetOnboarding() {
  localStorage.removeItem(ONBOARDING_STORAGE_KEY)
}

// Check if onboarding has been completed
export function hasCompletedOnboarding(): boolean {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true'
}
