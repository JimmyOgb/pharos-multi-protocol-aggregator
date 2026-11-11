export type ProtocolId = 'wpros' | 'faroo-stpros' | 'uniswap-v2-pros' | 'harbor-apc3m';

export type ProtocolStatus = 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'UNAVAILABLE';

export type DataFreshness = 'LIVE' | 'CACHED' | 'STALE';

export type RiskTier = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ProtocolVenue {
  id: ProtocolId;
  name: string;
  category: 'Liquid Native Wrapper' | 'Liquid Staking (ERC-4626)' | 'AMM Liquidity Pool' | 'RWA Fixed Income Credit';
  protocolWebsite: string;
  contractAddress: string;
  implementationAddress?: string;
  network: string;
  chainId: number;
  underlyingAsset: string;
  underlyingAssetAddress: string;
  shareAsset: string;
  status: ProtocolStatus;
  metrics: VenueMetrics;
  supportedActions: ('DEPOSIT' | 'WITHDRAW' | 'REDEEM' | 'APPROVE')[];
  dataFreshness: DataFreshness;
  lastObservedAt: string;
  verifiedSource: string;
  errorMessage?: string;
}

export interface VenueMetrics {
  tvlRaw: string;
  tvlFormatted: string;
  totalSharesRaw?: string;
  totalSharesFormatted?: string;
  baseApyPercent: number;
  netApyPercent: number;
  exchangeRate: number; // e.g. 1.008833 for stPROS
  exchangeRateDescription: string;
  unbondingPeriodSeconds: number;
  unbondingPeriodDays: number;
  lockupDurationSeconds: number;
  lockupDurationDays: number;
  depositFeeBps: number;
  withdrawalFeeBps: number;
  minDepositFormatted: string;
  riskTier: RiskTier;
  riskSummary: string;
}

export interface UserPosition {
  protocolId: ProtocolId;
  protocolName: string;
  contractAddress: string;
  assetSymbol: string;
  rawBalance: string;
  formattedBalance: string;
  rawShareBalance?: string;
  formattedShareBalance?: string;
  underlyingValueFormatted: string;
  unbondingActive: boolean;
  canWithdrawImmediately: boolean;
  dataFreshness: DataFreshness;
  observedAt: string;
}

export interface UserRoutingRequest {
  asset: string; // e.g. 'PROS', 'WPROS', 'USDC'
  amount: string; // e.g. '10.5'
  userAddress?: string;
  priority: 'MAX_YIELD' | 'INSTANT_LIQUIDITY' | 'MIN_LOCKUP' | 'BALANCED';
  maxLockupDays?: number;
}

export interface VenueEvaluation {
  venueId: ProtocolId;
  venueName: string;
  score: number;
  isEligible: boolean;
  exclusionReason?: string;
  apyPercent: number;
  unbondingDays: number;
  tvlFormatted: string;
  liquidityTier: string;
  pros: string[];
  cons: string[];
}

export interface RoutingDecision {
  request: UserRoutingRequest;
  timestamp: string;
  selectedVenue: ProtocolVenue | null;
  selectionSummary: string;
  detailedReasoning: string[];
  tradeOffs: string[];
  evaluations: VenueEvaluation[];
  dataProvenance: {
    source: string;
    chainId: number;
    rpcEndpoint: string;
    observationTime: string;
    freshness: DataFreshness;
  };
}

export interface ActionPreparationRequest {
  protocolId: ProtocolId;
  operation: 'DEPOSIT' | 'WITHDRAW' | 'REDEEM' | 'APPROVE';
  amount: string; // token units
  userAddress: string;
  receiverAddress?: string;
}

export interface UnsignedTransactionPayload {
  to: string;
  from: string;
  value: string; // hex wei
  data: string; // hex calldata
  gasLimit: string;
  chainId: number;
  description: string;
  protocolId: ProtocolId;
  protocolName: string;
  operation: 'DEPOSIT' | 'WITHDRAW' | 'REDEEM' | 'APPROVE';
  functionSelector: string;
  functionSignature: string;
  decodedParameters: Record<string, any>;
  contractExplorerUrl: string;
  signed: false;
  broadcast: false;
  requiresPriorApproval: boolean;
  approvalTransaction?: UnsignedTransactionPayload;
}
