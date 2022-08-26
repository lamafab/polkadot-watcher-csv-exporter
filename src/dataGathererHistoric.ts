/*eslint @typescript-eslint/no-use-before-define: ["error", { "variables": false }]*/

import { DeriveEraPoints } from '@polkadot/api-derive/staking/types';
import { MyDeriveStakingAccount, ChainData, EraLastBlock, Voter } from "./types";
import { Logger } from '@w3f/logger';
import { ApiPromise } from '@polkadot/api';
import { getDisplayName, erasLastBlock as erasLastBlockFunction } from './utils';
import { DeriveEraExposure, DeriveStakingAccount } from '@polkadot/api-derive/staking/types'
import { DeriveAccountInfo } from '@polkadot/api-derive/accounts/types'
import BN from 'bn.js';
import type { EraIndex, StakingLedger, Nominations } from '@polkadot/types/interfaces';
import type { PalletStakingNominations, PalletStakingStakingLedger, PalletStakingExposure } from '@polkadot/types/lookup';
import { application } from 'express';

export interface ChainDataHistoricalRequest {
  api: ApiPromise;
  network: string;
  eraIndex: EraIndex;
}

export const gatherChainDataHistorical = async (request: ChainDataHistoricalRequest, logger: Logger): Promise<ChainData> => {
  logger.info(`Historical Data gathering triggered...`)
  const data = await _gatherDataHistorical(request, logger)
  logger.info(`Historical Data have been gathered.`)
  return data
}

const _gatherDataHistorical = async (request: ChainDataHistoricalRequest, logger: Logger): Promise<ChainData> => {
  logger.debug(`Gathering some data from the chain...`)
  const { api, eraIndex } = request

  logger.info(`Requested era: ${eraIndex}`);
  logger.debug(`Gathering data ...`);

  // Get basic chain properties.
  const chainProperties = api.registry.getChainProperties();
  const tokenDecimals = chainProperties.tokenDecimals.unwrap().toArray()[0].toNumber();
  const tokenSymbol = chainProperties.tokenSymbol.unwrap().toArray()[0].toString();

  // Get era info.
  const eraBlockReference = (await erasLastBlockFunction([eraIndex], api)).find(({ era }) => era.eq(eraIndex));
  const hashReference = await api.rpc.chain.getBlockHash(eraBlockReference.block)
  const apiAt = await api.at(hashReference);
  const timestamp = new Date((await apiAt.query.timestamp.now()).toNumber());

  const totalValidatorRewards = (await api.query.staking.erasValidatorReward(eraIndex)).unwrap();

  const eraPoints = await api.query.staking.erasRewardPoints(eraIndex);
  const totalEraPoints = eraPoints.total;

  const erasExposure = (await api.derive.staking._erasExposure([eraIndex], false)).find(({ era }) => era.eq(eraIndex));
  const eraValidatorAddresses = Object.keys(erasExposure['validators']);
  const deriveStakingAccounts = await api.derive.staking.accounts(eraValidatorAddresses);

  const stakingAccounts: MyDeriveStakingAccount[] = [];
  for (const account of deriveStakingAccounts) {
    const validatorEraPoints = eraPoints.individual.get(account.accountId);
    stakingAccounts.push(
      {
        ...account,
        eraPoints: validatorEraPoints.toNumber(),
      }
    )
  }

  logger.debug(`Data gathering for era ${eraIndex} completed!`);

  return {
    network: request.network,
    tokenDecimals: tokenDecimals,
    tokenSymbol: tokenSymbol,
    eraIndex: eraIndex,
    timestamp: timestamp,
    totalEraPoints: totalEraPoints,
    totalValidatorRewards: totalValidatorRewards.toBigInt(),
    stakingAccounts: stakingAccounts,
  } as ChainData
}

interface MyNominator {
  address: string;
  nominations: Nominations;
  ledger: StakingLedger;
}
