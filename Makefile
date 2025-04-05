.PHONY: serve
serve:
	hugo server -D

.PHONY: build
build:
	hugo --minify

.PHONY: article
article:
	hugo new --kind article content/articles/$(filter-out $@,$(MAKECMDGOALS)).md

.PHONY: line-chart
line-chart:
	hugo new --kind line-chart content/$(filter-out $@,$(MAKECMDGOALS)).md

%:
	@:
