import { Client } from 'pg';
import { ChainData } from './types.js';

export class PostgreSql {
	client: Client;

	constructor(dbUrl: string) {
		this.client = new Client(dbUrl);
	}

	public start = async (): Promise<void> => {
		await this.client.connect();
	}

	public fetchLastCheckedEra = async (): Promise<number> => {
		//...
		return 0
	}

	public updateLastCheckedEra = async (): Promise<boolean> => {
		// ...
		return false
	}

	public insertChainData = async (chainData: ChainData): Promise<void> => {
		try {
			await this.client.query("BEGIN");
			await this._sqlInsertChainData(chainData);
			await this.client.query("COMMIT");
		} catch (e) {
			await this.client.query("ROLLBACK");
		}
	}

	private _sqlInsertChainData = async (chainData: ChainData): Promise<void> => {
		const eraInfoId = (await this.client.query("\
			INSERT INTO era_info (\
				era_index,\
				era_points_total\
			)\
			VALUES ($1, $2)\
			RETURNING id\
		", [
			chainData.eraIndex,
			chainData.eraPoints.total,
		])).rows[0].id;

		for (const validator of chainData.validatorInfo) {
			const ValidatorId = (await this.client.query("\
				INSERT INTO validator_rewards (\
					era_info_id,\
					unix_time,\
					block_nr,\
					account_addr,\
					exposure_total_bal,\
					exposure_own_bal\
				)\
				VALUES ($1, $2, $3, $4, $5, $6, $7)\
			", [
				eraInfoId,
				chainData.unixTime,
				chainData.blockNumber,
				validator.accountId,
				validator.exposure.total,
				validator.exposure.own,
			])).rows[0].id;

			for (const other of validator.exposure.others) {
				await this.client.query("\
					INSERT INTO individual_era_points (\
						era_info_id,\
						account_addr,\
						exposure_bal\
					)\
					VALUES ($1, $2, $3, $4)\
				", [
					eraInfoId,
					other.who,
					other.value,
				]);
			}

			for (const voter of validator.voters) {
				await this.client.query("\
					INSERT INTO votres (\
						validator_rewards_id,\
						account_addr,\
						stake\
					)\
					VALUES ($1, $2, $3)\
				", [
					ValidatorId,
					voter.address,
					voter.value
				]);
			}
		}

		// TODO: Track latest checked era.
	}
}
