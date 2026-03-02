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

    // 3. 準備 ERC-3009 TransferWithAuthorization 的 EIP-712 簽名資料
    // ERC-3009 允許透過簽名授權第三方代為轉帳 (gasless transfer)
    const tokenAddress = paymentChallenge.asset.split(':').pop() as string;
    console.log('🔗 Agent: 目標 Token 合約地址:', tokenAddress);

    // EIP-712 Domain - 需要使用 Token 合約的資訊
    const domain = {
      name: 'USD Coin', // USDC token name (Base Sepolia)
      version: '2', // USDC version
      chainId: 84532, // Base Sepolia
      verifyingContract: tokenAddress, // Token 合約地址
    };

    // ERC-3009 TransferWithAuthorization types
    const types = {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    };

    // 生成隨機 nonce (bytes32)
    const nonce = ethers.hexlify(ethers.randomBytes(32));

    // 設定有效時間範圍
    const now = Math.floor(Date.now() / 1000);
    const validAfter = now - 60; // 1 分鐘前開始有效
    const validBefore = now + 3600; // 1 小時後過期

    const value = {
      from: wallet.address, // 付款人 (Agent)
      to: paymentChallenge.recipient, // 收款人 (Server)
      value: paymentChallenge.amount, // 金額
      validAfter: validAfter,
      validBefore: validBefore,
      nonce: nonce,
    };

    // 4. 調用錢包進行簽名
    console.log('🖋️  Agent: 正在進行離線簽名授權...');
    const signature = await wallet.signTypedData(domain, types, value);
    console.log('🔏 Agent: 簽名完成，簽章:', signature);

    // 5. 第二次嘗試請求，帶上 payment-signature
    console.log('🚀 Agent: 帶上證明重新發送請求...');
    response = await fetch(SERVER_URL, {
      headers: {
        'payment-signature': signature,
        'payment-authorization': JSON.stringify(value),
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
