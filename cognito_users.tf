# Cognito Users - Loaded from external JSON file
# Edit users.json to add/remove users, then run `make apply`

locals {
  # Load users from external JSON file
  users_data = jsondecode(file("${path.module}/users.json"))

  # Transform to map keyed by email
  cognito_users = {
    for user in local.users_data.users :
    user.email => {
      name = user.name
    }
  }
}

# Create users in Cognito User Pool
resource "aws_cognito_user" "users" {
  for_each = local.cognito_users

  user_pool_id = aws_cognito_user_pool.main.id
  username     = each.key

  attributes = {
    email          = each.key
    email_verified = true
    name           = each.value.name
  }

  # Temporary password - user must change on first login
  # In production, use a more secure method like SSM Parameter Store
  temporary_password = "TempPass123!"

  # Don't send welcome email with temporary password
  # User will receive password reset email instead
  message_action = "SUPPRESS"

  lifecycle {
    ignore_changes = [
      # Ignore password changes after initial creation
      temporary_password,
    ]
  }
}
