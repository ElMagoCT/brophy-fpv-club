media/ - video files this site hosts itself (2026-11-26).

The overview videos go here, three files each, named by their id in
groundschool/gs-videos.js:
  <id>.mp4   the video (H.264 + AAC, 1080p or 720p, faststart)
  <id>.jpg   the poster frame shown before it plays (16:9)
  <id>.vtt   English captions (WebVTT)
ids: home-intro (home page, newcomers only), flight-overview (Flight Clearance),
path-overview (Pilot Path).

To switch one on, set its src in groundschool/gs-videos.js, e.g.
  src:'media/home-intro.mp4'
Keep each file small: GitHub warns over 50 MB and refuses over 100 MB.
