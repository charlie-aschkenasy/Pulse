import twilio from 'twilio'

// Validate environment variables
const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER

if (!accountSid || !authToken || !twilioPhoneNumber) {
  console.warn('Twilio credentials not configured. SMS reminders will be disabled.')
}

// Create Twilio client (lazy initialization)
let twilioClient: twilio.Twilio | null = null

function getClient(): twilio.Twilio | null {
  if (!accountSid || !authToken) {
    return null
  }
  if (!twilioClient) {
    twilioClient = twilio(accountSid, authToken)
  }
  return twilioClient
}

export interface SendSmsResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Send an SMS message via Twilio
 */
export async function sendSms(to: string, body: string): Promise<SendSmsResult> {
  const client = getClient()

  if (!client || !twilioPhoneNumber) {
    return {
      success: false,
      error: 'Twilio not configured',
    }
  }

  try {
    const message = await client.messages.create({
      body,
      from: twilioPhoneNumber,
      to,
    })

    return {
      success: true,
      messageId: message.sid,
    }
  } catch (error) {
    console.error('Twilio SMS error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send SMS',
    }
  }
}

/**
 * Send a task reminder SMS
 */
export async function sendTaskReminderSms(
  to: string,
  taskTitle: string,
  dueInfo?: string
): Promise<SendSmsResult> {
  const body = dueInfo
    ? `Pulse Reminder: "${taskTitle}" - ${dueInfo}`
    : `Pulse Reminder: "${taskTitle}"`

  return sendSms(to, body)
}

/**
 * Send a test SMS to verify phone number
 */
export async function sendTestSms(to: string): Promise<SendSmsResult> {
  const body = 'Pulse: Your phone number has been verified for SMS reminders.'
  return sendSms(to, body)
}

/**
 * Validate US phone number format
 * Accepts: (123) 456-7890, 123-456-7890, 1234567890, +1234567890
 * Returns E.164 format: +1XXXXXXXXXX
 */
export function validateAndFormatPhoneNumber(phone: string): { valid: boolean; formatted?: string; error?: string } {
  // Remove all non-digit characters except leading +
  const cleaned = phone.replace(/[^\d+]/g, '')

  // Check if it starts with + (international format)
  let digits = cleaned.startsWith('+') ? cleaned.slice(1) : cleaned

  // Add country code if not present (assume US)
  if (digits.length === 10) {
    digits = '1' + digits
  }

  // Validate: should be 11 digits starting with 1 for US
  if (digits.length !== 11 || !digits.startsWith('1')) {
    return {
      valid: false,
      error: 'Please enter a valid US phone number',
    }
  }

  return {
    valid: true,
    formatted: '+' + digits,
  }
}

/**
 * Check if Twilio is properly configured
 */
export function isTwilioConfigured(): boolean {
  return !!(accountSid && authToken && twilioPhoneNumber)
}
