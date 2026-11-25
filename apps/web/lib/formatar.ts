const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const data = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });
const dataHora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function formatarMoeda(v: string | number | null | undefined) {
  return moeda.format(Number(v ?? 0));
}

// Aceita "YYYY-MM-DD" (coluna date) sem deslocar o dia por fuso.
export function formatarData(d: string | Date | null | undefined) {
  if (!d) return "—";
  return data.format(typeof d === "string" ? new Date(`${d.slice(0, 10)}T00:00:00Z`) : d);
}

export function formatarDataHora(d: Date | null | undefined) {
  return d ? dataHora.format(d) : "—";
}

export function formatarCnpj(c: string) {
  const n = c.replace(/\D/g, "");
  return n.length === 14 ? n.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : c;
}

export function diasAte(d: string) {
  const alvo = new Date(`${d.slice(0, 10)}T00:00:00Z`).getTime();
  const hoje = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime();
  return Math.round((alvo - hoje) / 86_400_000);
}
