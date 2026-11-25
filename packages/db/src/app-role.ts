import postgres from "postgres";

// Define a senha e libera o login do papel do app: APP_DB_PASSWORD=... pnpm db:app-role
const senha = process.env.APP_DB_PASSWORD;
if (!senha || !/^[A-Za-z0-9]{24,}$/.test(senha)) throw new Error("Defina APP_DB_PASSWORD (alfanumérica, 24+ caracteres).");
const sql = postgres(process.env.DIRECT_DATABASE_URL!, { max: 1 });
await sql.unsafe(`ALTER ROLE fiscalize_app WITH LOGIN PASSWORD '${senha}'`);
await sql.end();
console.log("fiscalize_app pronto");
