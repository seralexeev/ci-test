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

const res = await web.chat.postMessage({
  channel: "C12345678",
  text: "Release deployed",
  mrkdwn: true,
  blocks: [
    {
      type: "header",
      text: { type: "plain_text", text: ":sherpa-excited:" },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: md },
    },
  ],
});

if (res.ts == null) {
  throw new Error(`Failed to send Slack notification: ${res.error}`);
}

setOutput("slack_ts", res.ts);
