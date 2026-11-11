import { PharosRpcClient } from '../core/rpc-client.ts';
import type { ProtocolVenue, UserPosition, UnsignedTransactionPayload } from '../types/index.ts';

export abstract class BaseProtocolAdapter {
  protected rpcClient: PharosRpcClient;
  protected timeoutMs: number;
  private simulatedFault: string | null = null;
  protected cachedVenue: { venue: ProtocolVenue; timestamp: number } | null = null;

  constructor(rpcClient: PharosRpcClient, timeoutMs = 10000) {
    this.rpcClient = rpcClient;
    this.timeoutMs = timeoutMs;
  }

  abstract getId(): string;
  abstract getName(): string;
  abstract getContractAddress(): string;

  /**
   * Set controlled fault injection for verifiable failure-isolation testing (REQ-04)
   */
  setInjectedFault(faultType: 'TIMEOUT' | 'REVERT' | 'NETWORK_ERROR' | null): void {
    this.simulatedFault = faultType;
    if (faultType !== null) {
      this.cachedVenue = null; // Clear cache on fault injection
    }
  }

  protected checkInjectedFault(): void {
    if (this.simulatedFault === 'TIMEOUT') {
      throw new Error(`[Fault Injection] Gateway timed out after ${this.timeoutMs}ms`);
    }
    if (this.simulatedFault === 'REVERT') {
      throw new Error('[Fault Injection] Contract call reverted: Execution reverted (0x)');
    }
    if (this.simulatedFault === 'NETWORK_ERROR') {
      throw new Error('[Fault Injection] Network connection refused: ECONNREFUSED');
    }
  }

  abstract fetchVenueInfo(forceLive?: boolean): Promise<ProtocolVenue>;
  abstract fetchUserPosition(userAddress: string): Promise<UserPosition>;
  abstract prepareDeposit(userAddress: string, amount: string, receiverAddress?: string): Promise<UnsignedTransactionPayload>;
  abstract prepareWithdraw(userAddress: string, amount: string, receiverAddress?: string): Promise<UnsignedTransactionPayload>;
}
