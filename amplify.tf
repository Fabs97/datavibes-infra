resource "aws_amplify_app" "main" {
  name       = "${local.name_prefix}-frontend"
  repository = "https://github.com/${var.github_repository}"

  # GitHub Access Token
  access_token = var.github_token

  # Build settings
  build_spec = <<-EOT
    version: 1
    frontend:
      phases:
        preBuild:
          commands:
            - curl -fsSL https://bun.sh/install | bash
            - export BUN_INSTALL="$HOME/.bun"
            - export PATH="$BUN_INSTALL/bin:$PATH"
            - cd app
            - bun install
        build:
          commands:
            - export BUN_INSTALL="$HOME/.bun"
            - export PATH="$BUN_INSTALL/bin:$PATH"
            - bun run build
      artifacts:
        baseDirectory: app/dist
        files:
          - '**/*'
      cache:
        paths:
          - app/node_modules/**/*
  EOT

  # Environment Variables
  environment_variables = {
    VITE_API_URL              = "https://api.${var.domain_name}"
    VITE_COGNITO_USER_POOL_ID = aws_cognito_user_pool.main.id
    VITE_COGNITO_CLIENT_ID    = aws_cognito_user_pool_client.frontend.id
    VITE_COGNITO_REGION       = var.aws_region
    AMPLIFY_DIFF_DEPLOY       = "false" # Always deploy
  }

  # Redirects for SPA
  custom_rule {
    source = "</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json)$)([^.]+$)/>"
    target = "/index.html"
    status = "200"
  }
}

# Main Branch (Prod)
resource "aws_amplify_branch" "main" {
  app_id      = aws_amplify_app.main.id
  branch_name = "main"

  framework = "React"
  stage     = "PRODUCTION"

  environment_variables = {
    VITE_API_URL = "https://api.${var.domain_name}"
  }
}

# Dev Branch (Dev)
resource "aws_amplify_branch" "dev" {
  app_id      = aws_amplify_app.main.id
  branch_name = "dev"

  framework = "React"
  stage     = "DEVELOPMENT"

  # We might want a different API URL for dev if we had a dev environment
  # For now, pointing to the same API but we could use a different stage if we had one
  environment_variables = {
    VITE_API_URL = "https://api.${var.domain_name}"
  }
}

# Domain Association
resource "aws_amplify_domain_association" "main" {
  app_id      = aws_amplify_app.main.id
  domain_name = var.domain_name

  # Prod: datavibes.datareply.de
  sub_domain {
    branch_name = aws_amplify_branch.main.branch_name
    prefix      = ""
  }

  # Dev: dev.datavibes.datareply.de
  sub_domain {
    branch_name = aws_amplify_branch.dev.branch_name
    prefix      = "dev"
  }

  # Wait for verification
  wait_for_verification = false
}
