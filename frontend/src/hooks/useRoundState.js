import { useCallback, useEffect, useState } from 'react'
import { db } from '../config/supabase'
import { SUPABASE_ANON, SUPABASE_URL } from '../config/constants'

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—')

export function useRoundState(address, currency = 'USDC') {
  const [round, setRound] = useState(null)
  const [participants, setParticipants] = useState([])
  const [lastWinner, setLastWinner] = useState(null)
  const [myTickets, setMyTickets] = useState(0)
  const [myAmount, setMyAmount] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchState = useCallback(async () => {
    if (!SUPABASE_URL || !SUPABASE_ANON) return

    try {
      const queryParams = []
      if (address) queryParams.push(`address=${address.toLowerCase()}`)
      if (currency) queryParams.push(`currency=${currency}`)
      const params = queryParams.length > 0 ? `?${queryParams.join('&')}` : ''

      const response = await fetch(`${SUPABASE_URL}/functions/v1/get-state${params}`, {
        headers: {
          apikey: SUPABASE_ANON,
          Authorization: `Bearer ${SUPABASE_ANON}`,
        },
      })

      if (!response.ok) {
        throw new Error(`get-state ${response.status}`)
      }

      const data = await response.json()
      setRound(data.round ?? null)
      setParticipants(data.participants ?? [])
      setMyTickets(data.myTickets ?? 0)
      setMyAmount(data.myAmount ?? 0)

      if (data.lastRound?.winner) {
        setLastWinner({
          name: data.lastRound.basename || short(data.lastRound.winner),
          amount: Number(data.lastRound.prize ?? 0).toFixed(2),
          pot: Number(data.lastRound.total_pot ?? 0).toFixed(2),
          chance: data.lastRound.chance ?? '0.0',
        })
      } else {
        setLastWinner(null)
      }
    } catch (error) {
      console.error('fetchState error:', error)
    } finally {
      setLoading(false)
    }
  }, [address, currency])

  useEffect(() => {
    fetchState()

    const channel = db
      .channel(`raffle-${Date.now()}-${Math.random()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bets' }, fetchState)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bets_hh' }, fetchState)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds' }, fetchState)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchState)
      .subscribe()

    const poll = setInterval(fetchState, 5000)

    return () => {
      db.removeChannel(channel)
      clearInterval(poll)
    }
  }, [fetchState])

  return { round, participants, lastWinner, myTickets, myAmount, loading, refetch: fetchState }
}
