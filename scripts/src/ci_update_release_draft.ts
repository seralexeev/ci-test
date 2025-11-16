#!/usr/bin/env node
/* eslint-disable no-console */
import { Octokit } from '@octokit/rest';
import z from 'zod';
import { $ } from 'zx';

// New process: takes prefix and target SHA
// Example: ci_update_release_draft.ts web-api abc123
const [prefix, targetSha] = z
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
  .parse(env.GITHUB_REPOSITORY.split('/'));

console.log(`Updating draft release for ${prefix} @ ${targetSha.substring(0, 7)}`);

// Get production tag SHA (if exists) to use as base for release notes
const productionTag = `${prefix}/production`;
let productionSha: string | null = null;

try {
  const sha = await $`git rev-parse ${productionTag}`.then((x) =>
    x.stdout.trim(),
  );
  productionSha = sha;
  console.log(
    `Production tag found: ${productionTag} @ ${sha.substring(0, 7)}`,
  );
} catch {
  console.log('No production tag found (first deployment)');
}

// Determine next version from existing release/* tags
let nextVersion = '0.0.1';
let latestReleaseTag: string | null = null;

try {
  const tag = await $`git tag -l ${prefix}/release/* | sort -V | tail -n 1`
    .then((x) => x.stdout.trim())
    .then(z.string().min(1).parse);

  latestReleaseTag = tag;

  // Extract version from tag: web-api/release/0.0.1 -> 0.0.1
  const parts = tag.split('/release/');
  if (parts.length !== 2 || parts[1] === undefined) {
    throw new Error(`Invalid release tag format: ${tag}`);
  }
  const version = parts[1];
  const [major, minor, patch] = z
    .tuple([z.coerce.number(), z.coerce.number(), z.coerce.number()])
    .parse(version.split('.'));

  // Bump patch version
  nextVersion = `${major}.${minor}.${patch + 1}`;
  console.log(`Latest release: ${tag}, next: ${nextVersion}`);
} catch {
  console.log('No release tags found, starting at 0.0.1');
}

const nextTag = `${prefix}/release/${nextVersion}`;

// Generate release notes from production -> target SHA
// This shows what will be in the next production release
const { data: releaseNotes } = await octokit.repos.generateReleaseNotes({
  owner,
  repo,
  tag_name: nextTag,
  target_commitish: targetSha,
  // Only include previous_tag_name if production tag exists
  ...(productionSha !== null && { previous_tag_name: productionTag }),
});

console.log(`Generating release notes: ${productionTag || '(initial)'} → ${targetSha.substring(0, 7)}`);

// Check if draft exists
// getReleaseByTag only works for published releases with tags.
// For drafts, we need to list releases and find by tag_name
const { data: releases } = await octokit.repos.listReleases({ owner, repo });
const draft =
  releases.find((release) => release.tag_name === nextTag && release.draft) ??
  null;

if (draft == null) {
  await octokit.repos.createRelease({
    owner,
    repo,
    tag_name: nextTag,
    name: nextTag,
    body: releaseNotes.body,
    draft: true,
    target_commitish: targetSha,
  });
  console.log(`✅ Created draft release ${nextTag}`);
} else {
  if (draft.draft === false) {
    throw new Error('The tag already has a published release.');
  }

  await octokit.repos.updateRelease({
    owner,
    repo,
    release_id: draft.id,
    tag_name: nextTag,
    draft: true,
    name: nextTag,
    body: releaseNotes.body,
    target_commitish: targetSha,
  });
  console.log(`✅ Updated draft release ${nextTag}`);
}

const releaseUrl = `https://github.com/${owner}/${repo}/releases/tag/${nextTag}`;
console.log(`📝 Draft release URL: ${releaseUrl}`);
