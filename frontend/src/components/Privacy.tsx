import NavBar from './NavBar'

export default function Privacy() {
  return (
    <>
      <NavBar />
      <div
        style={{
          maxWidth: 680,
          margin: '0 auto',
          padding: '32px 24px 48px',
        }}
      >
        <h1
          style={{
            fontSize: 'var(--fs-xl)',
            fontWeight: 700,
            color: 'var(--color-text)',
            margin: '0 0 4px',
          }}
        >
          Privacy Policy
        </h1>
        <p
          style={{
            fontSize: 'var(--fs-sm)',
            color: 'var(--color-text-muted)',
            margin: '0 0 32px',
          }}
        >
          Last updated: May 13, 2026
        </p>

        <p style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text)', lineHeight: 1.6, margin: '0 0 24px' }}>
          warm.care is a personal assistive technology project operated by Quantum Moon LLC. This policy explains what information is collected and how it is used.
        </p>

        <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 600, color: 'var(--color-text)', margin: '32px 0 12px' }}>
          What we collect
        </h2>

        <p style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text)', lineHeight: 1.6, margin: '0 0 16px' }}>
          When you sign in, we receive your name and email address from Google. We store this to identify your account.
        </p>

        <p style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text)', lineHeight: 1.6, margin: '0 0 16px' }}>
          If you connect Gmail or Google Drive, warm.care reads your email and file content on your request. This content is not stored on our servers. It is fetched from Google in real time and displayed to you.
        </p>

        <p style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text)', lineHeight: 1.6, margin: '0 0 16px' }}>
          If you use AI Chat, your messages are sent to Google's Gemini API to generate responses. If you have connected Monarch Money, relevant account summary data may be included in those messages. See Google's privacy policy for how they handle API data.
        </p>

        <p style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text)', lineHeight: 1.6, margin: '0 0 16px' }}>
          If you add bill records (company name, phone number, customer number), that information is stored on our servers and is only visible to you and any supporters you have invited.
        </p>

        <p style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text)', lineHeight: 1.6, margin: '0 0 16px' }}>
          If you create custom AI cards, your card prompts are stored on our servers and sent to Google's Gemini API on a schedule to generate results. Results are stored on our servers.
        </p>

        <p style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text)', lineHeight: 1.6, margin: '0 0 16px' }}>
          If you use GIF search, your search query is sent to the Giphy API. No personal information is included in that request.
        </p>

        <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 600, color: 'var(--color-text)', margin: '32px 0 12px' }}>
          How we store your data
        </h2>

        <p style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text)', lineHeight: 1.6, margin: '0 0 16px' }}>
          Your data is stored on a private server. OAuth tokens (for Gmail, Google Drive) are encrypted at rest. Your Monarch Money credentials are never stored — only a session token, which is also encrypted.
        </p>

        <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 600, color: 'var(--color-text)', margin: '32px 0 12px' }}>
          Who we share data with
        </h2>

        <p style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text)', lineHeight: 1.6, margin: '0 0 12px' }}>
          We do not sell your data. We share data with third-party services only as required to operate the app:
        </p>

        <ul
          style={{
            fontSize: 'var(--fs-base)',
            color: 'var(--color-text)',
            lineHeight: 1.6,
            margin: '0 0 16px',
            paddingLeft: 24,
          }}
        >
          <li>Google (Gmail API, Google Drive API, Gemini API, Google OAuth)</li>
          <li>Giphy (GIF search)</li>
        </ul>

        <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 600, color: 'var(--color-text)', margin: '32px 0 12px' }}>
          Your choices
        </h2>

        <p style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text)', lineHeight: 1.6, margin: '0 0 16px' }}>
          You can disconnect any connected service at any time in Settings. You can delete your account by contacting us. When your account is deleted, all stored data is removed.
        </p>

        <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 600, color: 'var(--color-text)', margin: '32px 0 12px' }}>
          Contact
        </h2>

        <p style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text)', lineHeight: 1.6, margin: '0 0 16px' }}>
          For questions or deletion requests:{' '}
          <a
            href="mailto:ellengambrell@gmail.com"
            style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}
          >
            ellengambrell@gmail.com
          </a>
        </p>

        <footer
          style={{
            marginTop: 48,
            paddingTop: 16,
            borderTop: '1px solid var(--color-border)',
            textAlign: 'center',
            fontSize: 12,
            color: 'var(--color-text-muted)',
          }}
        >
          <p style={{ margin: 0 }}>
            The views, thoughts, and opinions expressed on this site are solely my own and do not represent those of my employer, KPMG.
          </p>
          <p style={{ margin: '4px 0 0' }}>© 2026 Quantum Moon LLC. All rights reserved.</p>
        </footer>
      </div>
    </>
  )
}
