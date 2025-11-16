import { type RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";
import z from "zod";
import { $ } from "zx";
import {
  findDraftReleaseByTag,
  getReleaseTagInfo,
  octokit,
  repoInfo,
} from "./ci_util.ts";

// service name e.g., "web-api"
const [prefix, prevSha] = z
  .tuple([z.string().min(1), z.string().min(1)])
  .parse(process.argv.slice(2));

// sha of the current production deployment
// the tag is updated in the previous step (github action)
const targetSha = await $`git rev-parse ${prefix}/production`
  .then((x) => x.stdout.trim())
  .then(z.string().min(1).parse);

const releaseTagInfo = await getReleaseTagInfo(prefix);

// check if the release roll forward or roll backward
const isRollForward =
  await $`git merge-base --is-ancestor ${prevSha} ${targetSha}`
    .then(() => true)
    .catch(() => false);

const draft = await findDraftReleaseByTag(releaseTagInfo.next.tag);
if (!draft) {
  throw new Error(`No draft release found for tag ${releaseTagInfo.next.tag}`);
}

if (isRollForward) {
  // generate release notes from previous production SHA to target SHA (which is always staging here)
  const releaseNotesResponse = await octokit.repos.generateReleaseNotes({
    ...repoInfo,
    tag_name: draft.tag_name,
    previous_tag_name: releaseTagInfo.current.tag,
    target_commitish: targetSha,
  });

  // publish the draft release by setting draft: false
  const release = await octokit.repos.updateRelease({
    ...repoInfo,
    release_id: draft.id,
    draft: false,
    body: releaseNotesResponse.data.body,
    target_commitish: targetSha,
  });

  console.log(`Published release: ${release.data.html_url}`);
} else {
  // for roll back releases, we just update the draft release notes
  // to reflect the rollback from production to staging
  const stagingTargetSha = await $`git rev-parse ${prefix}/staging`
    .then((x) => x.stdout.trim())
    .then(z.string().min(1).parse);

  // generate release notes from ${prefix}/production -> target SHA (which is always staging here)
  const releaseNotes = await octokit.repos.generateReleaseNotes({
    ...repoInfo,
    tag_name: releaseTagInfo.next.tag,
    // we always generate notes from production to staging
    // for roll forward releases
    target_commitish: stagingTargetSha,
    previous_tag_name: `${prefix}/production`,
  });

  const params: RestEndpointMethodTypes["repos"]["createRelease"]["parameters"] =
    {
      ...repoInfo,
      tag_name: releaseTagInfo.next.tag,
      name: releaseNotes.data.name,
      draft: true,
      body: releaseNotes.data.body,
      // should be a commit (tags don't work for drafts)
      target_commitish: stagingTargetSha,
    };

  // create or update the draft release
  const draft = await findDraftReleaseByTag(releaseTagInfo.next.tag);
  const release =
    draft == null
      ? await octokit.repos.createRelease(params)
      : await octokit.repos.updateRelease({ release_id: draft.id, ...params });

  console.log(`Draft release URL: ${release.data.html_url}`);
}
