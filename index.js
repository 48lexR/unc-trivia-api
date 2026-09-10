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
			return res.status(404).json({ error: "Not here bud" });
		} else {
			return res.status(200).json(data.rows);
		}
	} catch (e) {	
		return res.status(500).json({ error: "I am ded" });
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
			return res.status(400).json({ error: "I don't understand that." });
		}
		let queryText = `
		INSERT INTO questions (content, answer, topic, difficulty)
		VALUES ($1, $2, $3, $4)
		RETURNING *`;

		const queryRes = await client.query(queryText, [content, answer, topic, parseInt(difficulty)]);
		return res.status(201).json(queryRes.rows[0]);
	} catch (e) {
		return res.status(500).json({ error: `${e.name}: ${e.message}`});
	} finally {
		client.release();
	}
});

app.put('/api/questions', async (req, res) => {
	const { index, content, answer, topic, difficulty } = req.body;
	const client = await pool.connect();
	try {
		if(!index || !content || !answer || !topic || difficulty === undefined){
			return res.status(400).json({ error: "I don't understand that." });
		}

		let queryText = `
			UPDATE questions
			SET content=$2, answer=$3, topic=$4, difficulty=$5
			WHERE index=$1
			RETURNING *
		`;
		const queryRes = await client.query(queryText, [index, content, answer, topic, difficulty]);
		if(queryRes.rows.length === 0){
			return res.status(404).json({ error: "I couldn't find that." });
		}
		return res.status(200).json(queryRes.rows[0]); 
	} catch (e) {
		return res.status(500).json({ error: "Sorry man, couldn't do it." });
	} finally {
		client.release();
	}
});

app.delete('/api/questions', async (req, res) => {
	const { index } = req.query;
	const client = await pool.connect();
	try {
		if(!index) {
			return res.status(400).json({ error: "I need the index to delete it, pal" });
		}
		let queryText = `
			DELETE FROM questions
			WHERE index=$1
		`;
		const queryRes = await client.query(queryText, [index]);
		return res.status(200).json({ deleted: index });
	} catch (e) {
		return res.status(500).json({ error: "Internal server error" });
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
