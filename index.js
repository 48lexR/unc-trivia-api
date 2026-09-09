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

// GET endpoint
// Accepts query parameters index, topic, and difficulty
app.get('/api/questions', async (req, res) => {
	const { index, topic, difficulty } = req.query;
	console.log(`Accepted conection: ${req.method} from ${req.originalUrl}`);
	let params = []
	const client = await pool.connect();
	try{	
		let queryText = 'SELECT * FROM questions WHERE 1=1';
		if (index) {
			params.push(parseInt(index));
			queryText += ` AND index=$${params.length}`;
		}

		if(topic) {
			params.push(topic);
			queryText += ` AND topic=$${params.length}`;
		}

		if(difficulty) {
			params.push(parseInt(difficulty));
			queryText += ` AND difficulty=$${params.length}`;
		}

		const data = await client.query(queryText, params);
		if(data.rows.length === 0){
			res.status(404).json({ error: "No such question matches those parameters" });
		} else {
			res.json(data.rows);
		}
	} catch (e) {	
		res.status(500).json({ error: "Internal server error" });
	} finally {
		client.release();
	}
});

// POST endpoint
// creates a new question

app.post('/api/questions', async (req, res) => {
	const client = await pool.connect();
	const { content, answer, topic, difficulty } = req.body;
	console.log(`Accepted conection: ${req.method} from ${req.originalUrl}`);
	try {
		if(!content || !answer || !topic || difficulty === undefined){
			res.status(400).json({ error: "Missing fields in POST body." });
		}
		let queryText = `
		INSERT INTO questions (content, answer, topic, difficulty)
		VALUES ($1, $2, $3, $4)
		RETURNING *`;

		const queryRes = await client.query(queryText, [content, answer, topic, parseInt(difficulty)]);
		res.status(201).json(queryRes.rows[0]);
	} catch (e) {
		res.status(500).json({ error: `${e.name}: ${e.message}`});
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
