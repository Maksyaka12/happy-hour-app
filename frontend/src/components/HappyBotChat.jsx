import { useState, useEffect, useRef } from 'react'
import { useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import { COORDINATOR_ADDRESS, COORDINATOR_ABI } from '../config/constants'

export function HappyBotChat({ address, isClubMember }) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: 'Привіт! Я твій персональний Happy Bot асистент. 🤖 Можу підказати твій баланс HP, стрік чек-інів, статус підписки та допомогти налаштувати авто-дії. Чим можу допомогти?',
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

      if (query.includes('привіт') || query.includes('hello') || query.includes('hi')) {
        botResponse = `Привіт! Радий бачити тебе. ${address ? 'Я готовий відповісти на будь-які питання про твою активність у Happy Hour.' : 'Будь ласка, підключи свій гаманець, щоб я міг бачити твою статистику.'}`
      } else if (query.includes('поінт') || query.includes('hp') || query.includes('баланс') || query.includes('points')) {
        botResponse = address 
          ? `Твій поточний баланс: *${hp} HP* (Happy Points). Продовжуй активність, щоб заробити більше!` 
          : 'Підключи гаманець, щоб дізнатися свій баланс поінтів.'
      } else if (query.includes('стрік') || query.includes('streak') || query.includes('чек-ін') || query.includes('checkin')) {
        botResponse = address
          ? `Твій поточний стрік чек-інів: *${streak} днів* 🔥. ${canCheckIn ? 'Ти можеш зробити чек-ін прямо зараз!' : 'Сьогодні ти вже зробив чек-ін. Повертайся завтра!'}`
          : 'Підключи гаманець, щоб побачити свій стрік.'
      } else if (query.includes('стрік') || query.includes('streak') || query.includes('чек-ін') || query.includes('checkin')) {
        botResponse = address
          ? `Твій поточний стрік чек-інів: *${streak} днів* 🔥. ${canCheckIn ? 'Ти можеш зробити чек-ін прямо зараз!' : 'Сьогодні ти вже зробив чек-ін. Повертайся завтра!'}`
          : 'Підключи гаманець, щоб побачити свій стрік.'
      } else if (query.includes('стейк') || query.includes('stake') || query.includes('staking')) {
        botResponse = address
          ? `Зараз у тебе застейкано *${totalStaked.toLocaleString()} $HH*. Стейкінг приносить APR та дає право на бейдж Happy Staker (+5% шанс у раффлах)!`
          : 'Підключи гаманець, щоб перевірити застейкані токени.'
      } else if (query.includes('рафл') || query.includes('raffle') || query.includes('квит') || query.includes('ticket')) {
        botResponse = address
          ? `У поточному годинному раунді у тебе *${raffleTickets} квитків*. Нагадую, що купівля квитка також автоматично реєструє тебе у Daily Raffle з бустами!`
          : 'Підключи гаманець, щоб побачити свої квитки.'
      } else if (query.includes('клуб') || query.includes('club') || query.includes('підписк') || query.includes('premium') || query.includes('преміум')) {
        botResponse = isClubMember
          ? '👑 Ти є учасником Happy Club! Тобі доступні безлімітні запити та авто-дії.'
          : 'Ти ще не приєднався до Happy Club. Підписка коштує $10/місяць і відкриває авто-чек-ін та авто-депозити. Приєднатися можна в профілі!'
      } else if (query.includes('автомат') || query.includes('auto') || query.includes('налаштув')) {
        if (!isClubMember) {
          botResponse = '⚠️ Автоматизація доступна лише для членів Happy Club. Приєднайся до клубу в профілі, щоб увімкнути авто-чек-ін та авто-депозити.'
        } else {
          botResponse = '🤖 Автоматизація активна! Твої агенти автоматично роблять чек-ін кожні 24 години та купують квитки в раффлах відповідно до налаштувань.'
        }
      } else {
        botResponse = 'Я розумію питання про: поінти (HP), стріки, стейкінг, квитки в раффлах, статус підписки Happy Club та автоматизацію. Спробуй запитати: "Скільки в мене поінтів?" або "Який мій стрік?"'
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
          bottom: 84,
          right: 20,
          width: 54,
          height: 54,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
          color: '#FFFFFF',
          border: '1px solid rgba(255, 255, 255, 0.25)',
          boxShadow: '0 8px 24px rgba(139, 92, 246, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
          cursor: 'pointer',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
          outline: 'none',
          transition: 'transform 0.2s ease-in-out',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        {isOpen ? '✕' : '🤖'}
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
              placeholder="Спитай щось про твої HP чи Стрік..."
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
