# Vibe Coding Workspace Design System

Generated: 2026-06-27
Product type: Desktop developer productivity workspace

## Design Direction

Vibe Coding Workspace should feel like a focused command center for isolated AI-agent sessions. The interface is dense, calm, and technical: clear surfaces, readable hierarchy, restrained motion, and strong contrast around active work.

The default visual language is dark-first, with a complete light theme for daytime use. Green communicates "run/connected/ready", blue communicates "system/navigation/focus", amber communicates pending work, and red communicates destructive/error states.

## Token Architecture

The implementation follows a three-layer token model in `src/renderer/styles.css`.

1. Primitive tokens define raw values:
   `--space-*`, `--radius-*`, `--duration-*`, font families, base color scales, shadows.

2. Semantic tokens define purpose:
   `--color-canvas`, `--color-surface`, `--color-text`, `--color-primary`, `--color-accent`, `--color-warning`, `--color-danger`, `--color-border`.

3. Component tokens define reusable UI decisions:
   `--button-*`, `--card-*`, `--input-*`, `--terminal-*`, plus compatibility aliases used by the current component classes.

Do not introduce one-off hex values in component rules unless creating a new primitive token. Component rules should reference semantic or component tokens.

## Color System

### Light Theme

| Role | Token | Value |
| --- | --- | --- |
| Canvas | `--color-canvas` | `#eef2f6` |
| Soft canvas | `--color-canvas-soft` | `#f6f8fb` |
| Surface | `--color-surface` | `#ffffff` |
| Raised surface | `--color-surface-raised` | `#ffffff` |
| Muted surface | `--color-surface-muted` | `#eef4f7` |
| Text | `--color-text` | `#17212b` |
| Strong text | `--color-text-strong` | `#0b1117` |
| Muted text | `--color-muted` | `#5d6a78` |
| Border | `--color-border` | `#d6e0e8` |
| Primary/run | `--color-primary` | `#0f7a4f` |
| System accent | `--color-accent` | `#0b72ba` |
| Warning | `--color-warning` | `#9d6a03` |
| Danger | `--color-danger` | `#b42318` |

### Dark Theme

| Role | Token | Value |
| --- | --- | --- |
| Canvas | `--color-canvas` | `#071018` |
| Soft canvas | `--color-canvas-soft` | `#0a1420` |
| Surface | `--color-surface` | `#101a26` |
| Raised surface | `--color-surface-raised` | `#142233` |
| Muted surface | `--color-surface-muted` | `#19283a` |
| Text | `--color-text` | `#dfe8f1` |
| Strong text | `--color-text-strong` | `#f8fbff` |
| Muted text | `--color-muted` | `#97a7b8` |
| Border | `--color-border` | `#26384a` |
| Primary/run | `--color-primary` | `#4ade80` |
| System accent | `--color-accent` | `#38bdf8` |
| Warning | `--color-warning` | `#f6c65b` |
| Danger | `--color-danger` | `#ff8a80` |

## Typography

Primary family: `Inter`, falling back to Segoe UI and system UI.
Monospace family: `Cascadia Mono`, Segoe UI Mono, Consolas.

Use compact, utilitarian type:
- Page titles: 28-64px depending on screen and context.
- Panel titles: 17-20px.
- Body and controls: 13-16px.
- Metadata and badges: 10-12px, often monospace for status values.

Letter spacing remains `0`. Avoid oversized marketing typography inside tool panels.

## Shape, Spacing, Motion

Radius:
- Standard controls and cards: `8px`.
- Small input details: `4-6px`.
- Pills and status dots: `999px`.

Spacing:
- Base rhythm: 4px.
- Standard component gaps: 8-16px.
- Panel padding: 16-22px.
- Gateway layout padding: 22-64px by viewport.

Motion:
- Color/background changes: 140-180ms.
- Width/progress changes: 240ms.
- Avoid layout-shifting hover movement. Use color, border, and shadow for emphasis.
- Respect `prefers-reduced-motion`.

## Component Specs

Buttons:
- Primary uses `--button-bg`, `--button-fg`, and `--button-bg-hover`.
- Secondary uses tokenized surface and border colors.
- Icon-only buttons must have stable square dimensions.
- Disabled controls keep semantics and reduce opacity.

Cards and panels:
- Use `--card-bg`, `--card-border`, `--card-radius`, and subtle shadows.
- Do not nest decorative cards inside larger decorative cards. Use panels for real UI groupings only.

Tabs:
- Active tabs use primary soft fill and a clear border.
- Text must truncate rather than resize or push actions.

Terminal:
- Terminal surfaces use the dedicated `--terminal-*` tokens.
- Codex smart UI uses app semantic tokens, while command lines use terminal tokens.

Status:
- Connected/running: primary green.
- Login pending/starting/approval: warning amber.
- Error/destructive: danger red.

## Accessibility Rules

- Text contrast should meet WCAG AA in both themes.
- Focus states must remain visible through `--focus-ring`.
- Do not rely on color alone for critical state; pair with labels/icons.
- All touch/click targets should stay visually stable and at least 32px high in dense desktop UI, larger where practical.
- Avoid horizontal overflow at narrow widths; text should truncate or wrap intentionally.

## Anti-Patterns

- Mixed unrelated palettes on the same surface.
- Raw per-component hex values outside token definitions.
- Beige/coral decorative gradients in workspace surfaces.
- Large rounded cards inside cards.
- Scale hover effects that move surrounding UI.
- Negative letter spacing.
- Emoji as structural icons.

## Implementation Source

The current source of truth is:

- `src/renderer/styles.css`
- Theme switching via `document.documentElement.dataset.theme`
- Mock visual state via `http://127.0.0.1:5173?mockWorkspace` in dev mode
