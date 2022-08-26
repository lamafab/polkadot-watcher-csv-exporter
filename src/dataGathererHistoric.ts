/*eslint @typescript-eslint/no-use-before-define: ["error", { "variables": false }]*/

import { DeriveEraPoints } from '@polkadot/api-derive/staking/types';
import { ValidatorInfo, NominatorInfo, ChainData, EraLastBlock, Voter } from "./types";
import { Logger } from '@w3f/logger';
import { ApiPromise } from '@polkadot/api';
import { getDisplayName, erasLastBlock as erasLastBlockFunction } from './utils';
import { DeriveEraExposure, DeriveStakingAccount } from '@polkadot/api-derive/staking/types'
import { DeriveAccountInfo } from '@polkadot/api-derive/accounts/types'
import BN from 'bn.js';
import type { AccountId32, EraIndex, StakingLedger, Nominations } from '@polkadot/types/interfaces';
import type { PalletStakingNominations, PalletStakingStakingLedger, PalletStakingExposure } from '@polkadot/types/lookup';
import { application } from 'express';

export interface ChainDataHistoricalRequest {
  api: ApiPromise;
  network: string;
  eraIndex: EraIndex;
}

export const gatherChainDataHistorical = async (request: ChainDataHistoricalRequest, logger: Logger): Promise<ChainData> => {
  return (await _gatherDataHistorical(request, logger))
}

const _gatherDataHistorical = async (request: ChainDataHistoricalRequest, logger: Logger): Promise<ChainData> => {
  const { api, eraIndex } = request

  // Get basic chain properties.
  logger.debug(`Gathering basic chain properties...`);
  const chainProperties = api.registry.getChainProperties();
  const tokenDecimals = chainProperties.tokenDecimals.unwrap().toArray()[0].toNumber();
  const tokenSymbol = chainProperties.tokenSymbol.unwrap().toArray()[0].toString();

  // Get era info.
  logger.debug(`Gathering info about era...`);
  const eraBlockReference = (await erasLastBlockFunction([eraIndex], api)).find(({ era }) => era.eq(eraIndex));
  const hashReference = await api.rpc.chain.getBlockHash(eraBlockReference.block)
  const totalValidatorRewards = (await api.query.staking.erasValidatorReward(eraIndex)).unwrap();

  const apiAt = await api.at(hashReference);
  const timestamp = new Date((await apiAt.query.timestamp.now()).toNumber());
  const eraPoints = await api.query.staking.erasRewardPoints(eraIndex);

  const validatorInfos: ValidatorInfo[] = [];

  logger.debug(`Gathering staking and exposure information...`);
  for (const [validatorId, validatorPoints] of eraPoints.individual) {
    const exposure = await api.query.staking.erasStakers(eraIndex, validatorId);
    const prefs = await api.query.staking.erasValidatorPrefs(eraIndex, validatorId);
    const payee = await api.query.staking.payee(validatorId);

    const nominatorInfos: NominatorInfo[] = [];
    for (const nominator of exposure.others) {
      nominatorInfos.push({
        accountId: nominator.who,
        exposure: nominator.value.toBigInt(),
      } as NominatorInfo);
    }

    let rewardDestination = null;
    if (payee.isAccount) {
      rewardDestination = payee.asAccount.toHuman();
    }

    validatorInfos.push({
      accountId: validatorId,
      rewardDestination: rewardDestination,
      eraPoints: validatorPoints.toNumber(),
      exposureOwn: exposure.own.toBigInt(),
      exposureTotal: exposure.total.toBigInt(),
      commission: prefs.commission.toNumber(),
      nominators: nominatorInfos,
    } as ValidatorInfo);
  }

  logger.debug(`Data gathering for era ${eraIndex} completed!`);

  return {
    network: request.network,
    tokenDecimals: tokenDecimals,
    tokenSymbol: tokenSymbol,
    eraIndex: eraIndex,
    timestamp: timestamp,
    totalValidatorRewards: totalValidatorRewards.toBigInt(),
    totalEraPoints: eraPoints.total,
    validatorInfos,
  } as ChainData
}

interface MyNominator {
  address: string;
  nominations: Nominations;
  ledger: StakingLedger;
}
