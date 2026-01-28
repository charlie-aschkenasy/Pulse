// Service Worker for Pulse Push Notifications
// Debug version with logging

console.log('Service Worker loaded')

self.addEventListener('install', (event) => {
  console.log('Service Worker installing...')
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...')
  event.waitUntil(clients.claim())
})

self.addEventListener('push', (event) => {
  console.log('🔔 Push event received!', event)
  
  if (!event.data) {
    console.log('No data in push event')
    return
  }

  let data = {}
  try {
    data = event.data.json()
    console.log('Push data parsed:', data)
  } catch (e) {
    console.error('Error parsing push data:', e)
    data = { title: 'Pulse', body: event.data.text() }
  }

  const title = data.title || 'Pulse Reminder'
  const options = {
    body: data.body || 'You have a task reminder',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'pulse-notification',
    renotify: true,
    requireInteraction: true,
    data: {
      url: data.url || '/dashboard',
      taskId: data.taskId
    },
    vibrate: [200, 100, 200],
    actions: [
      { action: 'open', title: 'Open Task' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  }

  console.log('Showing notification with options:', options)
  
  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => console.log('✅ Notification shown successfully'))
      .catch(err => console.error('❌ Error showing notification:', err))
  )
})

self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event.action)
  event.notification.close()

  if (event.action === 'dismiss') return

  const url = event.notification.data?.url || '/dashboard'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes('/dashboard') && 'focus' in client) {
            client.navigate(url)
            return client.focus()
          }
        }
        return clients.openWindow(url)
      })
  )
})
