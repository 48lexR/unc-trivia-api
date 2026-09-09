import express from 'express';
import { Client, Pool } from 'pg';

const conf = {
	user: process.env.POSTGRES_USER,
	password: process.env.POSTGRES_PASSWORD,
	host: process.env.POSTGRES_HOST,
	port: parseInt(process.env.POSTGRES_PORT),
	database: process.env.POSTGRES_DB
};

const app = express();
const pool = new Pool(conf);
const client = await pool.connect();



app.listen(parseInt(process.env.API_PORT), async () => {
	await pool.query(`CREATE TABLE IF NOT EXISTS questions(
		index INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
		content TEXT NOT NULL,
		answer TEXT NOT NULL,
		topic TEXT NOT NULL,
		difficulty INT NOT NULL
	)`);
	console.log(`UNC trivia api running on port ${PORT}`);
});
await client.release();
