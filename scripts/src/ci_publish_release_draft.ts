#!/usr/bin/env node
/* eslint-disable no-console */
import { Octokit, type RestEndpointMethodTypes } from "@octokit/rest";
import z from "zod";
import { $ } from "zx";

// service name e.g., "web-api"
const [prefix, prevSha] = z
  .tuple([z.string().min(1), z.string().min(1)])
  .parse(process.argv.slice(2));

const env = z
  .object({
    GITHUB_TOKEN: z.string().min(1),
    GITHUB_REPOSITORY: z.string().min(1),
  })
  .parse(process.env);

const octokit = new Octokit({
  auth: env.GITHUB_TOKEN,
});

const [owner, repo] = z
  .tuple([z.string().min(1), z.string().min(1)])
  .parse(env.GITHUB_REPOSITORY.split("/"));

// check if draft exists
// getReleaseByTag only works for published releases with tags.
// For drafts, we need to list releases and find by tag_name
const { data: releases } = await octokit.repos.listReleases({ owner, repo });
const [draft, ...extra] = releases.filter(
  (release) => release.tag_name.startsWith(`${prefix}/release`) && release.draft
);

if (!draft) {
  throw new Error(`No draft release found for tag ${prefix}/release/*`);
}

if (extra.length > 0) {
  throw new Error(`Multiple draft releases found for tag ${prefix}/release/*`);
}

// generate release notes from previous production SHA to target SHA (which is always staging here)
const releaseNotesResponse = await octokit.repos.generateReleaseNotes({
  owner,
  repo,
  tag_name: draft.tag_name,
  previous_tag_name: prevSha,
  target_commitish: draft.target_commitish,
});

// publish the draft release by setting draft: false
const release = await octokit.repos.updateRelease({
  owner,
  repo,
  release_id: draft.id,
  draft: false,
  body: releaseNotesResponse.data.body,
});

console.log(`Published release: ${release.data.html_url}`);
