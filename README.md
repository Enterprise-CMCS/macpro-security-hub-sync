<h1 align="center" style="border-bottom: none;">macpro-security-hub-sync</h1>
<h3 align="center">NPM module to create Jira tickets for all findings in Security Hub for the current AWS account.</h3>
<p align="center">
  <a href="https://github.com/Enterprise-CMCS/macpro-security-hub-sync/releases/latest">
    <img alt="latest release" src="https://img.shields.io/github/release/Enterprise-CMCS/macpro-security-hub-sync.svg">
  </a>
  <a href="https://www.npmjs.com/package/@enterprise-cmcs/macpro-security-hub-sync">
    <img alt="npm latest version" src="https://img.shields.io/npm/v/@enterprise-cmcs/macpro-security-hub-sync/latest.svg">
  </a>
  <a href="https://codeclimate.com/github/Enterprise-CMCS/macpro-security-hub-sync/maintainability">
    TODO: <img src="https://api.codeclimate.com/v1/badges/7aa40b9f69c550a8cf72/maintainability" />
  </a>
  <a href="https://codeclimate.com/github/Enterprise-CMCS/macpro-security-hub-sync/test_coverage">
    TODO: <img src="https://api.codeclimate.com/v1/badges/7aa40b9f69c550a8cf72/test_coverage" />
  </a>
  <a href="https://github.com/semantic-release/semantic-release">
    <img alt="semantic-release: angular" src="https://img.shields.io/badge/semantic--release-angular-e10079?logo=semantic-release">
  </a>
  <a href="https://dependabot.com/">
    <img alt="Dependabot" src="https://badgen.net/badge/Dependabot/enabled/green?icon=dependabot">
  </a>
  <a href="https://github.com/prettier/prettier">
    <img alt="code style: prettier" src="https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square">
  </a>
</p>

## Information

This package syncs AWS Security Hub Findings to Jira.

- When the sync utility is run, each Security Hub Finding type (Title) is represented as a single issue. So if you have violated the 'S3.8' rule three individual times, you will have one S3.8 GH Issue created.
- By default, CRITICAL and HIGH severity findings get tickets created in Jira. However, this is configurable in either direction (more or less sensitivity).
- When the utility runs, previously created Jira tickets that no longer have an active finding are closed. In this way, Jira tickets can be automatically closed as the Findings are resolved, if you run the utility on a schedule (recommended).

## Usage and Getting Started

To install the package run the following command:

```
npm install --save-dev @enterprise-cmcs/macpro-security-hub-sync
```

or

```
yarn add --dev @enterprise-cmcs/macpro-security-hub-sync
```

After installing the package in your project include this import statement

```
import { SecurityHubJiraSync } from "@enterprise-cmcs/macpro-security-hub-sync";
```

With SecurityHubJiraSync imported you can now execute it like:

```
await SecurityHubJiraSync.getAllFindings("us-east-1");
TODO: decide between approach to run above and below.
const mySync = new SecurityHubJiraSync({
  repository: "myorgname/myrepositoryname", // (required) The name of the repository in which to create Tickets. If GH Actions, use process.env.GITHUB_REPOSITORY
  auth: process.env.GITHUB_TOKEN, // (required) A PAT with access to create tickets. If GH Actions, use process.env.GITHUB_TOKEN
  accountNickname: "dev", // (required) A sensible account nickname; will be used to label tickets.
  region: "us-east-1", // (optional, default: us-east-1) The SecHub region at which to look.
  severity: ["CRITICAL","HIGH"], // (optional, default: ['CRITICAL','HIGH']) The finding types for which you want to create tickets.
});
await mySync.sync();

```

## Contributing

Found a bug, want to help with updating the docs or maybe you want to help add a feature. Refer to our contribution documentation for more information: [Documentation](./docs/CONTRIBUTING.MD)

## Instructions to test locally with a yarn project

- in your terminal from your local clone of macpro-security-hub-sync with your development branch
- `yarn link` (note, when testing is complete, run `yarn unlink`)
  that will return output like:

```
yarn link v1.22.19
warning ../../../package.json: No license field
success Registered "@enterprise-cmcs/macpro-security-hub-sync".
info You can now run `yarn link "@enterprise-cmcs/macpro-security-hub-sync"` in the projects where you want to use this package and it will be used instead.
✨  Done in 0.06s.
```

- npm install
- npm run build (this builds the package)

In your local yarn project that will be using the macpro-security-hub-sync package, run:

- `rm -rf node_modules`
- `yarn link "@enterprise-cmcs/macpro-security-hub-sync"`
  that will return output like:

```
yarn link v1.22.19
warning ../../../package.json: No license field
success Using linked package for "@enterprise-cmcs/macpro-security-hub-sync".
✨  Done in 0.05s.
```

- `yarn install`
- Note: when testing is complete run `yarn unlink "@enterprise-cmcs/macpro-security-hub-sync"`

## License

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

See [LICENSE](LICENSE) for full details.
