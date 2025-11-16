#!/usr/bin/env node
/* eslint-disable no-console */
import { Octokit, RestEndpointMethodTypes } from "@octokit/rest";
import z from "zod";
import { $ } from "zx";

// service name e.g., "web-api"
const [prefix] = z.tuple([z.string().min(1)]).parse(process.argv.slice(2));

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

// get the latest tag with the given prefix
// to determine the next version and the changelog
const latestTag = await $`git tag -l ${prefix}/release/* | sort -V | tail -n 1`
  .then((x) => x.stdout.trim())
  .then(z.string().min(1).parse);

// previous step updated the floating tag `${prefix}/staging` to point to the new staging commit
// here we just find out what commit it is (to avoid passing it as an argument)
const targetSha = await $`git rev-parse ${prefix}/staging`
  .then((x) => x.stdout.trim())
  .then(z.string().min(1).parse);

// discard the prefix part and parse the version (semver)
const [, version] = z
  .tuple([z.string(), z.string()])
  .parse(latestTag.split(`${prefix}/release/`));

const [major, minor, patch] = z
  .tuple([z.coerce.number(), z.coerce.number(), z.coerce.number()])
  .parse(version.split("."));

// currently we only bump the patch version only
const nextVersion = `${major}.${minor}.${patch + 1}`;

// we always increment the patch for roll forward releases
const nextTag = `${prefix}/release/${nextVersion}`;

// check if draft exists
// getReleaseByTag only works for published releases with tags.
// For drafts, we need to list releases and find by tag_name
const { data: releases } = await octokit.repos.listReleases({ owner, repo });
const draft =
  releases.find((release) => release.tag_name === nextTag && release.draft) ??
  null;

// generate release notes from ${prefix}/production -> target SHA (which is always staging here)
const releaseNotes = await octokit.repos.generateReleaseNotes({
  owner,
  repo,
  tag_name: nextTag,
  // we always generate notes from production to staging
  // for roll forward releases
  target_commitish: targetSha,
  previous_tag_name: `${prefix}/production`,
});

const params: RestEndpointMethodTypes["repos"]["createRelease"]["parameters"] =
  {
    owner,
    repo,
    tag_name: nextTag,
    name: releaseNotes.data.name,
    draft: true,
    body: releaseNotes.data.body,
    // should be a commit (tags don't work for drafts)
    target_commitish: targetSha,
  };

// create or update the draft release
const release =
  draft == null
    ? await octokit.repos.createRelease(params)
    : await octokit.repos.updateRelease({ release_id: draft.id, ...params });

console.log(`Draft release URL: ${release.data.html_url}`);
