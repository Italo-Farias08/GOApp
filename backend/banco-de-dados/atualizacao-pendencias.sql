-- Atualização pro recurso de "Pendências" (tela de pagamento de dívidas
-- direto pelas configurações do passageiro).
--
-- A tabela pagamentos_pix já existe no banco com um CHECK constraint na
-- coluna `tipo` que só permitia 'prepago' e 'pos_pago'. Esse script troca
-- esse constraint por um que também aceita 'quitacao_divida' (o tipo usado
-- quando o passageiro paga uma pendência direto pela tela, sem esperar a
-- próxima corrida embutir o valor).
--
-- Rode uma vez no seu PostgreSQL:
--   psql -U postgres -d goapp -f banco-de-dados/atualizacao-pendencias.sql
-- (ou cole o conteúdo no client que você usa pra acessar o banco, ex:
-- Railway, TablePlus, DBeaver etc.)

ALTER TABLE pagamentos_pix DROP CONSTRAINT IF EXISTS pagamentos_pix_tipo_check;

ALTER TABLE pagamentos_pix
  ADD CONSTRAINT pagamentos_pix_tipo_check
  CHECK (tipo IN ('prepago', 'pos_pago', 'quitacao_divida'));
