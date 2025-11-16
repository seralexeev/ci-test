#!/usr/bin/env node
/* eslint-disable no-console */
import { Octokit } from "@octokit/rest";
import z from "zod";
import { $ } from "zx";

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

const productionTag = `${prefix}/production`;

// trying to get the latest tag with the given prefix
// to determine the next version and the changelog
const latestTag = await $`git tag -l ${prefix}/release/* | sort -V | tail -n 1`
  .then((x) => x.stdout.trim())
  .then(z.string().min(1).parse);

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
const nextTag = `${prefix}/release/${nextVersion}`;

// generate release notes from ${prefix}/production -> target SHA (which is always staging here)
const { data: releaseNotes } = await octokit.repos.generateReleaseNotes({
  owner,
  repo,
  tag_name: nextTag,
  target_commitish: targetSha,
  previous_tag_name: `${prefix}/production`,
});

console.log(`Release title: ${releaseNotes.name}`);
console.log(releaseNotes.body);

// Check if draft exists
// getReleaseByTag only works for published releases with tags.
// For drafts, we need to list releases and find by tag_name
const { data: releases } = await octokit.repos.listReleases({ owner, repo });
const draft =
  releases.find((release) => release.tag_name === nextTag && release.draft) ??
  null;

const release =
  draft == null
    ? await octokit.repos.createRelease({
        owner,
        repo,
        tag_name: nextTag,
        name: nextTag,
        body: releaseNotes.body,
        draft: true,
        target_commitish: targetSha,
      })
    : await octokit.repos.updateRelease({
        owner,
        repo,
        release_id: draft.id,
        tag_name: nextTag,
        draft: true,
        name: nextTag,
        body: releaseNotes.body,
        target_commitish: targetSha,
      });

console.log(`📝 Draft release URL: ${release.data.html_url}`);
