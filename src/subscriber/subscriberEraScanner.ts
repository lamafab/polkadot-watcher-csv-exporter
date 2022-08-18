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

export class SubscriberEraScanner extends SubscriberTemplate implements ISubscriber {
  private config: InputConfig;

  private eraIndex: EraIndex;
  private isScanOngoing = false //lock for concurrency
  private isNewScanRequired = false
  private database: PostgreSql;

  constructor(cfg: InputConfig, protected readonly logger: Logger) {
    super(cfg, logger)
    this.config = cfg;

    logger.info(`Connecting to database at ${cfg.databaseUrl}...`)
    this.database = new PostgreSql(cfg.databaseUrl);
  }

  public start = async (): Promise<void> => {
    this.logger.info('Era Scanner mode active')

    await this.database.start();
    await this._initAPI();
    await this._initInstanceVariables();
    await this._handleEventsSubscriptions() // scan immediately after a event detection

    this.logger.info(`Event Scanner Based Module subscribed...`)
    // First scan after a restart
    await this._requestNewScan();
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
          if (era != this.eraIndex) {
            this.eraIndex = era;
            this._requestNewScan()
          }
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
        this.logger.error(`the SCAN had an issue ! last checked era: ${await this.database.fetchLastCheckedEra()}: ${error}`)
        this.logger.warn('quitting...')
        process.exit(-1);
      } finally {
        this.isScanOngoing = false
      }
    }
  }

  private _triggerEraScannerActions = async (): Promise<void> => {
    this.logger.info("Fetching latest checked Era from database...");
    let tobeCheckedEra = await this.database.fetchLastCheckedEra();
    const currentEra = this.eraIndex.toNumber();

    if (currentEra > tobeCheckedEra + 84) {
      this.logger.warn(`Skipping eras from ${tobeCheckedEra} to ${currentEra - 85}, max depth exceeded!`);
      tobeCheckedEra = currentEra - 84;
    } else {
      this.logger.info(`Starting scan from Era ${tobeCheckedEra} to ${currentEra - 1}`);
    }

    this.logger.info(`Starting scan from ${tobeCheckedEra} to ${currentEra - 1}`);
    while (tobeCheckedEra < currentEra - 1) {
      tobeCheckedEra += 1;
      this.logger.info(`starting the CSV writing for the era ${tobeCheckedEra}`)

      // Prepare for gathering.
      const network = this.chain.toString().toLowerCase()
      const eraIndex = this.api.createType("EraIndex", tobeCheckedEra)
      const request = { api: this.api, network, endpoint: this.endpoint, eraIndex }
      const chainData = await gatherChainDataHistorical(request, this.logger)

      // Insert the chainData into the database and track latest, checked Era.
      this.logger.info("Inserting all gathered data into the database...");
      await this.database.insertChainData(chainData);
      this.logger.info("Insertion into database completed");
    }
  }
}
