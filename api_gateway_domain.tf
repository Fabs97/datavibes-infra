# Custom Domain for API
resource "aws_api_gateway_domain_name" "main" {
  domain_name     = "api.${var.domain_name}"
  certificate_arn = aws_acm_certificate_validation.api.certificate_arn
  security_policy = "TLS_1_2"
}

# Base Path Mapping
resource "aws_api_gateway_base_path_mapping" "main" {
  api_id      = aws_api_gateway_rest_api.main.id
  stage_name  = aws_api_gateway_stage.main.stage_name
  domain_name = aws_api_gateway_domain_name.main.domain_name
}

# Route53 Alias for API
resource "aws_route53_record" "api" {
  name    = aws_api_gateway_domain_name.main.domain_name
  type    = "A"
  zone_id = aws_route53_zone.main.zone_id

  alias {
    evaluate_target_health = true
    name                   = aws_api_gateway_domain_name.main.cloudfront_domain_name
    zone_id                = aws_api_gateway_domain_name.main.cloudfront_zone_id
  }
}
