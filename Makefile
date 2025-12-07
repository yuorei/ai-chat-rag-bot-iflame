PROJECT_NAME ?= ai-chat-iflame
DOCKER_NETWORK ?= $(PROJECT_NAME)-net

WEB_IMAGE ?= $(PROJECT_NAME)-web
FRONT_IMAGE ?= $(PROJECT_NAME)-frontend

WEB_CONTAINER ?= $(PROJECT_NAME)-web
FRONT_CONTAINER ?= $(PROJECT_NAME)-frontend

.PHONY: help network-up network-down web-build web-run web-stop frontend-build frontend-run frontend-stop

help:
	@echo "Usage:"
	@echo "  make web-run        # Build server image and run Flask backend container"
	@echo "  make frontend-run   # Build frontend image and run nginx container"
	@echo "  make web-stop       # Stop backend container"
	@echo "  make frontend-stop  # Stop frontend container"
	@echo "  make network-down   # Remove the shared docker network"

network-up:
	@if ! docker network inspect $(DOCKER_NETWORK) >/dev/null 2>&1; then \
		echo "Creating network $(DOCKER_NETWORK)..."; \
		docker network create $(DOCKER_NETWORK); \
	fi

network-down:
	-@docker network rm $(DOCKER_NETWORK) >/dev/null 2>&1 || true

web-build:
	docker build -t $(WEB_IMAGE) -f server/Dockerfile server

web-run: web-build network-up
	docker run --rm --name $(WEB_CONTAINER) \
		--env-file .env \
		-p 8000:8000 \
		-v $(CURDIR)/server:/app \
		-v $(CURDIR)/data:/app/data \
		--network $(DOCKER_NETWORK) \
		$(WEB_IMAGE)

web-stop:
	-@docker stop $(WEB_CONTAINER) >/dev/null 2>&1 || true

frontend-build:
	docker build -t $(FRONT_IMAGE) -f front/Dockerfile front

frontend-run: frontend-build network-up
	docker run --rm --name $(FRONT_CONTAINER) \
		-p 3000:80 \
		-v $(CURDIR)/front:/usr/share/nginx/html:ro \
		--network $(DOCKER_NETWORK) \
		$(FRONT_IMAGE)

frontend-stop:
	-@docker stop $(FRONT_CONTAINER) >/dev/null 2>&1 || true
