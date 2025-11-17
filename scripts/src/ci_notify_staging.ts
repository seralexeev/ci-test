import { setOutput } from "@actions/core";
import { WebClient } from "@slack/web-api";
import z from "zod";

const env = z
  .object({
    APP_NAME: z.string().min(1),
    RUN_ID: z.string().min(1),
    GITHUB_URL: z.string().min(1),
    SLACK_TOKEN: z.string().min(1),
    STATUS: z.enum(["started", "success", "failure"]),
    MESSAGE_TS: z.string().optional(),
    SHA: z.string().min(1),
  })
  .parse(process.env);

const environment = "staging";
const channel = "C09TFU78Y3S";
const web = new WebClient(env.SLACK_TOKEN);

const emojiMap: Record<typeof env.STATUS, string> = {
  started: ":sherpa-excited:",
  success: ":sherpa-sparkle:",
  failure: ":sherpa-on-fire:",
};

const buildMessage = () => {
  const status = env.STATUS;
  const timestamp = new Date().toLocaleString("en-AU", {
    timeZone: "Australia/Sydney",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const timeLabel = status === "started" ? "Started" : "Finished";
  const emoji = emojiMap[status];
  const title = `${emoji} *${env.APP_NAME}* \`${environment}\` deployment *${env.STATUS}*`;
  const shaShort = env.SHA.substring(0, 7);

  return {
    text: title,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: title } },
      { type: "divider" },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*App:*\n${env.APP_NAME}` },
          { type: "mrkdwn", text: `*Environment:*\n\`${environment}\`` },
          { type: "mrkdwn", text: `*Status:*\n\`${status}\`` },
          { type: "mrkdwn", text: `*${timeLabel}:*\n${timestamp}` },
        ],
      },
      { type: "divider" },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `<${env.GITHUB_URL}/actions/runs/${env.RUN_ID}|Workflow>`,
          },
          {
            type: "mrkdwn",
            text: `<${env.GITHUB_URL}/commit/${env.SHA}|${shaShort}>`,
          },
        ],
      },
    ],
  };
};

if (env.STATUS === "started") {
  const message = buildMessage();
  const res = await web.chat.postMessage({ channel, ...message });
  if (res.ts == null) {
    throw new Error(`Failed to send Slack notification: ${res.error}`);
  }

  setOutput("message_ts", res.ts);
} else {
  if (env.MESSAGE_TS == null) {
    throw new Error(`MESSAGE_TS is required when STATUS is ${env.STATUS}`);
  }

  const message = buildMessage();
  const res = await web.chat.update({
    channel,
    ts: env.MESSAGE_TS,
    ...message,
  });

  if (res.ok === false) {
    throw new Error(`Failed to update Slack notification: ${res.error}`);
  }
}
