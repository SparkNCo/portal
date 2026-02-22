import { request, gql } from "https://esm.sh/graphql-request@5.1.0";

const LINEAR_API_KEY = Deno.env.get("LINEAR_API_KEY")!;

export const linearClient = {
  client: {
    async request(query: string, variables: Record<string, any> = {}) {
      const res = await fetch("https://api.linear.app/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${LINEAR_API_KEY}`,
        },
        body: JSON.stringify({ query, variables }),
      });

      if (!res.ok) throw new Error(`Linear API error: ${res.statusText}`);
      return await res.json();
    },
  },
};
