// Manda dinheiro DA conta da plataforma PRA uma chave Pix de terceiro (o
// motorista) — usa o Asaas por baixo dos panos. Mantém a mesma "forma" de
// função que o saqueControlador já chama, pra não precisar mexer lá.

const asaas = require('./asaas');

// O app usa 'PIX_CODE' pra chave aleatória (nome interno já existente),
// mas o Asaas espera 'EVP' — só esse tipo precisa de tradução.
function traduzirTipoChave(tipo) {
  return tipo === 'PIX_CODE' ? 'EVP' : tipo;
}

async function transferirPix({ valor, chavePixTipo, chavePixValor, idempotencyKey }) {
  return asaas.transferirPix({
    valor,
    chavePix: chavePixValor,
    tipoChavePix: traduzirTipoChave(chavePixTipo),
    idempotencyKey,
  });
}

module.exports = { transferirPix };