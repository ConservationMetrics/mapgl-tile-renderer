# Stuff managed outside of this module
data "azurerm_resource_group" "this" {
  name = var.resource_group_name
}
data "azurerm_container_registry" "this" {
  name                = var.container_registry_name
  resource_group_name = var.resource_group_name
}
data "azurerm_storage_account" "this" {
  name                = var.storage_account_name
  resource_group_name = var.resource_group_name
}

# Azure Storage Queue
resource "azurerm_storage_queue" "mappacker_requests" {
  name                 = "mappacker-requests"
  storage_account_name = var.storage_account_name
}

# Azure Container App
resource "azurerm_container_app_environment" "this" {
  name                = var.container_app_env_name
  resource_group_name = var.resource_group_name
  location            = var.container_app_environment_location
}
resource "azurerm_container_app" "mapgl_tile_renderer" {
  name                         = var.container_app_name
  resource_group_name          = var.resource_group_name
  container_app_environment_id = azurerm_container_app_environment.this.id
  revision_mode                = "Single"

  registry {
    server               = data.azurerm_container_registry.this.login_server
    username             = data.azurerm_container_registry.this.admin_username
    password_secret_name = "containerregistry"
  }
  # This secret is not used by the application code, but is used by for
  # Azure Container App to download the image.
  # TODO: Remove this secret by instead using a user-assigned managed identity
  # for Container App to connect to registry (see: registry {identity:...})
  secret {
    name  = "containerregistry"
    value = data.azurerm_container_registry.this.admin_password
  }

  # This secret is used for scale rules.
  secret {
    name  = "queueconnection"
    value = data.azurerm_storage_account.this.primary_connection_string
  }

  template {
    container {
      name   = "mbgl-tile-renderer"
      image  = var.tile_renderer_docker_image
      cpu    = "0.25"
      memory = "0.5Gi"

      env {
        name  = "QueueName"
        value = "mappacker-requests"
      }
      env {
        name  = "QueueConnectionString"
        value = data.azurerm_storage_account.this.primary_connection_string
      }

      volume_mounts {
        name = "mappacker-maps"
        path = "/maps/"
      }
    }

    volume {
      name         = "mappacker-maps"
      storage_name = "mappacker-maps"
      storage_type = "AzureFile"
    }

    min_replicas = 0
    max_replicas = 5

    azure_queue_scale_rule {
      name         = "scale-when-there-is-work"
      queue_name   = azurerm_storage_queue.mappacker_requests.name
      queue_length = 1
      authentication {
        secret_name       = "queueconnection"
        trigger_parameter = "connection"
      }
    }
  }

  # no external ingress is needed for the worker
  # ingress { external_enabled = false }

}
