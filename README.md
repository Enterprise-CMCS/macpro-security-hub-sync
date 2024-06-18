<h1  align="center"  style="border-bottom: none;">macpro-security-hub-sync</h1>

<h3  align="center">NPM module to create Jira issues for all findings in Security Hub for the current AWS account.</h3>

<p  align="center">

<a  href="https://cmsgov.slack.com/archives/C04MBTV136X">

<img  alt="Slack"  src="https://img.shields.io/badge/Slack-channel-purple.svg">

</a>

<a  href="https://github.com/Enterprise-CMCS/macpro-security-hub-sync/releases/latest">

<img  alt="latest release"  src="https://img.shields.io/github/release/Enterprise-CMCS/macpro-security-hub-sync.svg">

</a>

<a  href="https://www.npmjs.com/package/@enterprise-cmcs/macpro-security-hub-sync">

<img  alt="npm latest version"  src="https://img.shields.io/npm/v/@enterprise-cmcs/macpro-security-hub-sync/latest.svg">

</a>

<a  href="https://codeclimate.com/github/Enterprise-CMCS/macpro-security-hub-sync/maintainability">

<img  src="https://api.codeclimate.com/v1/badges/c8dfe630c7857d3ce591/maintainability"  />

</a>

<a  href="https://codeclimate.com/github/Enterprise-CMCS/macpro-security-hub-sync/test_coverage">

<img  src="https://api.codeclimate.com/v1/badges/c8dfe630c7857d3ce591/test_coverage"  />

</a>

<a  href="https://github.com/semantic-release/semantic-release">

<img  alt="semantic-release: angular"  src="https://img.shields.io/badge/semantic--release-angular-e10079?logo=semantic-release">

</a>

<a  href="https://dependabot.com/">

<img  alt="Dependabot"  src="https://badgen.net/badge/Dependabot/enabled/green?icon=dependabot">

</a>

<a  href="https://github.com/prettier/prettier">

<img  alt="code style: prettier"  src="https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square">

</a>

</p>

## Usage

Set a few enviroment variables that are expected by the package:

```

export JIRA_HOST=yourorg.atlassian.net

export JIRA_PROJECT=OY2 // This is the ID for the Jira Project you want to interact with

export JIRA_USERNAME="myuser@example.com"

export JIRA_TOKEN="a very long string" // This should be a [Personal Access Token](https://confluence.atlassian.com/enterprise/using-personal-access-tokens-1026032365.html) that you generate

```

Install the package with a dependency manager of your choice, probably as a dev dependency:

```

npm install @enterprise-cmcs/macpro-security-hub-sync --save-dev

```

Import the package and execute a sync:

```

import { SecurityHubJiraSync } from "@enterprise-cmcs/macpro-security-hub-sync";

await new SecurityHubJiraSync().sync();

```

Or, override defaults by passing more options:

```

await new SecurityHubJiraSync({

region: "us-west-2", // Which regional Security Hub to scrape; default is "us-east-1"

severities: ["HIGH","CRITICAL"], // List of all severities to find; default is ["MEDIUM","HIGH","CRITICAL"]

customJiraFields: { // A map of custom fields to add to each Jira Issue; no default.

customfield_14117: [{value: "Platform Team"}],

customfield_14151: [{value: "Not Applicable "}],

}

}).sync();

```

## Info

#### Overview

This package syncs AWS Security Hub Findings to Jira.

- When the sync utility is run, each Security Hub Finding type (Title) is represented as a single issue. So if you have violated the 'S3.8' rule three individual times, you will have one S3.8 Jira Issue created.

- By default, CRITICAL and HIGH severity findings get issues created in Jira. However, this is configurable in either direction (more or less sensitivity).

- When the utility runs, previously created Jira issues that no longer have an active finding are closed. In this way, Jira issues can be automatically closed as the Findings are resolved, if you run the utility on a schedule (recommended).

#### Sync Process

The SecurityHubJiraSyncOptions class's main function is sync. The sync process follows this process:

1. Get all open Security Hub issues (identified by a label convention) from Jira

