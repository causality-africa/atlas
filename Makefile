.PHONY: serve
serve:
	hugo server -D


.PHONY: build
build:
	hugo --minify


.PHONY: article
article:
	hugo new --kind article content/articles/$(filter-out $@,$(MAKECMDGOALS)).md


.PHONY: indicator
indicator:
	hugo new --kind indicator content/$(filter-out $@,$(MAKECMDGOALS)).md


%:
	@:
