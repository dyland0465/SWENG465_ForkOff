# API checkpoint — November 4, 2026

- Replaced Swagger documentation for the obsolete lobby voting/results and group-chat demos with the existing lobby round, vote, restaurant-search, and lobby-message APIs. The old vote/results endpoints respond with 410; the old group-chat demo router is no longer mounted.
- Added persisted ForkOff-managed restaurant details and menus. Approved partners can manage their assigned restaurants; administrators can manage any restaurant. Restaurant details are separate from Google Maps data.
- Added a Google Places photo endpoint using live provider data and author attribution. A configured GOOGLE_PLACES API key and network access are required.
- Added restaurant analytics for decisions in currently active rounds. This is a live snapshot only: the application does not retain ended-round history or track views, so historical analytics are not yet implemented.
- Updated backend tests to follow the current src/api_routes and src/db_models folder names. Mock-based backend tests passed; real MongoDB and Google Places integration still needs verification in a configured environment.