2. Get all current findings from Security Hub

3. Close existing Jira issues if their finding is no longer active/current

4. Create Jira issue (including labels from our label convention) for current findings that do not already have a Jira issue

#### Instructions to test locally with a yarn project

- in your terminal from your local clone of macpro-security-hub-sync with your development branch

- `yarn link` (note, when testing is complete, run `yarn unlink`)

that will return output like:

```

yarn link v1.22.19

warning ../../../package.json: No license field

success Registered "@enterprise-cmcs/macpro-security-hub-sync".

info You can now run `yarn link "@enterprise-cmcs/macpro-security-hub-sync"` in the projects where you want to use this package and it will be used instead.

✨ Done in 0.06s.

```

- npm install

- npm run build (this builds the package)

In your local yarn project that will be using the macpro-security-hub-sync package, run:

- `rm -rf node_modules`

- `yarn link "@enterprise-cmcs/macpro-security-hub-sync"`

that will return output like:

```

yarn link v1.22.19

warning ../../../package.json: No license field

success Using linked package for "@enterprise-cmcs/macpro-security-hub-sync".

✨ Done in 0.05s.

```

- `yarn install`

- Note: when testing is complete run `yarn unlink "@enterprise-cmcs/macpro-security-hub-sync"`

## Supplementary Functions

Below are additional functionalities provided by this package.

#### Automated Closure for Advanced Workflows

Starting from version 1.7.0, this package includes support for automated closure, specifically designed to enhance enterprise workflows within Jira. This feature supports complex workflows that have multiple paths to resolution. To enable automated closure, you need to specify the following parameter:

```
AUTO_CLOSE = true
```

When this parameter is set to true, the system will automatically close tickets based on predefined criteria, streamlining the workflow process and ensuring that issues are resolved efficiently.

#### Skipping Automated Closure

If the AUTO_CLOSE variable is set to false, the package will not automatically close the ticket. Instead, it will append a comment to the relevant ticket to indicate that the issue has been resolved, including the resolution date. For example, if the variable is configured as follows:

```
AUTO_CLOSE = false
```

a comment similar to the following will be added to the ticket, with "Resolved" prefixed to the ticket title:

```
`As of ${new Date(Date.now()).toDateString()}, this Security
 Hub finding has been marked resolved`
```

This feature allows for greater control over the closure process, ensuring that stakeholders are informed about the resolution without automatically closing the ticket.

#### Issue Linking Feature

Introduced in version 1.7.2, this feature facilitates the linking of newly created issues to a specified Jira issue ID using a desired link type. The link type can be any of the available Jira Issue Link Types such as 'Relates', 'Blocks', 'Duplicates', etc. To utilize this functionality, you need to set the following environment variables:

```
JIRA_LINK_ID='Pj-12'
JIRA_LINK_TYPE='Relates'
```

The above configuration will establish links between newly created tickets and 'Pj-12' under the "Relates" relationship. This feature is particularly useful for maintaining a clear and organized relationship between issues, aiding in better tracking and management.

#### Jira Ticket Assignee

This feature assigns the newly created ticket to the Jira user specified in the variable. To configure this feature, use the following variable:

```
ASSIGNEE='user1253'
```

By setting this variable, the package will ensure that the new ticket is assigned to the specified user, streamlining the task assignment process and ensuring that the appropriate team member is notified immediately. This enhances accountability and ensures that issues are addressed promptly by the correct individual.

## Contributing

Work items for this project are tracked in Jira. Check out the [project kanban board](https://qmacbis.atlassian.net/jira/software/c/projects/OY2/boards/251) to view all work items affecting this repo.

If you don't have access to Jira, would like access to Jira, or would like to drop us an idea without pursuing Jira access, please visit the [slack channel](https://cmsgov.slack.com/archives/C04MBTV136X).

## License

[![License](https://img.shields.io/badge/License-CC0--1.0--Universal-blue.svg)](https://creativecommons.org/publicdomain/zero/1.0/legalcode)

See [LICENSE](LICENSE) for full details.
