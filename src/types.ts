import { ApiPromise } from '@polkadot/api';
import { EraIndex, SessionIndex, BlockNumber, EraRewardPoints, Balance, BalanceOf } from '@polkadot/types/interfaces';
import { Compact } from '@polkadot/types';
import { DeriveStakingAccount } from '@polkadot/api-derive/staking/types';
import type { PalletStakingExposure } from '@polkadot/types/lookup';

export interface InputConfig {
  logLevel: string;
  debug?: DebugConfig;
  port: number;
  endpoint: string;
  database_url: string;
  exportDir: string;
  sessionOnly: boolean;
  endSessionBlockDistance: number;
  bucketUpload?: BucketUploadConfig;
  cronjob?: CronJobConfig;
  apiChunkSize?: number;
  apiTimeoutMs?: number;
  historic?: {
    enabled: boolean;
    historySize: number;
  };
  eraScanner?: {
    enabled: boolean;
    dataDir: string;
    startFromEra?: number;
  };
}

interface DebugConfig {
  enabled: boolean;
  forceInitialWrite: boolean;
}

export interface CronJobConfig {
  enabled: boolean;
}

export interface BucketUploadConfig {
  enabled: boolean;
  gcpServiceAccount: string;
  gcpProject: string;
  gcpBucketName: string;
}

export interface MyDeriveStakingAccount extends DeriveStakingAccount {
  displayName: string;
  voters: Voter[];
  eraPoints?: number;
  exposure: PalletStakingExposure;
}

export interface Voter {
  address: string;
  value: Compact<Balance>;
}

export interface WriteCSVHistoricalRequest {
  api: ApiPromise;
  network: string;
  eraIndex: EraIndex;
}

export interface ChainData {
  eraIndex: EraIndex;
  unixTime: number;
  blockNumber: Compact<BlockNumber>;
  eraPoints: EraRewardPoints;
  totalIssuance: Balance;
  validatorRewardsPreviousEra: BalanceOf;
  validatorInfo: MyDeriveStakingAccount[];
}

export interface EraLastBlock {
  era: EraIndex;
  block: number;
}