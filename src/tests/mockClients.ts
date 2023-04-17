import { IAMClient, ListAccountAliasesCommand } from "@aws-sdk/client-iam";
import {
  SecurityHubClient,
  GetFindingsCommand,
} from "@aws-sdk/client-securityhub";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { mockClient } from "aws-sdk-client-mock";
import * as mockResponses from "./mockResponses";
import { Constants } from "./constants";

// IAM
const iamClient = mockClient(IAMClient);
iamClient
  .on(ListAccountAliasesCommand, {})
  .resolves(mockResponses.listAccountAliasesResponse);

// Security Hub
const sHClient = mockClient(SecurityHubClient);
sHClient
  .on(GetFindingsCommand, {})
  .resolvesOnce({
    ...mockResponses.getFindingsCommandResponse,
    NextToken: "test",
  })
  .resolves({
    ...mockResponses.getFindingsCommandResponse,
    ...{
      Findings: [
        {
          ...mockResponses.getFindingsCommandResponse.Findings[0],
          ProductFields: {
            Title: "Test Finding",
            StandardsControlArn: `arn:aws:securityhub:${Constants.TEST_AWS_REGION}:${Constants.TEST_AWS_ACCOUNT_ID}:control/aws-foundational-security-best-practices/v/1.0.0/KMS.3`,
          },
        },
      ],
    },
  });

// STS
const stsClient = mockClient(STSClient);
stsClient.on(GetCallerIdentityCommand, {}).resolves({
  Account: Constants.TEST_AWS_ACCOUNT_ID,
});
