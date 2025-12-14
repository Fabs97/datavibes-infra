locals {
  name_prefix = "${var.project_name}-${var.environment}"

  # Discover handlers from folder structure: src/handlers/{METHOD}_{path}/
  # Path segments use underscores: GET_events_{id} -> GET /events/{id}
  handler_dirs = fileset("${path.module}/src/handlers", "**/index.ts")

  handlers = {
    for dir in local.handler_dirs :
    dirname(dir) => {
      name = dirname(dir)
      # First segment is the HTTP method
      method = split("_", dirname(dir))[0]
      # Remaining segments form the path, with {xxx} for path parameters
      path_segments = [
        for segment in slice(split("_", dirname(dir)), 1, length(split("_", dirname(dir)))) :
        startswith(segment, "{") ? segment : segment
      ]
      path = join("/", [
        for segment in slice(split("_", dirname(dir)), 1, length(split("_", dirname(dir)))) :
        startswith(segment, "{") ? segment : segment
      ])
    }
  }

  # Filter handlers for API Gateway (exclude workers)
  api_handlers = {
    for k, v in local.handlers : k => v
    if contains(["GET", "POST", "PUT", "DELETE"], v.method)
  }

  # Build a set of all unique path prefixes for creating API Gateway resources
  # e.g., ["events", "events/{id}", "events/{id}/polls", "events/{id}/polls/{pollId}"]
  all_path_prefixes = toset(flatten([
    for handler_key, handler in local.api_handlers : [
      for i in range(1, length(handler.path_segments) + 1) :
      join("/", slice(handler.path_segments, 0, i))
    ]
  ]))

  # Create a map of path -> parent path for resource creation
  path_resources = {
    for path in local.all_path_prefixes :
    path => {
      path      = path
      path_part = element(split("/", path), length(split("/", path)) - 1)
      parent    = length(split("/", path)) > 1 ? join("/", slice(split("/", path), 0, length(split("/", path)) - 1)) : null
      depth     = length(split("/", path))
    }
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
