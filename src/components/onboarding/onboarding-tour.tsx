'use client'

// Re-export everything from the new walkthrough system
export { WalkthroughProvider, useWalkthrough, hasCompletedWalkthrough as hasCompletedOnboarding } from './walkthrough-context'
export { WalkthroughOverlay as OnboardingTour } from './walkthrough-overlay'

// Legacy function for backwards compatibility
export function resetOnboarding() {
  if (typeof window === 'undefined') return
  localStorage.removeItem('pulse_walkthrough_complete')
  localStorage.removeItem('pulse_walkthrough_progress')
  localStorage.removeItem('pulse_tutorial_task_id')
  // Also clear old key for backwards compatibility
  localStorage.removeItem('pulse_onboarding_complete')
}
