import { Client } from 'pg';

export class PostgreSql {
	client: Client;

	constructor(dbUrl: string) {
		this.client = new Client(dbUrl);
	}

	public start = async (): Promise<void> => {
		await this.client.connect();
	}
}
