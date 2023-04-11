export const searchJiraResponse = {
  issues: [
    {
      fields: {
        summary: "Sample SecurityHub Finding",
      },
    },
  ],
};

export const addNewIssueJiraResponse = {
  key: "TEST-15",
};

export const listAccountAliasesResponse = {
  $metadata: {},
  AccountAliases: ["my-account-alias"],
};

export const getFindingsCommandResponse = {
  Findings: [
    {
      SchemaVersion: undefined,
      Id: undefined,
      ProductArn: undefined,
      GeneratorId: undefined,
      AwsAccountId: undefined,
      CreatedAt: undefined,
      UpdatedAt: undefined,
      Title: undefined,
      Description: undefined,
      Resources: undefined,
    },
  ],
  $metadata: {},
};
