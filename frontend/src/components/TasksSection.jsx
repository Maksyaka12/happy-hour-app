import { useEffect, useMemo, useState } from 'react'
import { useChainId, useSwitchChain } from 'wagmi'
import { base } from 'wagmi/chains'
import { db } from '../config/supabase'
import { USDC_ADDRESS, USDC_ABI, CHECKIN_TARGET } from '../config/constants'
import { useBuilderWrite } from '../hooks/useBuilderWrite'
import { TxModal } from './TxModal'

const taskIcons = { retweet: '🔁', like: '❤️', comment: '💬', bookmark: '🔖', follow: '👤' }

const fmt = (ms) => {
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function TaskCard({ task, taskState, onVisit, onCheck, onClaim, isClaiming }) {
  const left = Math.max(0, new Date(task.expires_at).getTime() - Date.now())
  const canCheck = taskState === 'visited'
  const isCounting = taskState === 'counting'
  const canClaim = taskState === 'checked'

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #DEE1E7',
        borderLeft: `2.5px solid ${canClaim ? '#059669' : canCheck ? '#0000FF' : '#DEE1E7'}`,
        borderRadius: 20,
        padding: 12,
        animation: 'fadeIn 0.3s ease',
      }}
    >
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {/* Icon */}
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            flexShrink: 0,
            background: task.icon_url ? '#F3F4F6' : (canClaim ? '#059669' : '#0000FF'),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            boxShadow: canClaim ? '0 4px 10px rgba(5,150,105,0.2)' : '0 4px 10px rgba(0,0,255,0.15)',
            overflow: 'hidden'
          }}
        >
          {task.icon_url ? (
            <img src={task.icon_url} alt="Task icon" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            taskIcons[task.type] || '⭐'
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#0A0B0D', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {task.text}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
            <span style={{ fontSize: 9, color: '#D97706', fontWeight: 800, background: 'rgba(217,119,6,0.1)', borderRadius: 6, padding: '1px 6px', textTransform: 'uppercase' }}>
              +{task.points} HP
            </span>
            <span style={{ fontSize: 9, color: '#64748B', fontWeight: 600 }}>⏰ {fmt(left)} left</span>
          </div>
        </div>

        {/* Action Button */}
        <div style={{ flexShrink: 0 }}>
          {canClaim ? (
            <button
              onClick={() => onClaim(task.id)}
              disabled={isClaiming}
              style={{
                background: '#059669',
                color: '#fff',
                borderRadius: 50,
                padding: '7px 0',
                width: 90,
                fontSize: 10,
                fontWeight: 900,
                border: 'none',
                cursor: isClaiming ? 'wait' : 'pointer',
                opacity: isClaiming ? 0.7 : 1,
                boxShadow: '0 4px 12px rgba(5,150,105,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4
              }}
            >
              {isClaiming ? '...' : (
                <>
                  CLAIM <span style={{ color: '#D1FAE5', textTransform: 'lowercase', fontWeight: 700, opacity: 0.9 }}>free</span>
                </>
              )}
            </button>
          ) : isCounting ? (
            <div
              style={{
                borderRadius: 50,
                padding: '7px 0',
                width: 90,
                background: '#EEF0F3',
                border: '1px solid #DEE1E7',
                fontSize: 10,
                fontWeight: 900,
                color: '#0000FF',
                textAlign: 'center',
                textTransform: 'uppercase'
              }}
            >
              CHECKING...
            </div>
          ) : canCheck ? (
            <button
              onClick={() => onCheck(task.id)}
              style={{
                background: '#EEF0F3',
                border: '1px solid #0000FF',
                color: '#0000FF',
                borderRadius: 50,
                padding: '7px 0',
                width: 90,
                fontSize: 10,
                fontWeight: 900,
                cursor: 'pointer',
                textTransform: 'uppercase'
              }}
            >
              CHECK
            </button>
          ) : (
            <button
              onClick={() => {
                window.open(task.url, '_blank')
                onVisit(task.id)
              }}
              style={{
                background: '#0000FF',
                color: '#fff',
                borderRadius: 50,
                padding: '7px 0',
                width: 90,
                fontSize: 10,
                fontWeight: 900,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 10px rgba(0,0,255,0.2)',
                textTransform: 'uppercase'
              }}
            >
              START
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function TasksSection({ address }) {
  const [tasks, setTasks] = useState([])
  const [done, setDone] = useState({})
  const [claimingId, setClaimingId] = useState('')
  const [errorText, setErrorText] = useState('')
  const [showAdmin, setShowAdmin] = useState(false)
  const [adminTab, setAdminTab] = useState('create') // 'create' | 'manage'
  const [allTasks, setAllTasks] = useState([])
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [editTaskState, setEditTaskState] = useState({ type: 'retweet', text: '', url: '', points: 1, icon_url: '', expires_at: '' })
  const [newTasks, setNewTasks] = useState([{ type: 'retweet', text: '', url: '', points: 1, icon_url: '', expires_hours: 24 }])
  const [isCreating, setIsCreating] = useState(false)

  const ADMIN_WALLET = '0x4c91d3bed372c11795b9ce9a9017dfe447bf050a'
  const isAdmin = address?.toLowerCase() === ADMIN_WALLET
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()

  const taskWrite = useBuilderWrite()
  const { isPending: isPendingTx, isConfirming: isConfirmingTx, isSuccess: isSuccessTx, data: txHash, error: txError, reset: resetTx } = taskWrite

  // Post submission state
  const [postUrl, setPostUrl] = useState('')
  const [postStatus, setPostStatus] = useState('') // '' | 'submitting' | 'success' | 'error'
  const [postMsg, setPostMsg] = useState('')
  const [hasSubmittedToday, setHasSubmittedToday] = useState(false)
  const [isCheckingPost, setIsCheckingPost] = useState(true)
  const [pendingPosts, setPendingPosts] = useState([])
  const [showPendingPosts, setShowPendingPosts] = useState(false)
  const [reviewingId, setReviewingId] = useState(null)

  useEffect(() => {
    if (address) {
      try {
        const local = localStorage.getItem('happy_tasks_' + address.toLowerCase())
        if (local) setDone(current => ({ ...JSON.parse(local), ...current }))
      } catch (e) {}
    }
  }, [address])

  useEffect(() => {
    if (address && Object.keys(done).length > 0) {
      localStorage.setItem('happy_tasks_' + address.toLowerCase(), JSON.stringify(done))
    }
  }, [done, address])

  const loadTasks = () => {
    db.from('tasks')
      .select('*')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error('load tasks:', error)
          return
        }
        setTasks(data ?? [])
      })
  }

  const loadAllTasks = () => {
    if (!isAdmin) return
    db.from('tasks')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error('load all tasks:', error)
          return
        }
        setAllTasks(data ?? [])
      })
  }

  const startEditing = (task) => {
    setEditingTaskId(task.id)
    setEditTaskState({
      type: task.type,
      text: task.text,
      url: task.url,
      points: task.points,
      icon_url: task.icon_url || '',
      expires_at: new Date(task.expires_at).toISOString().slice(0, 16)
    })
  }

  const handleUpdateTask = async (id) => {
    setIsCreating(true)
    setErrorText('')
    
    const { data, error } = await db.rpc('admin_update_task', {
      p_admin_address: address.toLowerCase(),
      p_task_id: id,
      p_type: editTaskState.type,
      p_text: editTaskState.text,
      p_url: editTaskState.url,
      p_points: Number(editTaskState.points),
      p_icon_url: editTaskState.icon_url || null,
      p_expires_at: new Date(editTaskState.expires_at).toISOString()
    })

    if (error || !data?.ok) {
      setErrorText(error?.message || data?.error || 'Failed to update task. Make sure to apply 027_task_admin_enhancements.sql first!')
    } else {
      setEditingTaskId(null)
      loadTasks()
      loadAllTasks()
    }
    setIsCreating(false)
  }

  const handleDeleteTask = async (id) => {
    if (!window.confirm('Are you sure you want to delete this task? This will also remove completion records!')) return
    setIsCreating(true)
    setErrorText('')
    
    const { data, error } = await db.rpc('admin_delete_task', {
      p_admin_address: address.toLowerCase(),
      p_task_id: id
    })

    if (error || !data?.ok) {
      setErrorText(error?.message || data?.error || 'Failed to delete task. Make sure to apply 027_task_admin_enhancements.sql first!')
    } else {
      loadTasks()
      loadAllTasks()
    }
    setIsCreating(false)
  }

  const handleCreateTask = async () => {
    const validTasks = newTasks.filter(t => t.url && t.text)
    if (validTasks.length === 0) return
    
    setIsCreating(true)
    setErrorText('')
    
    let successCount = 0
    for (const task of validTasks) {
      const expiresAt = new Date(Date.now() + (Number(task.expires_hours || 24) * 3600000)).toISOString()
      const { error } = await db.rpc('admin_create_task', {
        p_admin_address: address.toLowerCase(),
        p_type: task.type,
        p_text: task.text,
        p_url: task.url,
        p_points: Number(task.points),
        p_icon_url: task.icon_url || null,
        p_expires_at: expiresAt
      })
      if (!error) successCount++
    }

    if (successCount > 0) {
      setShowAdmin(false)
      setNewTasks([{ type: 'retweet', text: '', url: '', points: 1, icon_url: '', expires_hours: 24 }])
      loadTasks()
      loadAllTasks()
      if (successCount < validTasks.length) {
        setErrorText(`Created ${successCount} of ${validTasks.length} tasks. Some failed.`)
      }
    } else {
      setErrorText('Failed to create tasks. If this is a new function signature, make sure to apply 027_task_admin_enhancements.sql in Supabase SQL editor first!')
    }
    setIsCreating(false)
  }

  const addTaskRow = () => {
    setNewTasks([...newTasks, { type: 'retweet', text: '', url: '', points: 1, icon_url: '', expires_hours: 24 }])
  }

  const removeTaskRow = (index) => {
    if (newTasks.length <= 1) return
    setNewTasks(newTasks.filter((_, i) => i !== index))
  }

  const updateTaskRow = (index, field, value) => {
    const next = [...newTasks]
    next[index] = { ...next[index], [field]: value }
    setNewTasks(next)
  }

  useEffect(() => {
    loadTasks()
  }, [])

  // Load pending posts for admin
  const loadPendingPosts = async () => {
    if (!isAdmin) return
    const { data } = await db.rpc('get_pending_posts', { p_admin_address: address.toLowerCase() })
    setPendingPosts(data ?? [])
  }

  useEffect(() => {
    if (isAdmin) {
      loadPendingPosts()
      loadAllTasks()
    }
  }, [isAdmin, address])

  const checkTodaySubmission = async () => {
    if (!address) {
      setIsCheckingPost(false)
      return
    }
    setIsCheckingPost(true)
    
    try {
      const { data, error } = await db.rpc('has_submitted_post_today', { 
        p_address: address.toLowerCase() 
      })
      
      if (!error && data === true) {
        setHasSubmittedToday(true)
      } else {
        setHasSubmittedToday(false)
      }
    } catch (e) {
      console.error('Check post error:', e)
    } finally {
      setIsCheckingPost(false)
    }
  }

  useEffect(() => {
    if (address) checkTodaySubmission()
  }, [address])

  const getWaitTime = () => {
    const now = new Date()
    const hoursLeft = 24 - now.getUTCHours()
    if (hoursLeft === 24) return 0
    return hoursLeft
  }

  const handleSubmitPost = async () => {
    if (!address) return
    if (!postUrl.startsWith('http://') && !postUrl.startsWith('https://')) {
      setPostMsg('Link must start with http:// or https://')
      setPostStatus('error')
      return
    }
    setPostStatus('submitting')
    setPostMsg('')
    const { data, error } = await db.rpc('submit_post', {
      p_address: address.toLowerCase(),
      p_url: postUrl.trim()
    })
    if (error || !data?.ok) {
      setPostMsg(data?.error || 'Failed to submit. Try again.')
      setPostStatus('error')
      if (data?.error?.includes('once per day')) {
        setHasSubmittedToday(true)
      }
    } else {
      setPostMsg('Submitted! We\'ll review your post soon.')
      setPostStatus('success')
      setPostUrl('')
    }
  }

  const handleApprove = async (id) => {
    setReviewingId(id)
    await db.rpc('approve_post', { p_admin_address: address.toLowerCase(), p_submission_id: id })
    setReviewingId(null)
    loadPendingPosts()
  }

  const handleReject = async (id) => {
    setReviewingId(id)
    await db.rpc('reject_post', { p_admin_address: address.toLowerCase(), p_submission_id: id })
    setReviewingId(null)
    loadPendingPosts()
  }

  useEffect(() => {
    if (!address) return

    db.from('task_completions')
      .select('task_id')
      .eq('address', address.toLowerCase())
      .then(({ data, error }) => {
        if (error) {
          console.error('load task_completions:', error)
          return
        }

        const next = {}
        data?.forEach((row) => {
          next[row.task_id] = 'claimed'
        })
        setDone((current) => ({ ...current, ...next }))
      })
  }, [address])

  useEffect(() => {
    const timers = Object.entries(done)
      .filter(([, value]) => value === 'counting')
      .map(([id]) =>
        setTimeout(() => {
          setDone((current) => ({ ...current, [id]: 'checked' }))
        }, 3000)
      )

    return () => timers.forEach(clearTimeout)
  }, [done])

  const visible = useMemo(
    () => tasks.filter((task) => done[task.id] !== 'claimed' && new Date(task.expires_at) > new Date()),
    [tasks, done]
  )

  const handleVisit = (id) => {
    setDone((current) => ({ ...current, [id]: current[id] || 'visited' }))
  }

  const handleCheck = (id) => {
    setDone((current) => ({ ...current, [id]: 'counting' }))
  }

  const handleClaim = async (id) => {
    if (!address) {
      setErrorText('Connect your wallet before claiming task rewards.')
      return
    }

    if (chainId !== base.id) {
      switchChain({ chainId: base.id })
      return
    }

    setClaimingId(id)
    setErrorText('')

    taskWrite.writeContract({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: 'transfer',
      args: [CHECKIN_TARGET, 0n],
      chainId: base.id,
    })
  }

  useEffect(() => {
    if (isSuccessTx && claimingId && txHash) {
      const finalize = async () => {
        const { data, error } = await db.rpc('claim_task_completion', {
          p_task_id: claimingId,
          p_address: address.toLowerCase(),
          p_tx_hash: txHash
        })

        if (error || !data?.ok) {
          setErrorText(data?.error || 'Database sync failed after transaction.')
          setClaimingId('')
        } else {
          setDone((current) => ({ ...current, [claimingId]: 'claimed' }))
          setClaimingId('')
        }
        resetTx()
      }
      finalize()
    }
  }, [isSuccessTx, txHash, claimingId, address])

  useEffect(() => {
    if (txError) {
      setErrorText(txError.message || 'Transaction failed.')
      setClaimingId('')
      resetTx()
    }
  }, [txError])

  return (
    <div style={{ paddingBottom: 120, padding: '0 12px 120px' }}>

      {/* Promo Banner — Post about us */}
      <div style={{
        background: 'linear-gradient(135deg, #0000FF 0%, #4F46E5 100%)',
        borderRadius: 24, padding: '22px 20px', marginBottom: 16,
        position: 'relative', overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,255,0.2)',
      }}>
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.1,
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 1.5px, transparent 1.5px)',
          backgroundSize: '20px 20px',
        }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
            ✍️ Post about us and get <span style={{ color: '#A5B4FC' }}>+5 HP</span>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginBottom: 14, lineHeight: 1.5, fontWeight: 500 }}>
            We value creators on Base. Post about our app or share useful content about Base and submit your link below.
          </div>
          {isCheckingPost ? (
            <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : hasSubmittedToday ? (
            <div style={{ 
              background: 'rgba(255,255,255,0.1)', 
              borderRadius: 14, 
              padding: '10px 16px', 
              fontSize: 12, 
              color: 'rgba(255,255,255,0.9)', 
              fontWeight: 800,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              Available in {getWaitTime()}h
            </div>
          ) : postStatus === 'success' ? (
            <div style={{ background: 'rgba(5,150,105,0.25)', borderRadius: 14, padding: '10px 14px', fontSize: 12, color: '#6EE7B7', fontWeight: 800 }}>
              ✓ {postMsg}
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
                disabled={postStatus === 'submitting' || !postUrl}
                style={{
                  background: '#fff', color: '#0000FF', borderRadius: 50,
                  padding: '10px 20px', fontSize: 12, fontWeight: 800,
                  border: 'none', cursor: postStatus === 'submitting' || !postUrl ? 'not-allowed' : 'pointer',
                  opacity: postStatus === 'submitting' || !postUrl ? 0.6 : 1,
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
        </div>
      </div>

      {/* Admin controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: '#717886', fontWeight: 600 }}>
          {visible.length} active task{visible.length !== 1 ? 's' : ''}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isAdmin && (
            <button
              onClick={() => { setShowPendingPosts(!showPendingPosts); if (!showPendingPosts) loadPendingPosts() }}
              style={{ fontSize: 12, padding: '6px 12px', borderRadius: 50, background: pendingPosts.length > 0 ? '#DC2626' : '#717886', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', position: 'relative' }}
            >
              📬 Posts {pendingPosts.length > 0 ? `(${pendingPosts.length})` : ''}
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => setShowAdmin(!showAdmin)}
              style={{ fontSize: 12, padding: '6px 12px', borderRadius: 50, background: '#1DA1F2', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}
            >
              {showAdmin ? 'Cancel' : '+ Add Task'}
            </button>
          )}
        </div>
      </div>

      {/* Admin: pending post submissions */}
      {isAdmin && showPendingPosts && (
        <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 16, padding: 16, marginBottom: 16, animation: 'fadeIn 0.2s ease' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#9A3412', marginBottom: 12 }}>📬 Pending Posts ({pendingPosts.length})</div>
          {pendingPosts.length === 0 ? (
            <div style={{ fontSize: 13, color: '#B45309', textAlign: 'center', padding: '12px 0' }}>No pending submissions</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pendingPosts.map(p => (
                <div key={p.id} style={{ background: '#fff', borderRadius: 12, padding: '12px 14px', border: '1px solid #FED7AA' }}>
                  <div style={{ fontSize: 11, color: '#717886', marginBottom: 4, fontFamily: "'DM Mono',monospace" }}>
                    {p.address.slice(0, 6)}...{p.address.slice(-4)}
                  </div>
                  <a href={p.url} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 12, color: '#0000FF', wordBreak: 'break-all', display: 'block', marginBottom: 10 }}
                  >{p.url}</a>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => handleApprove(p.id)}
                      disabled={reviewingId === p.id}
                      style={{ flex: 1, background: '#059669', color: '#fff', border: 'none', borderRadius: 50, padding: '8px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                    >
                      ✓ Approve
                    </button>
                    <button
                      onClick={() => handleReject(p.id)}
                      disabled={reviewingId === p.id}
                      style={{ flex: 1, background: '#DC2626', color: '#fff', border: 'none', borderRadius: 50, padding: '8px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                    >
                      ✗ Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isAdmin && showAdmin && (
        <div style={{ background: '#EEF0F3', padding: 16, borderRadius: 16, marginBottom: 16, border: '1px solid #DEE1E7', animation: 'fadeIn 0.2s ease' }}>
          {/* Sub tabs */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, borderBottom: '1px solid #DEE1E7', paddingBottom: 10 }}>
            <button
              onClick={() => setAdminTab('create')}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 12,
                border: 'none',
                background: adminTab === 'create' ? '#0000FF' : 'transparent',
                color: adminTab === 'create' ? '#fff' : '#717886',
                fontWeight: 800,
                fontSize: 12,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              ➕ Create Tasks
            </button>
            <button
              onClick={() => { setAdminTab('manage'); loadAllTasks(); }}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 12,
                border: 'none',
                background: adminTab === 'manage' ? '#0000FF' : 'transparent',
                color: adminTab === 'manage' ? '#fff' : '#717886',
                fontWeight: 800,
                fontSize: 12,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              ⚙️ Manage Tasks ({allTasks.length})
            </button>
          </div>

          {adminTab === 'create' ? (
            <div>
              {newTasks.map((task, idx) => (
                <div key={idx} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: idx < newTasks.length - 1 ? '1px solid #DEE1E7' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#717886' }}>Task #{idx + 1}</span>
                    {newTasks.length > 1 && (
                      <button onClick={() => removeTaskRow(idx)} style={{ background: 'none', border: 'none', color: '#DC2626', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>Remove</button>
                    )}
                  </div>

                  <select value={task.type} onChange={e => updateTaskRow(idx, 'type', e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ccc', marginBottom: 8, background: '#fff', fontSize: 13 }}>
                    <option value="retweet">Retweet</option>
                    <option value="like">Like</option>
                    <option value="comment">Comment</option>
                    <option value="bookmark">Bookmark</option>
                    <option value="follow">Follow</option>
                  </select>
                  
                  <input placeholder="Task Description (e.g. Retweet & Tag 3 friends)" value={task.text} onChange={e => updateTaskRow(idx, 'text', e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ccc', marginBottom: 8, background: '#fff', fontSize: 13, boxSizing: 'border-box' }} />
                  
                  <input placeholder="Post URL (https://x.com/...)" value={task.url} onChange={e => updateTaskRow(idx, 'url', e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ccc', marginBottom: 8, background: '#fff', fontSize: 13, boxSizing: 'border-box' }} />
                  
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <input
                        placeholder="Custom Icon URL (optional)"
                        value={task.icon_url || ''}
                        onChange={e => updateTaskRow(idx, 'icon_url', e.target.value)}
                        style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ccc', background: '#fff', fontSize: 13, boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                      <button
                        onClick={() => updateTaskRow(idx, 'icon_url', '/turbogum.jpg')}
                        style={{
                          background: task.icon_url === '/turbogum.jpg' ? '#0000FF' : '#fff',
                          color: task.icon_url === '/turbogum.jpg' ? '#fff' : '#0000FF',
                          border: '1px solid #0000FF',
                          borderRadius: 8,
                          padding: '9px 12px',
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        🏎️ Turbo Gum
                      </button>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#717886' }}>HP:</span>
                      <input type="number" min="1" max="1000" value={task.points} onChange={e => updateTaskRow(idx, 'points', e.target.value)} style={{ width: 60, padding: 8, borderRadius: 8, border: '1px solid #ccc', background: '#fff', fontSize: 13 }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#717886' }}>Hours:</span>
                      <input type="number" min="1" max="8760" value={task.expires_hours || 24} onChange={e => updateTaskRow(idx, 'expires_hours', e.target.value)} style={{ width: 60, padding: 8, borderRadius: 8, border: '1px solid #ccc', background: '#fff', fontSize: 13 }} />
                    </div>
                  </div>
                </div>
              ))}

              <button onClick={addTaskRow} style={{ width: '100%', padding: 10, borderRadius: 8, border: '2px dashed #B1B7C3', background: 'none', color: '#717886', fontWeight: 700, cursor: 'pointer', marginBottom: 12, fontSize: 13 }}>
                + Add Another Task
              </button>

              <button onClick={handleCreateTask} disabled={isCreating} style={{ width: '100%', padding: 12, borderRadius: 8, background: isCreating ? '#B1B7C3' : '#0000FF', color: '#fff', fontWeight: 800, border: 'none', cursor: isCreating ? 'not-allowed' : 'pointer' }}>
                {isCreating ? 'Creating...' : `Create ${newTasks.length} Task${newTasks.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 400, overflowY: 'auto', paddingRight: 4 }}>
              {allTasks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#717886', fontSize: 13 }}>No tasks found in database.</div>
              ) : (
                allTasks.map(t => {
                  const isEditing = editingTaskId === t.id
                  const isExpired = new Date(t.expires_at) < new Date()
                  
                  if (isEditing) {
                    return (
                      <div key={t.id} style={{ background: '#fff', padding: 12, borderRadius: 14, border: '2px solid #0000FF', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#0000FF' }}>Editing Task Settings</div>
                        
                        <select
                          value={editTaskState.type}
                          onChange={e => setEditTaskState({ ...editTaskState, type: e.target.value })}
                          style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ccc', background: '#fff', fontSize: 13 }}
                        >
                          <option value="retweet">Retweet</option>
                          <option value="like">Like</option>
                          <option value="comment">Comment</option>
                          <option value="bookmark">Bookmark</option>
                          <option value="follow">Follow</option>
                        </select>
                        
                        <input
                          placeholder="Task Description"
                          value={editTaskState.text}
                          onChange={e => setEditTaskState({ ...editTaskState, text: e.target.value })}
                          style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ccc', fontSize: 13, boxSizing: 'border-box' }}
                        />
                        
                        <input
                          placeholder="Link URL"
                          value={editTaskState.url}
                          onChange={e => setEditTaskState({ ...editTaskState, url: e.target.value })}
                          style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ccc', fontSize: 13, boxSizing: 'border-box' }}
                        />
                        
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input
                            placeholder="Custom Icon URL"
                            value={editTaskState.icon_url}
                            onChange={e => setEditTaskState({ ...editTaskState, icon_url: e.target.value })}
                            style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid #ccc', fontSize: 13, boxSizing: 'border-box' }}
                          />
                          <button
                            onClick={() => setEditTaskState({ ...editTaskState, icon_url: '/turbogum.jpg' })}
                            style={{
                              background: editTaskState.icon_url === '/turbogum.jpg' ? '#0000FF' : '#fff',
                              color: editTaskState.icon_url === '/turbogum.jpg' ? '#fff' : '#0000FF',
                              border: '1px solid #0000FF',
                              borderRadius: 8,
                              padding: '8px 12px',
                              fontSize: 11,
                              fontWeight: 800,
                              cursor: 'pointer'
                            }}
                          >
                            🏎️ Turbo
                          </button>
                        </div>

                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#717886' }}>HP:</span>
                          <input
                            type="number"
                            value={editTaskState.points}
                            onChange={e => setEditTaskState({ ...editTaskState, points: Number(e.target.value) })}
                            style={{ width: 60, padding: 6, borderRadius: 8, border: '1px solid #ccc', fontSize: 13 }}
                          />
                          
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#717886', marginLeft: 8 }}>Expires:</span>
                          <input
                            type="datetime-local"
                            value={editTaskState.expires_at}
                            onChange={e => setEditTaskState({ ...editTaskState, expires_at: e.target.value })}
                            style={{ flex: 1, padding: 6, borderRadius: 8, border: '1px solid #ccc', fontSize: 13 }}
                          />
                        </div>

                        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                          <button
                            onClick={() => handleUpdateTask(t.id)}
                            style={{ flex: 1, background: '#059669', color: '#fff', border: 'none', borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingTaskId(null)}
                            style={{ flex: 1, background: '#717886', color: '#fff', border: 'none', borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div key={t.id} style={{ background: '#fff', padding: 10, borderRadius: 12, border: '1px solid #DEE1E7', display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0, background: t.icon_url ? '#F3F4F6' : '#EEF0F3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, overflow: 'hidden' }}>
                        {t.icon_url ? (
                          <img src={t.icon_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          taskIcons[t.type] || '⭐'
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#0A0B0D', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {t.text}
                        </div>
                        <div style={{ fontSize: 9, color: '#717886', display: 'flex', gap: 6, marginTop: 2 }}>
                          <span style={{ color: '#D97706', fontWeight: 800 }}>+{t.points} HP</span>
                          <span>•</span>
                          <span style={{ color: isExpired ? '#DC2626' : '#059669', fontWeight: 600 }}>{isExpired ? 'Expired' : 'Active'}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button
                          onClick={() => startEditing(t)}
                          style={{ background: '#EEF0F3', border: 'none', color: '#0000FF', borderRadius: 8, padding: '4px 8px', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleDeleteTask(t.id)}
                          style={{ background: '#FEE2E2', border: 'none', color: '#DC2626', borderRadius: 8, padding: '4px 8px', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>
      )}

      {errorText && (
        <div style={{ background: '#FEF3C7', border: '1px solid #D97706', borderRadius: 12, padding: '10px 12px', marginBottom: 12, fontSize: 12, color: '#B45309' }}>
          {errorText}
        </div>
      )}

      {visible.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#EEF0F3', borderRadius: 20 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 900, marginBottom: 6, color: '#0A0B0D' }}>All Done!</div>
          <div style={{ fontSize: 13, color: '#717886' }}>Check back soon for new tasks</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visible.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              taskState={done[task.id]}
              onVisit={handleVisit}
              onCheck={handleCheck}
              onClaim={handleClaim}
              isClaiming={claimingId === task.id && (isPendingTx || isConfirmingTx || isSuccessTx)}
            />
          ))}
        </div>
      )}

    </div>
  )
}
