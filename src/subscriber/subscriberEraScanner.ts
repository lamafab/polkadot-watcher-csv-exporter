import { EraIndex } from '@polkadot/types/interfaces';
import { Logger } from '@w3f/logger';
import { dataFileName } from '../constants'
import readline from 'readline';
import {
  InputConfig,
} from '../types';
import { isNewEraEvent } from '../utils';
import { gatherChainDataHistorical } from '../dataGathererHistoric';
import { ISubscriber } from './ISubscriber';
import { SubscriberTemplate } from './subscriberTemplate';
import { PostgreSql } from '../database';
import { ApiPromise } from '@polkadot/api';

export class SubscriberEraScanner extends SubscriberTemplate implements ISubscriber {
  private config: InputConfig;

  private eraIndex: EraIndex;
  private dataFileName = dataFileName
  private isScanOngoing = false //lock for concurrency
  private isNewScanRequired = false
  private database: PostgreSql;

  constructor(cfg: InputConfig, protected readonly logger: Logger) {
    super(cfg, logger)
    this.config = cfg;
    this.database = new PostgreSql(cfg.database_url);
  }

  public start = async (): Promise<void> => {

    this.logger.info('Era Scanner mode active')

    await this._initAPI();
    await this._initInstanceVariables();

    await this._handleEventsSubscriptions() // scan immediately after a event detection
    this.logger.info(`Event Scanner Based Module subscribed...`)

    this._requestNewScan() //first scan after a restart
  }

  private _initInstanceVariables = async (): Promise<void> => {
    this.eraIndex = (await this.api.query.staking.activeEra()).unwrap().index;
    this.logger.info(`Current Era: ${this.eraIndex}`)
  }

  private _handleEventsSubscriptions = async (): Promise<void> => {
    this.api.query.system.events((events) => {
      events.forEach(async (record) => {
        const { event } = record;
        if (isNewEraEvent(event, this.api)) {
          const era = (await this.api.query.staking.activeEra()).unwrap().index
          if (era != this.eraIndex) this._handleEraChange(era)
        }
      })
    })
  }

  private _requestNewScan = async (): Promise<void> => {
    if (this.isScanOngoing) {
      /*
      A new scan can be trigger asynchronously for various reasons (see the subscribe function above). 
      To ensure an exactly once detection and delivery, only one scan is allowed at time.  
      */
      this.isNewScanRequired = true
      this.logger.info(`new scan queued...`)
    }
    else {
      try {
        do {
          this.isScanOngoing = true
          this.isNewScanRequired = false
          await this._triggerEraScannerActions()
          /*
          An additional scan will be processed immediately if queued by any of the triggers.
          */
        } while (this.isNewScanRequired);
      } catch (error) {
        this.logger.error(`the SCAN had an issue ! last checked era: ${await this._getLastCheckedEra()}: ${error}`)
        this.logger.warn('quitting...')
        process.exit(-1);
      } finally {
        this.isScanOngoing = false
      }
    }
  }

  private _triggerEraScannerActions = async (): Promise<void> => {
    while (await this._getLastCheckedEra() < this.eraIndex.toNumber() - 1) {
      const tobeCheckedEra = await this._getLastCheckedEra() + 1
      this.logger.info(`starting the CSV writing for the era ${tobeCheckedEra}`)
      await this._writeEraCSVHistoricalSpecific(tobeCheckedEra)
      await this._updateLastCheckedEra(tobeCheckedEra)
    }
  }

  private _writeEraCSVHistoricalSpecific = async (era: number): Promise<void> => {
    const network = this.chain.toString().toLowerCase()
    const eraIndex = this.api.createType("EraIndex", era)

    const request = { api: this.api, network, eraIndex }
    const chainData = await gatherChainDataHistorical(request, this.logger)

    await this.database.insert_chain_data(chainData);
  }

  private _handleEraChange = async (newEra: EraIndex): Promise<void> => {
    this.eraIndex = newEra
    this._requestNewScan()
  }

  private _getLastCheckedEra = async (): Promise<number> => {
    // TODO: This should be read from SQL
    let lastCheckedEra: number

    return lastCheckedEra
  }

  private _updateLastCheckedEra = async (eraIndex: number): Promise<boolean> => {
    // TODO: This should update to SQL
    return true
  }

}
