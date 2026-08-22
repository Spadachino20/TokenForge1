# Design skills vendored for TMF

These Claude Code skills are installed here so any session working on this repo can call
them directly (Skill tool) instead of relying only on a static `DESIGN.md`. Each one is
vendored (copied in, not a git submodule) from its upstream repo, MIT-licensed, with the
original `LICENSE` kept alongside it.

| Skill folder | Use it for | Source |
| --- | --- | --- |
| `ui-ux-pro-max/` | Searchable UI/UX database: styles, palettes, font pairings, UX rules, GSAP presets, chart types, stack-specific guidance. Good for picking/validating concrete design decisions. | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) |
| `taste-skill/` (`design-taste-frontend`) | General "anti-slop" pass: infers design direction from the brief, avoids templated/generic AI UI, tunes variance/motion/density. Good default for any new page or component. | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) |
| `redesign-skill/` (`redesign-existing-projects`) | Built specifically for **existing** codebases like TMF: audits the current UI first, flags generic AI patterns, then fixes layout/spacing/hierarchy without breaking functionality. This is the one to reach for when reworking pages we already shipped. | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) (skill `redesign-skill` folder) |
| `design-motion-principles/` | Motion/interaction design: build purposeful animations or audit existing ones for AI-slop motion (abrupt state changes, no easing, missing reduced-motion support). | [kylezantos/design-motion-principles](https://github.com/kylezantos/design-motion-principles) |

## Two related tools that were *not* vendored as skills

- **Awesome Claude Design** ([VoltAgent/awesome-claude-design](https://github.com/VoltAgent/awesome-claude-design)) is a curated
  library of 68 `DESIGN.md` inspiration files, not a runnable skill — there's nothing to
  install. Browse it when we want a specific aesthetic direction to seed a fresh `DESIGN.md`,
  then let `taste-skill`/`redesign-skill` do the actual implementation work.
- **design-md-chrome** ([bergside/design-md-chrome](https://github.com/bergside/design-md-chrome)) is a
  Chrome extension, not a repo skill — it has to be loaded manually in a browser
  (`chrome://extensions` → Developer mode → Load unpacked). It scrapes a live site's styles
  and exports a `DESIGN.md`/`SKILL.md`. Useful if we want to reverse-engineer a reference
  site's tokens, but it runs in the user's browser, not in this session.

## Suggested workflow for redesigning TMF pages

1. `redesign-skill` first on any page that already exists — audit before touching code.
2. `ui-ux-pro-max` to pull in concrete tokens (palette, type, spacing) instead of guessing.
3. `design-motion-principles` once layout is settled, to add/clean up motion.
4. `taste-skill` as a general quality pass on anything new (new page/section from scratch).
