'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  User,
  Globe,
  Calendar,
  MessageSquare,
  Lock,
  LogOut,
  Loader2,
  HelpCircle,
  RotateCcw,
  Check,
  Phone,
  Bell,
  BellOff,
  Smartphone,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { resetOnboarding } from '@/components/onboarding/onboarding-tour'
import {
  isPushSupported,
  isIOSDevice,
  isPWAInstalled,
  subscribeToPush,
  unsubscribeFromPush,
  getNotificationPermission,
  serializeSubscription,
  getExistingSubscription,
} from '@/lib/push-notifications'
import {
  savePushSubscription,
  removePushSubscription,
  hasPushSubscription,
  sendTestNotification,
} from '@/app/actions/push'
import {
  getProfile,
  updatePhoneNumber,
  sendVerificationSms,
  toggleSmsReminders,
  updateTimezone,
} from '@/app/actions/profile'

const timezones = [
  { value: 'America/Mexico_City', label: 'Mexico City (CST)' },
  { value: 'America/New_York', label: 'New York (EST)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST)' },
  { value: 'America/Chicago', label: 'Chicago (CST)' },
  { value: 'America/Denver', label: 'Denver (MST)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
]

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)

  // Profile state
  const [timezone, setTimezone] = useState('America/Mexico_City')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [phoneInput, setPhoneInput] = useState('')
  const [smsEnabled, setSmsEnabled] = useState(false)
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [isSavingPhone, setIsSavingPhone] = useState(false)
  const [isSendingTestSms, setIsSendingTestSms] = useState(false)

  // Push notification state
  const [pushSupported, setPushSupported] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default')
  const [isIOS, setIsIOS] = useState(false)
  const [isPWA, setIsPWA] = useState(false)
  const [isLoadingPush, setIsLoadingPush] = useState(false)
  const [isSendingTestPush, setIsSendingTestPush] = useState(false)

  // Load profile on mount
  useEffect(() => {
    async function loadProfile() {
      const { data } = await getProfile()
      if (data) {
        setTimezone(data.timezone)
        setPhoneNumber(data.phone_number || '')
        setPhoneInput(data.phone_number || '')
        setSmsEnabled(data.sms_reminders_enabled)
        setPhoneVerified(data.phone_verified)
      }
      setIsLoadingProfile(false)
    }
    loadProfile()
  }, [])

  // Check push notification status on mount
  useEffect(() => {
    async function checkPushStatus() {
      setPushSupported(isPushSupported())
      setIsIOS(isIOSDevice())
      setIsPWA(isPWAInstalled())

      if (isPushSupported()) {
        const permission = await getNotificationPermission()
        setPushPermission(permission)

        const hasSubscription = await hasPushSubscription()
        setPushEnabled(hasSubscription)
      }
    }
    checkPushStatus()
  }, [])

  const handleSignOut = async () => {
    setIsLoading(true)
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error('Failed to sign out')
      setIsLoading(false)
      return
    }
    router.push('/login')
  }

  const handleTimezoneChange = async (value: string) => {
    setTimezone(value)
    const { error } = await updateTimezone(value)
    if (error) {
      toast.error('Failed to update timezone')
    } else {
      toast.success('Timezone updated')
    }
  }

  const handleSavePhoneNumber = async () => {
    if (!phoneInput.trim()) return

    setIsSavingPhone(true)
    const { data, error } = await updatePhoneNumber(phoneInput)
    if (error) {
      toast.error(error)
    } else if (data) {
      setPhoneNumber(data.phone_number || '')
      setPhoneVerified(false)
      setSmsEnabled(false)
      toast.success('Phone number saved. Send a test SMS to verify.')
    }
    setIsSavingPhone(false)
  }

  const handleSendTestSms = async () => {
    setIsSendingTestSms(true)
    const { data, error } = await sendVerificationSms()
    if (error) {
      toast.error(error)
    } else if (data) {
      setPhoneVerified(true)
      setSmsEnabled(true)
      toast.success('Test SMS sent! SMS reminders are now enabled.')
    }
    setIsSendingTestSms(false)
  }

  const handleToggleSms = async (enabled: boolean) => {
    const { data, error } = await toggleSmsReminders(enabled)
    if (error) {
      toast.error(error)
    } else if (data) {
      setSmsEnabled(data.sms_reminders_enabled)
    }
  }

  // Push notification handlers
  async function handleEnablePush() {
    setIsLoadingPush(true)
    try {
      const subscription = await subscribeToPush()
      const serialized = serializeSubscription(subscription)
      const { error } = await savePushSubscription(serialized)

      if (error) {
        toast.error(error)
      } else {
        setPushEnabled(true)
        setPushPermission('granted')
        toast.success('Push notifications enabled!')
      }
    } catch (err: unknown) {
      console.error('Failed to enable push:', err)
      const message = err instanceof Error ? err.message : 'Failed to enable notifications'
      if (message.includes('permission')) {
        toast.error('Please allow notifications in your browser settings')
      } else {
        toast.error(message)
      }
    } finally {
      setIsLoadingPush(false)
    }
  }

  async function handleDisablePush() {
    setIsLoadingPush(true)
    try {
      const subscription = await getExistingSubscription()
      await unsubscribeFromPush()
      await removePushSubscription(subscription?.endpoint)
      setPushEnabled(false)
      toast.success('Push notifications disabled')
    } catch {
      toast.error('Failed to disable notifications')
    } finally {
      setIsLoadingPush(false)
    }
  }

  async function handleTestNotification() {
    setIsSendingTestPush(true)
    try {
      const { error } = await sendTestNotification()
      if (error) {
        toast.error(error)
      } else {
        toast.success('Test notification sent!')
      }
    } catch {
      toast.error('Failed to send test notification')
    } finally {
      setIsSendingTestPush(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5" />
            <CardTitle>Profile</CardTitle>
          </div>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Select value={timezone} onValueChange={handleTimezoneChange}>
              <SelectTrigger>
                <Globe className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timezones.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Push Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Get task reminders on your device, even when the app is closed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!pushSupported ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <XCircle className="h-4 w-4" />
              <span>Push notifications are not supported in this browser</span>
            </div>
          ) : isIOS && !isPWA ? (
            <div className="space-y-3 p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 font-medium">
                <Smartphone className="h-4 w-4" />
                Install Pulse on your iPhone
              </div>
              <p className="text-sm text-muted-foreground">
                To enable notifications on iOS, you need to add Pulse to your Home Screen first:
              </p>
              <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                <li>Tap the Share button in Safari</li>
                <li>Scroll down and tap &quot;Add to Home Screen&quot;</li>
                <li>Open Pulse from your Home Screen</li>
                <li>Come back here to enable notifications</li>
              </ol>
            </div>
          ) : pushPermission === 'denied' ? (
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-4 w-4" />
              <span>Notifications blocked. Please enable them in your browser settings.</span>
            </div>
          ) : pushEnabled ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span>Push notifications are enabled</span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleTestNotification}
                  disabled={isSendingTestPush}
                >
                  {isSendingTestPush ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Bell className="h-4 w-4 mr-2" />
                  )}
                  Send Test
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDisablePush}
                  disabled={isLoadingPush}
                >
                  {isLoadingPush ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <BellOff className="h-4 w-4 mr-2" />
                  )}
                  Disable
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={handleEnablePush}
              disabled={isLoadingPush}
            >
              {isLoadingPush ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Bell className="h-4 w-4 mr-2" />
              )}
              Enable Push Notifications
            </Button>
          )}
        </CardContent>
      </Card>

      {/* SMS Reminders */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-600" />
            <CardTitle>SMS Reminders</CardTitle>
            {phoneVerified && (
              <Badge variant="outline" className="ml-auto text-green-600 border-green-600">
                <Check className="mr-1 h-3 w-3" />
                Verified
              </Badge>
            )}
          </div>
          <CardDescription>
            Receive task reminders via SMS
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Phone Number Input */}
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button
                variant="outline"
                onClick={handleSavePhoneNumber}
                disabled={isSavingPhone || phoneInput === phoneNumber || !phoneInput.trim()}
              >
                {isSavingPhone ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Save'
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              US phone numbers only. Standard messaging rates apply.
            </p>
          </div>

          {/* Test SMS Button */}
          {phoneNumber && !phoneVerified && (
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <p className="text-sm font-medium">Verify your phone number</p>
                <p className="text-xs text-muted-foreground">
                  Send a test SMS to confirm it works
                </p>
              </div>
              <Button
                size="sm"
                onClick={handleSendTestSms}
                disabled={isSendingTestSms}
              >
                {isSendingTestSms ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <MessageSquare className="mr-2 h-4 w-4" />
                )}
                Send Test SMS
              </Button>
            </div>
          )}

          <Separator />

          {/* SMS Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable SMS Reminders</Label>
              <p className="text-sm text-muted-foreground">
                Receive SMS notifications for task reminders
              </p>
            </div>
            <Switch
              checked={smsEnabled}
              onCheckedChange={handleToggleSms}
              disabled={!phoneVerified}
            />
          </div>

          {!phoneNumber && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                Add your phone number above to enable SMS reminders.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Integrations */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            <CardTitle>Integrations</CardTitle>
            <Badge variant="secondary" className="ml-auto">Coming Soon</Badge>
          </div>
          <CardDescription>
            Connect external services to Pulse
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Google Calendar Integration */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                <Label className="font-medium">Google Calendar</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Sync tasks with Google Calendar events
              </p>
            </div>
            <Switch disabled />
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              Calendar integration will be available in a future update.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            <CardTitle>Security</CardTitle>
          </div>
          <CardDescription>Manage your account security</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Change Password</Label>
            <div className="flex gap-2">
              <Input type="password" placeholder="Current password" disabled />
              <Input type="password" placeholder="New password" disabled />
              <Button variant="outline" disabled>
                Update
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Password change functionality coming soon
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Help & Support */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            <CardTitle>Help & Support</CardTitle>
          </div>
          <CardDescription>Get help with using Pulse</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Onboarding Tour</p>
              <p className="text-sm text-muted-foreground">
                Take a guided tour of the main features
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                resetOnboarding()
                router.push('/dashboard?tour=true')
              }}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Restart Tour
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible actions for your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Sign Out</p>
              <p className="text-sm text-muted-foreground">
                Sign out of your account on this device
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={handleSignOut}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="mr-2 h-4 w-4" />
              )}
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
