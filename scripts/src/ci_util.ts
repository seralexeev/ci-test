import { Octokit } from "@octokit/rest";
import z from "zod";
import { $ } from "zx";

const env = z
  .object({
    APP_NAME: z.string().min(1),
    GITHUB_TOKEN: z.string().min(1),
    GITHUB_REPOSITORY: z.string().min(1),
  })
  .parse(process.env);

export const octokit = new Octokit({
  auth: env.GITHUB_TOKEN,
});

export const [owner, repo] = z
  .tuple([z.string().min(1), z.string().min(1)])
  .parse(env.GITHUB_REPOSITORY.split("/"));

export const repoInfo = { owner, repo };

export const getReleaseTagInfo = async () => {
  const releasePrefix = `${env.APP_NAME}/release`;

  // get the latest tag with the given prefix
  const latestTag = await $`git tag -l ${releasePrefix}/* | sort -V | tail -n 1`
    .then((x) => x.stdout.trim())
    .then(z.string().min(1).parse);

  const latestTagSha = await $`git rev-parse ${latestTag}`
    .then((x) => x.stdout.trim())
    .then(z.string().min(1).parse);

  // discard the prefix part and parse the version (semver)
  const [, currentVersion] = z
    .tuple([z.string(), z.string()])
    .parse(latestTag.split(`${releasePrefix}/`));

  // parse the version into major, minor, patch
  const [major, minor, patch] = z
    .tuple([z.coerce.number(), z.coerce.number(), z.coerce.number()])
    .parse(currentVersion.split("."));

  // currently we only bump the patch version only
  const nextVersion = `${major}.${minor}.${patch + 1}`;

  // we always increment the patch for roll forward releases
  const nextTag = `${releasePrefix}/${nextVersion}`;

  return {
    current: {
      version: currentVersion,
      tag: latestTag,
      sha: latestTagSha,
    },
    next: {
      version: nextVersion,
      tag: nextTag,
    },
  };
};

export const findDraftReleaseByTag = async (tag: string) => {
  // check if draft exists
  // getReleaseByTag only works for published releases with tags.
  // For drafts, we need to list releases and find by tag_name
  const releases = await octokit.repos.listReleases(repoInfo);
  const [draft, ...drafts] = releases.data.filter(
    (release) => release.tag_name === tag && release.draft
  );

  if (drafts.length > 0) {
    throw new Error(`Multiple draft releases found for tag ${tag}`);
  }

  return draft ?? null;
};
