# Capsnip 0.1.2

- Export Back returns to the editor after completion or cancellation.
- Export requests are guarded against double clicks and duplicate completion.
- Recording resources and callbacks are released at the end or on cancellation.
- Saved MP4 previews remain paused. Completion reads Exported; another export requires a click.
- A delayed MP4 metadata callback ignores removed preview elements.

Validation: isolated Electron renderer, real source clip and MP4 encoding twice; duplicate-click guard, idle wait without repeat, all result media paused, Back before/after export, cancellation without encoding, and both FFmpeg worker completion paths. Worker rendering was stubbed for lifecycle checks; standard MP4s were encoded and fully decoded.
