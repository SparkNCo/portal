import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { getErrorMessage } from '../_shared/helpers.ts';
import axios from 'npm:axios';

const JIRA_API_KEY = Deno.env.get('JIRA_API_KEY');
const JIRA_EMAIL = Deno.env.get('JIRA_EMAIL'); // Email used for Jira
const JIRA_BASE_URL = Deno.env.get('JIRA_BASE_URL');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { params, method = 'GET', body: requestBody } = body;
    const endpoint = params?.endpoint;

    if (!endpoint) {
      throw new Error('Endpoint is required');
    }

    const url = `${JIRA_BASE_URL}/${endpoint}`;

    // We need to use Base64 for encoding the email and API key for Authorization, since Jira requires it and it will throw unauthorized otherwise.
    const authHeader = `Basic ${btoa(`${JIRA_EMAIL}:${JIRA_API_KEY}`)}`;

    const config = {
      method,
      url,
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      timeout: 240000,
    };

    if (method !== 'GET' || method !== 'DELETE') {
      config.data = requestBody;
    }

    const { data } = await axios(config);
    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error('Error while calling Jira API:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
