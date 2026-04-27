/**
 * SupporterDashboard — role-aware portal for supporters.
 * Shows only the sections relevant to this supporter's role.
 */

import { useState } from 'react'
import { useSupporterAuth } from '../context/SupporterAuthContext'
import MenuEditor from './supporter/MenuEditor'
import SupporterManagement from './supporter/SupporterManagement'

type Tab = 'menu' | 'supporters'

const MENU_EDIT_ROLES = new Set(['key_contact', 'family_secondary', 'homemaker'])
const MANAGE_ROLES = new Set(['key_contact'])

export default function SupporterDashboard() {
  const { supporter, logout } = useSupporterAuth()
  const [tab, setTab] = useState<Tab>('menu')
  const [loggingOut, setLoggingOut] = useState(false)

  if (!supporter) return null

  const canEditMenu = MENU_EDIT_ROLES.has(supporter.role)
  const canManage = MANAGE_ROLES.has(supporter.role)

  const doLogout = async () => {
    setLoggingOut(true)
    await logout()
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--color-bg)',
        padding: '0 0 80px',
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          background: 'var(--color-surface)',
          borderBottom: '2px solid var(--color-border)',
          padding: '20px 24px 16px',
        }}
      >
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 600, color: 'var(--color-accent)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            warm.care supporter
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.1 }}>
                {supporter.name}
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: 16, color: 'var(--color-text-muted)' }}>
                {supporter.role_label}
              </p>
            </div>
            <button
              onClick={doLogout}
              disabled={loggingOut}
              style={{
                minHeight: 48,
                padding: '0 18px',
                borderRadius: 12,
                border: '2px solid var(--color-border)',
                background: 'transparent',
                color: 'var(--color-text-muted)',
                fontFamily: 'inherit',
                fontWeight: 600,
                fontSize: 15,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {loggingOut ? '…' : 'Sign out'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Tab bar (only if more than one section available) ── */}
      {canManage && (
        <div
          style={{
            display: 'flex',
            background: 'var(--color-surface)',
            borderBottom: '2px solid var(--color-border)',
          }}
        >
          {[
            { key: 'menu' as Tab, label: '🍽️ Menu', show: canEditMenu },
            { key: 'supporters' as Tab, label: '👥 Supporters', show: canManage },
          ]
            .filter(t => t.show)
            .map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  flex: 1,
                  minHeight: 56,
                  border: 'none',
                  borderBottom: tab === t.key ? '3px solid var(--color-accent)' : '3px solid transparent',
                  background: 'transparent',
                  color: tab === t.key ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  fontFamily: 'inherit',
                  fontWeight: 700,
                  fontSize: 17,
                  cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            ))}
        </div>
      )}

      {/* ── Content ── */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 20px' }}>
        {/* Section header */}
        {!canManage && (
          <h2 style={{ margin: '0 0 20px', fontSize: 24, fontWeight: 800, color: 'var(--color-text)' }}>
            🍽️ Daily Menu
          </h2>
        )}

        {canManage && tab === 'supporters' ? (
          <>
            <h2 style={{ margin: '0 0 20px', fontSize: 24, fontWeight: 800, color: 'var(--color-text)' }}>
              👥 Supporter Accounts
            </h2>
            <SupporterManagement />
          </>
        ) : canEditMenu ? (
          <MenuEditor />
        ) : (
          /* Roles that can see the menu but can't edit it */
          <div style={{ textAlign: 'center', padding: '60px 24px' }}>
            <p style={{ fontSize: 40, margin: '0 0 16px' }}>👋</p>
            <p style={{ fontSize: 20, color: 'var(--color-text-muted)' }}>
              You're signed in as <strong>{supporter.role_label}</strong>.
            </p>
            <p style={{ fontSize: 18, color: 'var(--color-text-muted)', marginTop: 8 }}>
              More supporter features coming soon.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
