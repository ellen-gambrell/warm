export type AccessProfile =
  | 'stylus'       // Limited touch, stylus — Margaret's profile
  | 'voice'        // Voice only — C3-C4, no reliable touch
  | 'switch'       // Sip-and-puff or switch scanning
  | 'gaze'         // Eye gaze
  | 'touch'        // Standard touch with weakness — C7-T1

export interface UserProfile {
  accessProfile: AccessProfile
  name: string
  fontSize: 'normal' | 'large' | 'xlarge'
  ttsEnabled: boolean
  ttsRate: number  // 0.5–1.5
}

export const DEFAULT_PROFILE: UserProfile = {
  accessProfile: 'stylus',
  name: '',
  fontSize: 'large',
  ttsEnabled: true,
  ttsRate: 0.9,
}

export const PROFILE_LABELS: Record<AccessProfile, string> = {
  stylus: 'Stylus or limited touch',
  voice: 'Voice only',
  switch: 'Sip-and-puff or switch',
  gaze: 'Eye gaze',
  touch: 'Touch with reduced strength',
}

export const PROFILE_DESCRIPTIONS: Record<AccessProfile, string> = {
  stylus: 'You use a stylus or one finger. Touch targets are enlarged and multi-touch is never required.',
  voice: 'You control everything by speaking. No tapping is ever required.',
  switch: 'You use a sip-and-puff tube or switch. Navigation is scan-optimized with minimal menu depth.',
  gaze: 'You control the screen with your eyes. All actions use dwell selection with no time pressure.',
  touch: 'You use touch but with reduced strength or precision. Targets are large and well-spaced.',
}
