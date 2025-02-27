import SuccessStepsEmailTemplate from '@/components/email/templates/success-steps-template';
import { sendEmail } from '@/lib/repositories/send-email';
import { ErrorSuccessResponseMessage } from '@/lib/types/utils/functions-return-type';
import { render } from '@react-email/components';

export const sendSuccessEmailFn = async ({
  client_email,
  client_name,
  proposal_id,
  call_date,
}: {
  client_email: string;
  client_name: string;
  proposal_id: string;
  call_date: string;
}): Promise<ErrorSuccessResponseMessage> => {
  const template = await render(
    SuccessStepsEmailTemplate({
      callDate: call_date,
      recipientName: client_name,
      proposalId: proposal_id,
      // callDate: '2023-01-01',
      // recipientName: 'John Doe',
      // proposalId: '9c8bcc75-f0f0-4189-b3b1-c39da6068237',
    })
  );
  const { error } = await sendEmail({
    template,
    recipients: [client_email],
    // recipients: ['gastibarossi@gmail.com'],
    subject: 'Success Steps',
  });
  return {
    error: null,
    success: 'Email sent successfully',
  };
};
