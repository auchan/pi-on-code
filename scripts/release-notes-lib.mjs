export function extractPullRequestNumbers(markdown) {
  const numbers = new Set();
  for (const pattern of [/#(\d+)\b/g, /\/pull\/(\d+)\b/g]) {
    for (const match of markdown.matchAll(pattern)) {
      numbers.add(Number(match[1]));
    }
  }
  return [...numbers].sort((left, right) => left - right);
}

export function collectIssueReporters(pullRequests) {
  const reportersByIssue = new Map();
  for (const pullRequest of pullRequests) {
    const issues = pullRequest?.closingIssuesReferences?.nodes ?? [];
    for (const issue of issues) {
      const login = issue?.author?.login;
      if (typeof issue?.number === "number" && typeof login === "string" && login) {
        reportersByIssue.set(issue.number, login);
      }
    }
  }
  return [...reportersByIssue]
    .map(([issueNumber, login]) => ({ issueNumber, login }))
    .sort((left, right) => left.issueNumber - right.issueNumber);
}

export function formatIssueReporterSection(reporters) {
  if (reporters.length === 0) { return ""; }
  const acknowledgements = reporters.map(
    ({ issueNumber, login }) => `- Thanks @${login} for reporting #${issueNumber}.`,
  );
  return `## Issue reporters\n\n${acknowledgements.join("\n")}`;
}
