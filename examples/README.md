# Example Usage

This is intended to be an example of how a project might install the package and automate the running of it with GitHub Actions.

It has been made to be a very stripped down implementation.

To see a real world implementation, checkout [these docs](https://www.npmjs.com/package/@enterprise-cmcs/macpro-security-hub-sync)

## with NPM

npm install @enterprise-cmcs/macpro-security-hub-sync --save-dev

## or with Yarn

yarn add @enterprise-cmcs/macpro-security-hub-sync --dev

## or with PNPM

pnpm add @enterprise-cmcs/macpro-security-hub-sync --save-dev

## or with Bun

bun add @enterprise-cmcs/macpro-security-hub-sync --dev

## Additional Variables Needed

export JIRA_HOST=yourorg.atlassian.net

export JIRA_PROJECT=OY2 // This is the ID for the Jira Project you want to interact with

export JIRA_USERNAME="<youruser@gswell.com>"

export JIRA_TOKEN="a very long string" // This should be a [Personal Access Token](https://confluence.atlassian.com/enterprise/using-personal-access-tokens-1026032365.html) that you will need to generate
