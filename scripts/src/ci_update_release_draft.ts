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

// previous step updated the floating branch `${env.APP_NAME}/staging` to point to the new staging commit
// e.g for `web-api/staging`
const newStagingSha =
  await $`git rev-parse refs/remotes/origin/${env.APP_NAME}/staging`
    .then((x) => x.stdout.trim())
    .then(z.string().min(1).parse);

await octokit.git.createRef({
  ...repoInfo,
  ref: `refs/tags/${releaseTagInfo.next.tag}`,
  sha: newStagingSha,
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
  tag_name: releaseTagInfo.next.tag,
  // we always generate notes from production to staging
  target_commitish: newStagingSha,
  previous_tag_name: `${env.APP_NAME}/production`,
});

await octokit.git.deleteRef({
  ...repoInfo,
  ref: `tags/${releaseTagInfo.next.tag}`,
});

const params: RestEndpointMethodTypes["repos"]["createRelease"]["parameters"] =
  {
    ...repoInfo,
    tag_name: releaseTagInfo.next.tag,
    name: releaseNotes.data.name,
    draft: true,
    body: releaseNotes.data.body,
    // should be a commit (tags don't work for drafts)
    target_commitish: newStagingSha,
  };

// create or update the draft release
const draft = await findDraftReleaseByTag(releaseTagInfo.next.tag);
const release =
  draft == null
    ? await octokit.repos.createRelease({ ...params })
    : await octokit.repos.updateRelease({ ...params, release_id: draft.id });

console.log(`Draft release URL: ${release.data.html_url}`);
