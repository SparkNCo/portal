// @ts-nocheck
import { z } from "https://esm.sh/zod@3.23.8";

export const USER_INITIATIVES_QUERY = `
query GetUserInitiatives($email: String!) {
  users(filter: { email: { eq: $email } }) {
    nodes {
      id
      name
      email
      initiatives {
        nodes {
          id
          name
          projects {
            nodes {
              id
              name
              description
            }
          }
        }
      }
    }
  }
}
`;

export const GetUserRoadmapQuerySchema = z.object({
  email: z.string().email(),
});

export const UserRoadmapResponseSchema = z.object({
  users: z.object({
    nodes: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
        initiatives: z.object({
          nodes: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              projects: z.object({
                nodes: z.array(
                  z.object({
                    id: z.string(),
                    name: z.string(),
                    description: z.string().nullable(),
                  }),
                ),
              }),
            }),
          ),
        }),
      }),
    ),
  }),
});
