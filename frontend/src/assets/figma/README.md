# Figma Home assets

Source: https://www.figma.com/design/NGidWJoB9QBFCdTd7U4BlQ/FORKOFF-?node-id=33-2

| Local file | Figma layer | Source node | Original dimensions |
| --- | --- | --- | --- |
| wordmark.png | Logo / Wordmark crop (App Header instance) | I33:3;49:5 | 793 × 366 px |
| hero-food-collage.png | Decorative/Hero food collage | 127:288 | 2172 × 724 px |

Both are the original PNG assets returned by the Figma MCP design-context
request. They have not been edited or replaced. AppHeader preserves the
wordmark's Figma image-fill crop. HomeScreen preserves the collage's 3:1 aspect
ratio; on desktop it renders at 1482 × 494 px with the Figma canvas crop.
Mobile crops the same collage proportionally, without stretching it.

The Create Lobby (`33:15`) and Join Lobby (`33:28`) frames reuse the same
wordmark (verified byte-for-byte against the asset returned for both frames).
`fork-emblem.png` is their original Decorative/Fork emblem image (`84:313`
and `84:298`). ForkEmblem renders it at 84 × 121 px, offset 10px right and
8px down inside the 104px circular crop from Figma.
