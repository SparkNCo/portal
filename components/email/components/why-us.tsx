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
import * as React from 'react';
export const WhyUs = ({}) => {
  return (
    <Section className="bg-gray-50 px-6 mx-3 py-4 space-y-4 rounded-md">
      <Container>
        <Heading as="h2" className="text-xl font-semibold text-gray-900 mb-4">
          Why Choose Spark & Co?
        </Heading>

        {[
          {
            title: 'Innovation',
            icon: 'heart-icon.png',
            text: 'We are at the forefront of software innovation, continuously exploring and implementing the latest technologies.',
          },
          {
            title: 'Expertise',
            icon: 'rocket-icon.png',
            text: 'Our team comprises seasoned professionals with a wealth of experience in software development and business solutions.',
          },
          {
            title: 'Customer Focus',
            icon: 'megaphone-icon.png',
            text: "We prioritize our clients' needs, delivering tailored solutions that align with their unique objectives.",
          },
          {
            title: 'Reliability',
            icon: 'megaphone-icon.png',

            text: 'We ensure that every project is delivered on time and meets the highest quality standards.',
          },
        ].map(({ title, icon, text }, index) => (
          <Row key={index} className="mt-4">
            <Column className="align-center">
              <Img
                alt={`${title} icon`}
                height="48"
                src={`https://react.email/static/${icon}`}
                width="48"
              />
            </Column>
            <Column colSpan={1} className="align-baseline pl-4">
              <Text className="m-0 mt-4 text-lg font-semibold leading-6 text-gray-900">
                {title}
              </Text>
              <Text className="mt-2 text-sm leading-5 text-gray-500">
                {text}
              </Text>
            </Column>
          </Row>
        ))}
      </Container>
    </Section>
  );
};
