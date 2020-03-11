# Mountain Project Tick Cleaner

This is a Chrome extension that deletes repeated ticks on [Mountain Project].
For each route that you've climbed, all ticks except for the "best" one will be
deleted. "Best" is defined as follows:

*   First, ticks' numbers of pitches are compared. Ticks with more pitches are
    considered better since fewer pitches may mean that you didn't finish the
    whole climb.
*   Next, ticks' styles are compared. Here is the best-to-worst ranking:
    *   Solo
    *   Flash
    *   Send
    *   Lead (Onsight)
    *   Lead (Flash)
    *   Lead (Redpoint)
    *   Lead (Pinkpoint)
    *   Lead (Fell/Hung)
    *   Lead
    *   Follow
    *   TR
    *   Attempt
*   Next, ticks' dates are compared, with earlier ticks considered better.
*   As a final tiebreaker, ticks' IDs are compared. A lower ID (indicating that
    a tick was recorded earlier) is considered better.

This extension as written as a companion to [mpticks]. The general idea is that
you can periodically import your Mountain Project ticks into mpticks and then
use this extension to delete repeated ticks from Mountain Project.

[Mountain Project]: https://www.mountainproject.com/
[mpticks]: https://mpticks.web.app/
