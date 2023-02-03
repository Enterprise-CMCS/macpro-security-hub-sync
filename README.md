<h1 align="center" style="border-bottom: none;">macpro-security-hub-sync</h1>
<h3 align="center">NPM module to create Jira issues for all findings in Security Hub for the current AWS account.</h3>
<p align="center">
  <a href="https://github.com/Enterprise-CMCS/macpro-security-hub-sync/releases/latest">
    <img alt="latest release" src="https://img.shields.io/github/release/Enterprise-CMCS/macpro-security-hub-sync.svg">
  </a>
  <a href="https://www.npmjs.com/package/@enterprise-cmcs/macpro-security-hub-sync">
    <img alt="npm latest version" src="https://img.shields.io/npm/v/@enterprise-cmcs/macpro-security-hub-sync/latest.svg">
  </a>
  <a href="https://codeclimate.com/github/Enterprise-CMCS/macpro-security-hub-sync/maintainability">
    <img src="https://api.codeclimate.com/v1/badges/c8dfe630c7857d3ce591/maintainability" />
  </a>
  <a href="https://codeclimate.com/github/Enterprise-CMCS/macpro-security-hub-sync/test_coverage">
    <img src="https://api.codeclimate.com/v1/badges/c8dfe630c7857d3ce591/test_coverage" />
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
- By default, CRITICAL and HIGH severity findings get issues created in Jira. However, this is configurable in either direction (more or less sensitivity).
- When the utility runs, previously created Jira issues that no longer have an active finding are closed. In this way, Jira issues can be automatically closed as the Findings are resolved, if you run the utility on a schedule (recommended).

## Synchronization Process

The SecurityHubJiraSyncOptions class's main function is sync. The sync process follows this process:
Step 1. Get all open Security Hub issues from Jira
Step 2. Get all current findings from Security Hub
Step 3. Close existing Jira issues if their finding is no longer active/current
Step 4. Create Jira issue for current findings that do not already have a Jira issue

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
await new SecurityHubJiraSync({ region = "us-east-1", severities: ["MEDIUM"] }).sync();
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
