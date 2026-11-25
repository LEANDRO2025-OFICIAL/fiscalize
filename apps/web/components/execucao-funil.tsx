"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Selo, Tabela, Cartao, Vazio } from "@/components/ui";
import { formatarMoeda, formatarData } from "@/lib/formatar";

type Lancamento = {
  id: string;
  tipo: string;
  valor: string | number;
  numeroDocumento: string | null;
  data: Date | string;
  situacao: string;
  observacao: string | null;
  medicaoId: string | null;
  criadoEm: Date | string;
  numeroMedicao: string | null;
};

type MedicaoAprovada = {
  id: string;
  numero: number | string;
  valorLiquido: string | number;
};

const TIPOS: Array<{ value: string; rotulo: string }> = [
  { value: "empenho", rotulo: "Empenho" },
  { value: "liquidacao", rotulo: "Liquidação" },
  { value: "pagamento", rotulo: "Pagamento" },
];

const tomSituacao = (s: string) =>
  s === "confirmado" ? ("sucesso" as const) : s === "cancelado" ? ("erro" as const) : ("alerta" as const);

const rotuloTipo = (t: string) =>
  t === "empenho"
    ? "Empenho"
    : t === "liquidacao"
    ? "Liquidação"
    : t === "pagamento"
    ? "Pagamento"
    : t;

