import { setOutput } from "@actions/core";
import { WebClient } from "@slack/web-api";
import z from "zod";

const env = z
  .object({
    ACTION_URL: z.string().min(1),
    SLACK_TOKEN: z.string().min(1),
    STATUS: z.enum(["started", "success", "failure"]),
    MESSAGE_TS: z.string().optional(),
  })
  .parse(process.env);

const web = new WebClient(env.SLACK_TOKEN);

const statusConfig = {
  started: {
    emoji: ":sherpa-excited:",
    title: "Staging Deployment Started",
    color: "#2196F3", // Blue
    statusEmoji: "🔵",
  },
  success: {
    emoji: ":sherpa-sparkle:",
    title: "Staging Deployment Successful",
    color: "#4CAF50", // Green
    statusEmoji: "🟢",
  },
  failure: {
    emoji: ":sherpa-on-fire:",
    title: "Staging Deployment Failed",
    color: "#F44336", // Red
    statusEmoji: "🔴",
  },
} as const;

function buildMessage(status: typeof env.STATUS) {
  const config = statusConfig[status];
  const timestamp = new Date().toLocaleString("en-AU", {
    timeZone: "Australia/Sydney",
    dateStyle: "medium",
    timeStyle: "short",
  });
  const timeLabel = status === "started" ? "Started" : "Finished";

  return {
    text: `${config.emoji} ${config.title}`, // Fallback text
    blocks: [
      // Header
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${config.emoji} ${config.title}`,
          emoji: true,
        },
      },
      // Divider
      {
        type: "divider",
      },
      // Body - Deployment Details
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `App:\n*web-api*`,
          },
          {
            type: "mrkdwn",
            text: `Environment:\n*Staging*`,
          },
          {
            type: "mrkdwn",
            text: `Status:\n${config.statusEmoji} *${
              status.charAt(0).toUpperCase() + status.slice(1)
            }*`,
          },
          {
            type: "mrkdwn",
            text: `${timeLabel}:\n*${timestamp}*`,
          },
        ],
      },
      // Divider
      {
        type: "divider",
      },
      // Footer
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `<${env.ACTION_URL}|View Workflow Run>`,
          },
        ],
      },
    ],
    attachments: [
      {
        color: config.color,
        blocks: [],
      },
    ],
  };
}

if (env.STATUS === "started") {
  const message = buildMessage(env.STATUS);
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

  const message = buildMessage(env.STATUS);
  await web.chat.update({
    channel: "C09TFU78Y3S",
    ts: env.MESSAGE_TS,
    ...message,
  });
}
