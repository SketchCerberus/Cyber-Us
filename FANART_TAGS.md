# Fanart tags

Add `tags: ['Nome do personagem', 'Arte digital', 'Neon']` to each approved entry
in `approvedFanarts` in fanarts-showcase.js. Keep up to eight tags per artwork,
each with up to 32 characters. Duplicates ignore case and accents. No artwork or
artist was invented to populate the gallery.

Search matches artist names and tags without requiring accents or matching case.
Click tags in the filter bar or beneath an artwork. Multiple selected tags must
all match. Clear filters restores the gallery. Artwork without tags still appears
in the full gallery and artist searches. Filters affect the gallery, not the
decorative rotating showcase. The empty gallery explains why search is disabled.

Submissions remain closed; this adds discovery for approved editorial entries.
Tests cover normalization, limits, combined search, filter controls, empty results,
reset, localization and failed-image removal counts.
