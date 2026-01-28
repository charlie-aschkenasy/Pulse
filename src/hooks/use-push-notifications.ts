'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
  getExistingSubscription,
  serializeSubscription,
  isIOSDevice,
  isPWAInstalled,
} from '@/lib/push-notifications'
import { savePushSubscription, removePushSubscription } from '@/app/actions/push'

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [isPWA, setIsPWA] = useState(false)

  // Check if push notifications are supported and get current subscription
  useEffect(() => {
    async function checkSupport() {
      if (typeof window === 'undefined') {
        setIsLoading(false)
        return
      }

      setIsIOS(isIOSDevice())
      setIsPWA(isPWAInstalled())

      const supported = isPushSupported()
      setIsSupported(supported)

      if (!supported) {
        setIsLoading(false)
        return
      }

      try {
        const existingSubscription = await getExistingSubscription()
        if (existingSubscription) {
          setSubscription(existingSubscription)
          setIsSubscribed(true)
        }
      } catch (err) {
        console.error('Error checking push support:', err)
        setError('Failed to initialize push notifications')
      }

      setIsLoading(false)
    }

    checkSupport()
  }, [])

  const subscribe = useCallback(async () => {
    if (!isSupported) {
      setError('Push notifications are not supported in this browser')
      return false
    }

    setIsLoading(true)
    setError(null)

    try {
      const newSubscription = await subscribeToPush()
      const serialized = serializeSubscription(newSubscription)

      // Save subscription to server
      const result = await savePushSubscription(serialized)

      if (result.error) {
        throw new Error(result.error)
      }

      setSubscription(newSubscription)
      setIsSubscribed(true)
      setIsLoading(false)
      return true
    } catch (err) {
      console.error('Error subscribing to push:', err)
      setError(err instanceof Error ? err.message : 'Failed to subscribe')
      setIsLoading(false)
      return false
    }
  }, [isSupported])

  const unsubscribe = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Unsubscribe from push manager
      await unsubscribeFromPush()

      // Remove from server
      if (subscription) {
        await removePushSubscription(subscription.endpoint)
      } else {
        await removePushSubscription()
      }

      setSubscription(null)
      setIsSubscribed(false)
      setIsLoading(false)
      return true
    } catch (err) {
      console.error('Error unsubscribing from push:', err)
      setError(err instanceof Error ? err.message : 'Failed to unsubscribe')
      setIsLoading(false)
      return false
    }
  }, [subscription])

  return {
    isSupported,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    isIOS,
    isPWA,
  }
}
