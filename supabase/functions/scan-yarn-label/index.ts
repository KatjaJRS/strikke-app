// Læser en garnbanderole med Gemini. API-nøglen ligger kun som hemmelighed i Supabase.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_IMAGE_CHARS = 3_000_000;
const MAX_IMAGES = 4;
const MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash'];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Kun indloggede brugere må bruge funktionen; anon-nøglen alene er ikke nok.
async function isSignedIn(authHeader: string | null) {
  if (!authHeader) return false;
  const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, {
    headers: { Authorization: authHeader, apikey: Deno.env.get('SUPABASE_ANON_KEY') || '' },
  });
  return response.ok;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  if (!(await isSignedIn(req.headers.get('Authorization')))) {
    return json({ error: 'Not signed in' }, 401);
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return json({ error: 'AI is not configured' }, 500);

  let images: unknown = [];
  try {
    const body = await req.json();
    images = Array.isArray(body?.images) ? body.images : [body?.image];
  } catch {
    return json({ error: 'Invalid request' }, 400);
  }

  const imageParts = [];
  const imageList = images as unknown[];
  if (imageList.length < 1 || imageList.length > MAX_IMAGES) {
    return json({ error: 'Invalid number of images' }, 400);
  }
  for (const image of imageList) {
    const match = typeof image === 'string' && image.length <= MAX_IMAGE_CHARS
      ? /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(image)
      : null;
    if (!match) return json({ error: 'Invalid or too large image' }, 400);
    imageParts.push({ inline_data: { mime_type: match[1], data: match[2] } });
  }

  const prompt = `Læs teksten på billedet${imageParts.length > 1 ? 'erne' : ''} af garnbanderolen. ${imageParts.length > 1 ? 'Billederne viser den samme banderole fra forskellige dele eller sider; kombinér oplysningerne fra alle billeder. ' : ''}Svar kun med de fem felter i JSON-skemaet.
Vigtigt: Placér kun hver oplysning i feltet, der beskriver den. Udled eller opfind ikke oplysninger.
- type: garnets produktnavn og mærke, fx "Drops Merino Extra Fine". Medtag ikke farve, gram, meter eller fiberprocenter her.
- group: den angivne garnvægt-/garngruppe, fx fingering, sport, DK, worsted, chunky eller en nummereret gruppe. Lad feltet være tomt, hvis gruppen ikke står på etiketten.
- color: kun farvenavn og farve-/partinummer. Lad feltet være tomt, hvis det ikke kan læses.
- amount: kun vægt og løbelængde, fx "50 g / 175 m". Lad feltet være tomt, hvis det ikke kan læses.
- details: fiberindhold, anbefalet pindestørrelse, strikkefasthed og vaskeanvisning, kort adskilt med " · ".
Bevar tal og enheder nøjagtigt som på etiketten. Skriv oplysninger på dansk, men behold produktnavne og officielle farvenavne som trykt.`;

  const requestBody = JSON.stringify({
    contents: [{
      parts: [
        { text: prompt },
        ...imageParts,
      ],
    }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 512,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          type: { type: 'STRING' },
          group: { type: 'STRING' },
          color: { type: 'STRING' },
          amount: { type: 'STRING' },
          details: { type: 'STRING' },
        },
        required: ['type', 'group', 'color', 'amount', 'details'],
      },
    },
  });

  // Ved midlertidig overbelastning prøves modellen igen, derefter næste model.
  let geminiResponse: Response | null = null;
  let lastStatus = 0;
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 1500));
      geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: requestBody,
        },
      );
      if (geminiResponse.ok) break;

      lastStatus = geminiResponse.status;
      let errorMessage = '';
      try {
        const errorBody = await geminiResponse.json();
        errorMessage = String(errorBody?.error?.message || '').slice(0, 300);
      } catch (error) {
        console.error('Could not read Gemini error response:', error);
      }
      console.error('Gemini request failed:', { status: lastStatus, message: errorMessage, model });
      if (![429, 500, 503, 504].includes(lastStatus)) break;
    }
    if (geminiResponse?.ok || ![404, 429, 500, 503, 504].includes(lastStatus)) break;
  }

  if (!geminiResponse || !geminiResponse.ok) {
    if (lastStatus === 404) return json({ error: 'GEMINI_MODEL_NOT_FOUND' }, 502);
    if (lastStatus === 429) return json({ error: 'GEMINI_RATE_LIMITED' }, 503);
    if (lastStatus === 503 || lastStatus === 504) return json({ error: 'GEMINI_BUSY' }, 503);
    return json({ error: 'AI request failed' }, 502);
  }

  try {
    const data = await geminiResponse.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const parsed = JSON.parse(text);
    const clean = (value: unknown) => String(value ?? '').trim().slice(0, 300);
    return json({
      type: clean(parsed.type),
      group: clean(parsed.group),
      color: clean(parsed.color),
      amount: clean(parsed.amount),
      details: clean(parsed.details),
    });
  } catch {
    return json({ error: 'Could not read the AI answer' }, 502);
  }
});
