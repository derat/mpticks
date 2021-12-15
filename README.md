# mpticks

[![Build Status](https://storage.googleapis.com/derat-build-badges/90fa1254-0172-47ae-b338-223ae526ec2c.svg)](https://storage.googleapis.com/derat-build-badges/90fa1254-0172-47ae-b338-223ae526ec2c.html)

## Background

[mpticks.web.app] is an app for importing and visualizing ticks (i.e. personal
history) from [Mountain Project], a popular website that collects user-supplied
information about rock climbing areas.

Mountain Project's user pages display pitches/routes/days-out over different
periods of time, implying that users are expected to tick all their climbs
(including when repeating routes). However, doing so ends up cluttering
per-route tick lists with the same names over and over and with users' personal
notes.

There are many different opinions about how ticks should be used:

*   [Suggestion: Private Ticks Option]
*   [Hiding tick list from profile]
*   [Ticks posted on mountain project page]
*   [Tick Lists]

It doesn't look like a "private ticks" feature is going to be added to Mountain
Project anytime soon, hence the existence of this app.

[mpticks.web.app]: https://mpticks.web.app/
[Mountain Project]: https://www.mountainproject.com/
[Suggestion: Private Ticks Option]: https://www.mountainproject.com/forum/topic/111808954/suggestion-private-ticks-option
[Hiding tick list from profile]: https://www.mountainproject.com/forum/topic/113634433/hiding-tick-list-from-profile
[Ticks posted on mountain project page]: https://www.mountainproject.com/forum/topic/107421753/ticks-posted-on-mountain-project-page
[Tick Lists]: https://www.mountainproject.com/forum/topic/106511221/tick-lists

## Usage

1.  Log in to the app by going to [mpticks.web.app].
2.  Enter the email address that you use to log in to Mountain Project and your
    [private API key] and import your ticks.
3.  View your ticks, look at your stats, export your ticks and routes, etc.
4.  If you feel like it, delete your repetitive ticks from Mountain Project
    using the [Mountain Project Tick Cleaner] Chrome extension.

[private API key]: https://www.mountainproject.com/data
[Mountain Project Tick Cleaner]: https://chrome.google.com/webstore/detail/mountain-project-tick-cle/cefbdlamhlclnhdgeffngpfacmfmkkhj

## Frequently Asked Questions

### What does it do?

The [Import page] uses the `get-ticks` [Mountain Project Data API] endpoint to
fetch your new ticks. It then uses the `get-routes` endpoint to get information
about any ticked routes that haven't previously been seen. Your new ticks,
routes, and updated stats are saved to [Cloud Firestore].

The [Ticks page] displays an expandable tree of areas, routes, and ticks that
have been imported. Individual ticks can also be deleted from Cloud Firestore.

The [Stats page] displays charts, tables, and maps summarizing your tick
information. If the schema of the `Counts` object that is used to store stats
has changed since the last time that ticks were imported, the `Counts` object is
automatically regenerated.

The [Export page] lets you download all of your raw tick and route objects that
were fetched from Mountain Project via the `get-ticks` and `get-routes`
endpoints.

[Import page]: ./src/views/Import.vue
[Mountain Project Data API]: https://www.mountainproject.com/data
[Cloud Firestore]: https://firebase.google.com/docs/firestore
[Ticks page]: ./src/views/Ticks.vue
[Stats page]: ./src/views/Stats.vue
[Export page]: ./src/views/Export.vue

### Can I enter ticks directly into mpticks instead of needing to import them from Mountain Project?

Unfortunately, no. As far as I can see, Mountain Project doesn't provide an API
endpoint for searching for routes (besides `get-routes-for-lat-long`, which
returns up to 500 routes within up to 200 miles of a (latitude, longitude)
pair). As such, there's no easy way for this app to know anything about a given
route unless it's already been imported using `get-routes` due to having been
previously ticked.

### Why do the 90-day counts on the Stats page differ from the Tick Breakdown shown by Mountain Project?

I believe that Mountain Project is actually showing 91 days' worth of data
there. To use a simpler example, I'd expect "2 days" to include only today and
yesterday, i.e. two days of data. I think that Mountain Project's code would
include today, yesterday, plus the day before, i.e. three days.

### What happens if an area gets renamed on Mountain Project?

Routes within the area that are imported before and after the rename will end up
in different areas on the Ticks page.

Mountain Project's `get-routes` API endpoint only provides a list of the area
names for each route, e.g. `['New York', 'Gunks', 'Sky Top']` for route
`111251312`. It doesn't provide the underlying area IDs (`[105800424, 105798167,
105799181]` in this case), which would presumably stay constant even if the
corresponding names are changed.

When a route is imported (which only happens the first time it's ticked),
mpticks uses its area list to determine its location on the Ticks page. The
route's location won't be automatically updated if or when areas are renamed
later.

I sent a feature request via the MP feedback form on 2020-02-19 to update
`get-routes` to return area IDs, but I didn't hear back from anyone. As a
workaround, I've added a button to the Import page that can be used (sparingly)
to reimport all route data from Mountain Project.

## Cloud Firestore data

### How ticks are stored

The obvious approach would be to store each tick in its own [Cloud Firestore]
document, and also store data about each route in its own document (either
per-user or globally). This would make it easy to add or delete ticks or query a
user's most-recent ticks.

The big downside to this is [Google's pricing model for Cloud Firestore]: the
free quota includes only 50,000 document reads, 20,000 writes, and 20,000
deletes per day. I assume that some users have thousands of ticks, and they
could consume the free quota quickly.

At the other extreme, each user could have a single document storing all their
ticks. Cloud Firestore documents are limited to a maximum size of 1 MB, so
there's a risk of running up against the limit if a user has many ticks. At the
same time, users with many ticks seem unlikely to also have extensive notes in
each, so it's conceivable that a document could store 10,000 ticks. There's
still the question of where route data would be stored with this approach,
though.

As a compromise, each route gets its own document, containing both data about
the route itself and all of the user's ticks for the route. Each area gets its
own document listing all of its routes, and there's also an "area map" document
that describes the area hierarchy so that it can be displayed with a single
document read.

This is unlikely to run up against document size constraints. It's not much
better than the "each tick in its own document" approach for users who don't
repeat routes yet still have thousands of ticks, but I'm hopeful that that will
be an uncommon scenario.

[Google's pricing model for Cloud Firestore]: https://firebase.google.com/docs/firestore/quotas

### Schema

TypeScript interfaces for all Firestore documents are defined in
[src/models.ts](./src/models.ts).

#### `users` collection

User-specific information is stored in the `users` collection. Documents have
names corresponding to Firebase user IDs and correspond to the `User` interface:

*   `maxTickId`: Number field containing the maximum tick ID that has been
    imported.
*   `numRoutes`: Number field containing the number of routes that have been
    imported (and hence climbed).
*   `numImports`: Number field containing the number of successful imports.
*   `lastImportTime`: Date field containing the start time of the last
    successful import.
*   `numReimports`: Number field containing the number of times that route data
    has been reimported.

#### `routes` subcollection

Per-route information is stored in the `routes` subcollection under each user
document. Documents have names corresponding to Mountain Project route IDs and
correspond to the `Route` interface:

*   `name` - String field containing the route's name.
*   `type` - Number field containing a `RouteType` enum value.
*   `location` - String array field containing the route's location, e.g.
    `['Colorado', 'Boulder', 'Boulder Canyon', 'Avalon']`.
*   `lat` - Number field containing the route's latitude.
*   `long` - Number field containing the route's longitude.
*   `grade` - String field containing the route's grade, e.g. `'5.9'`.
*   `pitches` - Number field containing the number of pitches.
*   `ticks` - Map field keyed by Mountain Project tick ID. Values are maps
    corresponding to the `Tick` interface:
    *   `date` - String field containing tick date as `YYYYMMDD`, e.g.
        `'20200101'`.
    *   `style` - Number field containing a `TickStyle` enum value.
    *   `pitches` - Number field containing climbed pitches.
    *   `notes` - String field containing user-supplied notes.
    *   `stars` - String field containing user-supplied score for the route: 1
        is 'bomb', 5 is 4-star.
    *   `grade` - String field containing user-supplied grade for the route,
        e.g. `'5.10a'`.

#### `areas` subcollection

Area-specific information is stored in the `areas` subcollection under each user
document. Documents have names corresponding to pipe-separated Mountain Project
locations (e.g. `Colorado|Boulder|Boulder Canyon|Avalon`) with minor escaping
(see `makeAreaId()`). They correspond to the `Area` interface:

*   `routes` - Map field keyed by route ID. Values are maps corresponding to the
    `RouteSummary` interface:
    *   `name`: String field containing the route name.
    *   `grade`: String field containing the route grade, e.g. `'5.10a'`.

A singleton document in the `areas` subcollection named `map` contains the full
area hierarchy and corresponds to the `AreaMap` interface:

*   `children` - Optional map field keyed by location component (e.g. `'Boulder
    Canyon'`) and with map values corresponding to the `AreaMap` interface.
*   `areaId` - Optional string field containing the area's document ID in the
    `areas` subcollection.

#### `stats` subcollection

Aggregate pitch and tick counts are stored in a `counts` document in the `stats`
subcollection under each user document. The document corresponds to the `Counts`
interface:

*   `dateFirstTicks` - Map field keyed by date as `YYYYMMDD`. Counts ticks that
    were the first for their route.
*   `datePitches` - Map field keyed by date as `YYYYMMDD`.
*   `dateTicks` - Map field keyed by date as `YYYYMMDD`.
*   `dayOfWeekPitches` - Map field keyed by [ISO 8601 day of week] where `1` is
    Monday and `7` is Sunday.
*   `dayOfWeekTicks` - Like `dayOfWeekPitches` but counting ticks.
*   `gradeCleanTicks` - Map field keyed by route grade. Similar to `gradeTicks`,
    but only unroped or lead ticks with no falls or takes are counted. See the
    `isCleanTickStyle` function.
*   `gradeTicks` - Map field keyed by route grade, e.g. `'5.9'` or `'V3'`.
*   `latLongTicks` - Map field keyed by comma-separated route latitude and
    longitude rounded to two decimal places of precision, e.g.
    `'39.94,-105.02'`.
*   `monthGradeTicks` - Map field keyed by pipe-separated `YYYYMM` date and
    grade, e.g. `'201910|5.10a PG-13'`.
*   `pitchesTicks` - Map field keyed by number of pitches in each tick.
*   `regionTicks` - Map field keyed by route region (U.S. state/territory or
    country).
*   `routeTicks` - Map field keyed by pipe-separated Route ID and name, e.g.
    `'105924807|The Nose'`. Only a limited number of the most-climbed routes are
    present.
*   `routeTypeTicks` - Map field keyed by `RouteType` enum values.
*   `tickStyleTicks` - Map field keyed by `TickStyle` enum values.
*   `version` - Number field containing document version. Used to detect when
    stats need to be regenerated.

#### `imports` subcollection

Original imported Mountain Project data is stored in documents in the `imports`
subcollection under each user document. The documents correspond to the
`ImportedTicks` and `ImportedRoutes` interfaces, which just contain `ApiTicks`
and `ApiRoutes` objects. Documents are given names corresponding to the start
time of the import and suffixed by the data type and index, e.g.

*   `2020-02-09T13:34:03.195Z.routes.0`
*   `2020-02-09T13:34:03.195Z.ticks.0`
*   `2020-02-09T13:34:03.195Z.ticks.1`

[ISO 8601 day of week]: https://en.wikipedia.org/wiki/ISO_week_date
