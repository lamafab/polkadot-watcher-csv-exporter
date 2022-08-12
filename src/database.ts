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
		const lastEra = (await this.client.query("\
			SELECT\
				era_index\
			FROM\
				era_info\
			ORDER BY\
				era_index\
			DESC LIMIT\
				1\
		")).rows[0];

		if (lastEra == undefined) {
			return 0
		} else {
			return lastEra.era_index
		}
	}

	public insertChainData = async (chainData: ChainData): Promise<void> => {
		try {
			await this.client.query("BEGIN");
			await this._sqlInsertChainData(chainData);
			await this.client.query("COMMIT");
		} catch (error) {
			await this.client.query("ROLLBACK");
			throw Error(`Failed to insert chain data, rolled back transaction: ${error}`);
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
			chainData.eraIndex.toNumber(),
			chainData.eraPoints.total.toNumber(),
		])).rows[0].id;

		for (const validator of chainData.validatorInfo) {
			const ValidatorId = (await this.client.query("\
				INSERT INTO validator_rewards (\
					era_info_id,\
					timestamp,\
					block_nr,\
					account_addr,\
					exposure_total_bal,\
					exposure_own_bal\
				)\
				VALUES ($1, $2, $3, $4, $5, $6)\
				RETURNING id\
			", [
				eraInfoId,
				chainData.date,
				chainData.blockNumber.toNumber(),
				validator.accountId.toHuman(),
				validator.exposure.total.toNumber(),
				validator.exposure.own.toNumber(),
			])).rows[0].id;

			for (const other of validator.exposure.others) {
				await this.client.query("\
					INSERT INTO nominator_rewards (\
						era_info_id,\
						account_addr,\
						exposure_bal\
					)\
					VALUES ($1, $2, $3)\
				", [
					eraInfoId,
					other.who.toHuman(),
					other.value.toNumber(),
				]);
			}

			for (const voter of validator.voters) {
				await this.client.query("\
					INSERT INTO voters (\
						validator_rewards_id,\
						account_addr,\
						staked_bal\
					)\
					VALUES ($1, $2, $3)\
				", [
					ValidatorId,
					voter.address,
					voter.value.toNumber()
				]);
			}
		}
	}
}
