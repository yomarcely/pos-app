import 'dotenv/config'
import postgres from 'postgres'

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 })
  const probes = [
    { name: '0009 marker — customer_establishments.first_name_override', q: sql`SELECT column_name FROM information_schema.columns WHERE table_name='customer_establishments' AND column_name='first_name_override'` },
    { name: '0010 marker — brands.created_by_establishment_id', q: sql`SELECT column_name FROM information_schema.columns WHERE table_name='brands' AND column_name='created_by_establishment_id'` },
    { name: '0010 marker — customers_email_tenant_unique index', q: sql`SELECT indexname FROM pg_indexes WHERE indexname='customers_email_tenant_unique'` },
    { name: '0011 marker — pending_sales table', q: sql`SELECT table_name FROM information_schema.tables WHERE table_name='pending_sales'` },
    { name: '0011 marker — establishments.share_pending_sales', q: sql`SELECT column_name FROM information_schema.columns WHERE table_name='establishments' AND column_name='share_pending_sales'` },
    { name: '0012 marker — sales.points_earned', q: sql`SELECT column_name FROM information_schema.columns WHERE table_name='sales' AND column_name='points_earned'` },
    { name: '0012 marker — loyalty_config table', q: sql`SELECT table_name FROM information_schema.tables WHERE table_name='loyalty_config'` },
  ]
  for (const p of probes) {
    const r = await p.q
    console.log(`${r.length > 0 ? '✅' : '❌'}  ${p.name}`)
  }
  await sql.end()
}
main()
