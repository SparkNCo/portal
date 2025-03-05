import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { GPTResponseBody } from '../_shared/types.ts';
import { getErrorMessage } from '../_shared/helpers.ts';
// const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
import axios from 'npm:axios';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: GPTResponseBody = await req.json();
    const { endpoint, ...restBody } = body;
    const { data } = await axios.post(
      `https://api.openai.com/v1/${endpoint}`,
      restBody,
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 240000,
      }
    );
    return new Response(
      JSON.stringify({
        data,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error('Error while calling OpenAI:', errorMessage);
    return new Response(
      JSON.stringify({
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
