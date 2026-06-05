// ── Proxy MIRIO → Airtable (Vercel) ──
// El token de Airtable vive SOLO aquí, en variables de entorno del servidor.
// Nunca llega al navegador. Además exige la contraseña APP_PASSWORD.
// Archivo: /api/airtable/[...path].js  → atiende /api/airtable/*

export default async function handler(req, res) {
  const APP_PASSWORD   = process.env.APP_PASSWORD;
  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
  const BASE_ID        = process.env.AIRTABLE_BASE_ID;

  // 1) Config completa
  if (!APP_PASSWORD || !AIRTABLE_TOKEN || !BASE_ID) {
    return res.status(500).send('Faltan variables de entorno (APP_PASSWORD / AIRTABLE_TOKEN / AIRTABLE_BASE_ID).');
  }

  // 2) Validar contraseña
  const key = req.headers['x-app-key'] || '';
  if (key !== APP_PASSWORD) {
    return res.status(401).send('No autorizado');
  }

  // 3) Reconstruir la ruta hacia Airtable desde el catch-all
  const segs = Array.isArray(req.query.path) ? req.query.path : (req.query.path ? [req.query.path] : []);
  const sub = segs.join('/');
  if (!sub) return res.status(400).send('Ruta vacía');

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query)) {
    if (k === 'path') continue;
    if (Array.isArray(v)) v.forEach(x => params.append(k, x));
    else params.append(k, v);
  }
  const qs = params.toString();
  const target = `https://api.airtable.com/v0/${BASE_ID}/${sub}${qs ? '?' + qs : ''}`;

  // 4) Reenviar a Airtable con el token real
  const init = {
    method: req.method,
    headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
  };
  if (!['GET', 'HEAD'].includes(req.method) && req.body != null) {
    init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  }

  try {
    const r = await fetch(target, init);
    const text = await r.text();
    res.status(r.status).setHeader('Content-Type', 'application/json');
    return res.send(text);
  } catch (e) {
    return res.status(502).send('Error al contactar Airtable: ' + e.message);
  }
}
