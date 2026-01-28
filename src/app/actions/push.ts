'use server'

import webpush from 'web-push'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Initialize web-push with VAPID details
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    'mailto:notifications@pulse-app.com',
    vapidPublicKey,
    vapidPrivateKey
  )
}

export async function getVapidPublicKey() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null
}

export async function savePushSubscription(subscription: {
  endpoint: string
  keys: { p256dh: string; auth: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated', data: null }
  }

  // Delete any existing subscriptions for this endpoint
  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', subscription.endpoint)

  // Insert new subscription
  const { data, error } = await supabase
    .from('push_subscriptions')
    .insert({
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: null
    })
    .select()
    .single()

  if (error) {
    console.error('Error saving push subscription:', error)
    return { error: error.message, data: null }
  }

  // Update profile to mark push as enabled
  await supabase
    .from('profiles')
    .update({ push_enabled: true })
    .eq('user_id', user.id)

  revalidatePath('/settings')
  return { error: null, data }
}

export async function removePushSubscription(endpoint?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  if (endpoint) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('endpoint', endpoint)
  } else {
    // Remove all subscriptions for this user
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
  }

  // Check if user has any remaining subscriptions
  const { data: remaining } = await supabase
    .from('push_subscriptions')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)

  if (!remaining?.length) {
    await supabase
      .from('profiles')
      .update({ push_enabled: false })
      .eq('user_id', user.id)
  }

  revalidatePath('/settings')
  return { error: null }
}

export async function deletePushSubscription(endpoint: string) {
  return removePushSubscription(endpoint)
}

export async function hasPushSubscription(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return false

  const { data } = await supabase
    .from('push_subscriptions')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)

  return (data?.length ?? 0) > 0
}

export async function checkPushSetup() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated', data: null }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('push_enabled')
    .eq('user_id', user.id)
    .single()

  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('id')
    .eq('user_id', user.id)

  return {
    data: {
      pushEnabled: profile?.push_enabled ?? false,
      hasSubscriptions: (subscriptions?.length ?? 0) > 0,
      vapidConfigured: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    },
    error: null,
  }
}

export async function getUserPushSubscriptions(userId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId)

  if (error) {
    return { error: error.message, data: null }
  }

  return { data, error: null }
}

export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  url?: string,
  taskId?: string
) {
  console.log('sendPushNotification called for user:', userId)
  console.log('VAPID configured:', !!vapidPublicKey, !!vapidPrivateKey)
  
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.error('VAPID keys not configured')
    return { error: 'Push notifications not configured' }
  }

  const supabase = await createClient()

  const { data: subscriptions, error: fetchError } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId)

  console.log('Subscriptions found:', subscriptions?.length, subscriptions)

  if (fetchError) {
    console.error('Error fetching subscriptions:', fetchError)
    return { error: 'Error fetching subscriptions' }
  }

  if (!subscriptions?.length) {
    console.log('No subscriptions found for user')
    return { error: 'No push subscriptions found' }
  }

  const payload = JSON.stringify({
    title,
    body,
    url: url || '/dashboard',
    taskId,
    tag: taskId || 'pulse-reminder',
    timestamp: Date.now()
  })

  console.log('Payload:', payload)

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        console.log('Sending to endpoint:', sub.endpoint.substring(0, 50) + '...')
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          },
          payload
        )
        console.log('Push sent successfully to:', sub.id)
        return { success: true, id: sub.id }
      } catch (err: unknown) {
        console.error('Push error details:', {
          statusCode: (err as { statusCode?: number })?.statusCode,
          body: (err as { body?: string })?.body,
          message: (err as Error).message
        })

        // Remove expired/invalid subscriptions (410 Gone or 404 Not Found)
        const statusCode = (err as { statusCode?: number })?.statusCode
        if (statusCode === 410 || statusCode === 404) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('id', sub.id)
        }

        return { success: false, id: sub.id, error: (err as Error).message }
      }
    })
  )

  const successCount = results.filter(
    r => r.status === 'fulfilled' && r.value.success
  ).length

  console.log('Results:', results)
  console.log('Success count:', successCount, '/', subscriptions.length)

  return {
    error: null,
    sent: successCount,
    total: subscriptions.length
  }
}

export async function sendTestNotification() {
  console.log('sendTestNotification called')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    console.log('No user found in sendTestNotification')
    return { error: 'Not authenticated' }
  }

  console.log('Sending test notification for user:', user.id)
  return sendPushNotification(
    user.id,
    'Test Notification',
    'Push notifications are working! You\'ll receive task reminders here.',
    '/settings'
  )
}
