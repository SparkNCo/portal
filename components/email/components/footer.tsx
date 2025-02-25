import {
  Container,
  Heading,
  Hr,
  Img,
  Link,
  Section,
  Text,
} from '@react-email/components';
import { Layout } from '../components/layout';
import * as React from 'react';
import { IntendedFor } from './intended-for';
export const Footer = () => {
  return (
    <Section className="bg-gray-50 px-6 mx-3 mb-4 py-4 rounded-md">
      <Container>
        <Text className="text-gray-600 text-sm">
          &copy; {new Date().getFullYear()} Spark & Co. All rights reserved.
          <Link
            href="https://example.com/unsubscribe"
            className="ml-2 text-indigo-600 underline"
          >
            Unsubscribe
          </Link>
        </Text>
      </Container>
    </Section>
  );
};
