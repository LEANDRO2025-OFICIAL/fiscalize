import { and, eq, desc } from "drizzle-orm";
import { comOrganizacao } from "@contratacao/db/client";
import { sessaoAtiva, eventoSeguranca, usuario, organizacao } from "@contratacao/db/schema";
import { getSessao } from "@/lib/sessao";
import { formatarDataHora } from "@/lib/formatar";
import { Cabecalho, Cartao, Selo, Tabela, Vazio } from "@/components/ui";

const tomSeveridade: Record<string, "neutro" | "primario" | "sucesso" | "alerta" | "erro"> = {
  baixa: "neutro",
  media: "alerta",
  alta: "erro",
  critica: "erro",
};

const rotuloSeveridade: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

const rotuloTipo: Record<string, string> = {
  login_falha: "Falha de login",
  acesso_negado: "Acesso negado",
  papel_alterado: "Papel alterado",
  sessao_expirada: "Sessão expirada",
  token_invalido: "Token inválido",
};

export default async function PaginaSentinelaOps() {
  const sessao = await getSessao();
  return comOrganizacao(sessao.organizacaoId, async (db) => {
    const org = sessao.organizacaoId;

    const [orgData] = await db
      .select({ nome: organizacao.nome, cnpj: organizacao.cnpj })
      .from(organizacao)
      .where(eq(organizacao.id, org))
      .limit(1);

    const sessoesAtivas = await db
      .select({
        id: sessaoAtiva.id,
        nomeUsuario: usuario.nome,
        ip: sessaoAtiva.ip,
        userAgent: sessaoAtiva.userAgent,
        ultimoAcesso: sessaoAtiva.ultimoAcesso,
      })
      .from(sessaoAtiva)
      .leftJoin(usuario, eq(usuario.id, sessaoAtiva.usuarioId))
      .where(and(eq(sessaoAtiva.organizacaoId, org), eq(sessaoAtiva.ativo, true)))
      .orderBy(desc(sessaoAtiva.ultimoAcesso));

    const eventos = await db
      .select({
        id: eventoSeguranca.id,
        tipo: eventoSeguranca.tipo,
        descricao: eventoSeguranca.descricao,
        ip: eventoSeguranca.ip,
        severidade: eventoSeguranca.severidade,
        nomeUsuario: usuario.nome,
        criadoEm: eventoSeguranca.criadoEm,
      })
      .from(eventoSeguranca)
      .leftJoin(usuario, eq(usuario.id, eventoSeguranca.usuarioId))
      .where(eq(eventoSeguranca.organizacaoId, org))
      .orderBy(desc(eventoSeguranca.criadoEm))
      .limit(50);

    const eventosCriticos = eventos.filter((e) => e.severidade === "alta" || e.severidade === "critica").length;

    return (
      <>
        <Cabecalho
          titulo="SentinelaOps"
          descricao={`Monitoramento de segurança operacional — ${orgData?.nome} (${orgData?.cnpj}) · ${eventosCriticos} evento(s) crítico(s) recente(s)`}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <Cartao titulo="Sessões Ativas">
            {sessoesAtivas.length === 0 ? (
              <Vazio titulo="Nenhuma sessão ativa" texto="Não há sessões autenticadas no momento." />
            ) : (
              <Tabela
                colunas={[
                  { rotulo: "Usuário" },
                  { rotulo: "IP" },
                  { rotulo: "Último acesso" },
                  { rotulo: "" },
                ]}
              >
                {sessoesAtivas.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium">{s.nomeUsuario ?? "—"}</td>
                    <td className="px-5 py-3 text-texto-suave">{s.ip ?? "—"}</td>
                    <td className="tabular px-5 py-3 text-xs">{formatarDataHora(s.ultimoAcesso)}</td>
                    <td className="px-5 py-3">
                      <button
                        className="rounded border border-erro-suave bg-erro-suave px-2.5 py-1 text-xs font-semibold text-erro hover:bg-erro/50"
                        disabled
                      >
                        Invalidar
                      </button>
                    </td>
                  </tr>
                ))}
              </Tabela>
            )}
          </Cartao>

          <Cartao titulo="Eventos de Segurança (últimos 50)">
            {eventos.length === 0 ? (
              <Vazio
                titulo="Nenhum evento de segurança"
                texto="Não há eventos de segurança registrados para esta organização."
              />
            ) : (
              <Tabela
                colunas={[
                  { rotulo: "Tipo" },
                  { rotulo: "Severidade" },
                  { rotulo: "Usuário" },
                  { rotulo: "Descrição" },
                  { rotulo: "Registrado em" },
                ]}
              >
                {eventos.map((e) => {
                  const tom = tomSeveridade[e.severidade] ?? "neutro";
                  return (
                    <tr key={e.id} className="align-top hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium">{rotuloTipo[e.tipo] ?? e.tipo}</td>
                      <td className="px-5 py-3"><Selo tom={tom}>{rotuloSeveridade[e.severidade] ?? e.severidade}</Selo></td>
                      <td className="px-5 py-3 text-texto-suave">{e.nomeUsuario ?? "—"}</td>
                      <td className="px-5 py-3 max-w-md truncate text-texto-suave">{e.descricao}</td>
                      <td className="tabular px-5 py-3 text-xs">{formatarDataHora(e.criadoEm)}</td>
                    </tr>
                  );
                })}
              </Tabela>
            )}
          </Cartao>
        </div>
      </>
    );
  });
}
