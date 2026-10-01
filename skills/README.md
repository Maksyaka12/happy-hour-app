# Base Developer Skill

Professional senior Base blockchain developer skill for building production-ready applications on Base L2.

## Overview

This skill transforms Claude into an expert **Base blockchain developer** with comprehensive knowledge of:

- ✅ **Base L2 ecosystem** (Coinbase's Ethereum Layer 2)
- ✅ **wagmi + viem** stack for modern web3 development
- ✅ **Next.js 14+** with TypeScript and Tailwind CSS
- ✅ **Smart contract development** with Foundry
- ✅ **Base Account SDK** (smart wallets with account abstraction)
- ✅ **Batch transactions** via EIP-5792
- ✅ **Builder Codes** for transaction attribution
- ✅ **Production-ready** code standards

## When to Use This Skill

The skill triggers when you:

- Build apps on Base blockchain
- Work with Base mainnet or Sepolia testnet
- Implement wallet connection with wagmi/viem
- Deploy or interact with smart contracts on Base
- Use Base Account SDK, OnchainKit, or Builder Codes
- Develop web3 frontends with Next.js
- Need batch transactions or gas sponsorship
- Want production-ready Base applications

## Key Features

### 1. Production-Ready Code
- Battle-tested patterns from official Base documentation
- Proper error handling and user feedback
- Optimized for low gas costs
- Security-first approach

### 2. Strict Documentation Adherence
- Always follows official Base documentation
- Never deviates from documented patterns
- Searches docs when uncertain
- Uses latest Base ecosystem standards

### 3. Complete Technology Stack
```
Frontend:
- Next.js 14+ (App Router)
- TypeScript + Tailwind CSS
- React 18+

Web3 Integration:
- wagmi ^2.x (React hooks)
- viem ^2.x (Ethereum library)
- @tanstack/react-query (caching)
- @base-org/account (Base Account SDK)

Smart Contracts:
- Foundry (compilation, testing, deployment)
- Solidity 0.8.x

Optional:
- @coinbase/onchainkit (UI components)
- @rainbow-me/rainbowkit (wallet UI)
```

### 4. Base-Specific Features
- **Low fees**: ~$0.01 per transaction
- **Fast finality**: Sub-second block times
- **Batch transactions**: Multiple operations in one transaction
- **Gas sponsorship**: Cover user fees with paymasters
- **Builder Codes**: Transaction attribution for analytics and rewards
- **Coinbase integration**: 110M+ verified users

## What You'll Learn

With this skill, Claude will help you:

1. **Setup Projects**: Configure wagmi, Next.js, and Foundry correctly
2. **Connect Wallets**: Implement proper wallet connection with all states
3. **Read Contracts**: Fetch on-chain data with type-safe hooks
4. **Write Contracts**: Send transactions with proper confirmation handling
5. **Batch Operations**: Detect capabilities and execute batch transactions
6. **Deploy Contracts**: Use Foundry to compile, test, and deploy
7. **Integrate Builder Codes**: Add transaction attribution
8. **Gas Optimization**: Minimize costs and maximize performance
9. **Production Deployment**: Follow best practices for mainnet

## Skill Structure

```
base-developer-skill/
├── SKILL.md                    # Main skill instructions
├── README.md                   # This file
└── references/
    └── code-snippets.md        # Quick reference code examples
```

## Quick Start Examples

### Example 1: Create a New Base App

**You**: "Create a new Base app with wallet connection"

**Claude**: Creates a complete Next.js app with:
- Proper wagmi configuration for Base
- Wallet connection component (4 states handled)
- Provider setup with TypeScript
- Tailwind CSS styling
- Production-ready code structure

### Example 2: Deploy a Smart Contract

**You**: "Deploy a counter contract to Base Sepolia"

**Claude**: 
- Sets up Foundry project structure
- Writes secure deployment script
- Handles private key storage safely
- Deploys and verifies on BaseScan
- Provides contract address and ABI

### Example 3: Implement Batch Transactions

**You**: "Add batch transaction support for my contract"

**Claude**:
- Detects wallet capabilities
- Implements batch transaction hook
- Handles EOA fallback gracefully
- Provides user feedback at each step

## Official Resources

- **Main Docs**: https://docs.base.org/
- **Build Guide**: https://docs.base.org/get-started/build-app
- **Base Account**: https://docs.base.org/base-account/overview/what-is-base-account
- **Builder Codes**: https://docs.base.org/base-chain/builder-codes/builder-codes
- **Base.dev**: https://base.dev (app registration & analytics)
- **Discord**: https://discord.com/invite/buildonbase

## Production Checklist

Before deploying to mainnet, verify:

- [ ] TypeScript strict mode enabled
- [ ] All error states handled
- [ ] Loading indicators on async operations
- [ ] User feedback for transactions
- [ ] Correct chain IDs in all operations
- [ ] Contracts verified on BaseScan
- [ ] Mobile responsive design
- [ ] Builder Code integrated
- [ ] RPC fallbacks configured
- [ ] Security audit completed (if applicable)

## Contributing

This skill follows Base's official documentation and best practices. If you notice any discrepancies:

1. Verify against official docs: https://docs.base.org/
2. Report issues with specific documentation links
3. Suggest improvements with code examples

## Version

**Current Version**: 1.0.0

**Last Updated**: April 2026

**Compatible With**:
- Base Mainnet (Chain ID: 8453)
- Base Sepolia Testnet (Chain ID: 84532)
- wagmi ^2.x
- viem ^2.x
- Next.js 14+

## License

MIT License - Free to use for any purpose

## Support

Need help? 

- Check official Base docs: https://docs.base.org/
- Join Base Discord: https://discord.com/invite/buildonbase
- Search Base GitHub: https://github.com/base

---

**Built for production. Powered by official documentation. Ready to deploy.**
