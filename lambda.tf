# Build trigger - rebuilds when source files change
resource "null_resource" "lambda_build" {
  triggers = {
    source_hash = sha256(join("", [
      for f in fileset("${path.module}/src", "**/*.ts") :
      filesha256("${path.module}/src/${f}")
    ]))
  }

  provisioner "local-exec" {
    command     = "npm run build"
    working_dir = "${path.module}/src"
  }
}

# Create archive for each handler
data "archive_file" "handlers" {
  for_each = local.handlers

  type        = "zip"
  source_dir  = "${path.module}/src/dist/${each.key}"
  output_path = "${path.module}/src/dist/${each.key}.zip"

  depends_on = [null_resource.lambda_build]
}

# Lambda functions for each handler
resource "aws_lambda_function" "handlers" {
  for_each = local.handlers

  function_name = "${local.name_prefix}-${each.key}"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory_size   = 256

  filename         = data.archive_file.handlers[each.key].output_path
  source_code_hash = data.archive_file.handlers[each.key].output_base64sha256

  environment {
    variables = {
      ENVIRONMENT          = var.environment
      PROJECT_NAME         = var.project_name
      LOG_LEVEL            = var.environment == "prod" ? "info" : "debug"
      DYNAMODB_TABLE       = aws_dynamodb_table.main.name
      AWS_REGION_NAME      = var.aws_region
      MEDIA_BUCKET         = aws_s3_bucket.media.id
      SLACK_SECRET_ARN     = aws_secretsmanager_secret.slack_credentials.arn
      SCHEDULER_GROUP_NAME = aws_scheduler_schedule_group.main.name
      SCHEDULER_ROLE_ARN   = aws_iam_role.scheduler.arn
    }
  }
}

# CloudWatch Log Groups for each handler
resource "aws_cloudwatch_log_group" "handlers" {
  for_each = local.handlers

  name              = "/aws/lambda/${local.name_prefix}-${each.key}"
  retention_in_days = var.environment == "prod" ? 30 : 7
}
