'use client'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray as Uint8Array<ArrayBuffer>
}

export function isPushSupported(): boolean {
  return typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
}

export function isIOSDevice(): boolean {
  if (typeof window === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

export function isPWAInstalled(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers not supported')
  }

  const registration = await navigator.serviceWorker.register('/sw.js', {
    scope: '/'
  })

  // Wait for the service worker to be ready
  await navigator.serviceWorker.ready

  return registration
}

export async function getNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied'
  }
  return Notification.permission
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    throw new Error('Notifications not supported')
  }
  return Notification.requestPermission()
}

export async function subscribeToPush(): Promise<PushSubscription> {
  if (!isPushSupported()) {
    throw new Error('Push notifications not supported in this browser')
  }

  const permission = await requestNotificationPermission()
  if (permission !== 'granted') {
    throw new Error('Notification permission denied')
  }

  const registration = await registerServiceWorker()

  // Check for existing subscription
  let subscription = await registration.pushManager.getSubscription()

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    })
  }

  return subscription
}

export async function unsubscribeFromPush(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return true

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()

  if (subscription) {
    return subscription.unsubscribe()
  }

  return true
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null

  try {
    const registration = await navigator.serviceWorker.ready
    return registration.pushManager.getSubscription()
  } catch {
    return null
  }
}

export function serializeSubscription(subscription: PushSubscription) {
  const json = subscription.toJSON()
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: json.keys?.p256dh || '',
      auth: json.keys?.auth || ''
    }
  }
}
