SHORESH: Hebrew for work & life
Mac version {{VERSION}}

Shoresh runs on your Mac, in your browser. It never goes online: no account,
no updates from outside, nothing to install.


START
  Double-click start_shoresh.command.
  A small Terminal window opens, and Shoresh opens in your browser at
  http://localhost:8790/
  Leave the small window open while you practise (you can minimise it).

  The first time, macOS may refuse to open it ("Apple could not verify..." or
  "unidentified developer"), as it did for the order portal:
    - macOS 15 Sequoia or later: click Done. Then open System Settings ->
      Privacy & Security, scroll down to the message about
      start_shoresh.command and click Open Anyway.
    - Older macOS: right-click start_shoresh.command -> Open -> Open.
  Do the same once for stop_shoresh.command.
  If macOS asks whether Terminal may access a folder, click Allow.


STOP
  Close the small window, press Ctrl+C in it, or double-click
  stop_shoresh.command.
  Starting Shoresh while it is already running stops the old copy first, so
  the one you just started always takes over.


YOUR PROGRESS
  Shoresh saves your progress in two places: in the browser, and in the
  "progress" folder inside this Shoresh folder.
  - If the browser's data is cleared (for example Safari -> Clear History),
    Shoresh restores your progress from the folder the next time it starts.
    Switching from Safari to Chrome works the same way.
  - progress/backups keeps one copy per day for the last 30 days. To go back
    to a day: in Shoresh click the gear on Today -> Backup -> Import, and choose
    that day's file.
  - Keep the progress folder when you update or move Shoresh.


UPDATING
  Unzip the new version. Copy the "progress" folder from your old Shoresh
  folder into the new one, then start the new one. After that you can delete
  the old folder.


ONE-TIME SETUP
  Hebrew keyboard: System Settings -> Keyboard -> Text Input -> Edit... ->
    + -> Hebrew. Switch keyboards with Control-Space or the globe key.
  Hebrew voice: System Settings -> Accessibility -> Spoken Content ->
    System voice -> Manage Voices... -> Hebrew -> Carmit (download it). Then
    reload Shoresh. Menu names vary a little between macOS versions.
  First launch: take the 10-minute skills check. It places you in the course
  and tailors your daily plan.


TIPS
  - Bookmark http://localhost:8790/ (it works while Shoresh is running).
  - macOS 14 Sonoma or later: in Safari, File -> Add to Dock gives Shoresh its
    own window and Dock icon. Start Shoresh first, then click the icon.


WHAT'S IN THIS FOLDER
  start_shoresh.command   double-click to start
  stop_shoresh.command    double-click to stop
  serve.py                the small web server (runs on the Mac's Python 3)
  app/                    the app itself
  progress/               your saved progress (appears after the first start)

  Needs Python 3, which the order portal already uses. If the Terminal window
  says it is missing, install it from https://www.python.org/downloads/macos/
