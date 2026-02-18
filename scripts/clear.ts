/**
 * Clear all mock data from Firestore
 * Usage: npx tsx scripts/clear.ts
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, '..', 'functions', 'service-account.json'), 'utf8')
)

initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

async function clearCollection(name: string) {
  const snap = await db.collection(name).get()
  const batch = db.batch()
  snap.docs.forEach((doc) => batch.delete(doc.ref))
  await batch.commit()
  console.log(`   ✓ ${name}: ${snap.size} docs deleted`)
}

async function clear() {
  console.log('🗑️  Clearing Firestore mock data...\n')

  await clearCollection('users')
  await clearCollection('requests')
  await clearCollection('settlements')
  await clearCollection('settings')

  console.log('\n✅ All mock data cleared!')
  process.exit(0)
}

clear().catch((err) => {
  console.error('❌ Clear failed:', err)
  process.exit(1)
})
