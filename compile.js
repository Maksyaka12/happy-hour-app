const solc = require('solc');
const fs = require('fs');

const contractPath = './contracts/HappyHourVault.sol';
const source = fs.readFileSync(contractPath, 'utf8');

const input = {
  language: 'Solidity',
  sources: {
    'HappyHourVault.sol': {
      content: source,
    },
  },
  settings: {
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode'],
      },
    },
    optimizer: {
      enabled: true,
      runs: 200
    }
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
const contract = output.contracts['HappyHourVault.sol']['HappyHourVault'];

const fileContent = `export const VAULT_ABI = ${JSON.stringify(contract.abi, null, 2)};\nexport const VAULT_BYTECODE = "0x${contract.evm.bytecode.object}";\n`;
fs.writeFileSync('./frontend/src/VaultDeployData.js', fileContent);
