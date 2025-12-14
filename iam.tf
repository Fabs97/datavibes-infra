resource "aws_iam_role" "lambda_execution" {
  name               = "${local.name_prefix}-lambda-execution"
  assume_role_policy = file("${path.module}/policies/lambda-assume-role.json")
}

resource "aws_iam_policy" "lambda_execution" {
  name   = "${local.name_prefix}-lambda-execution"
  policy = file("${path.module}/policies/lambda-execution.json")
}

resource "aws_iam_role_policy_attachment" "lambda_execution" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = aws_iam_policy.lambda_execution.arn
}

# EventBridge Scheduler Role
resource "aws_iam_role" "scheduler" {
  name = "${local.name_prefix}-scheduler-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "scheduler.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_policy" "scheduler_policy" {
  name = "${local.name_prefix}-scheduler-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = [
          "arn:aws:lambda:${var.aws_region}:${data.aws_caller_identity.current.account_id}:function:${local.name_prefix}-Worker_process_message"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "scheduler_attachment" {
  role       = aws_iam_role.scheduler.name
  policy_arn = aws_iam_policy.scheduler_policy.arn
}
