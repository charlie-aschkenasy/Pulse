import webpush from 'web-push'

// Configure web-push with VAPID keys
// You need to generate these once and store them in environment variables
// Run: npx web-push generate-vapid-keys
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY

let configured = false
if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(
      'mailto:support@pulse.app',
      vapidPublicKey,
      vapidPrivateKey
    )
    configured = true
  } catch {
    console.error('Failed to configure web-push VAPID details')
  }
}

export function isWebPushConfigured(): boolean {
  return configured
}

interface PushPayload {
  title: string
  body: string
  tag?: string
  url?: string
  taskId?: string
}

interface PushSubscriptionData {
  endpoint: string
  p256dh: string
  auth: string
}

export async function sendPushNotification(
  subscription: PushSubscriptionData,
  payload: PushPayload
): Promise<{ success: boolean; error?: string }> {
  if (!isWebPushConfigured()) {
    return { success: false, error: 'Web push not configured' }
  }

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify(payload)
    )
    return { success: true }
  } catch (error) {
    console.error('Push notification error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function sendTaskReminderPush(
  subscription: PushSubscriptionData,
  taskTitle: string,
  taskId: string,
  dueInfo?: string
): Promise<{ success: boolean; error?: string }> {
  const body = dueInfo ? `${dueInfo}` : 'You have a task reminder'

  return sendPushNotification(subscription, {
    title: `Reminder: ${taskTitle}`,
    body,
    tag: `task-reminder-${taskId}`,
    url: `/tasks/${taskId}`,
    taskId,
  })
}
