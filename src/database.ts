import { Client } from 'pg';
import { ChainData } from './types.js';

export class PostgreSql {
	client: Client;

	constructor(dbUrl: string) {
		this.client = new Client({
			connectionString: dbUrl,
		});
	}

	public start = async (): Promise<void> => {
		await this.client.connect();
		// Connection check.
		await this.client.query("SELECT NOW()");
	}

	public fetchLastCheckedEra = async (): Promise<number> => {
		// It's debatable whether this should be optimized, such as using a
		// single table for the last checked era and updating it on
		// `insertChainData`. But this is probably sufficient.
		return (await this.client.query("\
			SELECT\
				era_index\
			FROM\
				era_info\
			ORDER BY\
				era_index\
			DESC LIMIT\
				1\
		")).rows[0].id;
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
				era_points_total,\
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
					INSERT INTO nominator_rewards (\
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
	}
}
