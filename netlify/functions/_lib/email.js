// Gmail API sender (raw fetch, OAuth2 refresh-token flow). Matches the Forest
// Gmail-API pattern. Set EMAIL_DRY_RUN=true to log instead of send.
const EMAIL_DRY_RUN = (process.env.EMAIL_DRY_RUN ?? 'true').toLowerCase() !== 'false';

async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID,
      client_secret: process.env.GMAIL_CLIENT_SECRET,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`Gmail OAuth falló: ${res.status}`);
  return (await res.json()).access_token;
}

function base64url(str) {
  return Buffer.from(str, 'utf-8').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function buildMime({ to, subject, html, from }) {
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
  ];
  return `${headers.join('\r\n')}\r\n\r\n${html}`;
}

/** Envía un correo HTML. En EMAIL_DRY_RUN solo lo registra. */
export async function sendEmail({ to, subject, html }) {
  const from = process.env.GMAIL_SENDER || 'no-reply@forestcol.com';
  if (EMAIL_DRY_RUN) {
    console.log('[email dry-run]', { to, subject });
    return { dryRun: true };
  }
  if (!process.env.GMAIL_REFRESH_TOKEN) throw new Error('Faltan credenciales Gmail');
  const token = await getAccessToken();
  const raw = base64url(buildMime({ to, subject, html, from }));
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) throw new Error(`Gmail send falló: ${res.status} ${await res.text()}`);
  return await res.json();
}

// --- Plantillas (español, tono Forest) --------------------------------------
const shell = (title, body) => `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#0c0c0b;background:#f7f6f2;padding:24px">
<div style="max-width:520px;margin:auto;background:#fff;border:1px solid #e5e3db;border-radius:6px;padding:24px">
<div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#6b6b66">Forest Gastos</div>
<h2 style="margin:4px 0 16px;color:#1b203d">${title}</h2>${body}
<p style="margin-top:24px;font-size:12px;color:#6b6b66">Este es un mensaje automático de Forest Gastos.</p>
</div></body></html>`;

export function tplRechazo({ nombre, categoria, monto, motivo }) {
  return {
    subject: 'Tu gasto fue rechazado — requiere corrección',
    html: shell('Gasto rechazado', `<p>Hola ${nombre},</p>
<p>Tu gasto de <strong>${categoria}</strong> por <strong>${monto}</strong> fue rechazado por contabilidad.</p>
<p style="background:#fbeae6;border-left:3px solid #a8351c;padding:8px 12px"><strong>Motivo:</strong> ${motivo}</p>
<p>Puedes corregirlo y reenviarlo desde la app con un toque.</p>`),
  };
}

export function tplCierre({ nombre, total, saldoTexto }) {
  return {
    subject: 'Cierre de reembolso completado',
    html: shell('Cierre completado', `<p>Hola ${nombre},</p>
<p>Contabilidad cerró un reembolso con tus gastos aprobados.</p>
<p>Total de gastos: <strong>${total}</strong></p>
<p style="background:#eef4e8;border-left:3px solid #4d7c2f;padding:8px 12px">${saldoTexto}</p>`),
  };
}

export function tplResumenPendientes({ count, lista }) {
  return {
    subject: `Gastos pendientes de revisión: ${count}`,
    html: shell('Resumen semanal', `<p>Hay <strong>${count}</strong> gastos esperando revisión.</p>${lista}`),
  };
}
