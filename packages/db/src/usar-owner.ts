// Scripts de manutenção (seed) rodam como dono do banco, que não é limitado pelo RLS.
// Importe este módulo antes de "./client".
process.env.DATABASE_URL = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
