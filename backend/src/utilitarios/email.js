// Envia e-mails usando a API HTTP do Brevo (ex-Sendinblue, https://brevo.com).
// Não precisa de nenhuma lib extra: usamos o fetch nativo do Node 18+.
//
// Configuração necessária no .env:
//   BREVO_API_KEY=xkeysib-xxx...     (chave gerada em brevo.com > SMTP & API > API Keys)
//   EMAIL_REMETENTE=verificado@seudominio.com   (precisa ser um remetente validado no Brevo)
//   EMAIL_REMETENTE_NOME=GOApp        (opcional, nome que aparece pro usuário)

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const EMAIL_REMETENTE = process.env.EMAIL_REMETENTE || 'no-reply@goapp.com';
const EMAIL_REMETENTE_NOME = process.env.EMAIL_REMETENTE_NOME || 'GOApp';

async function enviarEmailVerificacao({ para, nome, codigo }) {
  if (!BREVO_API_KEY) {
    // Em desenvolvimento, se a chave não estiver configurada, só loga o código
    // no console pra não travar o fluxo de teste.
    console.warn(`[email] BREVO_API_KEY não configurada. Código de verificação para ${para}: ${codigo}`);
    return;
  }

  const resposta = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: EMAIL_REMETENTE_NOME, email: EMAIL_REMETENTE },
      to: [{ email: para, name: nome || undefined }],
      subject: 'Seu código de verificação do GOApp',
      htmlContent: `
        <div style="font-family: sans-serif; background:#0B0B0F; padding:32px; border-radius:12px; color:#F5F5F7;">
          <h2 style="color:#39FF6A; margin-bottom:4px;">GOApp</h2>
          <p>Oi, ${nome || ''}!</p>
          <p>Use o código abaixo para confirmar seu e-mail. Ele vale por 15 minutos.</p>
          <p style="font-size:32px; font-weight:700; letter-spacing:8px; margin:24px 0; color:#39FF6A;">${codigo}</p>
          <p style="color:#9A9AA5; font-size:13px;">Se você não pediu isso, pode ignorar este e-mail.</p>
        </div>
      `,
    }),
  });

  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => '');
    console.error('[email] falha ao enviar via Brevo:', resposta.status, corpo);
    throw new Error('Não foi possível enviar o e-mail de verificação.');
  }
}

module.exports = { enviarEmailVerificacao };