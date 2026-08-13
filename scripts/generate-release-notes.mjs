#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import {
  collectIssueReporters,
  extractPullRequestNumbers,
  formatIssueReporterSection,
} from "./release-notes-lib.mjs";

const repository = process.env.GITHUB_REPOSITORY;
const tagName = process.env.GITHUB_REF_NAME;
const targetCommitish = process.env.GITHUB_SHA;
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const outputPath = process.argv[2] || "release-notes.md";

if (!repository || !tagName || !targetCommitish || !token) {
  throw new Error(
    "GITHUB_REPOSITORY, GITHUB_REF_NAME, GITHUB_SHA, and GH_TOKEN or GITHUB_TOKEN are required",
  );
}

const [owner, repo] = repository.split("/");
if (!owner || !repo) { throw new Error(`Invalid GITHUB_REPOSITORY: ${repository}`); }

async function githubRequest(url, options = {}) {
  const response = await fetch(`https://api.github.com${url}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...options.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

async function loadPullRequests(numbers) {
  const pullRequests = [];
  for (let offset = 0; offset < numbers.length; offset += 50) {
    const batch = numbers.slice(offset, offset + 50);
    const fields = batch.map((number) => `
      pr${number}: pullRequest(number: ${number}) {
        number
        closingIssuesReferences(first: 100) {
          nodes { number author { login } }
        }
      }`).join("\n");
    const query = `query {
      repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(repo)}) {
        ${fields}
      }
    }`;
    const result = await githubRequest("/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (result.errors?.length) {
      throw new Error(`GitHub GraphQL error: ${JSON.stringify(result.errors)}`);
    }
    pullRequests.push(...Object.values(result.data?.repository ?? {}).filter(Boolean));
  }
  return pullRequests;
}

const generated = await githubRequest(`/repos/${owner}/${repo}/releases/generate-notes`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    tag_name: tagName,
    target_commitish: targetCommitish,
  }),
});

const pullRequestNumbers = extractPullRequestNumbers(generated.body || "");
const pullRequests = await loadPullRequests(pullRequestNumbers);
const reporters = collectIssueReporters(pullRequests);
const reporterSection = formatIssueReporterSection(reporters);
const notes = reporterSection
  ? `${generated.body.trim()}\n\n${reporterSection}\n`
  : `${generated.body.trim()}\n`;

await writeFile(outputPath, notes, "utf8");
console.log(`Generated ${outputPath} with ${reporters.length} issue reporter acknowledgement(s).`);
