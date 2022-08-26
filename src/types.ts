import { ApiPromise } from '@polkadot/api';
import { EraIndex, SessionIndex, BlockNumber, RewardPoint, Balance, BalanceOf } from '@polkadot/types/interfaces';
import { Compact } from '@polkadot/types';
import { DeriveStakingAccount, DeriveStakingQuery } from '@polkadot/api-derive/staking/types';
import type { PalletStakingExposure } from '@polkadot/types/lookup';

export interface InputConfig {
  logLevel: string;
  debug?: DebugConfig;
  healthCheckPort: number;
  endpoint: string;
  databaseUrl: string;
  apiTimeoutMs?: number;
}

interface DebugConfig {
  enabled: boolean;
  forceInitialWrite: boolean;
}

export interface MyDeriveStakingAccount extends DeriveStakingAccount {
  eraPoints: number;
}

export interface Voter {
  address: string;
  value: Compact<Balance>;
}

export interface ChainData {
  network: string;
  tokenDecimals: number;
  tokenSymbol: string;
  eraIndex: EraIndex;
  timestamp: Date;
  totalEraPoints: RewardPoint;
  totalValidatorRewards: bigint;
  stakingAccounts: MyDeriveStakingAccount[];
}

export interface EraLastBlock {
  era: EraIndex;
  block: number;
}
