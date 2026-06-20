// /api/verify-code.js
// Vercel Serverless Function - verifies and activates access codes against Supabase

const SUPABASE_URL = 'https://vsvbxuzaypwdbxuegsll.supabase.co';
const SUPABASE_KEY = 'sb_publishable_TfDVmmrvxc-jthBAR32iMw_wfgn_gfC';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { code, deviceId } = req.body || {};

    if (!code || !deviceId) {
      return res.status(400).json({ ok: false, error: 'missing_params' });
    }

    const cleanCode = String(code).trim();

    const lookupUrl = `${SUPABASE_URL}/rest/v1/codes_acces?code=eq.${encodeURIComponent(cleanCode)}&select=code,appareil_id`;
    const lookupRes = await fetch(lookupUrl, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (!lookupRes.ok) {
      return res.status(500).json({ ok: false, error: 'supabase_error' });
    }

    const rows = await lookupRes.json();

    if (!rows || rows.length === 0) {
      return res.status(200).json({ ok: false, error: 'invalid_code' });
    }

    const row = rows[0];

    if (row.appareil_id && row.appareil_id !== deviceId) {
      return res.status(200).json({ ok: false, error: 'code_already_used' });
    }

    if (row.appareil_id && row.appareil_id === deviceId) {
      return res.status(200).json({ ok: true, alreadyActivated: true });
    }

    const updateUrl = `${SUPABASE_URL}/rest/v1/codes_acces?code=eq.${encodeURIComponent(cleanCode)}`;
    const updateRes = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        appareil_id: deviceId,
        date_activation: new Date().toISOString()
      })
    });

    if (!updateRes.ok) {
      return res.status(500).json({ ok: false, error: 'activation_failed' });
    }

    return res.status(200).json({ ok: true, alreadyActivated: false });

  } catch (err) {
    return res.status(500).json({ ok: false, error: 'server_error', detail: String(err) });
  }
          }
