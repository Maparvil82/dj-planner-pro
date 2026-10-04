# DJ profiles and embedded mixes

## Experience

- A user can read Community without publishing a DJ identity. Following another DJ or publishing an agenda session requires a public profile with a photo, city and at least one musical style.
- The follow action opens profile editing when prerequisites are missing. A checklist explains the missing fields. Incomplete private drafts remain saveable; activating or saving a public profile checks completeness.
- The identity photo is 104 × 104 with a direct edit action. City and musical styles are marked required. Genres are selected from a canonical catalogue; no default genre suggestions appear until the user types. The expanded catalogue includes Jazz, Nu Jazz, Acid Jazz, Jazz Funk, Swing, Blues, Bossa Nova, Chillout, Trip Hop, Italo Disco, Electro Swing, Baile Funk, Flamenco, World and Classical.
- Existing profiles, follows and publication consent are preserved. Existing incomplete profiles must complete their identity before new follows/publications and before their next public profile save. This migration does not retroactively hide profiles or delete follows.

## Mixes

- Personal profile → Mixes → Add a mix → title and public link to one recording → optional player preview → Save mix.
- Mixes save independently from the DJ profile editor; that section appears outside profile edit mode. A complete private profile can curate mixes before opting into public visibility.
- Mixes appear on the public DJ page before published performances. The two concepts are separate: mixes are recordings; published sessions are agenda performances.
- Supported recording URLs: `https://www.mixcloud.com/<dj>/<show>/` and `https://soundcloud.com/<artist>/<track>`. General profiles, playlists, pasted HTML, shortened URLs and private links are not supported. Tracking query parameters are stripped. Paste the full public recording URL.
- Official widgets render inline in a native WebView (Expo Go compatible 13.16.1) or web iframe. Only one player is mounted at a time, upon user request; no automatic playback. Players unmount on screen blur. Mixcloud’s official redirect to `player-widget.mixcloud.com` remains embedded.
- The owner can edit or remove an individual mix. Removing it does not delete the original recording. No mix quota or Pro restriction; lists load in pages of 20 without a total count cap.
- Public accessibility, availability and playback restrictions remain subject to the provider. A link that stops being public may no longer play. No audio uploads, scraping or third party credentials are introduced.

## Data and permissions

Migration: `20261004112730_community_profile_completion_and_mixes.sql`.

- `community_private.profile_complete` backs publish/follow policies and transactional profile save validation. Direct profile writes also require completeness when public.
- `community_profile_mixes` stores only owner, title, provider, canonical recording URL and timestamps. Unique owner/URL prevents duplicates. SQL constraints mirror the source allowlist.
- RLS permits reading own mixes or mixes of a visible profile. Only the owner writes or deletes. Update grants exclude ownership and timestamps. Anonymous roles have no grants. Deleting a community profile cascades its mix rows.
- Security advisors show no new findings; pre-existing Auth/delete-account/closed private booking table findings are unchanged.

## Verification

- `npm run typecheck`, `npm test`.
- `node tests/communityProfileMixesDatabase.cjs`: incomplete/public/draft profile validation, Jazz canonicalization, follow prerequisites, mix URL constraints, duplicates, ownership, visibility and anonymous denial.
- `tests/browser/profileMixes.cjs`: browser fixtures covering incomplete follow redirect, genre suggestions/multiple selection, draft save, mix validation/preview/create/public display/edit/remove. Widget content is mocked; this does not verify provider audio playback.
- iOS Expo export passes with the WebView dependency. Playback and image picking still need a physical Expo Go device check.
