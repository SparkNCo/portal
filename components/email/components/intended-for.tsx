import { Text } from '@react-email/components';

type IntendedForProps = {
  recipientEmail: string;
};
export const IntendedFor = ({ recipientEmail }: IntendedForProps) => {
  return (
    <Text className="text-[#666666] text-[12px] leading-[24px]">
      This email was intended for{' '}
      <span className="text-black font-semibold">{recipientEmail}</span>. If you
      were not expecting this invitation, you can ignore this email. If you are
      concerned about your account's safety, please reply to:{' '}
      <a
        href="mailto:kabir.malkani97@gmail.com"
        className="text-black font-semibold no-underline"
      >
        kabir.malkani97@gmail.com
      </a>{' '}
      to get in touch with us.
    </Text>
  );
};
