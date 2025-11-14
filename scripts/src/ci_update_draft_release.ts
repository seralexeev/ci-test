#!/usr/bin/env node
/* eslint-disable no-console */
import { Octokit } from "@octokit/rest";
import z from "zod";
import { $ } from "zx";

const [prefix] = z.tuple([z.string().min(1)]).parse(process.argv.slice(2));
console.log(`Parsed prefix: ${prefix}`);

const env = z
  .object({
    GITHUB_TOKEN: z.string().min(1),
    GITHUB_REPOSITORY: z.string().min(1),
  })
  .parse(process.env);
console.log(`Environment variables parsed successfully`);
console.log(`GITHUB_REPOSITORY: ${env.GITHUB_REPOSITORY}`);

const octokit = new Octokit({
  auth: env.GITHUB_TOKEN,
});
console.log(`Octokit initialized successfully`);

// trying to get the latest tag with the given prefix
// to determine the next version and the changelog
console.log(`Fetching latest tag with prefix: ${prefix}/*`);
const latestTag = await $`git tag -l ${prefix}/* | sort -V | tail -n 1`
  .then((x) => x.stdout.trim())
  .then(z.string().min(1).parse);
console.log(`Latest tag found: ${latestTag}`);

// discard the prefix part and parse the version (semver)
const [_, version] = z
  .tuple([z.string(), z.string()])
  .parse(latestTag.split("/"));
console.log(`Parsed version: ${version}`);

const [major, minor, patch] = z
  .tuple([z.coerce.number(), z.coerce.number(), z.coerce.number()])
  .parse(version.split("."));
console.log(
  `Version components - major: ${major}, minor: ${minor}, patch: ${patch}`
);

// currently we only bump the patch version only
const nextVersion = `${major}.${minor}.${patch + 1}`;
const nextTag = `${prefix}/${nextVersion}`;
console.log(`Next version calculated: ${nextVersion}`);
console.log(`Next tag: ${nextTag}`);

const [owner, repo] = z
  .tuple([z.string().min(1), z.string().min(1)])
  .parse(env.GITHUB_REPOSITORY.split("/"));
console.log(`Repository owner: ${owner}`);
console.log(`Repository name: ${repo}`);

// Generate release note
console.log(`Generating release notes for ${nextTag}...`);
const { data: releaseNotes } = await octokit.repos.generateReleaseNotes({
  owner,
  repo,
  tag_name: nextTag,
  target_commitish: "main",
  previous_tag_name: latestTag,
});
console.log(`Release notes generated successfully`);

// Check if draft exists
console.log(`Checking if draft release exists for tag: ${nextTag}...`);
const draft = await octokit.repos
  .getReleaseByTag({ owner, repo, tag: nextTag })
  .catch(() => null);

if (draft == null) {
  console.log(`No existing draft found. Creating new draft release...`);
  await octokit.repos.createRelease({
    owner,
    repo,
    tag_name: nextTag,
    name: nextTag,
    body: releaseNotes.body,
    draft: true,
    target_commitish: "main",
  });
  console.log(`Draft release created successfully`);
} else {
  console.log(`Existing release found for tag: ${nextTag}`);
  if (draft.data.draft === false) {
    console.error(`Error: The tag ${nextTag} already has a published release`);
    throw new Error("The tag already has a published release.");
  }

  console.log(`Updating existing draft release (ID: ${draft.data.id})...`);
  await octokit.repos.updateRelease({
    owner,
    repo,
    release_id: draft.data.id,
    draft: true,
    name: nextTag,
    body: releaseNotes.body,
  });
  console.log(`Draft release updated successfully`);
}

const releaseUrl = `https://github.com/${owner}/${repo}/releases/tag/${nextTag}`;

console.log(`\n${"=".repeat(50)}`);
console.log("Release Draft Updated");
console.log(`Next Version: ${nextTag}`);
console.log(`Release URL: ${releaseUrl}`);
console.log(`${"=".repeat(50)}`);
