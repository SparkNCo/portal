import { getErrorMessage } from '@/utils/helpers';
import { Resend } from 'resend';
import { supabase } from '../supabase/client';

export async function sendEmail({
  template,
  recipients,
  subject,
  sender = 'support@rentscape.co',
  onlyProd = false,
}: {
  template: string;
  recipients: string[];
  subject: string;
  sender?: string;
  onlyProd?: boolean;
}): Promise<{ error: string | null }> {
  if (!recipients.length) {
    return {
      error: 'No recipients provided.',
    };
  }
  if (onlyProd ? process.env.PRODUCTION : true) {
    const { data, error } = await supabase.functions.invoke('resend', {
      body: {
        template,
        recipients,
        subject,
        sender,
      },
    });
    if (error) {
      const errorMessage = getErrorMessage(error);
      return {
        error: errorMessage,
      };
    }
  }
  return {
    error: null,
  };
}

// if (
//   process.env.NEXT_PUBLIC_RESEND_KEY &&
//   (!onlyProd || process.env.PRODUCTION)
// ) {
//   // const resend = new Resend(process.env.NEXT_PUBLIC_RESEND_KEY);
//   const resend = new Resend('re_4YDa9Y14_DFG3rADeEC9pWfUoA2eFKoUK');
//   response = await resend.emails.send({
//     from: sender,
//     to: recipients,
//     subject,
//     html: template,
//   });
//   if (response?.error) {
//     console.log(response?.error);
//     const errorMessage = getErrorMessage(response?.error);
//     return {
//       error: errorMessage,
//     };
//   } else {
//     return {
//       error: null,
//     };
//   }
// } else {
//   if (!process.env.NEXT_PUBLIC_RESEND_KEY) {
//     console.log('No RESEND API_KEY found.');
//   }
//   if (process.env.NEXT_PUBLIC_RESEND_KEY && onlyProd) {
//     console.log(
//       'onlyProd is true, this email will not be sent in dev environments.'
//     );
//   }
//   return {
//     error: null,
//   };
// }
