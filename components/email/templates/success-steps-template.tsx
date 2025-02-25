import {
  Container,
  Heading,
  Hr,
  Img,
  Link,
  Row,
  Section,
  Text,
  Column,
  Button,
} from '@react-email/components';
import { Layout } from '../components/layout';
import * as React from 'react';
import { WhyUs } from '../components/why-us';
import { Footer } from '../components/footer';
import { getURL } from '@/utils/helpers';
interface EmailProps {
  recipientName: string;
  callDate: string;
  proposalId: string;
}

const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : '';

export const component = ({
  recipientName,
  callDate,
  proposalId,
}: EmailProps) => (
  <>
    <Section className="px-3">
      <Container className="py-8">
        <Row className="w-fit ">
          <Column className=" ">
            <Img
              src={`https://res.cloudinary.com/db7wpgkge/image/upload/v1740512947/portal/rfirfgdpcw64wbzqdhgu.png`}
              alt="Spark & Co Logo"
            />
          </Column>
        </Row>
      </Container>
    </Section>

    <Section className="bg-white pb-4 px-3">
      <Container className="">
        <Hr className="my-4 border-gray-300 pb-4" />
        <Section>
          <Heading as="h3" className="text-base font-semibold text-gray-900">
            Hey {recipientName}!
          </Heading>
        </Section>
        <Text className="text-gray-700 text-base">
          Thank you for your interest in working with{' '}
          <strong>Spark & Co</strong> for your next software project. We’ve
          taken the liberty of breaking down your project idea into a list of
          requirements.
          <br />
          Please take a look and and make any edits you like before our call on{' '}
          <strong>{callDate}</strong>. The better we understand your vision, the
          more successful your project will be.
        </Text>
      </Container>
    </Section>

    <Section className="rounded-md pb-12  px-3">
      <Container>
        <Button
          className="box-border w-full rounded-[8px] bg-logo px-[12px] py-[12px] text-center font-semibold text-white"
          href={getURL(`proposals/${proposalId}`)}
        >
          Go to Spark & Co <span className="pl-2">↗</span>
        </Button>{' '}
      </Container>
    </Section>
  </>
);

const SuccessStepsEmailTemplate = (props: EmailProps) => {
  return <Layout>{component(props)}</Layout>;
};

export default SuccessStepsEmailTemplate;
