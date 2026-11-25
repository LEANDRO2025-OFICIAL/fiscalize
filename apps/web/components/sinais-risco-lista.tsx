"use client";

import { useEffect, useState, useCallback } from "react";
import { Selo, Tabela, Vazio, Cartao, Indicador } from "@/components/ui";
import Link from "next/link";
import { formatarMoeda, formatarData, formatarDataHora } from "@/lib/formatar";

type Sinal = {
  id: string;
  tipo: string;
  regraAplicada: string;
  valorObservado: string | null;
  valorReferencia: string | null;
  desvioPercentual: string | null;
  confianca: string | null;
  statusRevisao: string;
  parecerHumano: string | null;
  observacao: string | null;
  parecerPorId: string | null;
  parecerEm: Date | null;
  criadoEm: Date | null;
  contratoNumero: string;
  contratoObjeto: string;
  contratoFornecedorCnpj: string;
  contratoId: string;
};

type Contrato = { id: string; numero: string };

type Estatisticas = {
  total: number;
  porTipo: Record<string, number>;
  porStatus: Record<string, number>;
  mediaDesvio: number | null;
};

function tomRisco(desvio: number | null): "sucesso" | "alerta" | "erro" | "neutro" {
  if (desvio === null) return "neutro";
  if (desvio >= 50) return "erro";
  if (desvio >= 20) return "alerta";
  return "sucesso";
}

function rotuloRisco(tipo: string, desvio: number | null): string {
  if (tipo === "vinculo_cadastral") return "Vínculo";
  if (desvio === null) return "—";
  return `${desvio.toFixed(1)}%`;
}

