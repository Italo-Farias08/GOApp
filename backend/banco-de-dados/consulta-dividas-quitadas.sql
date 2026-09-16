-- Rode isso primeiro, só pra CONSULTAR (não altera nada). Mostra as
-- dívidas já quitadas, quem foi o motorista credor, e o valor que foi
-- creditado a mais nele (R$0,50 por dívida, já que o `quitar()` antigo não
-- descontava a comissão da plataforma).
--
-- Uso:
--   psql -U postgres -d goapp -f banco-de-dados/consulta-dividas-quitadas.sql

SELECT
  d.id                       AS divida_id,
  d.valor                    AS valor_divida,
  d.quitado_em,
  u.id                       AS motorista_id,
  u.nome                     AS motorista_nome,
  u.saldo_a_receber          AS saldo_atual_motorista,
  0.50                       AS credito_a_mais_estimado
FROM dividas d
JOIN usuarios u ON u.id = d.motorista_credor_id
WHERE d.status = 'quitada'
ORDER BY d.quitado_em DESC;
