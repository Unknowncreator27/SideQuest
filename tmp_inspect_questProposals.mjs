import 'dotenv/config';
import mysql from 'mysql2/promise';

async function run() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [rows] = await conn.query('SHOW COLUMNS FROM questProposals');
  console.log(rows);
  await conn.end();
}

run().catch((err) => { console.error(err); process.exit(1); });
