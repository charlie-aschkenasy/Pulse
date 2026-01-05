'use client'

import { ReactNode } from 'react'
import { WalkthroughProvider } from './walkthrough-context'
import { WalkthroughOverlay } from './walkthrough-overlay'

export function WalkthroughWrapper({ children }: { children: ReactNode }) {
  return (
    <WalkthroughProvider>
      {children}
      <WalkthroughOverlay />
    </WalkthroughProvider>
  )
}
