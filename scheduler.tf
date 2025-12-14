resource "aws_scheduler_schedule_group" "main" {
  name = "${local.name_prefix}-schedules"
}

# Output the Schedule Group Name for Lambda to use
output "scheduler_group_name" {
  value = aws_scheduler_schedule_group.main.name
}

# Output the Scheduler Role ARN for Lambda to use
output "scheduler_role_arn" {
  value = aws_iam_role.scheduler.arn
}
