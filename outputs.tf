output "api_gateway_url" {
  description = "Base URL of the REST API Gateway"
  value       = aws_api_gateway_stage.main.invoke_url
}

output "api_gateway_id" {
  description = "ID of the REST API Gateway"
  value       = aws_api_gateway_rest_api.main.id
}

output "lambda_function_arns" {
  description = "ARNs of all Lambda functions"
  value       = { for k, v in aws_lambda_function.handlers : k => v.arn }
}

output "dynamodb_table_name" {
  description = "Name of the DynamoDB table"
  value       = aws_dynamodb_table.main.name
}

output "dynamodb_table_arn" {
  description = "ARN of the DynamoDB table"
  value       = aws_dynamodb_table.main.arn
}

output "media_bucket_name" {
  description = "Name of the S3 bucket for media uploads"
  value       = aws_s3_bucket.media.id
}

output "cognito_user_pool_id" {
  description = "ID of the Cognito User Pool"
  value       = aws_cognito_user_pool.main.id
}

output "cognito_client_id" {
  description = "ID of the Cognito User Pool Client (for frontend)"
  value       = aws_cognito_user_pool_client.frontend.id
}

output "cognito_domain" {
  description = "Cognito hosted UI domain"
  value       = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${var.aws_region}.amazoncognito.com"
}
