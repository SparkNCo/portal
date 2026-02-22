declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};