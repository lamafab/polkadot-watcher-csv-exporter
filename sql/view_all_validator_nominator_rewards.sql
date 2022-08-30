CREATE VIEW all_validator_nominator_rewards AS
SELECT
	era_info.network,
	era_info.timestamp,
	era_info.symbol,
	era_info.era_index,
	cast(era_info.rewards_total_bal AS DECIMAL) / cast(POWER(10, era_info.decimals) AS DECIMAL) AS "total_validator_rewards",
	era_info.era_points_total AS "total_validator_era_points",
	validator_rewards.account_addr AS "validator_address",
	validator_rewards.other_reward_destination AS "validator_custom_reward_destination",
	validator_rewards.era_points AS "validator_era_points",
	/* Divide by 10^(decimals) to get the correct unitl (e.g. DOT instead of plancks) */
	cast(validator_rewards.exposure_total_bal AS DECIMAL) / cast(POWER(10, era_info.decimals) AS DECIMAL) AS "validator_total_exposure",
	cast(validator_rewards.exposure_own_bal AS DECIMAL) / cast(POWER(10, era_info.decimals) AS DECIMAL) AS "validator_own_exposure",
	validator_rewards.commission / POWER(10,7) as "validator_commission",
	/* Calculate the reward of the validator */
	(cast(validator_rewards.era_points AS DECIMAL) / cast(NULLIF(era_info.era_points_total, 0) AS DECIMAL))
		* era_info.rewards_total_bal
		* (cast(validator_rewards.exposure_own_bal AS DECIMAL) / cast(NULLIF(validator_rewards.exposure_total_bal, 0) AS DECIMAL))
		/* Convert to the correct unit */
		/ POWER(10.0, era_info.decimals) AS "validator_reward",
	nominator_rewards.account_addr AS "nominator_address",
	cast(nominator_rewards.exposure_bal AS DECIMAL) / cast(POWER(10, era_info.decimals) AS DECIMAL) AS "nominator_exposure",
	/* Calculate the reward of the nominator */
	(cast(validator_rewards.era_points AS DECIMAL) / cast(NULLIF(era_info.era_points_total, 0) AS DECIMAL))
		* era_info.rewards_total_bal
		* (cast(nominator_rewards.exposure_bal AS DECIMAL) / cast(NULLIF(validator_rewards.exposure_total_bal, 0) AS DECIMAL))
		* ((100.0 - cast(validator_rewards.commission AS DECIMAL) / POWER(10.0,7)) / 100.0)
		/* Convert to the correct unit */
		/ POWER(10.0, era_info.decimals) AS "nominator_reward",
	/* Calculate "extra" validator reward via commission */
	(cast(validator_rewards.era_points AS DECIMAL) / cast(NULLIF(era_info.era_points_total, 0) AS DECIMAL))
		* era_info.rewards_total_bal
		* (cast(nominator_rewards.exposure_bal AS DECIMAL) / cast(NULLIF(validator_rewards.exposure_total_bal, 0) AS DECIMAL))
		* (cast(validator_rewards.commission AS DECIMAL) / POWER(10.0,7) / 100.0)
		/* Convert to the correct unit */
		/ POWER(10.0, era_info.decimals) AS "validator_commission_reward"
FROM
	era_info
LEFT JOIN
	validator_rewards
ON
	era_info.id = validator_rewards.era_info_id
LEFT JOIN
	nominator_rewards
ON
	validator_rewards.id = nominator_rewards.validator_rewards_id
;