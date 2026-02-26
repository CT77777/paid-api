import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
dotenv.config();

// 匯入類型定義
interface PaymentChallenge {
  amount: string;
  asset: string;
  facilitator: string;
  recipient: string;
}

// 模擬 Agent 的私鑰（請勿在生產環境洩漏）
const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY || '0x...';
const wallet = new ethers.Wallet(AGENT_PRIVATE_KEY);

const SERVER_URL = 'http://localhost:3000/secret-data';

async function runAgent() {
  console.log('🤖 Agent: 嘗試存取付費資源...');

  // 1. 第一次嘗試請求
  let response = await fetch(SERVER_URL);

  // 2. 檢查是否收到 402 Payment Required
  if (response.status === 402) {
    console.log('⚠️  Agent: 收到 402 錯誤，正在解析支付要求...');

    // 從 Header 提取支付指令 (payment-required)
    const paymentRequiredRaw = response.headers.get('payment-required');
    if (!paymentRequiredRaw) {
      throw new Error('Server 回傳 402 但缺少 payment-required header');
    }

    const paymentChallenge = JSON.parse(paymentRequiredRaw) as PaymentChallenge;
    console.log('📋 Agent: 支付挑戰詳情:', paymentChallenge);
    console.log(
      `💰 支付詳情: ${paymentChallenge.amount} units of ${paymentChallenge.asset}`,
    );

    // 3. 準備 EIP-712 簽名資料 (這是 x402 要求的格式)
    // 註：實際格式需參考 ERC-8004/x402 具體定義的 Domain 與 Types
    const domain = {
      name: 'x402-Payment',
      version: '1',
      chainId: 84532, // Base Sepolia
      verifyingContract: paymentChallenge.asset.split(':').pop(),
    };

    const types = {
      Payment: [
        { name: 'recipient', type: 'address' },
        { name: 'amount', type: 'uint256' },
        { name: 'asset', type: 'address' },
        { name: 'nonce', type: 'uint256' },
      ],
    };

    const value = {
      recipient: paymentChallenge.recipient,
      amount: paymentChallenge.amount,
      asset: paymentChallenge.asset.split(':').pop(), // 提取 ERC20 地址
      nonce: Math.floor(Math.random() * 1000000), // 實際應由 Server 或合約提供
    };

    // 4. 調用錢包進行簽名
    console.log('🖋️  Agent: 正在進行離線簽名授權...');
    const signature = await wallet.signTypedData(domain, types, value);

    // 5. 第二次嘗試請求，帶上 payment-signature
    console.log('🚀 Agent: 帶上證明重新發送請求...');
    response = await fetch(SERVER_URL, {
      headers: {
        'payment-signature': signature,
        'Content-Type': 'application/json',
      },
    });
  }

  // 6. 處理最終結果
  if (response.ok) {
    const data = (await response.json()) as number;
    console.log('✅ Agent: 成功獲取資源:', data);
  } else {
    console.log('❌ Agent: 請求失敗，狀態碼:', response.status);
  }
}

runAgent().catch(console.error);
