import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { getErrorMessage } from '../_shared/helpers.ts';
import axios from 'npm:axios';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    const body = await req.json();
    const { template, sender, recipients, subject } = body;

    const { data } = await axios.post(
      'https://api.resend.com/emails',
      {
        from: sender,
        to: recipients,
        subject: subject,
        html: template,
      },
      {
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 240000,
      }
    );

    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error('Error while sending email:', errorMessage);
    return new Response(
      JSON.stringify({
        error:
          'There was an error while processing your request. Please try again later.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
