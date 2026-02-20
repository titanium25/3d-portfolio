---
name: doc-updater
description: Automatically evaluates whether a code change is significant enough to warrant updating CLAUDE.md and/or README.md, then writes the relevant updates. Use after any meaningful feature addition, architectural change, or system overhaul in the 3d-portfolio project.
---

# Doc Updater — 3D Portfolio

After making code changes, evaluate whether the change is **major enough to document**, and if so, update `CLAUDE.md` and/or `README.md` to reflect the new state of the project.

Goal: keep documentation trustworthy — don't document every tweak, but never let a significant change go unrecorded.

---

## Step 1: Classify the Change

### UPDATE docs if the change involves:

| Category | Examples |
|---|---|
| New system or feature | Map view, sound system, new character type |
| New file(s) in `src/` | New module, class, UI component |
| Architecture change | Collision refactor, animation state machine redesign |
| New controls / key bindings | M for map, touch controls |
| New character or NPC | Cat companion, NPC with dialogue |
| New stop type or interaction | New overlay style, new interaction mechanic |
| Timeline content changed | Added/removed/edited career milestone entries |
| Ground/map structure changed | New zones, shape change, new visual areas |
| Performance strategy changed | New loading approach, shadow resolution, caching |
| Significant gameplay constants | Proximity radius change, map size change |
| Tech stack change | New dependency, build tool change |

### SKIP docs if the change is:

| Category | Examples |
|---|---|
| Minor tuning | Camera distance 5 → 6, lerp 0.045 → 0.04 |
| Bug fix (no behavior change) | Null check fix, typo correction |
| Style/formatting | Variable rename, file reformat |
| Debug code | Added/removed console.log |
| Comment-only changes | Updated inline comments |
| Trivial constant tweak | Emissive intensity ±0.05 |

**Litmus test:** *"Would a developer new to this project need to know about this change to understand how the system works?"* — if yes, document it.

---

## Step 2: Decide Which Files to Update

| Change Type | CLAUDE.md | README.md |
|---|---|---|
| New system/feature | Yes — full technical details | Yes — Core Features / Current Implementation |
| New character type | Yes — full class docs | Yes — mention in features |
| Architecture refactor | Yes — update affected section | Usually no |
| New key binding/control | Yes — Controls section | Yes — Controls section |
| New file added | Yes — Project Structure tree | Usually no |
| Timeline content change | Yes — Timeline section | No |
| Tech stack / dependency | Yes — Dependencies | Yes — Tech Stack |
| Future enhancement completed | Yes — `[ ]` → `[x]` | Yes — move to Current Implementation |
| New future enhancement planned | Yes — Future Enhancements | Yes — Future Enhancements |

---

## Step 3: Write the Updates

### CLAUDE.md Rules

CLAUDE.md is the **technical bible**. Updates must be:

- **Precise** — actual file paths, class names, constant names and values
- **Complete** — full API: constructor params, public methods, key constants
- **Structural** — follow existing patterns (heading → description → constants → methods)
- **Accurate** — reflect actual current code, not intentions

**New character class pattern:**

```markdown
### YourCharacter (`src/scene/characters/YourCharacter.ts`)

Brief description of role and behavior.

**Movement Constants:**
- `CONSTANT_NAME`: value (description)

**Features:**
- Feature one
- Feature two

**API Methods:**
- `method()`: what it does
```

**New system/module pattern:**

```markdown
### SystemName (`src/path/to/file.ts`)

What this system does and why it exists.

**Key Constants:**
- `CONSTANT`: value — effect on gameplay

**How it works:**
Step-by-step description of the runtime flow.
```

**New file:** Add to the Project Structure directory tree in the correct location with a brief comment.

**Completed future enhancement:** Find in `## Future Enhancements` and change `- [ ]` to `- [x]`.

**Document flow order** (insert new content in the right place):
Overview → What's New → Tech Stack → Project Structure → Key Components → Development Workflow → Technical Details → Performance → Future → Common Tasks → Troubleshooting → Code Style → Dependencies

### README.md Rules

README.md is the **public-facing overview** for visitors and recruiters. Updates must be:

- **Non-technical** — no file paths, no constant names, no implementation details
- **Feature-focused** — describe what the user *experiences*, not how it's coded
- **Concise** — one bullet per feature, minimal nesting
- **Engaging** — this is a portfolio

**Core Features pattern:**

```markdown
- **Feature Name**: What it does from the user's perspective
  - Sub-detail if needed (1-2 max)
```

**Current Implementation pattern:**

```markdown
✅ Brief description of completed feature
```

---

## Step 4: Format and Placement

- Insert in the **most relevant existing section** — don't create new top-level sections unless truly a new major system
- Match surrounding formatting exactly (heading levels, bullet style, table style)
- Read the target section before editing to ensure consistency

---

## Step 5: Output

1. **State classification**: Major or minor? Which files to update?
2. **Show the changes** — what section, what was added/changed/removed
3. If minor and no update needed, say so with a one-line reason. Don't silently skip.

---

## Quick Reference — Example Decisions

| Change | Decision |
|---|---|
| Added `MapView` system + M key + new file | Update both |
| Camera distance 5 → 6 | Skip — minor tuning |
| Added `CatCompanion` extending `BaseCharacter` | Update both |
| Fixed dog teleport bug | Skip — bug fix |
| Added ambient sound system | Update both |
| `ROAD_WIDTH` 2.4 → 2.8 | Skip — minor tuning |
| Added 2027 timeline entry | CLAUDE.md only |
| Replaced Vite with another build tool | Update both |
| Added mobile touch controls | Update both (completes future enhancement) |
| Fog density 0.052 → 0.055 | Skip — minor tuning |
| Added Easter egg hidden stop | Update both |
