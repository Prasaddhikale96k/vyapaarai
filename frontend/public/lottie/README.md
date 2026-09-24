# Lottie Animation Sources

No JSON files are checked in. The agent environment has no browser access,
so Storyset/LottieFiles downloads were impossible. Every beat therefore
renders its hand-coded doodle fallback (see `components/illustrations/`).
Drop a same-named JSON here and the `LottiePlayer` picks it up automatically
(fetch → render → IntersectionObserver pause, first frame on reduced-motion).

| Beat | File                 | Searched concept      | Status    | Fallback in use              |
|------|----------------------|-----------------------|-----------|------------------------------|
| 1    | hero-shop.json       | kirana store, grocer  | ❌ Missing | KiranaStore doodle           |
| 2    | problem-chaos.json   | paperwork stress      | ❌ Missing | Munshi doodle                |
| 3    | discovery-phone.json | phone notification    | ❌ Missing | WhatsAppPhone doodle         |
| 4a   | magic-voice.json     | voice waveform        | ❌ Missing | Munshi doodle                |
| 4b   | magic-photo.json     | bill scan             | ❌ Missing | UdhaarKhata doodle           |
| 4c   | magic-alert.json     | alert bell            | ❌ Missing | RupeeCoins + StampOverdue    |
| 5    | success-growth.json  | growth celebration    | ❌ Missing | Sparkline + StampPaid        |
| 6    | cta-rocket.json      | rocket launch         | ❌ Missing | Scooter + Munshi doodles     |

Style rule for future downloads: Flat/Rafiki, emerald #059669 + marigold
#F59E0B recolor, free license only, each file <100KB.
