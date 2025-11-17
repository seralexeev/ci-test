import { setOutput } from "@actions/core";
import { WebClient } from "@slack/web-api";
import z from "zod";

const env = z
  .object({
    SLACK_TOKEN: z.string().min(1),
  })
  .parse(process.env);

const web = new WebClient(env.SLACK_TOKEN);

const res = await web.chat.postMessage({
  channel: "C09TFU78Y3S",
  text: ":sherpa-excited: CI job notification",
});

if (res.ts == null) {
  throw new Error(`Failed to send Slack notification: ${res.error}`);
}

setOutput("slack_ts", res.ts);
