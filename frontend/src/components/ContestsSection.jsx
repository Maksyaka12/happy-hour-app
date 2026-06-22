import { useState, useEffect } from 'react'
import { db } from '../config/supabase'

const calculateContestTimeLeft = () => {
  // Target date: June 27, 2026 at 19:52:00 UTC (exactly 5 days from June 22, 2026)
  // Month index 5 is June
  const target = new Date(Date.UTC(2026, 5, 27, 19, 52, 0))
  const now = new Date()
  const diff = target.getTime() - now.getTime()
  
  if (isNaN(diff) || diff <= 0) return '00d 00h 00m 00s'
  
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  
  return `${d}d ${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`
}

export function ContestsSection({ setTab, address }) {
  const [activeContest, setActiveContest] = useState(null)
  const [contestTimeLeft, setContestTimeLeft] = useState(calculateContestTimeLeft())

  // Submit Form States
  const [postUrl, setPostUrl] = useState('')
  const [postStatus, setPostStatus] = useState('') // '', 'submitting', 'success', 'error'
  const [postMsg, setPostMsg] = useState('')

  // Admin Review States
  const [submissions, setSubmissions] = useState([])
  const [showAdminSubmissions, setShowAdminSubmissions] = useState(false)
  const [loadingSubmissions, setLoadingSubmissions] = useState(false)

  const handleSubmitPost = async () => {
    if (!address) return
    if (!postUrl.startsWith('http://') && !postUrl.startsWith('https://')) {
      setPostMsg('Link must start with http:// or https://')
      setPostStatus('error')
      return
    }
    setPostStatus('submitting')
    setPostMsg('')
    try {
      const { data, error } = await db.rpc('submit_contest_post', {
        p_address: address.toLowerCase(),
        p_url: postUrl.trim()
      })
      if (error || !data?.ok) {
        setPostMsg(data?.error || 'Failed to submit. Try again.')
        setPostStatus('error')
      } else {
        setPostMsg('Submitted successfully!')
        setPostStatus('success')
        setPostUrl('')
        if (showAdminSubmissions) {
          loadAdminSubmissions()
        }
      }
    } catch (err) {
      console.error(err)
      setPostMsg('An unexpected error occurred.')
      setPostStatus('error')
    }
  }

  const loadAdminSubmissions = async () => {
    if (!address) return
    setLoadingSubmissions(true)
    try {
      const { data, error } = await db.rpc('get_contest_submissions', {
        p_admin_address: address.toLowerCase()
      })
      if (!error && data) {
        setSubmissions(data)
      } else {
        console.error('loadAdminSubmissions error:', error)
      }
    } catch (err) {
      console.error(err)
    }
    setLoadingSubmissions(false)
  }

  useEffect(() => {
    if (showAdminSubmissions && address?.toLowerCase() === '0x4c91d3bed372c11795b9ce9a9017dfe447bf050a') {
      loadAdminSubmissions()
    }
  }, [address, showAdminSubmissions])

  useEffect(() => {
    const timer = setInterval(() => {
      setContestTimeLeft(calculateContestTimeLeft())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  if (activeContest === 'creator') {
    return (
      <div style={{ padding: '0 16px 120px' }}>
        {/* Back Button */}
        <button
          onClick={() => setActiveContest(null)}
          style={{
            background: 'none',
            border: 'none',
            color: '#717886',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 16,
            padding: 0,
            transition: 'color 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#F59E0B'}
          onMouseLeave={e => e.currentTarget.style.color = '#717886'}
        >
          ← Back to Contests
        </button>

        {/* Contest Banner - Themed to match the Contest Card */}
        <div style={{
          backgroundColor: '#2A1A06',
          borderRadius: 24,
          padding: '36px 20px',
          marginBottom: 20,
          position: 'relative',
          minHeight: 120,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(245, 158, 11, 0.15)',
          overflow: 'hidden',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          boxSizing: 'border-box'
        }}>
          {/* Style block for keyframes in case we are in detail view */}
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes floatingLogo {
              0% { transform: translateY(0px); }
              50% { transform: translateY(-6px); }
              100% { transform: translateY(0px); }
            }
          ` }} />

          {/* Graded background image with amber/warm gold hue filter */}
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'url(/banner.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'hue-rotate(25deg) brightness(0.5) contrast(1.15)',
            zIndex: 0,
            pointerEvents: 'none'
          }} />
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.15)', zIndex: 0 }} />
          
          {/* Floating creative emojis */}
          {[
            { char: '🎨', top: '10%', right: '15%', size: 28, opacity: 0.35, r: '15deg', dur: 4.2 },
            { char: '🖌️', bottom: '15%', left: '20%', size: 24, opacity: 0.3, r: '-20deg', dur: 4.8 },
            { char: '✏️', top: '45%', left: '8%', size: 22, opacity: 0.25, r: '10deg', dur: 5.5 },
            { char: '📝', bottom: '10%', right: '25%', size: 20, opacity: 0.3, r: '-15deg', dur: 3.9 }
          ].map((s, i) => (
            <div key={i} style={{
              position: 'absolute',
              top: s.top,
              right: s.right,
              left: s.left,
              bottom: s.bottom,
              zIndex: 1,
              pointerEvents: 'none',
              userSelect: 'none',
              animation: `floatingLogo ${s.dur}s ease-in-out infinite`,
              fontSize: s.size,
              opacity: s.opacity,
              transform: `rotate(${s.r})`,
              filter: 'blur(0.3px)'
            }}>
              {s.char}
            </div>
          ))}
          
          <div style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 38,
              fontWeight: 900,
              color: '#FFFFFF',
              lineHeight: 1.1,
              textShadow: '0 2px 10px rgba(0,0,0,0.5)',
              letterSpacing: '-0.5px'
            }}>
              Launch Contest
            </div>
            
            {/* Badges in Banner */}
            <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <div style={{
                background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                borderRadius: 50,
                height: 22,
                boxSizing: 'border-box',
                padding: '0 12px',
                fontSize: 10,
                fontWeight: 800,
                color: '#FFFFFF',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4
              }}>
                <span style={{ lineHeight: 1 }}>$120 in</span>
                <img src="/logo.jfif" alt="$HH" style={{ width: 12, height: 12, borderRadius: '50%', objectFit: 'cover' }} />
                <span style={{ lineHeight: 1 }}>$HH</span>
              </div>
              <div style={{
                background: 'rgba(0, 0, 0, 0.65)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 50,
                height: 22,
                boxSizing: 'border-box',
                padding: '0 12px',
                fontSize: 10,
                fontWeight: 800,
                color: '#FFFFFF',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span style={{ lineHeight: 1 }}>3 winners</span>
              </div>
              <div style={{
                background: 'rgba(252, 64, 31, 0.15)',
                border: '1px solid rgba(252, 64, 31, 0.3)',
                borderRadius: 50,
                height: 22,
                boxSizing: 'border-box',
                padding: '0 12px',
                fontSize: 10,
                fontWeight: 800,
                color: '#FC401F',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4
              }}>
                <span style={{ display: 'inline-block', lineHeight: 1 }}>left:</span>
                <span style={{ fontFamily: "'DM Mono', monospace", display: 'inline-block', lineHeight: 1 }}>{contestTimeLeft}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content Details (Glassmorphic Card) */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(245, 158, 11, 0.03) 100%)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid #2A1A06',
          borderRadius: 20,
          padding: '20px',
          boxShadow: '0 8px 32px rgba(245, 158, 11, 0.06)',
          boxSizing: 'border-box',
          color: '#1E293B',
          fontFamily: "'Outfit', 'Inter', sans-serif"
        }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 800, color: '#D97706' }}>About the Contest</h3>
          <p style={{ margin: '0 0 16px', fontSize: 13, lineHeight: 1.5, color: '#475569', fontWeight: 600 }}>
            In honor of the Season 2 launch - we are kicking off our Launch Contest dedicated to creators! Showcase your creativity to share a prize pool.
          </p>

          <div style={{ margin: '0 0 20px', fontSize: 13, color: '#475569', fontWeight: 500 }}>
            <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
              <li>Explore our updated app</li>
              <li>Create content about Happy Hour: guides, tutorials, videos, threads, art, or memes.</li>
              <li>Publish it on X and submit the link below.</li>
              <li>You can submit multiple links.</li>
            </ul>
          </div>

          <div style={{ borderTop: '1px solid rgba(245, 158, 11, 0.15)', paddingTop: 16 }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#1E293B' }}>Rewards breakdown:</h4>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#475569', lineHeight: 1.6, fontWeight: 500 }}>
              <li>1st Place: $60 in $HH tokens</li>
              <li>2nd Place: $30 in $HH tokens</li>
              <li>3rd Place: $30 in $HH tokens</li>
            </ul>
          </div>
        </div>

        {/* Post Submission Form */}
        <div style={{
          background: 'linear-gradient(135deg, #2A1A06 0%, #4F330D 100%)',
          borderRadius: 24,
          padding: '22px 20px',
          marginTop: 16,
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(42,26,6,0.2)',
          border: '1px solid rgba(245,158,11,0.3)',
          boxSizing: 'border-box'
        }}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>✍️ Submit your Contest post</span>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginBottom: 14, lineHeight: 1.5, fontWeight: 500 }}>
              Submit your X posts link below. You can submit as many posts as you want.
            </div>
            
            {postStatus === 'success' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ background: 'rgba(5,150,105,0.25)', borderRadius: 14, padding: '10px 14px', fontSize: 12, color: '#6EE7B7', fontWeight: 800 }}>
                  ✓ {postMsg}
                </div>
                <button
                  onClick={() => { setPostStatus(''); setPostMsg(''); }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    color: '#fff',
                    borderRadius: 50,
                    padding: '8px 16px',
                    fontSize: 11,
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    alignSelf: 'flex-start'
                  }}
                >
                  Submit another link
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={postUrl}
                  onChange={e => { setPostUrl(e.target.value); setPostStatus(''); setPostMsg('') }}
                  placeholder="Paste your link here…"
                  style={{
                    flex: 1, padding: '10px 16px', borderRadius: 50,
                    border: postStatus === 'error' ? '1.5px solid #FCA5A5' : '1.5px solid rgba(255,255,255,0.2)',
                    background: 'rgba(255,255,255,0.1)', color: '#fff',
                    fontSize: 12, outline: 'none', fontFamily: 'inherit',
                    fontWeight: 600
                  }}
                />
                <button
                  onClick={handleSubmitPost}
                  disabled={postStatus === 'submitting' || !postUrl || !address}
                  style={{
                    background: '#fff', color: '#2A1A06', borderRadius: 50,
                    padding: '10px 20px', fontSize: 12, fontWeight: 800,
                    border: 'none', cursor: postStatus === 'submitting' || !postUrl || !address ? 'not-allowed' : 'pointer',
                    opacity: postStatus === 'submitting' || !postUrl || !address ? 0.6 : 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {postStatus === 'submitting' ? '…' : 'Submit'}
                </button>
              </div>
            )}
            {postStatus === 'error' && (
              <div style={{ fontSize: 10, color: '#FCA5A5', marginTop: 6, fontWeight: 600 }}>{postMsg}</div>
            )}
            {!address && (
              <div style={{ fontSize: 10, color: '#FCA5A5', marginTop: 6, fontWeight: 600 }}>Please connect your wallet to submit a post.</div>
            )}
          </div>
        </div>

        {/* Admin panel */}
        {address?.toLowerCase() === '0x4c91d3bed372c11795b9ce9a9017dfe447bf050a' && (
          <div style={{ marginTop: 16 }}>
            <button
              onClick={() => {
                const next = !showAdminSubmissions
                setShowAdminSubmissions(next)
                if (next) loadAdminSubmissions()
              }}
              style={{
                fontSize: 12,
                padding: '8px 16px',
                borderRadius: 50,
                background: '#F59E0B',
                color: '#fff',
                border: 'none',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              📬 View Submitted Posts {submissions.length > 0 ? `(${submissions.length})` : ''}
            </button>

            {showAdminSubmissions && (
              <div style={{
                background: '#FFF7ED',
                border: '1px solid #FED7AA',
                borderRadius: 16,
                padding: 16,
                marginTop: 12,
                boxSizing: 'border-box'
              }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#9A3412', marginBottom: 12 }}>
                  Contest Submissions ({submissions.length})
                </div>

                {loadingSubmissions ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
                    <div style={{ width: 16, height: 16, border: '2px solid rgba(154,52,18,0.3)', borderTopColor: '#9A3412', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  </div>
                ) : submissions.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#B45309', textAlign: 'center', padding: '12px 0' }}>
                    No submissions found
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 300, overflowY: 'auto' }}>
                    {submissions.map(s => (
                      <div key={s.id} style={{ background: '#fff', borderRadius: 12, padding: '10px 12px', border: '1px solid #FED7AA', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#717886', fontFamily: "'DM Mono', monospace" }}>
                            {s.address}
                          </span>
                          <span style={{ fontSize: 9, color: '#A0AEC0' }}>
                            {new Date(s.submitted_at).toLocaleString()}
                          </span>
                        </div>
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: 11.5,
                            color: '#0052FF',
                            fontWeight: 600,
                            wordBreak: 'break-all',
                            textDecoration: 'none'
                          }}
                          onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                          onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                        >
                          {s.url}
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ padding: '0 16px 120px' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes floatingLogo {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
          100% { transform: translateY(0px); }
        }
      ` }} />

      {/* Section Banner - Identical to Earn, but with USDC + HH logos */}
      <div style={{
        backgroundImage: 'url(/banner.jpg)',
        backgroundColor: '#0000FF',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        borderRadius: 24,
        padding: '36px 20px',
        marginBottom: 16,
        position: 'relative',
        minHeight: 120,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.1)',
        boxSizing: 'border-box'
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 0 }} />
        
        {/* Floating $HH & USDC Logos */}
        {[
          { type: 'hh', top: '10%', left: '8%', size: 38, opacity: 0.45, r: '-15deg', blur: 0.4, dur: 4.5 },
          { type: 'usdc', bottom: '10%', left: '22%', size: 28, opacity: 0.4, r: '10deg', blur: 0, dur: 5.2 },
          { type: 'hh', top: '8%', right: '12%', size: 44, opacity: 0.5, r: '18deg', blur: 0.5, dur: 3.8 },
          { type: 'usdc', top: '45%', right: '28%', size: 24, opacity: 0.35, r: '-8deg', blur: 0.8, dur: 6.0 },
          { type: 'hh', bottom: '8%', right: '6%', size: 48, opacity: 0.55, r: '12deg', blur: 0, dur: 4.4 },
          { type: 'usdc', top: '40%', left: '4%', size: 32, opacity: 0.4, r: '15deg', blur: 0.3, dur: 5.0 }
        ].map((s, i) => (
          <div key={i} style={{
            position: 'absolute',
            top: s.top,
            right: s.right,
            left: s.left,
            bottom: s.bottom,
            zIndex: 1,
            pointerEvents: 'none',
            userSelect: 'none',
            animation: `floatingLogo ${s.dur}s ease-in-out infinite`,
          }}>
            <img
              src={s.type === 'hh' ? '/logo.jfif' : '/usdc-logo.png'}
              alt=""
              style={{
                width: s.size,
                height: s.size,
                borderRadius: '50%',
                opacity: s.opacity,
                filter: s.blur > 0 ? `blur(${s.blur}px)` : 'none',
                transform: `rotate(${s.r})`,
                objectFit: 'cover'
              }}
            />
          </div>
        ))}

        <div style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 38,
            fontWeight: 900,
            color: '#FFFFFF',
            lineHeight: 1.1,
            textShadow: '0 2px 10px rgba(0,0,0,0.5)',
            letterSpacing: '-0.5px'
          }}>
            Contest Hub
          </div>
        </div>
      </div>

      {/* Info Card (Premium Glassmorphism Theme) */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(0, 82, 255, 0.08) 0%, rgba(0, 82, 255, 0.03) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(0, 82, 255, 0.22)',
        borderRadius: 16,
        padding: '12px 16px',
        marginBottom: 16,
        boxShadow: '0 8px 32px rgba(0, 82, 255, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
        boxSizing: 'border-box'
      }}>
        <div style={{
          color: '#1E293B',
          fontFamily: "'Outfit', 'Inter', sans-serif",
          fontSize: 12.5,
          fontWeight: 600,
          lineHeight: 1.6,
          textAlign: 'center'
        }}>
          Follow contests to participate and earn{" "}
          <img src="/logo.jfif" alt="$HH" style={{ width: 13, height: 13, borderRadius: '50%', objectFit: 'cover', display: 'inline-block', verticalAlign: 'middle', margin: '0 2px 2px' }} />
          {" "}$HH and{" "}
          <img src="/usdc-logo.png" alt="USDC" style={{ width: 13, height: 13, display: 'inline-block', verticalAlign: 'middle', margin: '0 2px 2px' }} />
          {" "}USDC rewards. Contests are added periodically.
        </div>
      </div>

      {/* Feature Blocks Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
        {/* Block 1: Creator Contest (Now on the Left) */}
        <div
          onClick={() => setActiveContest('creator')}
          style={{
            background: '#2A1A06',
            borderRadius: 20,
            padding: '12px 12px 10px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 8px 32px rgba(245, 158, 11, 0.15)',
            height: 140,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid rgba(245, 158, 11, 0.3)'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-1.5px)'
            e.currentTarget.style.boxShadow = '0 12px 36px rgba(245, 158, 11, 0.25)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'none'
            e.currentTarget.style.boxShadow = '0 8px 32px rgba(245, 158, 11, 0.15)'
          }}
        >
          {/* Graded background image */}
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'url(/banner.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'hue-rotate(25deg) brightness(0.5) contrast(1.15)',
            zIndex: 0,
            pointerEvents: 'none'
          }} />

          {/* Floating creative emojis */}
          {[
            { char: '🎨', top: '8%', right: '12%', size: 20, opacity: 0.35, r: '12deg', dur: 4.0 },
            { char: '🖌️', bottom: '25%', left: '15%', size: 18, opacity: 0.3, r: '-15deg', dur: 4.5 },
            { char: '✏️', top: '40%', right: '35%', size: 16, opacity: 0.25, r: '8deg', dur: 5.0 }
          ].map((s, i) => (
            <div key={i} style={{
              position: 'absolute',
              top: s.top,
              right: s.right,
              left: s.left,
              bottom: s.bottom,
              zIndex: 1,
              pointerEvents: 'none',
              userSelect: 'none',
              animation: `floatingLogo ${s.dur}s ease-in-out infinite`,
              fontSize: s.size,
              opacity: s.opacity,
              transform: `rotate(${s.r})`,
              filter: 'blur(0.3px)'
            }}>
              {s.char}
            </div>
          ))}

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 850, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Launch Contest</div>
            
            {/* Badges container */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
              {/* Row 1: Orange & Black Badges */}
              <div style={{ display: 'flex', gap: 4 }}>
                <div style={{
                  background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  borderRadius: 6,
                  height: 18,
                  boxSizing: 'border-box',
                  padding: '0 5px',
                  fontSize: 8,
                  fontWeight: 850,
                  color: '#FFFFFF',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  lineHeight: 1
                }}>
                  <span style={{ lineHeight: 1 }}>$120 in</span>
                  <img src="/logo.jfif" alt="$HH" style={{ width: 9, height: 9, borderRadius: '50%', objectFit: 'cover' }} />
                  <span style={{ lineHeight: 1 }}>$HH</span>
                </div>
                <div style={{
                  background: 'rgba(0, 0, 0, 0.65)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: 6,
                  height: 18,
                  boxSizing: 'border-box',
                  padding: '0 5px',
                  fontSize: 8,
                  fontWeight: 850,
                  color: '#FFFFFF',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1
                }}>
                  <span style={{ lineHeight: 1 }}>3 winners</span>
                </div>
              </div>
              
              {/* Row 2: Red Timer Badge */}
              <div>
                <div style={{
                  background: 'rgba(252, 64, 31, 0.15)',
                  border: '1px solid rgba(252, 64, 31, 0.3)',
                  borderRadius: 6,
                  height: 18,
                  boxSizing: 'border-box',
                  padding: '0 5px',
                  fontSize: 8,
                  fontWeight: 850,
                  color: '#FC401F',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  lineHeight: 1
                }}>
                  <span style={{ lineHeight: 1 }}>left:</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>{contestTimeLeft}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Centered semi-transparent Participate Badge */}
          <div style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            height: 28,
            background: 'rgba(255, 255, 255, 0.12)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontSize: 12,
            fontWeight: 800,
            transition: 'background 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
          >
            Participate →
          </div>
        </div>

        {/* Block 2: Happy Raids (Now on the Right) */}
        <div
          style={{
            background: '#140505',
            borderRadius: 20,
            padding: '14px 14px 12px',
            cursor: 'default',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            height: 140,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.08)'
          }}
        >
          {/* Graded background image */}
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'url(/banner.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'hue-rotate(330deg) brightness(0.4) contrast(1.15)',
            zIndex: 0,
            pointerEvents: 'none'
          }} />
          
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: '#FFFFFF' }}>Trader Contest</div>
          </div>
          
          {/* Centered semi-transparent Play Badge */}
          <div style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            height: 30,
            background: 'rgba(255, 255, 255, 0.12)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontSize: 12.5,
            fontWeight: 800
          }}
          >
            Participate →
          </div>

          {/* Coming Soon Overlay */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(20, 20, 20, 0.35)',
            backdropFilter: 'blur(1px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontSize: 13,
            fontWeight: 800,
            zIndex: 2,
            borderRadius: 20
          }}>
            Coming Soon
          </div>
        </div>
      </div>
    </div>
  )
}
