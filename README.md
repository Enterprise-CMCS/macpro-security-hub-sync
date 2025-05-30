# ⚠️ DEPRECATED - macpro-security-hub-sync v1

> **🚨 IMPORTANT NOTICE: This package (v1) is deprecated and no longer maintained.**
>
> **All users should migrate to the new version:** [mac-fc-security-hub-visibility v2](https://github.com/Enterprise-CMCS/mac-fc-security-hub-visibility/tree/v2)
>
> **This v1 package should only be used by teams still using Atlassian Jira who cannot immediately migrate.**

---

## About This Package

This NPM module creates Jira issues for AWS Security Hub findings in your current AWS account. However, **this version is deprecated** and users should migrate to the newer, actively maintained version.

[![Slack](https://img.shields.io/badge/Slack-channel-purple.svg)](https://cmsgov.slack.com/archives/C04MBTV136X)
[![Latest Release](https://img.shields.io/github/release/Enterprise-CMCS/macpro-security-hub-sync.svg)](https://github.com/Enterprise-CMCS/macpro-security-hub-sync/releases/latest)
[![NPM Version](https://img.shields.io/npm/v/@enterprise-cmcs/macpro-security-hub-sync/latest.svg)](https://www.npmjs.com/package/@enterprise-cmcs/macpro-security-hub-sync)
[![Maintainability](https://api.codeclimate.com/v1/badges/c8dfe630c7857d3ce591/maintainability)](https://codeclimate.com/github/Enterprise-CMCS/macpro-security-hub-sync/maintainability)
[![Test Coverage](https://api.codeclimate.com/v1/badges/c8dfe630c7857d3ce591/test_coverage)](https://codeclimate.com/github/Enterprise-CMCS/macpro-security-hub-sync/test_coverage)
[![Semantic Release](https://img.shields.io/badge/semantic--release-angular-e10079?logo=semantic-release)](https://github.com/semantic-release/semantic-release)
[![Dependabot](https://badgen.net/badge/Dependabot/enabled/green?icon=dependabot)](https://dependabot.com/)
[![Code Style: Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)

## Migration Notice

**Before using this package, please consider migrating to the newer version:**

- **New Version**: [mac-fc-security-hub-visibility v2](https://github.com/Enterprise-CMCS/mac-fc-security-hub-visibility/tree/v2)
- **Recommended for**: All Enterprise Jira teams
- **This v1 version**: Only for teams using Atlassian Jira who cannot immediately migrate

## Usage (Deprecated)

> **⚠️ Warning**: This usage information is for the deprecated v1 package. Please migrate to v2 instead.

### Environment Variables

Set the following environment variables:

```bash
export JIRA_HOST=yourorg.atlassian.net
export JIRA_PROJECT=OY2  # Jira Project ID
export JIRA_USERNAME="myuser@example.com"
export JIRA_TOKEN="your-personal-access-token"  # Generate from Atlassian
```

The `JIRA_TOKEN` should be a [Personal Access Token](https://confluence.atlassian.com/enterprise/using-personal-access-tokens-1026032365.html).

### Installation

```bash
npm install @enterprise-cmcs/macpro-security-hub-sync --save-dev
```

### Basic Usage

```javascript
import { SecurityHubJiraSync } from "@enterprise-cmcs/macpro-security-hub-sync";

await new SecurityHubJiraSync().sync();
```

### Advanced Configuration

```javascript
await new SecurityHubJiraSync({
  region: "us-west-2", // Default: "us-east-1"
  severities: ["HIGH", "CRITICAL"], // Default: ["MEDIUM", "HIGH", "CRITICAL"]
  customJiraFields: {
    customfield_14117: [{ value: "Platform Team" }],
    customfield_14151: [{ value: "Not Applicable" }],
  },
}).sync();
```

## How It Works

### Overview

This package synchronizes AWS Security Hub findings to Jira:

- **One Issue Per Finding Type**: Each Security Hub finding type (title) creates a single Jira issue, regardless of how many resources are affected
- **Severity Filtering**: By default, only CRITICAL and HIGH severity findings create Jira issues (configurable)
- **Automatic Closure**: When findings are resolved in Security Hub, corresponding Jira issues are automatically closed on the next sync

### Sync Process

1. **Retrieve Open Issues**: Get all open Security Hub-related Jira issues (identified by label convention)
2. **Get Current Findings**: Fetch all current findings from AWS Security Hub
3. **Close Resolved Issues**: Close Jira issues for findings that are no longer active
4. **Create New Issues**: Create Jira issues for new findings that don't have existing issues

## Local Development (Deprecated)

> **⚠️ Note**: These instructions are for the deprecated v1 package.

### Testing with Yarn Link

1. In your local clone of macpro-security-hub-sync:

   ```bash
   yarn link
   npm install
   npm run build
   ```

1. In your test project:

   ```bash
   rm -rf node_modules
   yarn link "@enterprise-cmcs/macpro-security-hub-sync"
   yarn install
   ```

1. When testing is complete

   ```bash
   yarn unlink "@enterprise-cmcs/macpro-security-hub-sync"
   yarn unlink  # Run this in the macpro-security-hub-sync directory
   ```

## Advanced Features (Deprecated)

### Automated Closure (v1.7.0+)

Control automatic ticket closure:

```bash
AUTO_CLOSE=true   # Automatically close resolved tickets
AUTO_CLOSE=false  # Add resolution comment instead of closing
```

### Issue Linking (v1.7.2+)

Link new issues to existing Jira issues:

```bash
JIRA_FEATURE_KEY='PJ-12'
JIRA_LINK_TYPE='Relates'
JIRA_LINK_DIRECTION='inward'  # v1.11.0+
```

### Custom Labels Configuration

Configure custom labels with JSON:

```bash
jira-labels-config='[{"labelField":"ProductName","labelPrefix":"product","labelDelimiter":":"}, {"labelField":"severity"}]'
```

### Multi-Product Support

Include findings from other security products:

```bash
include-all-products=true
skip-products="Trivy, Guard Duty"
```

### Ticket Assignment

Assign new tickets to specific users:

```bash
ASSIGNEE='user1253'
```

### Resource Information (v1.9.0+)

Non-compliant resources are automatically included in issue descriptions:

```markdown
Resource Id | Partition | Region | Type
resource-xxvysdh | aws | us-east-1 | AwsDynamoDbTable
```

## Contributing

> **⚠️ Note**: This project is deprecated. Consider contributing to the new version instead.

- **Project Board**: [Jira Kanban Board](https://qmacbis.atlassian.net/jira/software/c/projects/OY2/boards/251)
- **Slack Channel**: [#macpro-security-hub-sync](https://cmsgov.slack.com/archives/C04MBTV136X)

## License

[![License](https://img.shields.io/badge/License-CC0--1.0--Universal-blue.svg)](https://creativecommons.org/publicdomain/zero/1.0/legalcode)

See [LICENSE](LICENSE) for full details.

---

## 🚨 Final Reminder

**This package is deprecated. Please migrate to [mac-fc-security-hub-visibility v2](https://github.com/Enterprise-CMCS/mac-fc-security-hub-visibility/tree/v2) for continued support and new features.**
