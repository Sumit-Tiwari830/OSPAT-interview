import express from 'express';
import dotenv from 'dotenv';
import { ENV } from './lib/env.js';

const app = express();

console.log('PORT:', ENV.PORT);
console.log('DB_URL:', ENV.DB_URL);

app.get('/', (req, res) => {
    res.status(200).json({ message: 'Hello World!123' });
});

app.listen(ENV.PORT, () => {
    console.log('Server is running on port', ENV.PORT);
});