resource "aws_secretsmanager_secret" "slack_credentials" {
  name        = "${local.name_prefix}-slack-credentials"
  description = "Slack Bot Token and Channel ID for DataVibes notifications"
}

# We don't set the secret value here to avoid committing secrets to git.
# The user must set the value manually in the AWS Console or via CLI.
# Value format: {"token": "xoxb-...", "channelId": "C..."}
