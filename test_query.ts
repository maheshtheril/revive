import { getProductsPremium } from './src/app/actions/inventory'
import * as dotenv from 'dotenv'
dotenv.config()

async function test() {
    const res = await getProductsPremium('DEX25', 1)
    console.log('Result for DEX25:', JSON.stringify(res, null, 2))
}

test()
