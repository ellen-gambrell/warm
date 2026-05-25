import type { Reminder } from '../context/ReminderContext'

export type VoiceCommand =
  | { type: 'navigate'; destination: string; path: string }
  | { type: 'reminder_add'; label: string; intervalMinutes: number }
  | { type: 'reminder_snooze'; reminderId: string; reminderLabel: string }
  | { type: 'reminder_dismiss'; reminderId: string; reminderLabel: string }
  | { type: 'unknown' }

const DESTINATIONS = [
  { path: '/',          label: 'Home',         aliases: ['home screen', 'home'] },
  { path: '/chat',      label: 'Ask anything', aliases: ['ask anything', 'chat', 'ai'] },
  { path: '/gmail',     label: 'Gmail',        aliases: ['gmail', 'email', 'mail'] },
  { path: '/drive',     label: 'Google Drive', aliases: ['google drive', 'drive', 'files'] },
  { path: '/reminders', label: 'Reminders',    aliases: ['reminders', 'reminder', 'timers', 'timer'] },
  { path: '/bills',     label: 'Bills',        aliases: ['bills', 'bill'] },
  { path: '/gif',       label: 'Find a GIF',   aliases: ['find a gif', 'gifs', 'gif'] },
  { path: '/money',     label: 'Venmo',        aliases: ['venmo', 'money'] },
  { path: '/check-run', label: 'Check Run',    aliases: ['check run', 'checks'] },
  { path: '/menu',      label: "Today's Menu", aliases: ["today's menu", 'todays menu', 'menu', 'food'] },
  { path: '/settings',  label: 'Settings',     aliases: ['settings'] },
  { path: '/profile',   label: 'Profile',      aliases: ['profile'] },
  { path: '/admin',     label: 'Admin',        aliases: ['admin'] },
]

export function formatInterval(minutes: number): string {
  if (minutes === 30) return '30-minute'
  if (minutes === 60) return '1-hour'
  if (minutes === 120) return '2-hour'
  if (minutes === 240) return '4-hour'
  return '8-hour'
}

function parseInterval(text: string): number | null {
  const t = text.toLowerCase()
  if (t.includes('30 min') || t.includes('thirty min') || t.includes('half hour') || t.includes('half an hour')) return 30
  if (t.includes('8 hour') || t.includes('eight hour')) return 480
  if (t.includes('4 hour') || t.includes('four hour')) return 240
  if (t.includes('2 hour') || t.includes('two hour')) return 120
  if (t.includes('1 hour') || t.includes('one hour') || t.includes('an hour') || t.includes('hour')) return 60
  return null
}

function normalizeLabel(spoken: string): string {
  return spoken
    .replace(/\b(the|my|a|an|reminder|reminders)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function fuzzyMatchReminder(spoken: string, reminders: Reminder[]): Reminder | null {
  const s = normalizeLabel(spoken)
  return (
    reminders.find(r => r.label.toLowerCase() === s) ??
    reminders.find(r => r.label.toLowerCase().includes(s)) ??
    reminders.find(r => s.includes(r.label.toLowerCase())) ??
    null
  )
}

export function parseVoiceCommand(transcript: string, reminders: Reminder[]): VoiceCommand {
  const t = transcript.toLowerCase().trim()

  // Reminder add — must check before navigation to avoid "reminder" matching nav
  const addMatch = t.match(/(?:add|set|create)\s+(?:a\s+)?reminder\s+for\s+(.+?)\s+every\s+(.+)/)
  if (addMatch) {
    const label = normalizeLabel(addMatch[1]) || addMatch[1].trim()
    const intervalMinutes = parseInterval(addMatch[2])
    if (label && intervalMinutes) {
      return { type: 'reminder_add', label, intervalMinutes }
    }
  }

  // Reminder snooze / pause
  const snoozeMatch = t.match(/(?:snooze|pause)\s+(.+)/)
  if (snoozeMatch) {
    const reminder = fuzzyMatchReminder(snoozeMatch[1], reminders)
    if (reminder) {
      return { type: 'reminder_snooze', reminderId: reminder.id, reminderLabel: reminder.label }
    }
  }

  // Reminder dismiss / done
  const dismissMatch = t.match(/(?:done|dismiss)\s+(.+)/)
  if (dismissMatch) {
    const reminder = fuzzyMatchReminder(dismissMatch[1], reminders)
    if (reminder) {
      return { type: 'reminder_dismiss', reminderId: reminder.id, reminderLabel: reminder.label }
    }
  }

  // Navigation — find all destinations whose aliases appear in the transcript
  const matches = DESTINATIONS.filter(dest =>
    dest.aliases.some(alias => t.includes(alias))
  )

  if (matches.length === 1) {
    return { type: 'navigate', destination: matches[0].label, path: matches[0].path }
  }

  return { type: 'unknown' }
}
