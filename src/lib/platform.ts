// Setup hints differ between the iPhone and the Mac.
export const isMac = typeof navigator !== 'undefined' && /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints < 2;

/** Where to add the Hebrew keyboard and the Hebrew voice on this device. */
export const setupHelp = isMac
  ? {
      device: 'Mac',
      keyboard: 'System Settings → Keyboard → Text Input → Edit… → + → Hebrew',
      switchKey: 'Control-Space or the 🌐 key',
      voice: 'System Settings → Accessibility → Spoken Content → System voice → Manage Voices… → Hebrew → Carmit',
      voiceAfter: 'then reload this page',
    }
  : {
      device: 'iPhone',
      keyboard: 'Settings → General → Keyboard → Keyboards → Add New Keyboard → Hebrew',
      switchKey: 'the 🌐 key',
      voice: 'Settings → Accessibility → Spoken Content → Voices → Hebrew → Carmit',
      voiceAfter: 'choose “Enhanced” for better quality',
    };
