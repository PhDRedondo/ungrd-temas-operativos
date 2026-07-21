# Makefile — atajos locales

.PHONY: help install setup dev harness smoke ci docs stack-up stack-down

help:
	@echo "UNGRD Temas Operativos"
	@echo "  make install   — npm install"
	@echo "  make setup     — db:setup"
	@echo "  make dev       — next dev"
	@echo "  make harness   — env + back + front"
	@echo "  make smoke     — E2E API"
	@echo "  make ci        — lint + typecheck + smoke"
	@echo "  make stack-up  — docker compose up"
	@echo "  make docs      — listar docs/"

install:
	npm install

setup:
	npm run db:setup

dev:
	npm run dev

harness:
	npm run harness

smoke:
	npm run smoke

ci:
	npm run ci:local

stack-up:
	npm run stack:up

stack-down:
	npm run stack:down

docs:
	@ls -1 docs/*.md