export function ExecucaoFunil({
  contratoId,
  contratoNumero,
  lancamentos,
  medicoesAprovadas,
  podeGerir,
}: {
  contratoId: string;
  contratoNumero: string;
  lancamentos: Lancamento[];
  medicoesAprovadas: MedicaoAprovada[];
  podeGerir: boolean;
}) {
  const [lista, setLista] = useState<Lancamento[]>(lancamentos);
  const [carregando, setCarregando] = useState(false);
  const [novoTipo, setNovoTipo] = useState("empenho");
  const [novoValor, setNovoValor] = useState("");
  const [novoDocumento, setNovoDocumento] = useState("");
  const [novoMedicao, setNovoMedicao] = useState("");
  const [novoObservacao, setNovoObservacao] = useState("");
  const [novoData, setNovoData] = useState(new Date().toISOString().slice(0, 10));
  const [alerta, setAlerta] = useState<string | null>(null);

  const podeLiquidarOuPagar = novoTipo === "liquidacao" || novoTipo === "pagamento";

  const refetch = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch(`/api/contratos/${contratoId}/execucao`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        setLista(json.lancamentos ?? []);
      }
    } finally {
      setCarregando(false);
    }
  }, [contratoId]);

  const lancar = async () => {
    const valorNum = Number(novoValor);
    if (!novoValor || !Number.isFinite(valorNum) || valorNum <= 0) {
      setAlerta("Informe um valor válido.");
      return;
    }
    if (podeLiquidarOuPagar && !novoMedicao) {
      setAlerta("Selecione a medição aprovada para liquidação ou pagamento.");
      return;
    }
    if (novoTipo === "pagamento") {
      const temLiquidacao = lista.some(
        (l) => l.tipo === "liquidacao" && l.situacao === "confirmado"
      );
      if (!temLiquidacao) {
        setAlerta("O pagamento requer uma liquidação prévia confirmada.");
        return;
      }
    }
    setCarregando(true);
    setAlerta(null);
    try {
      const res = await fetch(`/api/contratos/${contratoId}/execucao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: novoTipo,
          valor: valorNum,
          data: novoData,
          numeroDocumento: novoDocumento || undefined,
          medicaoId: novoMedicao || undefined,
          observacao: novoObservacao || undefined,
        }),
      });
      if (!res.ok) {
        const erro = await res.json().catch(() => ({}));
        throw new Error(erro.erro || "Não foi possível lançar a execução.");
      }
      setNovoValor("");
      setNovoDocumento("");
      setNovoMedicao("");
      setNovoObservacao("");
      await refetch();
    } catch (e) {
      setAlerta(e instanceof Error ? e.message : "Erro ao lançar execução.");
      setCarregando(false);
    }
  };

  const alterarSituacao = async (id: string, acao: "confirmar" | "cancelar") => {
    setCarregando(true);
    try {
      const res = await fetch(`/api/execucao/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao }),
      });
      if (!res.ok) throw new Error("Não foi possível alterar a situação.");
      await refetch();
    } catch (e) {
      setAlerta(e instanceof Error ? e.message : "Erro ao alterar situação.");
      setCarregando(false);
    }
  };

  const totalPorTipo = (tipo: string) =>
    lista
      .filter((l) => l.tipo === tipo && l.situacao === "confirmado")
      .reduce((s, l) => s + Number(l.valor), 0);

  const empenho = totalPorTipo("empenho");
  const liquido = totalPorTipo("liquidacao");
  const pago = totalPorTipo("pagamento");

  return (
    <div className="space-y-6">
      {alerta && (
        <div className="rounded-lg border border-erro-suave bg-erro-suave p-3 text-sm text-erro">
          {alerta}
        </div>
      )}

      {podeGerir ? (
        <Cartao titulo="Novo lançamento">
          <div className="grid gap-3 px-5 py-4 sm:grid-cols-4 items-end">
            <select
              value={novoTipo}
              onChange={(e) => setNovoTipo(e.target.value)}
              className="rounded-lg border border-borda bg-superficie px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primario"
            >
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.rotulo}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              min="0"
              value={novoValor}
              onChange={(e) => setNovoValor(e.target.value)}
              placeholder="Valor"
              className="rounded-lg border border-borda bg-superficie px-3 py-2 text-sm tabular focus:outline-none focus:ring-2 focus:ring-primario"
            />
            <select
              value={novoMedicao}
              onChange={(e) => setNovoMedicao(e.target.value)}
              disabled={!podeLiquidarOuPagar}
              className="rounded-lg border border-borda bg-superficie px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primario"
            >
              <option value="">Medição aprovada</option>
              {medicoesAprovadas.map((m) => (
                <option key={m.id} value={m.id}>
                  #{m.numero} · {formatarMoeda(m.valorLiquido)}
                </option>
              ))}
            </select>
            <button
              onClick={lancar}
              disabled={carregando}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-borda bg-primario px-3 py-2 text-sm font-semibold text-white hover:bg-primario-2 disabled:opacity-50"
            >
              {carregando ? "Lançando…" : "Lançar"}
            </button>
          </div>
          <div className="px-5 py-2 grid gap-2 sm:grid-cols-4 items-center text-xs text-texto-suave">
            <div>
              <label className="block">Data</label>
              <input
                type="date"
                value={novoData}
                onChange={(e) => setNovoData(e.target.value)}
                className="rounded-lg border border-borda bg-superficie px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primario"
              />
            </div>
            <div>
              <label className="block">Número do documento</label>
              <input
                value={novoDocumento}
                onChange={(e) => setNovoDocumento(e.target.value)}
                placeholder="ex.: EMP-2026-001"
                className="rounded-lg border border-borda bg-superficie px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primario"
              />
            </div>
            <div>
              <label className="block">Observação</label>
              <input
                value={novoObservacao}
                onChange={(e) => setNovoObservacao(e.target.value)}
                placeholder="opcional"
                className="rounded-lg border border-borda bg-superficie px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primario"
              />
            </div>
            <div className="h-full"></div>
          </div>
          {podeLiquidarOuPagar && medicoesAprovadas.length === 0 && (
            <p className="px-5 py-2 text-xs text-texto-suave">
              Nenhuma medição aprovada para vincular. Aprove uma medição primeiro.
            </p>
          )}
        </Cartao>
      ) : null}

      <Cartao titulo="Lançamentos do contrato">
        {lista.length === 0 ? (
          <Vazio
            titulo="Sem lançamentos"
            texto="O funil de execução (empenho → liquidação → pagamento) aparecerá aqui."
          />
        ) : (
          <div className="overflow-x-auto">
            <Tabela
              colunas={[
                { rotulo: "Tipo" },
                { rotulo: "Valor", alinhar: "direita" },
                { rotulo: "Documento" },
                { rotulo: "Data" },
                { rotulo: "Medição" },
                { rotulo: "Situação" },
                { rotulo: "Ação" },
              ]}
            >
              {lista.map((l) => {
                const confirmado = l.situacao === "confirmado";
                return (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-sm">{rotuloTipo(l.tipo)}</td>
                    <td className="tabular px-5 py-3 text-right text-sm font-medium">
                      {formatarMoeda(l.valor)}
                    </td>
                    <td className="px-5 py-3 text-sm">
                      {l.numeroDocumento || "—"}
                    </td>
                    <td className="tabular px-5 py-3 text-sm">
                      {formatarData(l.data)}
                    </td>
                    <td className="px-5 py-3 text-sm">
                      {l.numeroMedicao ? `#${l.numeroMedicao}` : "—"}
                    </td>
                    <td className="px-5 py-3 text-sm">
                      <Selo tom={tomSituacao(l.situacao)}>{l.situacao}</Selo>
                    </td>
                    <td className="px-5 py-3">
                      {l.situacao === "pendente" && podeGerir ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => alterarSituacao(l.id, "confirmar")}
                            disabled={carregando}
                            className="rounded border border-sucesso-suave bg-sucesso-suave px-2.5 py-1 text-xs font-semibold text-sucesso hover:bg-sucesso/50 disabled:opacity-50"
                          >
                            Confirmar
                          </button>
                          <button
                            onClick={() => alterarSituacao(l.id, "cancelar")}
                            disabled={carregando}
                            className="rounded border border-erro-suave bg-erro-suave px-2.5 py-1 text-xs font-semibold text-erro hover:bg-erro/50 disabled:opacity-50"
                          >
                            Cancelar
                          </button>
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
      </Cartao>

      <Cartao
        titulo="Resumo do funil"
        acao={
          podeGerir ? (
            <Link href={`/contratos/${contratoId}`} className="text-xs font-semibold text-primario hover:underline">
              Voltar ao contrato
            </Link>
          ) : undefined
        }
      >
        <div className="grid gap-3 px-5 py-4 sm:grid-cols-3 text-sm">
          <div className="rounded-lg border border-borda bg-superficie p-3">
            <p className="text-xs text-texto-suave uppercase">Empenho confirmado</p>
            <p className="tabular text-lg font-semibold">{formatarMoeda(empenho)}</p>
          </div>
          <div className="rounded-lg border border-borda bg-superficie p-3">
            <p className="text-xs text-texto-suave uppercase">Liquidação confirmada</p>
            <p className="tabular text-lg font-semibold">{formatarMoeda(liquido)}</p>
          </div>
          <div className="rounded-lg border border-borda bg-superficie p-3">
            <p className="text-xs text-texto-suave uppercase">Pagamento confirmado</p>
            <p className="tabular text-lg font-semibold">{formatarMoeda(pago)}</p>
          </div>
        </div>
      </Cartao>
    </div>
  );
}
