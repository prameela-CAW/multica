import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Loader2 } from 'lucide-react'
import { useQRToken, useCountdown } from './qr-hooks'
import { QRCodeFrame, ExpiryTimer } from './qr-code'

export interface TelegramConnectQRProps {
  gateway: string
  hubId: string
  agentId: string
  expirySeconds?: number
  size?: number
}

/**
 * Telegram QR code for deep link connection flow.
 *
 * Generates a token, sends it to Gateway to create a short code,
 * then renders a QR encoding https://t.me/{botUsername}?start={code}.
 * Auto-refreshes when the token expires.
 */
export function TelegramConnectQR({
  gateway,
  hubId,
  agentId,
  expirySeconds = 30,
  size = 200,
}: TelegramConnectQRProps) {
  const { token, expiresAt, refresh } = useQRToken(agentId, expirySeconds)
  const remaining = useCountdown(expiresAt, refresh)

  const [deepLink, setDeepLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function fetchCode() {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch(`${gateway}/telegram/connect-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gateway, hubId, agentId, token, expires: expiresAt }),
        })

        if (cancelled) return

        if (!res.ok) {
          if (res.status === 503) {
            setError('Telegram bot not configured on Gateway')
          } else {
            setError(`Gateway error: ${res.statusText}`)
          }
          setDeepLink(null)
          return
        }

        const data = (await res.json()) as { code: string; botUsername: string }
        if (cancelled) return

        setDeepLink(`https://t.me/${data.botUsername}?start=${data.code}`)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to connect to Gateway')
        setDeepLink(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchCode()
    return () => { cancelled = true }
  }, [token, expiresAt, gateway, hubId, agentId])

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 py-4">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  if (!deepLink) return null

  return (
    <div className="flex flex-col items-center gap-4">
      <QRCodeFrame>
        <QRCodeSVG
          value={deepLink}
          size={size}
          level="M"
          marginSize={0}
          bgColor="#ffffff"
          fgColor="#0a0a0a"
        />
      </QRCodeFrame>

      <ExpiryTimer remaining={remaining} />
    </div>
  )
}
