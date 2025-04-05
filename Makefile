.PHONY: serve
serve:
	hugo server -D

.PHONY: build
build:
	hugo --minify

.PHONY: article
article:
	hugo new --kind article content/$(filter-out $@,$(MAKECMDGOALS)).md

.PHONY: chart
chart:
	hugo new --kind chart content/$(filter-out $@,$(MAKECMDGOALS)).md

%:
	@:
