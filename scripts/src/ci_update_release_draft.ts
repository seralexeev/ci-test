import { type RestEndpointMethodTypes } from "@octokit/rest";
import z from "zod";
import { $ } from "zx";
import {
  findDraftReleaseByTag,
  getReleaseTagInfo,
  octokit,
  repoInfo,
} from "./ci_util.ts";

const env = z.object({ APP_NAME: z.string().min(1) }).parse(process.env);
const releaseTagInfo = await getReleaseTagInfo();

const stagingSha =
  await $`git rev-parse refs/remotes/origin/${env.APP_NAME}/staging`
    .then((x) => x.stdout.trim())
    .then(z.string().min(1).parse);

// GitHub releases require a tag reference to generate correct changelogs
// so we need to update/create a tag pointing to the new staging SHA
// this tag is only used for generating release notes for the draft release
await octokit.git.updateRef({
  ...repoInfo,
  ref: `tags/web-api/draft`,
  sha: stagingSha,
  force: true,
});

// generate release notes from ${env.APP_NAME}/production -> ${env.APP_NAME}/staging
//            feature/foo
//            |  feature/bar feature/baz
//            |  |           |
// *----*-----*--*-----------*
//      |                    |
//      web-api/production   web-api/staging
//      (previous prod)      (new staging)
// we always generate notes from production to staging
const releaseNotes = await octokit.repos.generateReleaseNotes({
  ...repoInfo,
  tag_name: `tags/web-api/draft`,
  // we always generate notes from production to staging
  target_commitish: stagingSha,
  previous_tag_name: `${env.APP_NAME}/production`,
});

const params: RestEndpointMethodTypes["repos"]["createRelease"]["parameters"] =
  {
    ...repoInfo,
    tag_name: releaseTagInfo.next.tag,
    name: releaseTagInfo.next.tag,
    draft: true,
    body: releaseNotes.data.body,
    // should be a commit (tags don't work for drafts)
    target_commitish: stagingSha,
  };

// create or update the draft release
const draft = await findDraftReleaseByTag(releaseTagInfo.next.tag);
const release =
  draft == null
    ? await octokit.repos.createRelease({ ...params })
    : await octokit.repos.updateRelease({ ...params, release_id: draft.id });

console.log(`Draft release URL: ${release.data.html_url}`);
