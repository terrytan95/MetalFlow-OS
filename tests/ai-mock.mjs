// Test-only OpenAI-compatible server. Never receives real credentials.
import http from "node:http";
import console from "node:console";
const server = http.createServer(async (req, res) => {
  if (req.url === "/health") {
    res.end("ok");
    return;
  }
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 1000000) {
      res.writeHead(413).end();
      return;
    }
  }
  const key = (req.headers.authorization || "").replace("Bearer ", "");
  const fail = (status, code) => {
    res.writeHead(status, {
      "content-type": "application/json",
      "retry-after": "120",
    });
    res.end(
      JSON.stringify({
        error: {
          message: `Test-only provider response (${key})`,
          type: code,
          code,
        },
      }),
    );
  };
  if (key.includes("rate")) return fail(429, "rate_limit_exceeded");
  if (key.includes("quota")) return fail(429, "insufficient_quota");
  if (key.includes("invalid")) return fail(401, "invalid_api_key");
  if (key.includes("server")) return fail(503, "server_error");
  if (key.includes("badrequest")) return fail(400, "invalid_request");
  const input = JSON.parse(body || "{}");
  const jsonText = key.includes("malformed")
    ? "{broken json"
    : input.response_format || input.text?.format
      ? JSON.stringify({
          material: "Stainless steel",
          grade: "304",
          profile: "square tube",
          widthMm: 40,
          heightMm: 40,
          thicknessMm: 2,
          lengthMm: 6000,
          quantity: 100,
          unit: "piece",
          missing: [],
          uncertainties: [],
        })
      : "OK: synthetic provider response";
  res.writeHead(200, {
    "content-type": "application/json",
    ...(key.includes("empty")
      ? {
          "x-ratelimit-remaining-tokens": "0",
          "x-ratelimit-reset-tokens": "2m",
        }
      : {}),
  });
  if (req.url === "/v1/chat/completions")
    res.end(
      JSON.stringify({
        id: "chat-test",
        object: "chat.completion",
        created: 1,
        model: input.model,
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: jsonText },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
      }),
    );
  else if (req.url === "/v1/responses")
    res.end(
      JSON.stringify({
        id: "resp-test",
        object: "response",
        created_at: 1,
        status: "completed",
        model: input.model,
        output: [
          {
            id: "msg-test",
            type: "message",
            status: "completed",
            role: "assistant",
            content: [{ type: "output_text", text: jsonText, annotations: [] }],
          },
        ],
        usage: { input_tokens: 11, output_tokens: 7, total_tokens: 18 },
      }),
    );
  else res.end(JSON.stringify({ error: "Unsupported mock path" }));
});
server.listen(8080, "0.0.0.0", () => console.log("Test-only AI server ready"));
