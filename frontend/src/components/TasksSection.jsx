import { useEffect, useMemo, useState } from 'react'
import { db } from '../config/supabase'

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
        borderLeft: `3px solid ${canClaim ? '#059669' : canCheck ? '#0000FF' : '#DEE1E7'}`,
        borderRadius: 16,
        padding: 16,
        animation: 'fadeIn 0.3s ease',
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            flexShrink: 0,
            background: canClaim ? '#059669' : '#0000FF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            boxShadow: canClaim ? '0 4px 12px rgba(5,150,105,0.35)' : '0 4px 12px rgba(0,0,255,0.25)',
          }}
        >
          {taskIcons[task.type] || '⭐'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, lineHeight: 1.4, color: '#0A0B0D' }}>{task.text}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: '#D97706', fontWeight: 700, background: 'rgba(217,119,6,0.1)', borderRadius: 50, padding: '2px 10px' }}>
              +{task.points} HP
            </span>
            <span style={{ fontSize: 11, color: '#717886' }}>⏰ {fmt(left)} left</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <a
          href={task.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => !taskState && onVisit(task.id)}
          style={{
            flex: 1,
            display: 'block',
            textAlign: 'center',
            background: 'rgba(29,161,242,0.08)',
            border: '1px solid rgba(29,161,242,0.25)',
            color: '#1DA1F2',
            borderRadius: 50,
            padding: 10,
            fontSize: 13,
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          {task.type === 'retweet' ? 'Retweet' : task.type === 'like' ? 'Like' : task.type === 'follow' ? 'Follow' : task.type === 'comment' ? 'Comment' : task.type === 'bookmark' ? 'Bookmark' : 'Visit'}
        </a>

        {canClaim ? (
          <button
            onClick={() => onClaim(task.id)}
            disabled={isClaiming}
            style={{
              background: '#059669',
              color: '#fff',
              borderRadius: 50,
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: 800,
              border: 'none',
              cursor: isClaiming ? 'wait' : 'pointer',
              opacity: isClaiming ? 0.7 : 1,
              boxShadow: '0 4px 16px rgba(5,150,105,0.35)',
            }}
          >
            {isClaiming ? 'Claiming…' : 'Claim'}
          </button>
        ) : isCounting ? (
          <div
            style={{
              borderRadius: 50,
              padding: '10px 22px',
              background: '#EEF0F3',
              border: '1px solid #DEE1E7',
              fontSize: 14,
              fontWeight: 700,
              color: '#0000FF',
              minWidth: 80,
              textAlign: 'center',
            }}
          >
            Check…
          </div>
        ) : (
          <button
            onClick={() => onCheck(task.id)}
            disabled={!canCheck}
            style={{
              background: canCheck ? '#EEF0F3' : '#F8F9FC',
              border: `1px solid ${canCheck ? '#0000FF' : '#DEE1E7'}`,
              color: canCheck ? '#0000FF' : '#B1B7C3',
              borderRadius: 50,
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: 700,
              cursor: canCheck ? 'pointer' : 'not-allowed',
            }}
          >
            Check
          </button>
        )}
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
  const [newTasks, setNewTasks] = useState([{ type: 'retweet', text: '', url: '', points: 1 }])
  const [isCreating, setIsCreating] = useState(false)

  const ADMIN_WALLET = '0x4c91d3bed372c11795b9ce9a9017dfe447bf050a'
  const isAdmin = address?.toLowerCase() === ADMIN_WALLET

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

  const handleCreateTask = async () => {
    const validTasks = newTasks.filter(t => t.url && t.text)
    if (validTasks.length === 0) return
    
    setIsCreating(true)
    setErrorText('')
    
    let successCount = 0
    for (const task of validTasks) {
      const { error } = await db.rpc('admin_create_task', {
        p_admin_address: address.toLowerCase(),
        p_type: task.type,
        p_text: task.text,
        p_url: task.url,
        p_points: Number(task.points),
      })
      if (!error) successCount++
    }

    if (successCount > 0) {
      setShowAdmin(false)
      setNewTasks([{ type: 'retweet', text: '', url: '', points: 1 }])
      loadTasks()
      if (successCount < validTasks.length) {
        setErrorText(`Created ${successCount} of ${validTasks.length} tasks. Some failed.`)
      }
    } else {
      setErrorText('Failed to create tasks')
    }
    setIsCreating(false)
  }

  const addTaskRow = () => {
    setNewTasks([...newTasks, { type: 'retweet', text: '', url: '', points: 1 }])
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

    setClaimingId(id)
    setErrorText('')

    const { data, error } = await db.rpc('claim_task_completion', {
      p_task_id: id,
      p_address: address.toLowerCase(),
    })

    setClaimingId('')

    if (error) {
      console.error('claim_task_completion:', error)
      setErrorText('Task claim failed. Please try again.')
      return
    }

    if (!data?.ok) {
      setErrorText(data?.error || 'Task claim failed.')
      return
    }

    setDone((current) => ({ ...current, [id]: 'claimed' }))
  }

  return (
    <div style={{ paddingBottom: 120, padding: '0 12px 120px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: '#717886', fontWeight: 600 }}>
          {visible.length} active task{visible.length !== 1 ? 's' : ''}
        </div>
        {isAdmin && (
          <button 
            onClick={() => setShowAdmin(!showAdmin)}
            style={{ fontSize: 12, padding: '6px 12px', borderRadius: 50, background: '#1DA1F2', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}
          >
            {showAdmin ? 'Cancel' : '+ Add Task'}
          </button>
        )}
      </div>

      {isAdmin && showAdmin && (
        <div style={{ background: '#EEF0F3', padding: 16, borderRadius: 16, marginBottom: 16, border: '1px solid #DEE1E7', animation: 'fadeIn 0.2s ease' }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12, color: '#0A0B0D' }}>Bulk Create Tasks (24h)</div>
          
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
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Points:</span>
                <input type="number" min="1" max="1000" value={task.points} onChange={e => updateTaskRow(idx, 'points', e.target.value)} style={{ width: 80, padding: 8, borderRadius: 8, border: '1px solid #ccc', background: '#fff', fontSize: 13 }} />
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
              isClaiming={claimingId === task.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
