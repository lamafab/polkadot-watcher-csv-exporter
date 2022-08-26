import { ApiPromise } from '@polkadot/api';
import { AccountId, EraIndex, SessionIndex, BlockNumber, RewardPoint, Balance, BalanceOf } from '@polkadot/types/interfaces';
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

export interface ValidatorInfo {
  accountId: AccountId;
  rewardDestination: string | null;
  eraPoints: number;
  exposureOwn: bigint;
  exposureTotal: bigint;
  commission: number;
  nominators: NominatorInfo[];
}

export interface NominatorInfo {
  accountId: AccountId;
  exposure: bigint;
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
  totalValidatorRewards: bigint;
  totalEraPoints: RewardPoint;
  validatorInfos: ValidatorInfo[];
}

export interface EraLastBlock {
  era: EraIndex;
  block: number;
}
