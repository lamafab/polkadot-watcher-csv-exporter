CREATE TABLE era_info (
	id SERIAL PRIMARY KEY,
	network TEXT NOT NULL,
	symbol TEXT NOT NULL,
	decimals INT NOT NULL,
	validator_payout BIGINT NOT NULL,
	era_index INT NOT NULL,
	era_points_total BIGINT NOT NULL,

	UNIQUE (network, era_index)
);

CREATE TABLE validator_rewards (
	id SERIAL PRIMARY KEY,
	era_info_id INT NOT NULL,
	timestamp TIMESTAMP NOT NULL,
	block_nr INT NOT NULL,
	account_addr TEXT NOT NULL,
	exposure_total_bal BIGINT NOT NULL,
	exposure_own_bal BIGINT NOT NULL,

	FOREIGN KEY (era_info_id)
		REFERENCES era_info (id),

	UNIQUE (era_info_id, account_addr)
);

CREATE TABLE voters (
	id SERIAL PRIMARY KEY,
	validator_rewards_id INT NOT NULL,
	account_addr TEXT NOT NULL,
	staked_bal BIGINT NOT NULL,

	FOREIGN KEY (validator_rewards_id)
		REFERENCES validator_rewards (id)
);

CREATE TABLE nominator_rewards (
	id SERIAL PRIMARY KEY,
	validator_rewards_id INT NOT NULL,
	account_addr TEXT NOT NULL,
	exposure_bal BIGINT NOT NULL,

	FOREIGN KEY (validator_rewards_id)
		REFERENCES validator_rewards (id),

	UNIQUE (validator_rewards_id, account_addr)
);
