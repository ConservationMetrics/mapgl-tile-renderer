terraform {
  required_version = ">= 1.5.7"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.86"
    }
  }
}

provider "azurerm" {
  features {}
}
