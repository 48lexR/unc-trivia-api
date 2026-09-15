import express from 'express';
import { Client, Pool } from 'pg';
import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import cookieParser from 'cookie-parser';

const conf = {
	user: process.env.POSTGRES_USER,
	password: process.env.POSTGRES_PASSWORD,
	host: process.env.POSTGRES_HOST,
	port: parseInt(process.env.POSTGRES_PORT),
	database: process.env.POSTGRES_DB
};

const app = express();
app.use(express.json());
app.use(cookieParser());

const pool = new Pool(conf);

const requireAuth = (req, res, next) => {
	const token = req.cookies?.token;
	if(!token) {
		return res.status(401).json({ error: "unauthorized" });
	}
	try {
		const payload = jwt.verify(token, process.env.JWT_SECRET);
		req.user = { id: payload.sub, username: payload.username };
		next();
	} catch (e) {
		return res.status(401).json({ error: "Invalid or expired session" });
	}
};

app.get('/api/whoami', requireAuth, async (req, res) => {
	res.json({ user: req.user.username });
});

/**
 * LOGIN ENDPOINTS
 */ 

app.post('/api/login', async (req, res) => {
	let client = await pool.connect();
	const {username, password} = req.body;
	try {
		if(!username || !password) {
			res.status(400).json({ error: "Either username or password not provided." });
		}

		const q = await client.query('SELECT * FROM users WHERE username=$1', [username]);
		const user = q.rows[0];

		if(!user || !(await argon2.verify(user.password_hash, password))){
			return res.status(401).json({ error: "Invalid username or password." });
		}

		const token = jwt.sign(
			{sub: user.id, username: user.username},
			process.env.JWT_SECRET,
			{ expiresIn: '7d' }
		);

		res.cookie('token', token, {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production', // requires HTTPS in prod
			sameSite: 'lax',
			maxAge: 7 * 24 * 60 * 60 * 1000
		});

		return res.json({ id: user.id, username: user.username });
	} catch (e) {
		return res.status(500).json({ error: "Internal server error" });
	} finally {
		client.release();
	}
});

app.post('/api/logout', async (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    });
    return res.status(200).json({ ok: 'true' });
});

/**
 * USERS ENDPOINTS
 */ 

app.get('/api/users/', async (req, res) => {
	const client = await pool.connect();
	const { username } = req.query;
	try {
		const queryText = `SELECT id FROM users WHERE username=$1`;
		const q = await client.query(queryText, [username]);
		if(q.rows.length === 0){
			return res.status(404).json({ error: "not found" });
		}
		return res.json(q.rows[0]);
	} catch (e) {
		return res.status(500).json({ error: "Internal server error" });
	} finally {
		client.release();
	}
});


// Create a new user


app.post('/api/users', async (req, res) => {
	let client = await pool.connect();
	const {username, password} = req.body;
	if(!username || !password) {
		return res.status(400).json({ error: "couldn't get the username and/or password" });
	}

	try {
		const queryText = `INSERT INTO users (username, password_hash) 
		VALUES ($1, $2) 
		RETURNING *`;
		const password_hash = await argon2.hash(password);
		const q = await client.query(queryText, [username, password_hash]);
		if(q.rows.length === 0){
			return res.status(404).json({ error: "Could not create user" });
		}
		return res.status(201).json(q.rows[0]);
	} catch (e) {
		if(e.code === "23505"){
			return res.status(409).json({ error: "Username already taken" });
		}
		return res.status(500).json({ error: "Internal server error" });
	} finally {
		client.release();
	}
});

app.put('/api/users', requireAuth, async (req, res) => {
	let client = await pool.connect();
	const { username } = req.body;
	if(!username){
		return res.status(400).json({ error: "Username required" });
	}
	try {
		const queryText = `UPDATE users
		SET username=$1
		WHERE id=$2
		RETURNING *`;
		const q = await client.query(queryText, [ username, req.user.id ]);
		if(q.rows.length === 0){
			return res.status(404).json({ error: "Not found" });
		}
		return res.json(q.rows[0]);
	} catch (e) {
		if(e.code === "23505"){
			return res.status(409).json({ error: "No duplicate usernames" });
		}
		return res.status(500).json({ error: "Internal server error" });
	} finally {
		client.release();
	}
});

app.delete('/api/users', requireAuth, async (req, res) => {
	let client = await pool.connect();
	
	try {
		const queryText = `DELETE FROM users
		WHERE id=$1`;

		const q = await client.query(queryText, [ req.user.id ]);
		return res.status(200).json({ deleted: req.user.id });
	} catch (e) {
		return res.status(500).json({ error: "Internal server error" });
	} finally {
		client.release();
	}
});



