import { useState, useEffect, useCallback, useRef } from 'react'

/** Generate a secure random token */
function generateToken(): string {
  return crypto.randomUUID()
}

/**
 * Hook to manage QR token lifecycle
 * - Generates token on mount
 * - Auto-refreshes when expired
 * - Registers token with Hub
 */
export function useQRToken(agentId: string, expirySeconds: number) {
  const [token, setToken] = useState(generateToken)
  const [expiresAt, setExpiresAt] = useState(() => Date.now() + expirySeconds * 1000)

  const refresh = useCallback(() => {
    const newToken = generateToken()
    const newExpiry = Date.now() + expirySeconds * 1000
    setToken(newToken)
    setExpiresAt(newExpiry)
    window.electronAPI?.hub.registerToken(newToken, agentId, newExpiry)
  }, [agentId, expirySeconds])

  // Register initial token
  useEffect(() => {
    window.electronAPI?.hub.registerToken(token, agentId, expiresAt)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { token, expiresAt, refresh }
}

/**
 * Hook for countdown timer
 * Returns remaining seconds, auto-updates every second
 */
export function useCountdown(expiresAt: number, onExpire: () => void) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
  )
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  useEffect(() => {
    // Reset when expiresAt changes
    setRemaining(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)))

    const id = setInterval(() => {
      const next = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
      setRemaining(next)
      if (next === 0) onExpireRef.current()
    }, 1000)

    return () => clearInterval(id)
  }, [expiresAt])

  return remaining
}
