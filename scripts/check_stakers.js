import { createPublicClient, http, parseAbi, formatUnits } from 'viem';
import { base } from 'viem/chains';

const SUPABASE_URL = 'https://xiyrzftdeefszsiukkjc.supabase.co';
const SUPABASE_ANON = 'sb_publishable_C1OnF0Bi-L1hcIsPfQ8_BQ_-eT3XLzK';
const STAKING = "0xFd23526111280b78FF4e7F38B1fAF5818B9c5214".toLowerCase();

const ABI = [
  {
    name: 'getUserPositions',
    type: 'function',
    inputs: [{ name: '_user', type: 'address' }],
    outputs: [{
      components: [
        { name: 'amount', type: 'uint256' },
        { name: 'startTime', type: 'uint256' },
        { name: 'endTime', type: 'uint256' },
        { name: 'apr', type: 'uint256' },
        { name: 'durationDays', type: 'uint256' },
        { name: 'active', type: 'bool' }
      ],
      type: 'tuple[]'
    }],
    stateMutability: 'view',
  }
];

async function main() {
  const resUsers = await fetch(`${SUPABASE_URL}/rest/v1/users?select=address`, {
    headers: {
      'apikey': SUPABASE_ANON,
      'Authorization': `Bearer ${SUPABASE_ANON}`
    }
  });
  const users = await resUsers.json();
  
  const publicClient = createPublicClient({
    chain: base,
    transport: http('https://mainnet.base.org')
  });

  const calls = [];
  for (const u of users) {
    calls.push({
      address: STAKING,
      abi: ABI,
      functionName: "getUserPositions",
      args: [u.address],
    });
  }

  const results = [];
  const chunkSize = 100;
  for (let i = 0; i < calls.length; i += chunkSize) {
    const chunk = calls.slice(i, i + chunkSize);
    try {
      const res = await publicClient.multicall({ contracts: chunk });
      results.push(...res);
    } catch (e) {
      for (let j = 0; j < chunk.length; j++) results.push({ status: 'failure' });
    }
  }

  let totalStakedPool = 0;
  const allStakers = [];

  for (let i = 0; i < users.length; i++) {
    const addr = users[i].address;
    const posRes = results[i];

    if (posRes.status === 'success' && posRes.result) {
      let userTotal = 0;
      for (const pos of posRes.result) {
        userTotal += parseFloat(formatUnits(pos.amount, 18));
      }
      if (userTotal > 0) {
        allStakers.push({ addr, staked: userTotal });
        totalStakedPool += userTotal;
      }
    }
  }

  allStakers.sort((a, b) => b.staked - a.staked);

  console.log(`\n=== ALL USERS WITH ACTIVE POSITIONS (${allStakers.length} users) ===`);
  allStakers.forEach((u, i) => {
    console.log(`${i+1}. ${u.addr} - ${u.staked.toLocaleString()} $HH`);
  });
  console.log(`\nTOTAL IN POSITIONS: ${totalStakedPool.toLocaleString()} $HH`);
}

main();
