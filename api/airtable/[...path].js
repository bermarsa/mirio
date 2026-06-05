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
    res.setHeader('x-mirio-auth', 'rejected');
    return res.status(401).send('No autorizado');
  }

  // 3) Reconstruir la ruta hacia Airtable (robusto: usa la URL completa)
  const parsed = new URL(req.url, 'http://x');
  let sub = parsed.pathname.replace(/^\/api\/airtable\/?/, '').replace(/^\/+/, '');
  if (!sub && req.query && req.query.path) {
    sub = Array.isArray(req.query.path) ? req.query.path.join('/') : String(req.query.path);
  }
  if (!sub) return res.status(400).send('Ruta vacía (url=' + req.url + ')');

  const params = parsed.searchParams;
  params.delete('path'); // parámetro interno del catch-all, no va a Airtable
  const qs = params.toString();
  const target = `https://api.airtable.com/v0/${BASE_ID}/${sub}${qs ? '?' + qs : ''}`;

  // 4) Reenviar a Airtable con el token real
  const init = {
    method: req.method,
    headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` },
  };
  // Solo POST/PATCH/PUT llevan cuerpo; DELETE/GET/HEAD van limpios
  if (!['GET', 'HEAD', 'DELETE'].includes(req.method) && req.body != null) {
    init.headers['Content-Type'] = 'application/json';
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
