/**
 * Migration: Add project layer
 * - Creates a default project from existing settings
 * - Adds projectId to all existing requests and settlements
 * - Adds projectIds to all existing users
 * - Creates settings/global with defaultProjectId
 *
 * SAFE: Idempotent - can be run multiple times.
 *
 * For emulator: FIRESTORE_EMULATOR_HOST is set automatically.
 * For production: set GOOGLE_APPLICATION_CREDENTIALS env var.
 */

import { initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const useEmulator = process.argv.includes('--emulator')
if (useEmulator) {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'
}

initializeApp({ projectId: 'finance-96f46' })
const db = getFirestore()

const DEFAULT_PROJECT_ID = 'default'
const BATCH_LIMIT = 499

async function batchUpdate(
  docs: FirebaseFirestore.QueryDocumentSnapshot[],
  updateFn: (doc: FirebaseFirestore.QueryDocumentSnapshot) => Record<string, unknown> | null
) {
  let count = 0
  let batch = db.batch()
  let ops = 0

  for (const d of docs) {
    const data = updateFn(d)
    if (!data) continue
    batch.update(d.ref, data)
    ops++
    count++
    if (ops >= BATCH_LIMIT) {
      await batch.commit()
      batch = db.batch()
      ops = 0
    }
  }
  if (ops > 0) await batch.commit()
  return count
}

async function migrate() {
  console.log(`Starting project migration (${useEmulator ? 'emulator' : 'production'})...`)

  // 1. Read existing settings
  const budgetSnap = await db.doc('settings/budget-config').get()
  const docNoSnap = await db.doc('settings/document-no').get()

  const budgetConfig = budgetSnap.exists
    ? budgetSnap.data()
    : { totalBudget: 0, byCode: {} }

  const documentNo = docNoSnap.exists
    ? (docNoSnap.data()?.value || '')
    : ''

  // 2. Create default project (if not exists)
  const projectRef = db.doc(`projects/${DEFAULT_PROJECT_ID}`)
  const projectSnap = await projectRef.get()

  if (!projectSnap.exists) {
    await projectRef.set({
      name: 'Default Project',
      description: 'Migrated from existing data',
      createdAt: Timestamp.now(),
      createdBy: { uid: 'system', name: 'Migration', email: '' },
      budgetConfig,
      documentNo,
      driveFolders: { operations: '', preparation: '', bankbook: '' },
      memberUids: [],
      isActive: true,
    })
    console.log('  Created default project')
  } else {
    console.log('  Default project already exists, skipping')
  }

  // 3. Add projectId to all requests
  const reqSnap = await db.collection('requests').get()
  const reqCount = await batchUpdate(reqSnap.docs, (d) =>
    d.data().projectId ? null : { projectId: DEFAULT_PROJECT_ID }
  )
  console.log(`  Updated ${reqCount} requests`)

  // 4. Add projectId to all settlements
  const stlSnap = await db.collection('settlements').get()
  const stlCount = await batchUpdate(stlSnap.docs, (d) =>
    d.data().projectId ? null : { projectId: DEFAULT_PROJECT_ID }
  )
  console.log(`  Updated ${stlCount} settlements`)

  // 5. Add projectIds to all users and collect UIDs
  const userSnap = await db.collection('users').get()
  const allUids = userSnap.docs.map(d => d.id)
  const userCount = await batchUpdate(userSnap.docs, (d) =>
    d.data().projectIds ? null : { projectIds: [DEFAULT_PROJECT_ID] }
  )
  console.log(`  Updated ${userCount} users`)

  // Update project memberUids
  await projectRef.update({ memberUids: allUids })

  // 6. Create settings/global
  await db.doc('settings/global').set(
    { defaultProjectId: DEFAULT_PROJECT_ID },
    { merge: true }
  )
  console.log('  Set default project in settings/global')

  console.log('Migration complete!')
  process.exit(0)
}

migrate().catch((e) => {
  console.error('Migration failed:', e)
  process.exit(1)
})
