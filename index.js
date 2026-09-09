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
app.use(express.json());
const pool = new Pool(conf);
// const client = await pool.connect();


app.get('/api/questions', async (req, res) => {
	const { index, topic, difficulty } = req.query;
	let params = []
	const client = await pool.connect();
	try{	
		let queryText = 'GET * FROM questions WHERE 1=1';
		if (index) {
			params.push(parseInt(index));
			queryText += ` AND index=$${params.length}`;
		}

		if(topic) {
			params.push(topic);
			queryText += ` AND topic=$${params.length}`;
		}

		if(difficulty) {
			params.push(difficulty);
			queryText += ` AND difficulty=$${params.length}`;
		}

		const rows = await client.query(queryText, params);
		if(res.rows.length === 0){
			res.status(404).json({ error: "No such question matches those parameters" });
		} else {
			res.json(result.rows);
		}
	} catch (e) {
		await client.query('ROLLBACK');
		res.status(500);
	} finally {
		client.release();
	}
});


app.listen(parseInt(process.env.API_PORT), async () => {
	let res = await pool.query(`CREATE TABLE IF NOT EXISTS questions(
		index INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
		content TEXT NOT NULL,
		answer TEXT NOT NULL,
		topic TEXT NOT NULL,
		difficulty INT NOT NULL
	)`);
	console.log(`Successfully created table questions with result: ${res}`);
	console.log(`UNC trivia api running on port ${process.env.API_PORT}`);
});
// await client.release();
