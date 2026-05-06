import 'dotenv/config'
import postgres from 'postgres'

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 })

  console.log('\n📜 Establishments :')
  const estabs = await sql`
    SELECT id, tenant_id, establishment_number, name, is_active
    FROM establishments
    ORDER BY tenant_id, establishment_number
    LIMIT 20
  `
  for (const e of estabs) {
    console.log(`  #${e.id} tenant=${String(e.tenant_id).slice(0, 8)}… num=${e.establishment_number} active=${e.is_active} ${e.name}`)
  }

  console.log('\n📜 Registers :')
  const regs = await sql`
    SELECT id, establishment_id, register_number, name, is_active
    FROM registers
    ORDER BY establishment_id, register_number
    LIMIT 20
  `
  for (const r of regs) {
    console.log(`  #${r.id} estab=${r.establishment_id} num=${r.register_number} active=${r.is_active} ${r.name}`)
  }

  await sql.end()
}
main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
