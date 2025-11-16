#!/usr/bin/env node
/* eslint-disable no-console */
import { Octokit, type RestEndpointMethodTypes } from "@octokit/rest";
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
const draft = releases.find(
  (release) => release.tag_name === nextTag && release.draft
);

if (!draft) {
  throw new Error(
    `No draft release found for tag ${nextTag}. Please run ci_update_release_draft.ts first.`
  );
}

// publish the draft release by setting draft: false
const release = await octokit.repos.updateRelease({
  owner,
  repo,
  release_id: draft.id,
  draft: false,
});

console.log(`Published release: ${release.data.html_url}`);
