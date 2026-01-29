'use client'

import { SWRConfig } from 'swr'
import { ReactNode } from 'react'

export function SWRProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        dedupingInterval: 2000,
        errorRetryCount: 3,
        keepPreviousData: true,
      }}
    >
      {children}
    </SWRConfig>
  )
}
