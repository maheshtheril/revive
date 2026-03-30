import { Client } from 'pg'
import * as dotenv from 'dotenv'
dotenv.config()

async function check() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  })
  try {
    await client.connect()
    const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'app_user'
    `)
    console.log("Columns in app_user:")
    console.log(res.rows.map(r => r.column_name).join(', '))
  } catch (e: any) {
    console.log("Error: " + e.message)
  } finally {
    await client.end()
  }
}

check()
