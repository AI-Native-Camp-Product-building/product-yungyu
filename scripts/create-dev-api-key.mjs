#!/usr/bin/env node
/**
 * 개발용 API 키 생성 스크립트
 * 사용: node scripts/create-dev-api-key.mjs
 */
import { createHash, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { neon } from '@neondatabase/serverless'

// .env.local 파싱
const envPath = resolve(process.cwd(), '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const env = Object.fromEntries(
  envContent.split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => {
      const idx = l.indexOf('=')
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^"|"$/g, '')]
    })
)

const DATABASE_URL = env.DATABASE_URL_UNPOOLED || env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL not found in .env.local')
  process.exit(1)
}

const sql = neon(DATABASE_URL)

const DEV_CLERK_ID = 'dev_local_user'
const DEV_EMAIL = 'dev@localhost'

async function main() {
  // 1. 사용자 생성 (없으면)
  const existingUsers = await sql`
    SELECT id FROM users WHERE clerk_id = ${DEV_CLERK_ID} LIMIT 1
  `
  let userId
  if (existingUsers.length > 0) {
    userId = existingUsers[0].id
    console.log(`기존 개발 사용자 사용: ${userId}`)
  } else {
    const newUsers = await sql`
      INSERT INTO users (clerk_id, email) VALUES (${DEV_CLERK_ID}, ${DEV_EMAIL})
      ON CONFLICT (clerk_id) DO UPDATE SET email = EXCLUDED.email
      RETURNING id
    `
    userId = newUsers[0].id
    console.log(`개발 사용자 생성: ${userId}`)
  }

  // 2. API 키 생성
  const raw = `hc_live_${randomBytes(24).toString('hex')}`
  const keyHash = createHash('sha256').update(raw).digest('hex')
  const keyPrefix = raw.slice(0, 16) + '...'
  const name = 'Claude Code Dev Key'

  await sql`
    INSERT INTO api_keys (user_id, name, key_hash, key_prefix)
    VALUES (${userId}, ${name}, ${keyHash}, ${keyPrefix})
  `

  console.log('\n✅ API 키 생성 완료!\n')
  console.log(`키: ${raw}`)
  console.log('\n--- ~/.claude/.mcp.json에 추가할 설정 ---\n')
  console.log(JSON.stringify({
    mcpServers: {
      "harness-coach": {
        type: "http",
        url: "http://localhost:3000/api/mcp",
        headers: {
          Authorization: `Bearer ${raw}`
        }
      }
    }
  }, null, 2))
}

main().catch(e => { console.error(e); process.exit(1) })
