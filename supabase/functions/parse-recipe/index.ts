import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ParseRequest {
  text: string;
  type: "ingredients" | "steps";
}

interface ParsedIngredient {
  name: string;
  amount: number | null;
  unit: string;
}

interface ParsedStep {
  description: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const { text, type }: ParseRequest = await req.json();

    if (!text || !type) {
      throw new Error("Missing text or type parameter");
    }

    const systemPrompt = type === "ingredients"
      ? `Je bent een assistent die ingrediënten uit tekst extraheert.
Parse de tekst en geef een JSON array terug met objecten die de volgende velden hebben:
- name: string (ingrediënt naam zonder hoeveelheid/eenheid)
- amount: number | null (numerieke hoeveelheid, null als niet gespecificeerd)
- unit: string (eenheid zoals "g", "ml", "el", "tl", "stuks", etc. Leeg als geen eenheid)

Voorbeelden:
"500g pasta" → { "name": "pasta", "amount": 500, "unit": "g" }
"2 eieren" → { "name": "eieren", "amount": 2, "unit": "stuks" }
"zout naar smaak" → { "name": "zout", "amount": null, "unit": "" }
"1 el olijfolie" → { "name": "olijfolie", "amount": 1, "unit": "el" }`
      : `Je bent een assistent die bereidingsstappen uit tekst extraheert.
Parse de tekst en geef een JSON array terug met objecten die het volgende veld hebben:
- description: string (de bereidingsstap als volledige zin)

Splits de tekst in logische stappen. Elke stap moet een duidelijke actie beschrijven.`;

    const userPrompt = `Parse de volgende tekst:\n\n${text}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error("No response from OpenAI");
    }

    // Parse the JSON response
    const parsed = JSON.parse(content);
    
    // Extract the array (it might be wrapped in an object like { "ingredients": [...] } or { "steps": [...] })
    let items: (ParsedIngredient | ParsedStep)[];
    if (Array.isArray(parsed)) {
      items = parsed;
    } else if (parsed.ingredients) {
      items = parsed.ingredients;
    } else if (parsed.steps) {
      items = parsed.steps;
    } else {
      // Try to find an array in the response
      const values = Object.values(parsed);
      const arrayValue = values.find((v) => Array.isArray(v));
      items = arrayValue as (ParsedIngredient | ParsedStep)[] || [];
    }

    return new Response(JSON.stringify({ items }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

