# REST API Gateway
resource "aws_api_gateway_rest_api" "main" {
  name        = "${local.name_prefix}-api"
  description = "REST API for ${var.project_name}"

  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

# Create API resources for each unique path segment
# This handles nested paths like /events/{id}/polls/{pollId}
resource "aws_api_gateway_resource" "paths" {
  for_each = local.path_resources

  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id = each.value.parent != null ? (
    aws_api_gateway_resource.paths[each.value.parent].id
  ) : aws_api_gateway_rest_api.main.root_resource_id
  path_part = each.value.path_part

  # Ensure parent resources are created first
  depends_on = [aws_api_gateway_rest_api.main]
}

# Create methods for each handler
resource "aws_api_gateway_method" "handlers" {
  for_each = local.api_handlers

  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.paths[each.value.path].id
  http_method   = each.value.method
  authorization = "NONE"
}

# Lambda integrations for each handler
resource "aws_api_gateway_integration" "handlers" {
  for_each = local.api_handlers

  rest_api_id             = aws_api_gateway_rest_api.main.id
  resource_id             = aws_api_gateway_resource.paths[each.value.path].id
  http_method             = aws_api_gateway_method.handlers[each.key].http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.handlers[each.key].invoke_arn
}

# Lambda permissions for API Gateway
resource "aws_lambda_permission" "api_gateway" {
  for_each = local.api_handlers

  statement_id  = "AllowAPIGatewayInvoke-${replace(each.key, "/[^a-zA-Z0-9]/", "-")}"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.handlers[each.key].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

# API Deployment
resource "aws_api_gateway_deployment" "main" {
  rest_api_id = aws_api_gateway_rest_api.main.id

  triggers = {
    redeployment = sha256(jsonencode([
      aws_api_gateway_resource.paths,
      aws_api_gateway_method.handlers,
      aws_api_gateway_integration.handlers,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    aws_api_gateway_integration.handlers
  ]
}

# API Stage
resource "aws_api_gateway_stage" "main" {
  deployment_id = aws_api_gateway_deployment.main.id
  rest_api_id   = aws_api_gateway_rest_api.main.id
  stage_name    = var.environment
}

# Enable CORS for all resources
resource "aws_api_gateway_method" "options" {
  for_each = local.path_resources

  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.paths[each.key].id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "options" {
  for_each = local.path_resources

  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.paths[each.key].id
  http_method = aws_api_gateway_method.options[each.key].http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "options" {
  for_each = local.path_resources

  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.paths[each.key].id
  http_method = aws_api_gateway_method.options[each.key].http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }

  response_models = {
    "application/json" = "Empty"
  }
}

resource "aws_api_gateway_integration_response" "options" {
  for_each = local.path_resources

  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.paths[each.key].id
  http_method = aws_api_gateway_method.options[each.key].http_method
  status_code = aws_api_gateway_method_response.options[each.key].status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,PUT,DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}
