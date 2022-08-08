import { ApiPromise, WsProvider } from '@polkadot/api';
import { Logger } from '@w3f/logger';
import { Text } from '@polkadot/types/primitive';
import {
  InputConfig,
} from '../types';
import { apiTimeoutMs } from '../constants';

export abstract class SubscriberTemplate {
  protected chain: Text;
  protected api: ApiPromise;
  protected apiTimeoutMs: number;
  protected endpoint: string;

  constructor(
    cfg: InputConfig,
    protected readonly logger: Logger) {
    this.endpoint = cfg.endpoint;
    this.apiTimeoutMs = cfg.apiTimeoutMs ? cfg.apiTimeoutMs : apiTimeoutMs
  }

  protected _initAPI = async (): Promise<void> => {
    const endpoints = [this.endpoint] //one could define more than one endpoint
    const provider = new WsProvider(endpoints, undefined, undefined, this.apiTimeoutMs);
    this.api = await ApiPromise.create({ provider, throwOnConnect: true, throwOnUnknown: true })
    this.api.on('error', (error) => { this.logger.warn("The API has an error"); console.log(error) })

    this.chain = await this.api.rpc.system.chain();
    const [nodeName, nodeVersion] = await Promise.all([
      this.api.rpc.system.name(),
      this.api.rpc.system.version()
    ]);
    this.logger.info(
      `You are connected to chain ${this.chain} using ${nodeName} v${nodeVersion}`
    );
  }
}
