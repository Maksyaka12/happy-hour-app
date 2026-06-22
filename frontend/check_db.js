import { createPublicClient, http, formatUnits } from 'viem';
import { base } from 'viem/chains';

const HH = '0x8235EdF32a1e10Bd1867ad622915AB613664cbA3';
const HH_RAFFLE_VAULT = '0x3bdF461984142C473F2185B4F0F64a918B8ce49b';

async function main() {
  try {
    const client = createPublicClient({
      chain: base,
      transport: http()
    });

    const currentBlock = await client.getBlockNumber();
    console.log(`Current block: ${currentBlock}`);
    const fromBlock = currentBlock - 9000n;

    console.log(`Querying logs from block ${fromBlock}...`);
    // Transfer events where HH_RAFFLE_VAULT is sender or receiver
    const logs1 = await client.getLogs({
      address: HH,
      event: {
        type: 'event',
        name: 'Transfer',
        inputs: [
          { type: 'address', indexed: true, name: 'from' },
          { type: 'address', indexed: true, name: 'to' },
          { type: 'uint256', name: 'value' }
        ]
      },
      args: {
        to: HH_RAFFLE_VAULT
      },
      fromBlock
    });

    const logs2 = await client.getLogs({
      address: HH,
      event: {
        type: 'event',
        name: 'Transfer',
        inputs: [
          { type: 'address', indexed: true, name: 'from' },
          { type: 'address', indexed: true, name: 'to' },
          { type: 'uint256', name: 'value' }
        ]
      },
      args: {
        from: HH_RAFFLE_VAULT
      },
      fromBlock
    });

    console.log(`=== Transfers TO raffle contract (${logs1.length}) ===`);
    for (const log of logs1) {
      console.log(`Block: ${log.blockNumber}, Tx: ${log.transactionHash}`);
      console.log(`From: ${log.args.from}, Amount: ${formatUnits(log.args.value, 18)} HH`);
    }

    console.log(`=== Transfers FROM raffle contract (${logs2.length}) ===`);
    for (const log of logs2) {
      console.log(`Block: ${log.blockNumber}, Tx: ${log.transactionHash}`);
      console.log(`To: ${log.args.to}, Amount: ${formatUnits(log.args.value, 18)} HH`);
      
      try {
        const tx = await client.getTransaction({ hash: log.transactionHash });
        console.log(`  Sender (from): ${tx.from}`);
        console.log(`  To (contract): ${tx.to}`);
        console.log(`  Data (first 10 chars): ${tx.input.slice(0, 10)}`);
        
        // Decode
        const { decodeFunctionData } = await import('viem');
        const decoded = decodeFunctionData({
          abi: [{
            name: 'distributePrize',
            type: 'function',
            inputs: [
              { name: '_winner', type: 'address' },
              { name: '_winnerAmount', type: 'uint256' },
              { name: '_burnAmount', type: 'uint256' }
            ]
          }],
          data: tx.input
        });
        console.log(`  Decoded Args: winner=${decoded.args[0]}, winnerAmount=${formatUnits(decoded.args[1], 18)} HH, burnAmount=${formatUnits(decoded.args[2], 18)} HH`);
      } catch (err) {
        console.error(`  Failed to fetch/decode tx info:`, err.message);
      }
    }

    // Check balance
    const balance = await client.readContract({
      address: HH,
      abi: [{
        name: 'balanceOf',
        type: 'function',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ type: 'uint256' }],
        stateMutability: 'view'
      }],
      functionName: 'balanceOf',
      args: [HH_RAFFLE_VAULT]
    });
    console.log(`\nHH Raffle Vault Balance: ${formatUnits(balance, 18)} HH`);
  } catch (e) {
    console.error(e);
  }
}

main();
