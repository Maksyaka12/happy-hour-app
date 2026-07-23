import { createPublicClient, http, parseAbi, formatUnits } from 'viem';
import { base } from 'viem/chains';

const STAKING = "0xFd23526111280b78FF4e7F38B1fAF5818B9c5214".toLowerCase();

async function main() {
  const publicClient = createPublicClient({
    chain: base,
    transport: http('https://mainnet.base.org')
  });

  const latestBlock = await publicClient.getBlockNumber();
  let fromBlock = 16000000n; 
  const step = 9500n;
  const uniqueAddresses = new Set();
  
  console.log(`Fetching logs from ${fromBlock} to ${latestBlock}...`);
  
  const promises = [];
  while (fromBlock < latestBlock) {
    let toBlock = fromBlock + step;
    if (toBlock > latestBlock) toBlock = latestBlock;
    promises.push(
      publicClient.getLogs({
        address: STAKING,
        event: parseAbi(["event Staked(address indexed user, uint256 amount, uint256 durationDays)"])[0],
        fromBlock,
        toBlock
      }).catch(e => [])
    );
    fromBlock = toBlock + 1n;
  }
  
  const allLogs = await Promise.all(promises);
  for (const logs of allLogs) {
    for (const log of logs) {
      uniqueAddresses.add(log.args.user.toLowerCase());
    }
  }
  
  console.log(`Found ${uniqueAddresses.size} unique stakers. Checking positions...`);

  const calls = [];
  for (const u of uniqueAddresses) {
    calls.push({
      address: STAKING,
      abi: [{ name: 'getUserPositions', type: 'function', inputs: [{ name: '_user', type: 'address' }], outputs: [{ components: [{ name: 'amount', type: 'uint256' }, { name: 'startTime', type: 'uint256' }, { name: 'endTime', type: 'uint256' }, { name: 'apr', type: 'uint256' }, { name: 'durationDays', type: 'uint256' }, { name: 'active', type: 'bool' }], type: 'tuple[]' }], stateMutability: 'view' }],
      functionName: "getUserPositions",
      args: [u],
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
  const activeStakers = [];

  const addressesArray = Array.from(uniqueAddresses);
  for (let i = 0; i < addressesArray.length; i++) {
    const addr = addressesArray[i];
    const posRes = results[i];

    if (posRes?.status === 'success' && posRes.result) {
      let userTotal = 0;
      for (const pos of posRes.result) {
        if (pos.active) {
          userTotal += parseFloat(formatUnits(pos.amount, 18));
        }
      }
      if (userTotal > 0) {
        activeStakers.push({ addr, staked: userTotal });
        totalStakedPool += userTotal;
      }
    }
  }

  activeStakers.sort((a, b) => b.staked - a.staked);

  console.log(`\n=== ALL ONCHAIN ACTIVE STAKERS (${activeStakers.length} users) ===`);
  activeStakers.forEach((u, i) => {
    console.log(`${i+1}. ${u.addr} - ${u.staked.toLocaleString()} $HH`);
  });
  console.log(`\nTOTAL ONCHAIN ACTIVE STAKED: ${totalStakedPool.toLocaleString()} $HH`);
}

main().catch(console.error);
