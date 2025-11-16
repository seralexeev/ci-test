import { type RestEndpointMethodTypes } from "@octokit/rest";
import z from "zod";
import { $ } from "zx";
import {
  findDraftReleaseByTag,
  getReleaseTagInfo,
  octokit,
  repoInfo,
} from "./ci_util.ts";

// service name e.g., "web-api"
const [prefix] = z.tuple([z.string().min(1)]).parse(process.argv.slice(2));
const releaseTagInfo = await getReleaseTagInfo(prefix);

// previous step updated the floating tag `${prefix}/staging` to point to the new staging commit
// here we just find out what commit it is (to avoid passing it as an argument)
const targetSha = await $`git rev-parse ${prefix}/staging`
  .then((x) => x.stdout.trim())
  .then(z.string().min(1).parse);

// generate release notes from ${prefix}/production -> target SHA (which is always staging here)
const releaseNotes = await octokit.repos.generateReleaseNotes({
  ...repoInfo,
  tag_name: releaseTagInfo.next.tag,
  // we always generate notes from production to staging
  // for roll forward releases
  target_commitish: targetSha,
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
    target_commitish: targetSha,
  };

// create or update the draft release
const draft = await findDraftReleaseByTag(releaseTagInfo.next.tag);
const release =
  draft == null
    ? await octokit.repos.createRelease(params)
    : await octokit.repos.updateRelease({ release_id: draft.id, ...params });

console.log(`Draft release URL: ${release.data.html_url}`);
