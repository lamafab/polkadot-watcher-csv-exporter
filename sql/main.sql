CREATE TABLE [IF NOT EXISTS] validator_rewards (
	id SERIAL PRIMARY KEY,
	era_info_id INT NOT NULL,
	session_idx INT NOT NULL,
	unix_time INT NOT NULL,
	block_nr INT NOT NULL,
	account_addr TEXT NOT NULL,
	exposure_total INT NOT NULL,
	exposure_own INT NOT NULL,

	FOREIGN KEY (era_info_id)
		REFERENCES era_info (id)

	UNIQUE (era_info_id, account_addr)
);

CREATE TABLE [IF NOT EXISTS] era_info (
	id SERIAL PRIMARY KEY,
	era_idx INT NOT NULL,
	era_points_total INT NOT NULL,
);

CREATE TABLE [IF NOT EXISTS] individual_era_points (
	id SERIAL PRIMARY KEY,
	era_info_id INT NOT NULL,
	account_addr TEXT NOT NULL,
	era_points INT NOT NULL,
	exposure INT NOT NULL,

	FOREIGN KEY (era_info_id)
		REFERENCES era_info (id)

	UNIQUE (era_info_id, account_addr)
);
