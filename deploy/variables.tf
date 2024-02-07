variable "resource_group_name" {
  description = "The name of the resource group"
  type        = string
}

variable "container_registry_name" {
  description = "The name of the container registry"
  type        = string
}

variable "tile_renderer_docker_image" {
  description = "The name of the docker image to launch"
  type        = string
}

variable "storage_account_name" {
  description = "The name of the existing storage account"
  type        = string
}

variable "container_app_environment_location" {
  description = "Location for the container app environment"
  type        = string
  default     = "eastus2"
}

variable "container_app_name" {
  description = "Name of the task worker container app"
  type        = string
  default     = "mappacker-worker"
}

variable "container_app_env_name" {
  description = "Name of the task worker container environment"
  type        = string
  default     = "mappacker-env"
}