/**
 * QUESTIONS ENDPOINT
 */ 
// GET endpoint
// Accepts query parameters index, topic, and difficulty
app.get('/api/questions', async (req, res) => {
	const { index, topic, difficulty, user_id } = req.query;
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

		if(user_id) {
			params.push(user_id);
			queryText += ` AND user_id=$${params.length}`;
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

app.post('/api/questions', requireAuth, async (req, res) => {
	// TODO: Need a more secure way to verify user id
	const client = await pool.connect();
	const { content, answer, topic, difficulty } = req.body;
	console.log(`Accepted conection: ${req.method} from ${req.originalUrl}`);
	try {
		if(!content || !answer || !topic || difficulty === undefined){
			return res.status(400).json({ error: "I don't understand that." });
		}
		let queryText = `
		INSERT INTO questions (content, answer, topic, difficulty, user_id)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING *`;

		const queryRes = await client.query(queryText, [content, answer, topic, parseInt(difficulty), req.user.id]);
		return res.status(201).json(queryRes.rows[0]);
	} catch (e) {
		if(e.code === "23505"){
			return res.status(409).json({ error: "Duplicate question?" });
		}
		return res.status(500).json({ error: `${e.name}: ${e.message}`});
	} finally {
		client.release();
	}
});

app.put('/api/questions', requireAuth, async (req, res) => {
	// TODO: Need a more secure way to verify user ID
	const { index, content, answer, topic, difficulty } = req.body;
	const client = await pool.connect();
	try {
		if(!index || !content || !answer || !topic || difficulty === undefined){
			return res.status(400).json({ error: "I don't understand that." });
		}

		let queryText = `
			UPDATE questions
			SET content=$2, answer=$3, topic=$4, difficulty=$5
			WHERE index=$1 AND user_id=$6
			RETURNING *
		`;
		const queryRes = await client.query(queryText, [index, content, answer, topic, difficulty, req.user.id]);
		if(queryRes.rows.length === 0){
			return res.status(404).json({ error: "I couldn't find that." });
		}
		return res.json(queryRes.rows[0]); 
	} catch (e) {
		return res.status(500).json({ error: "Sorry man, couldn't do it." });
	} finally {
		client.release();
	}
});

app.delete('/api/questions', requireAuth, async (req, res) => {
	// TODO: Need a more secure way to verify deletion
	const { index } = req.query;
	const client = await pool.connect();
	try {
		if(!index) {
			return res.status(400).json({ error: "I need the index to delete it, pal" });
		}
		let queryText = `
			DELETE FROM questions
			WHERE index=$1 AND user_id=$2
		`;
		const queryRes = await client.query(queryText, [index, req.user.id]);
		return res.status(200).json({ deleted: index });
	} catch (e) {
		if(e.code === "23505"){
			return res.status(409).json({ error: "Duplicate question?" });
		}
		return res.status(500).json({ error: "Internal server error" });
	} finally {
		client.release();
	}
});


/**
 * RANDOM QUESTION ENDPOINT
 */  

app.get('/api/questions/random', async (req, res) => {
	const client = await pool.connect();
	const { topic, user_id, difficulty } = req.query;
	let params = [];
	try {
		let queryString = `SELECT * FROM questions WHERE 1=1 `;

		if(topic){
			params.push(topic);
			queryString += `AND topic=$${params.length} `;
		}
	
		if(difficulty){
			params.push(difficulty);
			queryString += `AND difficulty=$${params.length} `;
		}

		if(user_id){
			params.push(user_id);
			queryString += `AND user_id=$${params.length} `;
		}

		queryString += `ORDER BY RANDOM() LIMIT 1`;

		const data = await client.query(queryString, params);

		if(data.rows.length === 0){
			return res.status(404).json({ error: "not found." });
		}
		return res.json(data.rows[0]);
	} catch (e) {
		return res.status(500).json({ error: "Internal server error" });
	} finally {
		client.release();
	}
});

/**
 * App starting point
 */ 
app.listen(parseInt(process.env.API_PORT), async () => {
	let res = await pool.query(`CREATE TABLE IF NOT EXISTS questions(
		index INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
		content TEXT UNIQUE NOT NULL,
		answer TEXT NOT NULL,
		topic TEXT NOT NULL,
		user_id UUID NOT NULL,
		difficulty INT NOT NULL
	)`);
	console.log(`Successfully created table questions with result: ${res}`);
	let userRes = await pool.query(`CREATE TABLE IF NOT EXISTS users(
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		username VARCHAR(255) UNIQUE NOT NULL,
		password_hash VARCHAR(255) NOT NULL 
		)`
	);
	console.log(`UNC trivia api running on port ${process.env.API_PORT}`);
});
// await client.release();
