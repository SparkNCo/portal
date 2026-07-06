// @ts-nocheck
import { createQuestion } from "./createQuestion.ts";
import { getQuestions } from "./getQuestions.ts";
import { markRead } from "./markRead.ts";
import { serveWithCors } from "../utils/serve.ts";

serveWithCors("issue-questions Error", async (req) => {
  const pathname = new URL(req.url).pathname;

  if (req.method === "GET") {
    return await getQuestions(req);
  }
  if (req.method === "POST" && pathname.endsWith("/read")) {
    return await markRead(req);
  }
  if (req.method === "POST") {
    return await createQuestion(req);
  }
  return Response.json({ error: "Method not allowed" }, { status: 405 });
});
