'use client'

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'

const WALKTHROUGH_STORAGE_KEY = 'pulse_walkthrough_complete'
const WALKTHROUGH_PROGRESS_KEY = 'pulse_walkthrough_progress'
const TUTORIAL_TASK_KEY = 'pulse_tutorial_task_id'

export type WalkthroughStep =
  | 'idle'
  | 'welcome'
  | 'click-new-task'
  | 'fill-task-form'
  | 'task-created'
  | 'drag-to-weekly'
  | 'task-moved'
  | 'click-projects'
  | 'on-projects'
  | 'click-matrix'
  | 'on-matrix'
  | 'click-task-detail'
  | 'on-task-detail'
  | 'type-in-editor'
  | 'editor-typed'
  | 'click-delete'
  | 'complete'

interface WalkthroughState {
  isActive: boolean
  currentStep: WalkthroughStep
  tutorialTaskId: string | null
  isPaused: boolean
}

interface WalkthroughContextType extends WalkthroughState {
  startWalkthrough: () => void
  endWalkthrough: () => void
  advanceStep: (toStep?: WalkthroughStep) => void
  setTutorialTaskId: (id: string | null) => void
  pauseWalkthrough: () => void
  resumeWalkthrough: () => void
  isWalkthroughComplete: () => boolean
  resetWalkthrough: () => void
}

const WalkthroughContext = createContext<WalkthroughContextType | null>(null)

const stepOrder: WalkthroughStep[] = [
  'idle',
  'welcome',
  'click-new-task',
  'fill-task-form',
  'task-created',
  'drag-to-weekly',
  'task-moved',
  'click-projects',
  'on-projects',
  'click-matrix',
  'on-matrix',
  'click-task-detail',
  'on-task-detail',
  'type-in-editor',
  'editor-typed',
  'click-delete',
  'complete',
]

export function WalkthroughProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalkthroughState>({
    isActive: false,
    currentStep: 'idle',
    tutorialTaskId: null,
    isPaused: false,
  })

  // Load saved progress on mount
  useEffect(() => {
    const savedProgress = localStorage.getItem(WALKTHROUGH_PROGRESS_KEY)
    const savedTaskId = localStorage.getItem(TUTORIAL_TASK_KEY)
    const isComplete = localStorage.getItem(WALKTHROUGH_STORAGE_KEY)

    if (savedProgress && !isComplete) {
      const step = savedProgress as WalkthroughStep
      if (stepOrder.includes(step) && step !== 'idle' && step !== 'complete') {
        setState({
          isActive: true,
          currentStep: step,
          tutorialTaskId: savedTaskId,
          isPaused: false,
        })
      }
    }
  }, [])

  // Save progress when step changes
  useEffect(() => {
    if (state.isActive && state.currentStep !== 'idle') {
      localStorage.setItem(WALKTHROUGH_PROGRESS_KEY, state.currentStep)
      if (state.tutorialTaskId) {
        localStorage.setItem(TUTORIAL_TASK_KEY, state.tutorialTaskId)
      }
    }
  }, [state.currentStep, state.isActive, state.tutorialTaskId])

  const startWalkthrough = useCallback(() => {
    localStorage.removeItem(WALKTHROUGH_STORAGE_KEY)
    localStorage.removeItem(WALKTHROUGH_PROGRESS_KEY)
    localStorage.removeItem(TUTORIAL_TASK_KEY)
    setState({
      isActive: true,
      currentStep: 'welcome',
      tutorialTaskId: null,
      isPaused: false,
    })
  }, [])

  const endWalkthrough = useCallback(() => {
    localStorage.setItem(WALKTHROUGH_STORAGE_KEY, 'true')
    localStorage.removeItem(WALKTHROUGH_PROGRESS_KEY)
    localStorage.removeItem(TUTORIAL_TASK_KEY)
    setState({
      isActive: false,
      currentStep: 'idle',
      tutorialTaskId: null,
      isPaused: false,
    })
  }, [])

  const advanceStep = useCallback((toStep?: WalkthroughStep) => {
    setState((prev) => {
      if (!prev.isActive) return prev

      let nextStep: WalkthroughStep
      if (toStep) {
        nextStep = toStep
      } else {
        const currentIndex = stepOrder.indexOf(prev.currentStep)
        nextStep = stepOrder[currentIndex + 1] || 'complete'
      }

      if (nextStep === 'complete') {
        localStorage.setItem(WALKTHROUGH_STORAGE_KEY, 'true')
        localStorage.removeItem(WALKTHROUGH_PROGRESS_KEY)
        localStorage.removeItem(TUTORIAL_TASK_KEY)
      }

      return { ...prev, currentStep: nextStep }
    })
  }, [])

  const setTutorialTaskId = useCallback((id: string | null) => {
    setState((prev) => ({ ...prev, tutorialTaskId: id }))
    if (id) {
      localStorage.setItem(TUTORIAL_TASK_KEY, id)
    } else {
      localStorage.removeItem(TUTORIAL_TASK_KEY)
    }
  }, [])

  const pauseWalkthrough = useCallback(() => {
    setState((prev) => ({ ...prev, isPaused: true }))
  }, [])

  const resumeWalkthrough = useCallback(() => {
    setState((prev) => ({ ...prev, isPaused: false }))
  }, [])

  const isWalkthroughComplete = useCallback(() => {
    return localStorage.getItem(WALKTHROUGH_STORAGE_KEY) === 'true'
  }, [])

  const resetWalkthrough = useCallback(() => {
    localStorage.removeItem(WALKTHROUGH_STORAGE_KEY)
    localStorage.removeItem(WALKTHROUGH_PROGRESS_KEY)
    localStorage.removeItem(TUTORIAL_TASK_KEY)
    setState({
      isActive: false,
      currentStep: 'idle',
      tutorialTaskId: null,
      isPaused: false,
    })
  }, [])

  return (
    <WalkthroughContext.Provider
      value={{
        ...state,
        startWalkthrough,
        endWalkthrough,
        advanceStep,
        setTutorialTaskId,
        pauseWalkthrough,
        resumeWalkthrough,
        isWalkthroughComplete,
        resetWalkthrough,
      }}
    >
      {children}
    </WalkthroughContext.Provider>
  )
}

export function useWalkthrough() {
  const context = useContext(WalkthroughContext)
  if (!context) {
    throw new Error('useWalkthrough must be used within a WalkthroughProvider')
  }
  return context
}

// Check if walkthrough has been completed (for initial load)
export function hasCompletedWalkthrough(): boolean {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(WALKTHROUGH_STORAGE_KEY) === 'true'
}
