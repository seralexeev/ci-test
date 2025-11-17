import { setOutput } from "@actions/core";
import { WebClient } from "@slack/web-api";
import z from "zod";

const env = z
  .object({
    ACTION_URL: z.string().min(1),
    SLACK_TOKEN: z.string().min(1),
    STATUS: z.enum(["started", "success", "failure"]),
    MESSAGE_TS: z.string().optional(),
    SHA: z.string().min(1),
  })
  .parse(process.env);

const web = new WebClient(env.SLACK_TOKEN);

const statusConfig = {
  started: {
    emoji: ":sherpa-excited:",
    title: "[staging] deployment started",
  },
  success: {
    emoji: ":sherpa-sparkle:",
    title: "[staging] deployment successful",
  },
  failure: {
    emoji: ":sherpa-on-fire:",
    title: "[staging] deployment failed",
  },
} as const;

const buildMessage = () => {
  const status = env.STATUS;
  const config = statusConfig[status];
  const timestamp = new Date().toLocaleString("en-AU", {
    timeZone: "Australia/Sydney",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const timeLabel = status === "started" ? "Started" : "Finished";

  return {
    text: `${config.emoji} ${config.title}`,
    blocks: [
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `App:\n*web-api*`,
          },
          {
            type: "mrkdwn",
            text: `Environment:\n*staging*`,
          },
          {
            type: "mrkdwn",
            text: `Status:\n*${
              status.charAt(0).toUpperCase() + status.slice(1)
            }*`,
          },
          {
            type: "mrkdwn",
            text: `${timeLabel}:\n*${timestamp}*`,
          },
        ],
      },
      { type: "divider" },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `<${env.ACTION_URL}|View Workflow Run>`,
          },
          {
            type: "mrkdwn",
            text: `<${env.SHA}|View Commit> ${env.SHA.substring(0, 7)}`,
          },
        ],
      },
    ],
  };
};

if (env.STATUS === "started") {
  const message = buildMessage();
  const res = await web.chat.postMessage({
    channel: "C09TFU78Y3S",
    ...message,
  });

  if (res.ts == null) {
    throw new Error(`Failed to send Slack notification: ${res.error}`);
  }

  setOutput("message_ts", res.ts);
} else {
  if (env.MESSAGE_TS == null) {
    throw new Error(`MESSAGE_TS is required when STATUS is ${env.STATUS}`);
  }

  const message = buildMessage();
  await web.chat.update({
    channel: "C09TFU78Y3S",
    ts: env.MESSAGE_TS,
    ...message,
  });
}
