import React, { useState, useEffect } from 'react'
import { useAccount, useBalance, useReadContract } from 'wagmi'
import { formatUnits, parseUnits } from 'viem'
import { useBuilderWrite } from '../hooks/useBuilderWrite'
import { db } from '../config/supabase'

import {
  FOUNDATION,
  CHECKIN_TARGET,
  USDC_ADDRESS,
  HH_ADDRESS,
  HH_MANAGER_ADDRESS,
  HH_RAFFLE_VAULT_ADDRESS,
  STAKING_ADDRESS
} from '../config/constants'

// Optional: A helper to format numbers elegantly
const formatExactOrConcise = (balData) => {
  if (!balData) return '0.00'
  const val = parseFloat(balData.formatted)
  return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
}

export function AdminPage() {
  const { address } = useAccount()
  const isAdmin = address?.toLowerCase() === '0x4c91d3bed372c11795b9ce9a9017dfe447bf050a'
  const { writeContract: wagmiWriteContract } = useBuilderWrite()

  // State
  const [totalUsers, setTotalUsers] = useState(0)
  
  // Refund amounts
  const [hourlyRefundAmount, setHourlyRefundAmount] = useState('')
  const [dailyRefundAmount, setDailyRefundAmount] = useState('')
  const [paymentsRefundAmount, setPaymentsRefundAmount] = useState('')
  const [paymentsHHRefundAmount, setPaymentsHHRefundAmount] = useState('')
  const [stakingHHRefundAmount, setStakingHHRefundAmount] = useState('')

  // Fetch users
  useEffect(() => {
    if (!isAdmin) return
    const fetchUsers = async () => {
      const { count: usersCount, error: usersError } = await db.from('users').select('*', { count: 'exact', head: true })
      setTotalUsers(usersCount || 0)
    }
    fetchUsers()
  }, [isAdmin])

  // Balances
  const { data: hourlyVaultBalanceData } = useBalance({
    address: FOUNDATION,
    token: USDC_ADDRESS,
    query: { refetchInterval: 5000 }
  })

  const { data: dailyVaultBalanceData } = useBalance({
    address: HH_RAFFLE_VAULT_ADDRESS,
    token: HH_ADDRESS,
    query: { refetchInterval: 5000 }
  })

  const { data: paymentsVaultBalanceData } = useBalance({
    address: CHECKIN_TARGET, // Used for USDC payments vault
    token: USDC_ADDRESS,
    query: { refetchInterval: 5000 }
  })

  const { data: paymentsVaultHHBalanceData } = useBalance({
    address: HH_MANAGER_ADDRESS, // Used for $HH payments vault
    token: HH_ADDRESS,
    query: { refetchInterval: 5000 }
  })

  const { data: stakingBalanceData } = useBalance({
    address: STAKING_ADDRESS,
    token: HH_ADDRESS,
    query: { refetchInterval: 5000 }
  })

  const { data: totalStakedPrincipalRaw } = useReadContract({
    address: STAKING_ADDRESS,
    abi: [{ name: 'totalStakedPrincipal', type: 'function', inputs: [], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' }],
    functionName: 'totalStakedPrincipal',
    query: { refetchInterval: 5000 }
  })

  const { data: deadHHBalanceData } = useBalance({
    address: '0x000000000000000000000000000000000000dEaD',
    token: HH_ADDRESS,
    query: { refetchInterval: 10000 }
  })

  // Staking Math
  const hhStakingBalanceRaw = stakingBalanceData?.value || 0n
  const excessRewardsRaw = (totalStakedPrincipalRaw !== undefined && hhStakingBalanceRaw > totalStakedPrincipalRaw)
    ? (hhStakingBalanceRaw - totalStakedPrincipalRaw)
    : 0n

  const excessRewardsFormatted = parseFloat(formatUnits(excessRewardsRaw, 18)).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6
  })

  // Refund Actions
  const safeParseUnits = (val, decimals) => {
    try {
      if (!val || parseFloat(val) <= 0) return 0n;
      return parseUnits(val, decimals);
    } catch {
      return 0n;
    }
  };

  const rescueToken = (targetAddress, tokenAddress, amountRaw) => {
    if (amountRaw === 0n) return;
    wagmiWriteContract({
      address: targetAddress,
      abi: [{ name: 'rescueToken', type: 'function', inputs: [{ name: '_token', type: 'address' }, { name: '_to', type: 'address' }, { name: '_amount', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' }],
      functionName: 'rescueToken',
      args: [tokenAddress, address, amountRaw]
    })
  }

  // Hourly (USDC) from FOUNDATION
  const refundHourlySpecific = () => rescueToken(FOUNDATION, USDC_ADDRESS, safeParseUnits(hourlyRefundAmount, 6))
  const refundHourlyAll = () => rescueToken(FOUNDATION, USDC_ADDRESS, hourlyVaultBalanceData?.value || 0n)

  // Daily ($HH) from HH_RAFFLE_VAULT_ADDRESS
  const refundDailySpecific = () => rescueToken(HH_RAFFLE_VAULT_ADDRESS, HH_ADDRESS, safeParseUnits(dailyRefundAmount, 18))
  const refundDailyAll = () => rescueToken(HH_RAFFLE_VAULT_ADDRESS, HH_ADDRESS, dailyVaultBalanceData?.value || 0n)

  // Payments (USDC) from CHECKIN_TARGET
  const refundPaymentsSpecific = () => rescueToken(CHECKIN_TARGET, USDC_ADDRESS, safeParseUnits(paymentsRefundAmount, 6))
  const refundPaymentsAll = () => rescueToken(CHECKIN_TARGET, USDC_ADDRESS, paymentsVaultBalanceData?.value || 0n)

  // Payments ($HH) from HH_MANAGER_ADDRESS
  const refundPaymentsHHSpecific = () => rescueToken(HH_MANAGER_ADDRESS, HH_ADDRESS, safeParseUnits(paymentsHHRefundAmount, 18))
  const refundPaymentsHHAll = () => rescueToken(HH_MANAGER_ADDRESS, HH_ADDRESS, paymentsVaultHHBalanceData?.value || 0n)

  // Staking Excess ($HH) from STAKING_ADDRESS
  const refundStakingHHSpecific = () => {
    const amountRaw = safeParseUnits(stakingHHRefundAmount, 18);
    if (amountRaw === 0n) return;
    wagmiWriteContract({
      address: STAKING_ADDRESS,
      abi: [{ name: 'withdrawExcessRewards', type: 'function', inputs: [{ name: '_amount', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' }],
      functionName: 'withdrawExcessRewards',
      args: [amountRaw]
    })
  }

  const refundStakingHHAll = () => {
    if (excessRewardsRaw === 0n) return;
    wagmiWriteContract({
      address: STAKING_ADDRESS,
      abi: [{ name: 'withdrawExcessRewards', type: 'function', inputs: [{ name: '_amount', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' }],
      functionName: 'withdrawExcessRewards',
      args: [excessRewardsRaw]
    })
  }

  if (!isAdmin) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#fff' }}>
        <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 8 }}>Access Denied</h2>
        <p style={{ color: '#9CA3AF' }}>You do not have permission to view this page.</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 16px', maxWidth: 800, margin: '0 auto', paddingBottom: 100 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 32 }}>🛠️</span> Admin Control Panel
        </h1>
        <p style={{ color: '#9CA3AF', marginTop: 8, fontSize: 14 }}>
          Manage vault balances, recover excess rewards, and monitor platform metrics.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Hourly Lottery Vault (USDC) */}
        <VaultCard 
          title="Hourly Lottery Vault Balance"
          token="USDC"
          balance={hourlyVaultBalanceData ? parseFloat(hourlyVaultBalanceData.formatted).toFixed(2) : '0.00'}
          val={hourlyRefundAmount}
          setVal={setHourlyRefundAmount}
          onRefund={refundHourlySpecific}
          onRefundAll={refundHourlyAll}
        />

        {/* Daily Lottery Vault ($HH) */}
        <VaultCard 
          title="Daily Lottery Vault Balance"
          token="$HH"
          balance={dailyVaultBalanceData ? formatExactOrConcise(dailyVaultBalanceData) : '0.00'}
          val={dailyRefundAmount}
          setVal={setDailyRefundAmount}
          onRefund={refundDailySpecific}
          onRefundAll={refundDailyAll}
        />

        {/* Payments Vault (USDC) */}
        <VaultCard 
          title="Payments Vault Balance (USDC)"
          token="USDC"
          balance={paymentsVaultBalanceData ? parseFloat(paymentsVaultBalanceData.formatted).toFixed(2) : '0.00'}
          val={paymentsRefundAmount}
          setVal={setPaymentsRefundAmount}
          onRefund={refundPaymentsSpecific}
          onRefundAll={refundPaymentsAll}
        />

        {/* Payments Vault ($HH) */}
        <VaultCard 
          title="Payments Vault Balance ($HH)"
          token="$HH"
          balance={paymentsVaultHHBalanceData ? formatExactOrConcise(paymentsVaultHHBalanceData) : '0.00'}
          val={paymentsHHRefundAmount}
          setVal={setPaymentsHHRefundAmount}
          onRefund={refundPaymentsHHSpecific}
          onRefundAll={refundPaymentsHHAll}
        />

        {/* Staking Vault Balance */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 20,
          padding: 20,
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '0.5px' }}>Staking Vault Balance</div>
              <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>
                Excess Rewards: <span style={{ color: '#10B981', fontWeight: 700 }}>{excessRewardsFormatted} $HH</span>
              </div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#4F46E5', fontFamily: "'DM Mono', monospace" }}>
              {stakingBalanceData ? formatExactOrConcise(stakingBalanceData) : '0.00'} $HH
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number"
              value={stakingHHRefundAmount}
              onChange={(e) => setStakingHHRefundAmount(e.target.value)}
              placeholder="Amount to Refund ($HH)"
              style={{
                flex: 1.5,
                padding: '10px 14px',
                borderRadius: 14,
                border: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(0, 0, 0, 0.2)',
                fontSize: 13,
                fontFamily: "'DM Mono', monospace",
                outline: 'none',
                color: '#fff'
              }}
            />
            <button
              onClick={refundStakingHHSpecific}
              style={{
                flex: 1,
                padding: '10px 16px',
                background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
                color: '#fff',
                borderRadius: 14,
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                whiteSpace: 'nowrap'
              }}
            >
              Refund Excess
            </button>
            <button
              onClick={refundStakingHHAll}
              style={{
                flex: 1,
                padding: '10px 16px',
                background: 'rgba(255, 255, 255, 0.1)',
                color: '#fff',
                borderRadius: 14,
                fontWeight: 800,
                border: '1px solid rgba(255, 255, 255, 0.2)',
                cursor: 'pointer',
                fontSize: 13,
                whiteSpace: 'nowrap'
              }}
            >
              Refund All Excess
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 8 }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 20,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#9CA3AF', marginBottom: 8 }}>Total $HH Burned (Dead Address)</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#EF4444', fontFamily: "'DM Mono', monospace" }}>
              {deadHHBalanceData ? formatExactOrConcise(deadHHBalanceData) : '0.00'} $HH
            </div>
          </div>
          
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 20,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#9CA3AF', marginBottom: 8 }}>Total Registered Users</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#10B981', fontFamily: "'DM Mono', monospace" }}>
              {totalUsers.toLocaleString()}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

function VaultCard({ title, token, balance, val, setVal, onRefund, onRefundAll }) {
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.03)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: 20,
      padding: 20,
      backdropFilter: 'blur(10px)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '0.5px' }}>{title}</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#4F46E5', fontFamily: "'DM Mono', monospace" }}>
          {balance} {token}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="number"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder={`Amount (${token})`}
          style={{
            flex: 1.5,
            padding: '10px 14px',
            borderRadius: 14,
            border: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(0, 0, 0, 0.2)',
            fontSize: 13,
            fontFamily: "'DM Mono', monospace",
            outline: 'none',
            color: '#fff'
          }}
        />
        <button
          onClick={onRefund}
          style={{
            flex: 1,
            padding: '10px 16px',
            background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
            color: '#fff',
            borderRadius: 14,
            fontWeight: 800,
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            whiteSpace: 'nowrap'
          }}
        >
          Refund
        </button>
        <button
          onClick={onRefundAll}
          style={{
            flex: 1,
            padding: '10px 16px',
            background: 'rgba(255, 255, 255, 0.1)',
            color: '#fff',
            borderRadius: 14,
            fontWeight: 800,
            border: '1px solid rgba(255, 255, 255, 0.2)',
            cursor: 'pointer',
            fontSize: 13,
            whiteSpace: 'nowrap'
          }}
        >
          Full Refund
        </button>
      </div>
    </div>
  )
}
