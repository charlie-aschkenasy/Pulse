'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { validateAndFormatPhoneNumber, sendTestSms } from '@/lib/twilio'

export async function getProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated', data: null }
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  return { data, error: null }
}

export async function updatePhoneNumber(phoneNumber: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated', data: null }
  }

  // Validate and format phone number
  const validation = validateAndFormatPhoneNumber(phoneNumber)
  if (!validation.valid) {
    return { error: validation.error, data: null }
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({
      phone_number: validation.formatted,
      phone_verified: false,
      sms_reminders_enabled: false,
    })
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath('/settings')
  return { data, error: null }
}

export async function sendVerificationSms() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated', data: null }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('phone_number')
    .eq('user_id', user.id)
    .single()

  if (!profile?.phone_number) {
    return { error: 'No phone number configured', data: null }
  }

  const result = await sendTestSms(profile.phone_number)

  if (!result.success) {
    return { error: result.error || 'Failed to send SMS', data: null }
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({
      phone_verified: true,
      sms_reminders_enabled: true,
    })
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath('/settings')
  return { data, error: null }
}

export async function toggleSmsReminders(enabled: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated', data: null }
  }

  if (enabled) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('phone_verified, phone_number')
      .eq('user_id', user.id)
      .single()

    if (!profile?.phone_number) {
      return { error: 'Please add a phone number first', data: null }
    }

    if (!profile?.phone_verified) {
      return { error: 'Please verify your phone number first', data: null }
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ sms_reminders_enabled: enabled })
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath('/settings')
  return { data, error: null }
}

export async function updateTimezone(timezone: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated', data: null }
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ timezone })
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    return { error: error.message, data: null }
  }

  revalidatePath('/settings')
  return { data, error: null }
}
