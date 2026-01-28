'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Bell, BellOff, Loader2, AlertCircle, Check, Send, Smartphone } from 'lucide-react'
import { usePushNotifications } from '@/hooks/use-push-notifications'
import { sendTestNotification } from '@/app/actions/push'
import { toast } from 'sonner'

export function PushNotificationSettings() {
  const {
    isSupported,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    isIOS,
    isPWA,
  } = usePushNotifications()
  const [isSendingTest, setIsSendingTest] = useState(false)

  const handleToggle = async () => {
    if (isSubscribed) {
      const success = await unsubscribe()
      if (success) {
        toast.success('Push notifications disabled')
      } else {
        toast.error('Failed to disable push notifications')
      }
    } else {
      const success = await subscribe()
      if (success) {
        toast.success('Push notifications enabled')
      }
    }
  }

  const handleSendTest = async () => {
    setIsSendingTest(true)
    const result = await sendTestNotification()
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Test notification sent!')
    }
    setIsSendingTest(false)
  }

  // iOS without PWA installed - show install instructions
  if (isIOS && !isPWA) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
          <Smartphone className="h-5 w-5 text-muted-foreground shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Install Pulse as an app</p>
            <p className="text-xs text-muted-foreground">
              To receive push notifications on iOS, install Pulse to your home screen:
            </p>
            <ol className="text-xs text-muted-foreground mt-2 list-decimal list-inside space-y-1">
              <li>Tap the Share button in Safari</li>
              <li>Scroll down and tap &quot;Add to Home Screen&quot;</li>
              <li>Tap &quot;Add&quot; to install</li>
              <li>Open Pulse from your home screen</li>
            </ol>
          </div>
        </div>
      </div>
    )
  }

  if (!isSupported) {
    return (
      <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
        <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium">Push notifications not supported</p>
          <p className="text-xs text-muted-foreground">
            Your browser doesn&apos;t support push notifications. Try using Chrome, Firefox, or Edge.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-sm font-medium">Push Notifications</h3>
          <p className="text-xs text-muted-foreground">
            Receive task reminders as push notifications on this device
          </p>
        </div>
        <Button
          variant={isSubscribed ? 'outline' : 'default'}
          size="sm"
          onClick={handleToggle}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : isSubscribed ? (
            <BellOff className="mr-2 h-4 w-4" />
          ) : (
            <Bell className="mr-2 h-4 w-4" />
          )}
          {isSubscribed ? 'Disable' : 'Enable'}
        </Button>
      </div>

      {isSubscribed && (
        <>
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <Check className="h-4 w-4" />
            <span>Push notifications are enabled for this device</span>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div>
              <p className="text-sm font-medium">Test Notification</p>
              <p className="text-xs text-muted-foreground">
                Send a test notification to verify it&apos;s working
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSendTest}
              disabled={isSendingTest}
            >
              {isSendingTest ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send Test
            </Button>
          </div>
        </>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Note: You need to enable push notifications on each device where you want to receive reminders.
        {isIOS && ' On iOS, Pulse must be installed as an app from Safari.'}
      </p>
    </div>
  )
}
