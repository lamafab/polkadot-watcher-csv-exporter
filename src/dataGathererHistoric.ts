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

export interface ChainDataHistoricalRequest {
  api: ApiPromise;
  network: string;
  endpoint: string;
  eraIndex: EraIndex;
}

export const gatherChainDataHistorical = async (request: ChainDataHistoricalRequest, logger: Logger): Promise<ChainData> => {
  logger.info(`Historical Data gathering triggered...`)
  const data = await _gatherDataHistorical(request, logger)
  logger.info(`Historical Data have been gathered.`)
  return data
}

const _gatherDataHistorical = async (request: ChainDataHistoricalRequest, logger: Logger): Promise<ChainData> => {
  logger.debug(`gathering some data from the chain...`)
  const { api, eraIndex } = request

  logger.info(`Requested era: ${eraIndex}`);
  logger.debug(`Gathering data ...`);

  const erasPoints = (await api.derive.staking._erasPoints([eraIndex], false)).find(({ era }) => era.eq(eraIndex));
  const erasExposure = (await api.derive.staking._erasExposure([eraIndex], false)).find(({ era }) => era.eq(eraIndex));
  const eraBlockReference = (await erasLastBlockFunction([eraIndex], api)).find(({ era }) => era.eq(eraIndex));
  const hashReference = await api.rpc.chain.getBlockHash(eraBlockReference.block)
  const apiAt = await api.at(hashReference);
  const unixTime = (await apiAt.query.timestamp.now()).toNumber();

  logger.debug(`nominators...`)
  const nominators = await _getNominatorStaking(api, eraBlockReference, logger)
  logger.debug(`got nominators...`)
  logger.debug(`valdiators...`)
  const myValidatorStaking = await _getEraHistoricValidatorStakingInfo(
    api,
    erasPoints,
    erasExposure,
    nominators,
  );
  logger.debug(`got validators...`)

  const chainProperties = api.registry.getChainProperties();

  return {
    chainName: request.network,
    wsSource: request.endpoint,
    tokenDecimals: chainProperties.tokenDecimals[0],
    tokenSymbol: chainProperties.tokenSymbol[0],
    eraIndex: eraIndex,
    date: new Date(unixTime),
    blockNumber: api.createType('Compact<Balance>', eraBlockReference.block),
    eraPoints: await api.query.staking.erasRewardPoints(eraIndex),
    totalIssuance: await apiAt.query.balances.totalIssuance(),
    validatorInfo: myValidatorStaking
  } as ChainData
}

interface MyNominator {
  address: string;
  nominations: Nominations;
  ledger: StakingLedger;
}

const _getNominatorStaking = async (api: ApiPromise, eraLastBlock: EraLastBlock, logger: Logger): Promise<MyNominator[]> => {

  const lastBlockHash = await api.rpc.chain.getBlockHash(eraLastBlock.block)
  const apiAt = await api.at(lastBlockHash)
  logger.debug(`getting the nominator entries...`)
  const nominators = await apiAt.query.staking.nominators.entries() //this call requires a node connection with an high --ws-max-out-buffer-capacity 
  logger.debug(`got ${nominators.length} nominator entries !!`)
  const stakingLedgers = await apiAt.query.staking.ledger.entries() //this call requires a node connection with an high --ws-max-out-buffer-capacity
  logger.debug(`got ${stakingLedgers.length} ledger entries !!`)

  const nominatorsMap = new Map<string, PalletStakingNominations[]>();
  for (const nominator of nominators) {
    const key = nominator[0].toHuman().toString()
    const value = nominator[1].unwrap()
    if (!nominatorsMap.has(key)) {
      nominatorsMap.set(key, [])
    }
    else {
      logger.debug("more attention needed, multiple nominators")
    }
    nominatorsMap.get(key).push(value)
  }

  const ledgersMap = new Map<string, PalletStakingStakingLedger[]>();
  for (const ledger of stakingLedgers) {
    const key = ledger[0].toHuman().toString()
    const value = ledger[1].unwrap()
    if (!ledgersMap.has(key)) {
      ledgersMap.set(key, [])
    }
    else {
      logger.debug("more attention needed, mutiple ledgers")
    }
    ledgersMap.get(key).push(value)
  }

  const nominatorsStakings: MyNominator[] = []
  nominatorsMap.forEach((nominator, address) => {
    if (ledgersMap.has(address)) {
      nominatorsStakings.push({
        "address": address,
        "nominations": nominator[0],
        "ledger": ledgersMap.get(address)[0]
      })
    }
  })

  return nominatorsStakings
}

const _getEraHistoricValidatorStakingInfo = async (api: ApiPromise, eraPoints: DeriveEraPoints, eraExposure: DeriveEraExposure, nominators: MyNominator[]): Promise<MyDeriveStakingAccount[]> => {
  const eraValidatorAddresses = Object.keys(eraExposure['validators']);

  console.time('validatorStakings')
  const validatorStakings = await api.derive.staking.accounts(eraValidatorAddresses)
  const validatorStakingsMap = new Map<string, DeriveStakingAccount>();
  for (const vs of validatorStakings) {
    const key = vs.accountId.toHuman().toString()
    const value = vs
    validatorStakingsMap.set(key, value)
  }
  console.timeEnd('validatorStakings')

  console.time('infoMap')
  const infoMap = new Map<string, DeriveAccountInfo>();
  for (const address of validatorStakingsMap.keys()) {
    // room for improvment
    const info = await api.derive.accounts.info(address);
    infoMap.set(address, info)
  }
  console.timeEnd('infoMap')

  console.time('votersMap')
  const votersMap = new Map<string, Voter[]>();
  // init validators with no nominations
  for (const address of validatorStakingsMap.keys()) {
    votersMap.set(address, [])
  }
  for (const nominator of nominators) {
    // key: validatorAddress
    // value: array of {nominatorAddress,amount}

    for (const validatorAddress of nominator.nominations.targets) {
      const key = validatorAddress.toHuman().toString()
      const value = { address: nominator.address, value: nominator.ledger.total }

      if (!votersMap.has(key)) {
        votersMap.set(key, [])
      }
      votersMap.get(key).push(value)
    }

  }
  console.timeEnd('votersMap')
  //votersMap.forEach((value,key)=>console.log(`valAddress: ${key} | voters: ${JSON.stringify(value)}`))


  console.time('deriveStakingAccounts')
  const deriveStakingAccounts: MyDeriveStakingAccount[] = []
  for (const address of validatorStakingsMap.keys()) {

    const validatorEraPoints = api.createType('RewardPoint', eraPoints.validators[address]);
    const exposure: PalletStakingExposure = api.createType('PalletStakingExposure', eraExposure.validators[address]);

    let displayName = ""
    if (infoMap.has(address)) {
      const { identity } = infoMap.get(address)
      displayName = getDisplayName(identity)
    }
    else {
      console.log("no info map entry for " + address)
    }

    //console.log(`valAddress: ${address} | numVoters: ${votersMap.get(address).length} | voters: ${JSON.stringify(votersMap.get(address))}`)
    deriveStakingAccounts.push({
      ...validatorStakingsMap.get(address),
      displayName: displayName,
      voters: votersMap.get(address),
      exposure: exposure,
      eraPoints: validatorEraPoints.toNumber(),
    })
  }
  console.timeEnd('deriveStakingAccounts')
  return deriveStakingAccounts
}
