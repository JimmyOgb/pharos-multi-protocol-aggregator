export const DEFAULT_PHAROS_RPC = 'https://rpc.pharos.xyz';
export const PHAROS_CHAIN_ID = 1672;
export const EXPLORER_BASE_URL = 'https://www.pharosscan.xyz';

export class PharosRpcClient {
  private rpcUrl: string;

  constructor(rpcUrl: string = DEFAULT_PHAROS_RPC) {
    this.rpcUrl = rpcUrl;
  }

  getRpcUrl(): string {
    return this.rpcUrl;
  }

  async call(to: string, data: string, timeoutMs = 12000): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resp = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Math.floor(Math.random() * 1000000),
          method: 'eth_call',
          params: [{ to, data }, 'latest'],
        }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        throw new Error(`RPC HTTP ${resp.status}: ${resp.statusText}`);
      }

      const json = await resp.json();
      if (json.error) {
        throw new Error(`RPC Error (${json.error.code}): ${json.error.message}`);
      }

      return json.result || '0x';
    } finally {
      clearTimeout(timeout);
    }
  }

  async getBalance(address: string, timeoutMs = 12000): Promise<bigint> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resp = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Math.floor(Math.random() * 1000000),
          method: 'eth_getBalance',
          params: [address, 'latest'],
        }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        throw new Error(`RPC HTTP ${resp.status}: ${resp.statusText}`);
      }

      const json = await resp.json();
      if (json.error) {
        throw new Error(`RPC Error: ${json.error.message}`);
      }

      return BigInt(json.result || '0x0');
    } finally {
      clearTimeout(timeout);
    }
  }

  async getBlockNumber(timeoutMs = 12000): Promise<number> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resp = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_blockNumber',
          params: [],
        }),
        signal: controller.signal,
      });

      const json = await resp.json();
      return parseInt(json.result, 16);
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function padAddress(address: string): string {
  const clean = address.toLowerCase().replace(/^0x/, '');
  return clean.padStart(64, '0');
}

export function padUint256(amount: bigint | number | string): string {
  const bn = BigInt(amount);
  const hex = bn.toString(16);
  return hex.padStart(64, '0');
}

export function formatEther(wei: bigint | string, decimals = 18): string {
  const bn = BigInt(wei);
  const factor = 10n ** BigInt(decimals);
  const whole = bn / factor;
  const fraction = (bn % factor).toString().padStart(decimals, '0').slice(0, 4);
  return `${whole}.${fraction}`;
}

export function parseEther(etherStr: string, decimals = 18): bigint {
  const parts = etherStr.trim().split('.');
  const whole = parts[0] ? BigInt(parts[0]) : 0n;
  const factor = 10n ** BigInt(decimals);
  let result = whole * factor;

  if (parts[1]) {
    const fractionPart = parts[1].padEnd(decimals, '0').slice(0, decimals);
    result += BigInt(fractionPart);
  }
  return result;
}
