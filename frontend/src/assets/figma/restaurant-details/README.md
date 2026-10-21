# Restaurant Details assets

Source: [07_Restaurant_Details, 33:80](https://www.figma.com/design/NGidWJoB9QBFCdTd7U4BlQ/FORKOFF-?node-id=33-80).

- `map-marker.svg`: original Ellipse asset (`41:217`), used at its native 28 × 28 px dimensions in the static map.
- Restaurant photo (`41:192`): reuses `../discovery/north-pier-ramen.png`, verified by SHA-256 against the Details asset. Desktop slot: 560 × 360 px, cover.
- Header wordmark: reuses `../wordmark.png`, verified by SHA-256 against the Details asset. Shared Discovery header slot: 260 × 70 px, cover.
- Map streets are native rectangles and transforms in Figma, reproduced with CSS. The map is illustrative, with no geographic data.

Photos remain driven by the shared restaurant fixtures. Address and hours are explicitly sample information; no live source or update recency is claimed. Other restaurants show unavailable fields rather than inheriting North Pier Ramen's sample address or hours.
