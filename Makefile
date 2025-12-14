.PHONY: init plan apply destroy build validate fmt clean

# Check AWS_PROFILE is set (skip in CI or if keys are present)
check-profile:
ifndef CI
ifndef AWS_ACCESS_KEY_ID
ifndef AWS_PROFILE
	$(error AWS_PROFILE is not set. Please export AWS_PROFILE=your-profile-name)
endif
endif
endif

# Initialize Terraform with backend config
init: check-profile
	terraform init -backend-config=backend.tfbackend

# Run Terraform plan
plan: check-profile
	terraform plan -out=tfplan

# Apply Terraform changes
apply: check-profile
	terraform apply tfplan

# Apply with auto-approve (use with caution)
apply-auto: check-profile
	terraform apply -auto-approve

# Destroy infrastructure
destroy: check-profile
	terraform destroy

# Build TypeScript Lambda code
build:
	cd src && bun run build

# Install TypeScript dependencies
install:
	cd src && bun install

# Validate Terraform configuration
validate:
	terraform validate

# Format Terraform files
fmt:
	terraform fmt -recursive

# Format check (for CI)
fmt-check:
	terraform fmt -recursive -check

# Clean build artifacts
clean:
	rm -rf src/dist
	rm -f tfplan

# Full setup: install dependencies, build, and init
setup: install build init

# Development workflow: build and plan
dev: build plan
