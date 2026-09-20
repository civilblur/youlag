/**
 * Settings
 *
 * Youlag user settings passed from `extension.php` via FreshRSS `js_vars` hook.
 */

function getSettings() {
  return context?.extensions?.youlag ?? {};
}

function getSetting(name) {
  return getSettings()[name];
}
