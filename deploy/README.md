# Deploy as a Background Worker on Azure

This folder contains Terraform modules designed to provision infrastructure
to run MapGL Tile Renderer as a background worker on Azure.

## Getting Started

### Prerequisites

- Terraform 1.7.x or later (Visit the [Terraform documentation](https://www.terraform.io/docs) for installation and usage instructions.)
- Azure cloud account, with a few core pieces of infrastructure already provisioned:
    * a storage account, which will be used to create a queue of work requests and to write offline mbtiles back to file storage;
    * a container registry (TODO: we should host this for you)
    * a single resource group containing all of the above

### Usage

1. **Initialize Terraform** in your project directory if you haven't done so already:

```shell
terraform init
```

2. **Create a terraform.tfvars file** in your project directory. This file will contain the values for the variables defined in the `variables.tf` file, most of which refer to your existing Azure infrastructure. Example:

```ini
resource_group_name     = "mappacker"
container_registry_name = "myacr"
storage_account_name    = "mappackerplayground"
```

If managing multiple deployments, make a separate `*.tfvars` file for each,
then append `--var-file=«mydeployment».tfvars` in the `terraform` bash commands below.

3. **Plan and apply your configuration:**
```shell
terraform plan
terraform apply
```

## Support

For issues or questions regarding these modules, please open an issue in this repository.
