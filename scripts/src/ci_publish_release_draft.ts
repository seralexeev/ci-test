import {
  findDraftReleaseByTag,
  getReleaseTagInfo,
  octokit,
  repoInfo,
} from "./ci_util.ts";

const releaseTagInfo = await getReleaseTagInfo();
const draft = await findDraftReleaseByTag(releaseTagInfo.next.tag);
if (!draft) {
  throw new Error(`No draft release found for tag ${releaseTagInfo.next.tag}`);
}

await octokit.repos.updateRelease({
  ...repoInfo,
  release_id: draft.id,
  draft: false,
});
