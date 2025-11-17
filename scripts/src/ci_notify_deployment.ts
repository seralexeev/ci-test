import { setOutput } from "@actions/core";
import { Block, KnownBlock, WebClient } from "@slack/web-api";
import z from "zod";
import { octokit, repoInfo } from "./ci_util";

const env = z
  .object({
    APP_NAME: z.string().min(1),
    RUN_ID: z.string().min(1),
    GITHUB_URL: z.string().min(1),
    SLACK_TOKEN: z.string().min(1),
    STATUS: z.enum(["started", "success", "failure"]),
    MESSAGE_TS: z.string().optional(),
    SHA: z.string().min(1),
    DEPLOY_ENV: z.string().min(1),
    RELEASE_ID: z.string().optional(),
  })
  .parse(process.env);

const channel = "C09TFU78Y3S";
const web = new WebClient(env.SLACK_TOKEN);

const emojiMap: Record<typeof env.STATUS, string> = {
  started: ":sherpa-excited:",
  success: ":sherpa-sparkle:",
  failure: ":sherpa-on-fire:",
};

const status = env.STATUS;
const timestamp = new Date().toLocaleString("en-AU", {
  timeZone: "Australia/Sydney",
  dateStyle: "medium",
  timeStyle: "short",
});

const timeLabel = status === "started" ? "Started" : "Finished";
const emoji = emojiMap[status];
const title = `${emoji} *${env.APP_NAME}* [${env.DEPLOY_ENV}] deployment *${env.STATUS}*`;
const shaShort = env.SHA.substring(0, 7);

const blocks: Array<KnownBlock | Block> = [
  { type: "section", text: { type: "mrkdwn", text: title } },
  { type: "divider" },
  {
    type: "section",
    fields: [
      { type: "mrkdwn", text: `*App:*\n${env.APP_NAME}` },
      { type: "mrkdwn", text: `*Status:*\n\`${status}\`` },
      { type: "mrkdwn", text: `*Environment:*\n\`${env.DEPLOY_ENV}\`` },
      { type: "mrkdwn", text: `*${timeLabel}:*\n${timestamp}` },
    ],
  },
  { type: "divider" },
];

if (env.RELEASE_ID) {
  const releases = await octokit.repos.listReleases(repoInfo);
  // will be the only one item array because we checked for multiple drafts before
  const release = releases.data.find((r) => r.id === Number(env.RELEASE_ID));
  if (release == null) {
    throw new Error(`Release with ID ${env.RELEASE_ID} not found`);
  }

  const draftReleaseUrl = release.html_url;

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `:page_facing_up: <${draftReleaseUrl}|Release for ${env.APP_NAME} - ${release.tag_name}>`,
    },
  });

  blocks.push({ type: "divider" });

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: release.body ?? "_No release notes available_",
    },
  });

  blocks.push({ type: "divider" });
}

blocks.push({
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
});

if (env.STATUS === "started") {
  const res = await web.chat.postMessage({ channel, text: title, blocks });
  if (res.ts == null) {
    throw new Error(`Failed to send Slack notification: ${res.error}`);
  }

  setOutput("message_ts", res.ts);
} else {
  if (env.MESSAGE_TS == null) {
    throw new Error(`MESSAGE_TS is required when STATUS is ${env.STATUS}`);
  }

  const res = await web.chat.update({
    channel,
    ts: env.MESSAGE_TS,
    text: title,
    blocks,
  });

  if (res.ok === false) {
    throw new Error(`Failed to update Slack notification: ${res.error}`);
  }
}
