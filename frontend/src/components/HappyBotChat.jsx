import { useState, useEffect, useRef } from 'react'
import { useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import { COORDINATOR_ADDRESS, COORDINATOR_ABI } from '../config/constants'

export function HappyBotChat({ address, isClubMember }) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: 'Hi! I am your personal Happy Bot assistant. 🤖 I can help you check your HP balance, check-in streak, subscription status, and set up routine automations. How can I help you today?',
      time: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)

  // Fetch complete user summary directly from contract for context
  const { data: summary } = useReadContract({
    address: COORDINATOR_ADDRESS,
    abi: COORDINATOR_ABI,
    functionName: 'getUserSummary',
    args: address ? [address] : undefined,
    query: { enabled: !!address && isOpen, refetchInterval: 15000 }
  })

  // Parse summary data
  const hp = summary ? Number(summary[0]) : 0
  const streak = summary ? Number(summary[1]) : 0
  const canCheckIn = summary ? summary[3] : false
  const raffleTickets = summary ? Number(summary[6]) : 0
  const totalStaked = summary ? Number(formatUnits(summary[14], 18)) : 0

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const handleSend = () => {
    if (!input.trim()) return

    const userMessage = {
      sender: 'user',
      text: input,
      time: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')

    // Generate dynamic response based on user inputs
    setTimeout(() => {
      let botResponse = ''
      const query = input.toLowerCase()

      if (query.includes('hi') || query.includes('hello') || query.includes('hey') || query.includes('привіт')) {
        botResponse = `Hello! Great to see you. ${address ? 'I am ready to answer any questions about your activity in Happy Hour.' : 'Please connect your wallet so I can check your stats.'}`
      } else if (query.includes('point') || query.includes('hp') || query.includes('balance') || query.includes('поінт')) {
        botResponse = address 
          ? `Your current balance is *${hp} HP* (Happy Points). Keep up the activity to earn more!` 
          : 'Please connect your wallet to check your points balance.'
      } else if (query.includes('streak') || query.includes('check-in') || query.includes('checkin') || query.includes('стрік')) {
        botResponse = address
          ? `Your current check-in streak is *${streak} days* 🔥. ${canCheckIn ? 'You can check in right now!' : 'You have already checked in today. See you tomorrow!'}`
          : 'Please connect your wallet to view your streak.'
      } else if (query.includes('stake') || query.includes('staking') || query.includes('стейк')) {
        botResponse = address
          ? `You currently have *${totalStaked.toLocaleString()} $HH* staked. Staking yields APR and awards the Happy Staker badge (+5% chance in raffles)!`
          : 'Please connect your wallet to check your staked tokens.'
      } else if (query.includes('raffle') || query.includes('ticket') || query.includes('рафл') || query.includes('квит')) {
        botResponse = address
          ? `In the current hourly round, you have *${raffleTickets} tickets*. Remember, buying an hourly ticket automatically qualifies you for the Daily Raffle with your active boosts!`
          : 'Please connect your wallet to check your tickets.'
      } else if (query.includes('club') || query.includes('membership') || query.includes('premium') || query.includes('клуб') || query.includes('підписк')) {
        botResponse = isClubMember
          ? '👑 You are a member of the Happy Club! Unlimited queries and automated routine actions are enabled.'
          : "You haven't joined the Happy Club yet. The membership costs ~$10/month and unlocks automatic check-ins and auto-buys. You can join via the Profile section!"
      } else if (query.includes('auto') || query.includes('routine') || query.includes('robot') || query.includes('автомат')) {
        if (!isClubMember) {
          botResponse = '⚠️ Automation is only available for Happy Club members. Join the club in your Profile to enable auto-check-ins and auto-buys.'
        } else {
          botResponse = '🤖 Automation is active! Your routine agents automatically perform check-ins every 24 hours and buy raffle tickets based on your preferences.'
        }
      } else {
        botResponse = 'I understand questions about: points (HP), streaks, staking, raffle tickets, Happy Club membership, and automation. Try asking: "How many points do I have?" or "What is my streak?"'
      }

      setMessages(prev => [...prev, {
        sender: 'bot',
        text: botResponse,
        time: new Date()
      }])
    }, 800)
  }

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: 16,
          background: 'url(/logo.jfif) center/cover',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
          cursor: 'pointer',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          outline: 'none',
          transition: 'transform 0.2s ease-in-out',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        {isOpen && (
          <div style={{ position: 'absolute', top: -10, right: -10, background: '#111', color: '#fff', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>✕</div>
        )}
      </button>

      {/* Chat Drawer / Window */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: 150,
          right: 20,
          width: 'calc(100% - 40px)',
          maxWidth: 380,
          height: 480,
          borderRadius: 24,
          background: '#0B0D16',
          border: '1px solid rgba(139, 92, 246, 0.35)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.6), 0 0 15px rgba(139, 92, 246, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: 9998,
          animation: 'slideUp 0.25s ease-out'
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 18px',
            background: 'linear-gradient(90deg, #180C2C 0%, #0F0D1B 100%)',
            borderBottom: '1px solid rgba(139, 92, 246, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: 10
          }}>
            <span style={{ fontSize: 20 }}>🤖</span>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 950, color: '#FFFFFF', letterSpacing: '0.1px', fontFamily: "'Outfit', sans-serif" }}>
                HAPPY HOUR BOT
              </div>
              <div style={{ fontSize: 9, color: '#A78BFA', fontWeight: 800 }}>AI Consumer Assistant</div>
            </div>
          </div>

          {/* Messages Area */}
          <div style={{
            flex: 1,
            padding: '16px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            background: 'radial-gradient(circle at bottom right, rgba(139, 92, 246, 0.05) 0%, transparent 60%)'
          }}>
            {messages.map((m, i) => {
              const isBot = m.sender === 'bot'
              return (
                <div
                  key={i}
                  style={{
                    alignSelf: isBot ? 'flex-start' : 'flex-end',
                    maxWidth: '85%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3
                  }}
                >
                  <div style={{
                    background: isBot ? 'rgba(255, 255, 255, 0.04)' : 'linear-gradient(135deg, #6D28D9 0%, #5B21B6 100%)',
                    border: isBot ? '1px solid rgba(139, 92, 246, 0.15)' : '1px solid rgba(255, 255, 255, 0.1)',
                    padding: '10px 14px',
                    borderRadius: isBot ? '18px 18px 18px 4px' : '18px 18px 4px 18px',
                    color: '#E2E8F0',
                    fontSize: 12.5,
                    fontWeight: 550,
                    lineHeight: 1.4,
                    wordBreak: 'break-word',
                    fontFamily: "'Outfit', sans-serif"
                  }}>
                    {m.text}
                  </div>
                  <span style={{
                    fontSize: 8,
                    color: 'rgba(255, 255, 255, 0.35)',
                    alignSelf: isBot ? 'flex-start' : 'flex-end',
                    fontWeight: 700
                  }}>
                    {m.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Row */}
          <div style={{
            padding: '10px 14px',
            background: '#07080E',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            gap: 8,
            alignItems: 'center'
          }}>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
              placeholder="Ask about your HP, streak, staking..."
              style={{
                flex: 1,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 14,
                padding: '10px 14px',
                color: '#FFFFFF',
                fontSize: 12.5,
                fontWeight: 600,
                outline: 'none',
                fontFamily: "'Outfit', sans-serif"
              }}
            />
            <button
              onClick={handleSend}
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
                color: '#FFFFFF',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                fontWeight: 900
              }}
            >
              ➔
            </button>
          </div>
        </div>
      )}
    </>
  )
}
