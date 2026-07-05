import { usePrivy } from '@privy-io/react-auth'

export function PrivyLogin() {
  const { login, logout, authenticated, user, ready } = usePrivy()

  if (!ready) {
    return (
      <button disabled style={{ padding: '10px 20px', opacity: 0.5 }}>
        loading...
      </button>
    )
  }

  if (!authenticated) {
    return (
      <button
        onClick={login}
        style={{
          background: '#0000FF',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: '12px',
          padding: '12px 24px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Connect Wallet
      </button>
    )
  }

  const wallet = user?.wallet?.address
  const display = wallet
    ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}`
    : 'connected'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <span style={{ fontSize: '14px', fontWeight: 500, color: '#0A0B0D' }}>
        {display}
      </span>
      <button
        onClick={logout}
        style={{
          background: '#EEF0F3',
          color: '#32353D',
          border: 'none',
          borderRadius: '12px',
          padding: '10px 16px',
          fontSize: '13px',
          cursor: 'pointer',
        }}
      >
        Disconnect
      </button>
    </div>
  )
}
