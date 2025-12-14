# Cognito User Pool
resource "aws_cognito_user_pool" "main" {
  name = "${local.name_prefix}-users"

  # Username configuration - use email as username
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # Simple password policy
  password_policy {
    minimum_length                   = 8
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = false
    require_uppercase                = false
    temporary_password_validity_days = 7
  }

  # MFA configuration - optional but encouraged
  mfa_configuration = "OPTIONAL"

  software_token_mfa_configuration {
    enabled = true
  }

  # Account recovery via email
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # Email configuration (using Cognito default)
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  # Schema attributes
  schema {
    name                     = "email"
    attribute_data_type      = "String"
    required                 = true
    mutable                  = true
    developer_only_attribute = false

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  schema {
    name                     = "name"
    attribute_data_type      = "String"
    required                 = false
    mutable                  = true
    developer_only_attribute = false

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  # Verification message customization
  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_subject        = "Your Datavibes verification code"
    email_message        = "Your verification code is {####}"
  }

  # User pool add-ons
  user_pool_add_ons {
    advanced_security_mode = "OFF"
  }

  tags = {
    Name = "${local.name_prefix}-users"
  }
}

# Cognito User Pool Client (Public - for frontend)
resource "aws_cognito_user_pool_client" "frontend" {
  name         = "${local.name_prefix}-frontend"
  user_pool_id = aws_cognito_user_pool.main.id

  # Public client - no secret
  generate_secret = false

  # Token validity
  access_token_validity  = 1  # hours
  id_token_validity      = 1  # hours
  refresh_token_validity = 30 # days

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  # Allowed OAuth flows
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes                 = ["email", "openid", "profile"]

  # Callback URLs - update with your actual frontend URLs
  callback_urls = [
    "http://localhost:5173",
    "http://localhost:5173/callback",
  ]

  logout_urls = [
    "http://localhost:5173",
  ]

  # Supported identity providers
  supported_identity_providers = ["COGNITO"]

  # Auth flows enabled
  explicit_auth_flows = [
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_USER_PASSWORD_AUTH",
  ]

  # Prevent user existence errors
  prevent_user_existence_errors = "ENABLED"

  # Read/write attributes
  read_attributes  = ["email", "name", "email_verified"]
  write_attributes = ["email", "name"]
}

# Cognito User Pool Domain (Custom Domain)
resource "aws_cognito_user_pool_domain" "main" {
  domain          = "auth.${var.domain_name}"
  certificate_arn = aws_acm_certificate_validation.auth.certificate_arn
  user_pool_id    = aws_cognito_user_pool.main.id
}

# Route53 Alias for Cognito
resource "aws_route53_record" "auth" {
  name    = aws_cognito_user_pool_domain.main.domain
  type    = "A"
  zone_id = aws_route53_zone.main.zone_id

  alias {
    evaluate_target_health = false
    name                   = aws_cognito_user_pool_domain.main.cloudfront_distribution
    zone_id                = aws_cognito_user_pool_domain.main.cloudfront_distribution_zone_id
  }
}
