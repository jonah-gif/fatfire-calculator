/**
 * /api/submit.js — FatFIRE Calculator Lead Capture
 * Vercel serverless function (Node.js 20)
 *
 * UPDATED: Now captures UTM parameters and passes to GHL
 */

const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;
const PIPELINE_ID = 'dGPOo5EyspFfEBAham7N'; // Leads pipeline
const STAGE_ID = '00cbc90a-d360-473d-bcf3-0986100a212c'; // New stage
const GHL_BASE = 'https://services.leadconnectorhq.com';

function ghlHeaders() {
  return {
    'Authorization': `Bearer ${GHL_API_KEY}`,
    'Content-Type': 'application/json',
    'Version': '2021-07-28',
  };
}

async function ghlPost(path, body) {
  const res = await fetch(`${GHL_BASE}${path}`, {
    method: 'POST',
    headers: ghlHeaders(),
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`GHL POST ${path} ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

function buildNote(d) {
  const fmt = n => isNaN(n) ? n : '$' + Number(n).toLocaleString('en-CA');
  const pct = n => isNaN(n) ? n : (Number(n) * 100).toFixed(2) + '%';

  return [
    '=== FatFIRE Calculator Lead ===',
    `Submitted: ${new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto' })}`,
    '',
    '--- Profile ---',
    `Age: ${d.currentAge}`,
    `Province: ${d.province}`,
    `Annual Income: ${fmt(d.annualIncome)}`,
    `Current Savings: ${fmt(d.currentSavings)}`,
    `Retirement Expenses: ${fmt(d.retirementExpenses)}`,
    '',
    '--- FatFIRE Number ---',
    `Target: ${fmt(d.fatfireTarget)}`,
    `Standard Path: FatFIRE at age ${d.scenarioAAge}`,
    '',
    '--- Mortgage Inputs ---',
    `Balance: ${fmt(d.mortgageBalance)}`,
    `Rate: ${pct(d.mortgageRate)}`,
    `Amortization: ${d.mortgageAmort} years`,
    `HELOC Available: ${fmt(d.heloc)}`,
    '',
    '--- With Freedom Accelerator ---',
    `FatFIRE at age ${d.scenarioBAge} (${d.yearsSooner} year${d.yearsSooner !== 1 ? 's' : ''} sooner)`,
    `Interest Saved: ${fmt(d.interestSaved)}`,
    `SM Tax Benefit: ${fmt(d.smTaxBenefit)}`,
    `Lifetime Payments Freed: ${fmt(d.lifetimeFreed)}`,
    '',
    '--- UTM Tracking ---',
    `Source: ${d.utm_source || 'direct'}`,
    `Medium: ${d.utm_medium || '(none)'}`,
    `Campaign: ${d.utm_campaign || '(none)'}`,
    `Content: ${d.utm_content || '(none)'}`,
    `Term: ${d.utm_term || '(none)'}`,
    '',
    'Source: fatfirecalculator.com',
  ].join('\n');
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  let data;
  try {
    data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { firstName, email } = data || {};
  if (!firstName || !email) {
    return res.status(400).json({ error: 'firstName and email are required' });
  }

  // Extract UTM parameters
  const utmSource = data.utm_source || '';
  const utmMedium = data.utm_medium || '';
  const utmCampaign = data.utm_campaign || '';
  const utmContent = data.utm_content || '';
  const utmTerm = data.utm_term || '';

  try {
    // 1. Upsert contact — now includes UTM as custom fields
    const contactBody = {
      firstName,
      email,
      locationId: GHL_LOCATION_ID,
      source: 'FatFIRE Calculator',
      tags: ['fatfire-calculator', 'calculator-lead'],
    };

    // Add UTM custom fields if any are present
    const utmFields = [
      { key: 'utm_source', field_value: utmSource },
      { key: 'utm_medium', field_value: utmMedium },
      { key: 'utm_campaign', field_value: utmCampaign },
      { key: 'utm_content', field_value: utmContent },
      { key: 'utm_term', field_value: utmTerm },
    ].filter(f => f.field_value);

    if (utmFields.length > 0) {
      contactBody.customFields = utmFields;
    }

    const contactRes = await ghlPost('/contacts/upsert', contactBody);

    const contactId = contactRes.contact?.id;
    if (!contactId) throw new Error('No contact ID from GHL');

    // 2. Add note
    await ghlPost(`/contacts/${contactId}/notes`, {
      body: buildNote(data),
    });

    // 3. Create opportunity
    await ghlPost('/opportunities/', {
      pipelineId: PIPELINE_ID,
      locationId: GHL_LOCATION_ID,
      name: `${firstName} — FatFIRE Calculator`,
      pipelineStageId: STAGE_ID,
      status: 'open',
      contactId,
      source: 'FatFIRE Calculator',
    });

    return res.status(200).json({ success: true, contactId });
  } catch (err) {
    console.error('[FatFIRE submit error]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
