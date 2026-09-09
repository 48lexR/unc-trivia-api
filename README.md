# UNC Trivia Api

This project is designed to be an api for my UNC trivia database.

Database
---

The database contains a table 'questions' that contains the questions as a tuple:

questions(
    index INTEGER,
    content TEXT,
    answer TEXT,
    topic TEXT,
    difficulty INTEGER
)

### Index
The index is just a number to quickly identify the question. It is arbitrary.

### Content
This is the actual content of the question.

### Answer
This is the answer to the question (stripped for whitespace and **lowercase**).

### Topic
Roughly corresponds to the kind of question (again, stripped for whitespace and **lowercase**). Some common types include:
* Sports
* Alumni
* Campus
* History

### Difficulty
Represents the difficulty of the question from 1-5. 1-3 are all 'easy' whereas 4 is 'medium' and 5 is 'hard.'

Endpoints
---

## /api
* GET/POST/PUT/DELETE: Not allowed
**DO NOT USE THIS ENDPOINT.**

## /api/questions

* GET: This will GET the entire database as JSON.
* POST: Add a new question. Accepts: `type: text/json`
* PUT: Updates a question (index must be specified as a query parameter.)
* DELETE: Deletes a question (index must be specified as a query parameter.)

**Allowed query parameters**
* index: query the 'index' of questions
* topic: query the 'topic' of questions
* difficulty: query the 'difficulty' of questions

Examples
---

**GET /api/questions?difficulty=5 HTTP/1.1**
* This will get all the hard questions as a list of JSON objects
* Return: HTTP/1.1 200 OK ...

**GET /api/questions?topic=sports&difficulty=1 HTTP/1.1**
* This will get all the super easy sports questions
* Return: HTTP/1.1 200 OK ...

**POST /api/questions HTTP/1.1 ...**
* This will create a new question.
* Return: HTTP/1.1 201

**DELETE /api/questions HTTP/1.1**
* This will fail (no ID specified)
* HTTP/1.1 410 No ID specified

