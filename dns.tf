# Route53 Zone for datavibes.datareply.de
resource "aws_route53_zone" "main" {
  name = var.domain_name
}

# Output nameservers for delegation in parent zone
output "nameservers" {
  description = "Nameservers for the created zone. Add these to the parent zone."
  value       = aws_route53_zone.main.name_servers
}

# ACM Certificate for API (eu-central-1)
resource "aws_acm_certificate" "api" {
  domain_name       = "api.${var.domain_name}"
  validation_method = "DNS"

  tags = {
    Name = "api-${var.domain_name}"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# DNS Validation Record for API Cert
resource "aws_route53_record" "api_validation" {
  for_each = {
    for dvo in aws_acm_certificate.api.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = aws_route53_zone.main.zone_id
}

# Certificate Validation for API
resource "aws_acm_certificate_validation" "api" {
  certificate_arn         = aws_acm_certificate.api.arn
  validation_record_fqdns = [for record in aws_route53_record.api_validation : record.fqdn]
}

# ACM Certificate for Auth (us-east-1) - Required for Cognito
resource "aws_acm_certificate" "auth" {
  provider          = aws.us-east-1
  domain_name       = "auth.${var.domain_name}"
  validation_method = "DNS"

  tags = {
    Name = "auth-${var.domain_name}"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# DNS Validation Record for Auth Cert
resource "aws_route53_record" "auth_validation" {
  for_each = {
    for dvo in aws_acm_certificate.auth.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = aws_route53_zone.main.zone_id
}

# Certificate Validation for Auth
resource "aws_acm_certificate_validation" "auth" {
  provider                = aws.us-east-1
  certificate_arn         = aws_acm_certificate.auth.arn
  validation_record_fqdns = [for record in aws_route53_record.auth_validation : record.fqdn]
}