export function SinaisRiscoLista({
  sinais,
  contratos,
  podeGerir,
  podeRevisar,
}: {
  sinais: Sinal[];
  contratos: Contrato[];
  podeGerir: boolean;
  podeRevisar: boolean;
}) {
  const [lista, setLista] = useState<Sinal[]>(sinais);
  const [estatisticas, setEstatisticas] = useState<Estatisticas | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [carregandoEstatisticas, setCarregandoEstatisticas] = useState(false);
  const [filtroContrato, setFiltroContrato] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [parecerId, setParecerId] = useState<string | null>(null);
  const [parecerTexto, setParecerTexto] = useState("");
  const [observacaoTexto, setObservacaoTexto] = useState("");

  const tipos = [...new Set(lista.map((s) => s.tipo))];
  const statuses = [...new Set(lista.map((s) => s.statusRevisao))];

  const filtrados = lista.filter(
    (s) =>
      (!filtroContrato || s.contratoNumero === filtroContrato) &&
      (!filtroTipo || s.tipo === filtroTipo) &&
      (!filtroStatus || s.statusRevisao === filtroStatus)
  );

  const refetch = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch("/api/sinais-risco", {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        setLista(json.sinais ?? []);
      }
    } finally {
      setCarregando(false);
    }
  }, []);

  const refetchEstatisticas = useCallback(async () => {
    setCarregandoEstatisticas(true);
    try {
      const res = await fetch("/api/sinais-risco?estatisticas=1", {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        setEstatisticas(json);
      }
    } finally {
      setCarregandoEstatisticas(false);
    }
  }, []);

  useEffect(() => {
    refetch();
    refetchEstatisticas();
  }, [refetch, refetchEstatisticas]);

  const recalcular = async () => {
    setCarregando(true);
    try {
      const res = await fetch("/api/sinais-risco", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "gerar" }),
      });
      if (!res.ok) throw new Error("Não foi possível recalcular os sinais.");
      await refetch();
      await refetchEstatisticas();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao recalcular sinais.");
      setCarregando(false);
    }
  };

  const salvarParecer = async (id: string) => {
    if (!parecerTexto.trim()) {
      alert("O parecer não pode ser vazio.");
      return;
    }
    try {
      const res = await fetch(`/api/sinais-risco/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acao: "parecer",
          texto: parecerTexto,
          observacao: observacaoTexto || undefined,
        }),
      });
      if (!res.ok) throw new Error("Não foi possível registrar o parecer.");
      setParecerId(null);
      setParecerTexto("");
      setObservacaoTexto("");
      await refetch();
      await refetchEstatisticas();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao registrar parecer.");
    }
  };

  const salvarObservacao = async (id: string) => {
    try {
      const res = await fetch(`/api/sinais-risco/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "observacao", observacao: observacaoTexto }),
      });
      if (!res.ok) throw new Error("Não foi possível salvar a observação.");
      setParecerId(null);
      setObservacaoTexto("");
      await refetch();
      await refetchEstatisticas();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao salvar observação.");
    }
  };

  const totalSinais = estatisticas?.total ?? lista.length;
  const aguardamRevisao = estatisticas?.porStatus?.aguarda_revisao ?? 0;
  const revisados = estatisticas?.porStatus?.revisado ?? 0;
  const divergencias = estatisticas?.porTipo?.divergencia_preco ?? 0;
  const vinculos = estatisticas?.porTipo?.vinculo_cadastral ?? 0;

  return (
    <div className="space-y-6">
      {/* Estatísticas visuais */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Cartao titulo="Sinais totais" className="p-4">
          <p className="tabular text-3xl font-semibold text-texto">
            {totalSinais}
          </p>
          <p className="mt-1 text-xs text-texto-suave">
            {aguardamRevisao} aguardam revisão · {revisados} revisados
          </p>
        </Cartao>
        <Indicador
          rotulo="Divergência de preço"
          valor={String(divergencias)}
          detalhe={
            estatisticas?.mediaDesvio != null
              ? `média de desvio: ${estatisticas.mediaDesvio}%`
              : "—"
          }
          tom="alerta"
        />
        <Indicador
          rotulo="Vínculo cadastral"
          valor={String(vinculos)}
          detalhe="Fornecedor vinculado ao órgão"
          tom="neutro"
        />
        <div className="p-4 flex flex-col justify-between">
          {podeGerir ? (
            <button
              onClick={recalcular}
              disabled={carregando}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-borda bg-superficie px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              {carregando ? "Recalculando…" : "Recalcular sinais"}
            </button>
          ) : (
            <p className="text-xs text-texto-suave">Sem permissão para gerar</p>
          )}
        </div>
      </div>

      {/* Filtros */}
      <Cartao titulo="Filtros" className="mt-4">
        <div className="grid gap-3 px-5 py-4 sm:grid-cols-5 items-end">
          <select
            value={filtroContrato}
            onChange={(e) => setFiltroContrato(e.target.value)}
            className="rounded-lg border border-borda bg-superficie px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primario"
          >
            <option value="">Todos os contratos</option>
            {contratos.map((c) => (
              <option key={c.id} value={c.numero}>
                {c.numero}
              </option>
            ))}
          </select>
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="rounded-lg border border-borda bg-superficie px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primario"
          >
            <option value="">Todos os tipos</option>
            {tipos.map((t) => (
              <option key={t} value={t}>
                {t === "divergencia_preco" ? "Divergência de preço" : "Vínculo cadastral"}
              </option>
            ))}
          </select>
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="rounded-lg border border-borda bg-superficie px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primario"
          >
            <option value="">Todos os status</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s === "aguarda_revisao" ? "Aguarda revisão humana" : "Revisado"}
              </option>
            ))}
          </select>
          <div className="h-full"></div>
        </div>
      </Cartao>

      {/* Lista de sinais */}
      {filtrados.length === 0 ? (
        <Vazio
          titulo="Nenhum sinal de risco"
          texto="Recalcule os sinais para avaliar divergências de preço e vínculos cadastrais dos contratos do órgão."
        />
      ) : (
        <div className="overflow-x-auto">
          <Tabela
            colunas={[
              { rotulo: "Contrato" },
              { rotulo: "Tipo de sinal" },
              { rotulo: "Regra aplicada" },
              { rotulo: "Valor observado", alinhar: "direita" },
              { rotulo: "Referência", alinhar: "direita" },
              { rotulo: "Desvio %", alinhar: "direita" },
              { rotulo: "Confiança", alinhar: "direita" },
              { rotulo: "Risco" },
              { rotulo: "Revisão" },
              { rotulo: "Ação" },
            ]}
          >
            {filtrados.map((s) => {
              const desvioNum = s.desvioPercentual ? Number(s.desvioPercentual) : null;
              const confiancaNum = s.confianca ? Number(s.confianca) : null;
              const riscoTom = tomRisco(desvioNum);
              return (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <Link
                      href={`/contratos/${s.contratoId}`}
                      className="font-medium text-primario hover:underline"
                    >
                      {s.contratoNumero}
                    </Link>
                    <p className="text-xs text-texto-suave">{s.contratoObjeto}</p>
                  </td>
                  <td className="px-5 py-3">
                    <Selo
                      tom={
                        s.tipo === "divergencia_preco" ? "alerta" : "neutro"
                      }
                    >
                      {s.tipo === "divergencia_preco" ? "Preço" : "Vínculo"}
                    </Selo>
                  </td>
                  <td className="px-5 py-3 text-sm">{s.regraAplicada}</td>
                  <td className="tabular px-5 py-3 text-right text-sm">
                    {s.valorObservado != null
                      ? formatarMoeda(s.valorObservado)
                      : "—"}
                  </td>
                  <td className="tabular px-5 py-3 text-right text-sm">
                    {s.valorReferencia != null
                      ? formatarMoeda(s.valorReferencia)
                      : "—"}
                  </td>
                  <td className="tabular px-5 py-3 text-right text-sm">
                    {desvioNum != null ? `${desvioNum.toFixed(1)}%` : "—"}
                  </td>
                  <td className="tabular px-5 py-3 text-right text-sm">
                    {confiancaNum != null
                      ? `${(confiancaNum * 100).toFixed(0)}%`
                      : "—"}
                  </td>
                  <td className="px-5 py-3">
                    <Selo tom={riscoTom}>
                      {rotuloRisco(s.tipo, desvioNum)}
                    </Selo>
                  </td>
                  <td className="px-5 py-3 text-sm">
                    {s.statusRevisao === "aguarda_revisao" ? (
                      <Selo tom="alerta">Aguarda revisão humana</Selo>
                    ) : (
                      <Selo tom="sucesso">Revisado</Selo>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {s.statusRevisao === "aguarda_revisao" && podeRevisar ? (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <textarea
                          value={parecerId === s.id ? parecerTexto : ""}
                          onChange={(e) => {
                            setParecerId(s.id);
                            setParecerTexto(e.target.value);
                          }}
                          placeholder="Parecer humano…"
                          className="w-full rounded-lg border border-borda bg-superficie px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primario"
                          rows={2}
                        />
                        <input
                          value={
                            parecerId === s.id ? observacaoTexto : s.observacao ?? ""
                          }
                          onChange={(e) => {
                            setParecerId(s.id);
                            setObservacaoTexto(e.target.value);
                          }}
                          placeholder="Observação / evidência (opcional)"
                          className="w-full rounded-lg border border-borda bg-superficie px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primario"
                        />
                        <button
                          onClick={() => salvarParecer(s.id)}
                          disabled={!parecerTexto.trim() || parecerId !== s.id}
                          className="rounded-lg border border-borda bg-primario px-3 py-1.5 text-xs font-semibold text-white hover:bg-primario-2 disabled:opacity-50"
                        >
                          Registrar parecer
                        </button>
                      </div>
                    ) : s.parecerHumano ? (
                      <div className="text-sm text-texto-suave">
                        <p>
                          {s.parecerHumano.slice(0, 80)}
                          {s.parecerHumano.length > 80 ? "…" : ""}
                        </p>
                        {s.observacao ? (
                          <p className="mt-1 text-xs text-texto-suave">
                            <strong>Obs.:</strong>
                            {s.observacao.slice(0, 60)}
                            {s.observacao.length > 60 ? "…" : ""}
                          </p>
                        ) : null}
                        <br />
                        <span className="text-xs text-texto-suave">
                          {formatarDataHora(s.parecerEm)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-texto-suave">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </Tabela>
        </div>
      )}

      {/* Guia de leitura */}
      {filtrados.length > 0 && (
        <Cartao titulo="Como ler os sinais">
          <ul className="divide-y divide-borda text-sm">
            <li className="px-5 py-3">
              <p className="font-medium">Divergência de preço</p>
              <p className="text-xs text-texto-suave">
                O preço unitário de um item está acima da média de itens similares
                (mesma descrição e unidade) no órgão. Acima de 20% gera o sinal.
                Nunca é um juízo de irregularidade — apenas um número para a
                fiscalização conferir.
              </p>
            </li>
            <li className="px-5 py-3">
              <p className="font-medium">Vínculo cadastral identificado</p>
              <p className="text-xs text-texto-suave">
                O fornecedor do contrato consta como organização vinculada ao
                órgão contratante. Apenas sinaliza a existência do vínculo;
                cabe à pessoa revisora avaliar a conveniência.
              </p>
            </li>
            <li className="px-5 py-3">
              <p className="font-medium">Nível de risco (cores)</p>
              <p className="text-xs text-texto-suave">
                <Selo tom="erro">Alto (≥ 50% desvio)</Selo>{" "}
                <Selo tom="alerta">Médio (≥ 20% desvio)</Selo>{" "}
                <Selo tom="sucesso">Baixo (&lt; 20% desvio)</Selo>{" "}
                <Selo tom="neutro">Sem desvio / vínculo</Selo>
              </p>
            </li>
            <li className="px-5 py-3">
              <p className="font-medium">Revisão humana obrigatória</p>
              <p className="text-xs text-texto-suave">
                Sinais sem parecer exibem "Aguarda revisão humana" e não podem
                ser incluídos em dossiê exportado. Quem assina o parecer é quem
                se responsabiliza pela avaliação.
              </p>
            </li>
          </ul>
        </Cartao>
      )}
    </div>
  );
}
