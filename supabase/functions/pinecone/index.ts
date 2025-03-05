import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { getErrorMessage } from '../_shared/helpers.ts';
// const PINECONE_API_KEY = Deno.env.get("PINECONE_API_KEY");
import axios from 'npm:axios';

const PINECONE_API_KEY = Deno.env.get('PINECONE_API_KEY');
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { params, body: restBody } = body;
    const index = params?.index;
    const endpoint = params?.endpoint;
    const { data } = await axios.post(
      `https://${index}-ido9773.svc.aped-4627-b74a.pinecone.io/${endpoint}`,
      restBody,
      {
        headers: {
          'Api-Key': `${PINECONE_API_KEY}`,
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
    console.error('Error while calling PINECONE:', errorMessage);
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
