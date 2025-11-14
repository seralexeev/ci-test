#!/usr/bin/env node
/* eslint-disable no-console */
import { Octokit } from '@octokit/rest';
import z from 'zod';
import { $ } from 'zx';

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

// trying to get the latest tag with the given prefix
// to determine the next version and the changelog
const latestTag = await $`git tag -l ${prefix}/* | sort -V | tail -n 1`
  .then((x) => x.stdout.trim())
  .then(z.string().min(1).parse);

// discard the prefix part and parse the version (semver)
const [_, version] = z
  .tuple([z.string(), z.string()])
  .parse(latestTag.split('/'));

const [major, minor, patch] = z
  .tuple([z.coerce.number(), z.coerce.number(), z.coerce.number()])
  .parse(version.split('.'));

// currently we only bump the patch version only
const nextVersion = `${major}.${minor}.${patch + 1}`;
const nextTag = `${prefix}${nextVersion}`;

const [owner, repo] = z
  .tuple([z.string().min(1), z.string().min(1)])
  .parse(env.GITHUB_REPOSITORY.split('/'));

// Generate release note
const { data: releaseNotes } = await octokit.repos.generateReleaseNotes({
  owner,
  repo,
  tag_name: nextTag,
  target_commitish: 'main',
  previous_tag_name: latestTag,
});

// Check if draft exists
const draft = await octokit.repos
  .getReleaseByTag({ owner, repo, tag: nextTag })
  .catch(() => null);

if (draft == null) {
  await octokit.repos.createRelease({
    owner,
    repo,
    tag_name: nextTag,
    name: nextTag,
    body: releaseNotes.body,
    draft: true,
    target_commitish: 'main',
  });
} else {
  if (draft.data.draft === false) {
    throw new Error('The tag already has a published release.');
  }

  await octokit.repos.updateRelease({
    owner,
    repo,
    release_id: draft.data.id,
    draft: true,
    name: nextTag,
    body: releaseNotes.body,
  });
}

const releaseUrl = `https://github.com/${owner}/${repo}/releases/tag/${nextTag}`;

console.log('Release Draft Updated');
console.log(`Next Version: ${nextTag}`);
console.log(`Release URL: ${releaseUrl}`);
