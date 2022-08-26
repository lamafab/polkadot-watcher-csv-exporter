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

	public fetchLastCheckedEra = async (network: string): Promise<number> => {
		// It's debatable whether this should be optimized, such as using a
		// single table for the last checked era and updating it on
		// `insertChainData`. But this is probably sufficient.
		const lastEra = (await this.client.query("\
			SELECT\
				era_index\
			FROM\
				era_info\
			WHERE\
				network = $1\
			ORDER BY\
				era_index\
			DESC LIMIT\
				1\
		", [
			network
		])).rows[0];

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
				network,\
				timestamp,\
				symbol,\
				decimals,\
				era_index,\
				rewards_total_bal,\
				era_points_total\
			)\
			VALUES ($1, $2, $3, $4, $5, $6, $7)\
			RETURNING id\
		", [
			chainData.network,
			chainData.timestamp,
			chainData.tokenSymbol,
			chainData.tokenDecimals,
			chainData.eraIndex.toNumber(),
			chainData.totalValidatorRewards,
			chainData.totalEraPoints.toNumber(),
		])).rows[0].id;

		for (const validator of chainData.validatorInfos) {
			//console.log("eraInfoId:", eraInfoId, "accountId:", validator.accountId.toHuman());
			const ValidatorId = (await this.client.query("\
				INSERT INTO validator_rewards (\
					era_info_id,\
					account_addr,\
					other_reward_destination,\
					era_points,\
					commission,\
					exposure_total_bal,\
					exposure_own_bal\
				)\
				VALUES ($1, $2, $3, $4, $5, $6, $7)\
				RETURNING id\
			", [
				eraInfoId,
				validator.accountId.toHuman(),
				validator.rewardDestination,
				validator.eraPoints,
				validator.commission,
				validator.exposureTotal,
				validator.exposureOwn,
			])).rows[0].id;

			for (const nominator of validator.nominators) {
				//console.log(">> nominator: eraInfoId:", eraInfoId, "accountId", other.who.toHuman(), "value", other.value.toBigInt());
				await this.client.query("\
					INSERT INTO nominator_rewards (\
						validator_rewards_id,\
						account_addr,\
						exposure_bal\
					)\
					VALUES ($1, $2, $3)\
				", [
					ValidatorId,
					nominator.accountId.toHuman(),
					nominator.exposure,
				]);
			}
		}
	}
}
