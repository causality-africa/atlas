.PHONY: serve
serve:
	hugo server -D

.PHONY: build
build:
	hugo --minify

.PHONY: article
article:
	hugo new --kind article content/en/articles/$(filter-out $@,$(MAKECMDGOALS)).md

.PHONY: visual
visual:
	hugo new --kind visual content/en/explore/$(filter-out $@,$(MAKECMDGOALS)).md

%:
	@:
