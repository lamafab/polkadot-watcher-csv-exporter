CREATE TABLE era_info (
	id SERIAL PRIMARY KEY,
	network TEXT NOT NULL,
	timestamp TIMESTAMP NOT NULL,
	symbol TEXT NOT NULL,
	decimals INT NOT NULL,
	era_index INT NOT NULL,
	rewards_total_bal BIGINT NOT NULL,
	era_points_total INT NOT NULL,

	UNIQUE (network, era_index)
);

CREATE TABLE validator_rewards (
	id SERIAL PRIMARY KEY,
	era_info_id INT NOT NULL,
	account_addr TEXT NOT NULL,
	other_reward_destination TEXT,
	era_points INT NOT NULL,
	commission INT NOT NULL,
	exposure_total_bal BIGINT NOT NULL,
	exposure_own_bal BIGINT NOT NULL,

	FOREIGN KEY (era_info_id)
		REFERENCES era_info (id),

	UNIQUE (era_info_id, account_addr)
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
