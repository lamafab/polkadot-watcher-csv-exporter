CREATE TABLE era_info (
	id SERIAL PRIMARY KEY,
	era_index INT NOT NULL,
	era_points_total INT NOT NULL
);

CREATE TABLE validator_rewards (
	id SERIAL PRIMARY KEY,
	era_info_id INT NOT NULL,
	unix_time INT NOT NULL,
	block_nr INT NOT NULL,
	account_addr TEXT NOT NULL,
	exposure_total_bal INT NOT NULL,
	exposure_own_bal INT NOT NULL,

	FOREIGN KEY (era_info_id)
		REFERENCES era_info (id),

	UNIQUE (era_info_id, account_addr)
);

CREATE TABLE voters (
	id SERIAL PRIMARY KEY,
	validator_rewards_id INT NOT NULL,
	account_addr TEXT NOT NULL,
	staked_bal INT NOT NULL,

	FOREIGN KEY (validator_rewards_id)
		REFERENCES validator_rewards (id)
);

CREATE TABLE nominator_rewards (
	id SERIAL PRIMARY KEY,
	era_info_id INT NOT NULL,
	account_addr TEXT NOT NULL,
	exposure_bal INT NOT NULL,

	FOREIGN KEY (era_info_id)
		REFERENCES era_info (id),

	UNIQUE (era_info_id, account_addr)
);
