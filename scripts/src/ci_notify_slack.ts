import { setOutput } from "@actions/core";
import { WebClient } from "@slack/web-api";
import z from "zod";

const env = z
  .object({
    SLACK_TOKEN: z.string().min(1),
  })
  .parse(process.env);

const web = new WebClient(env.SLACK_TOKEN);

const md = `
## What's Changed
* pr 30 by @seralexeev in https://github.com/seralexeev/ci-test/pull/28
* pr 31 by @seralexeev in https://github.com/seralexeev/ci-test/pull/29
* pr 32 by @seralexeev in https://github.com/seralexeev/ci-test/pull/30
* pr 33 by @seralexeev in https://github.com/seralexeev/ci-test/pull/31
* pr 35 by @seralexeev in https://github.com/seralexeev/ci-test/pull/32
* pr 36 by @seralexeev in https://github.com/seralexeev/ci-test/pull/33


**Full Changelog**: https://github.com/seralexeev/ci-test/compare/web-api/release/0.0.5...tags/web-api/draft
`;

function convertGitHubMarkdownToSlack(markdown: string) {
  let converted = markdown;

  // Convert headers (## Header -> *Header*)
  converted = converted.replace(/^##\s+(.+)$/gm, "*$1*\n");

  // Convert markdown links [text](url) to Slack format <url|text>
  converted = converted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<$2|$1>");

  // Convert bold **text** to *text* (Slack uses single asterisks)
  converted = converted.replace(/\*\*([^*]+)\*\*/g, "*$1*");

  // Clean up excessive newlines (more than 2 consecutive)
  converted = converted.replace(/\n{3,}/g, "\n\n");

  // Trim whitespace
  converted = converted.trim();

  return converted;
}

const res = await web.chat.postMessage({
  channel: "C09TFU78Y3S",
  text: "Release deployed",
  mrkdwn: true,
  blocks: [
    {
      type: "header",
      text: { type: "plain_text", text: ":sherpa-excited:" },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: convertGitHubMarkdownToSlack(md) },
    },
  ],
});

if (res.ts == null) {
  throw new Error(`Failed to send Slack notification: ${res.error}`);
}

setOutput("slack_ts", res.ts);
