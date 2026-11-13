const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

function runAdb(adbPath, args) {
  return execFileSync(adbPath, args, { encoding: 'utf8', windowsHide: true });
}

function prepareConnection({
  apiUrl,
  adbPath,
  deviceId,
  interactive = false,
  runAdb: execute = runAdb,
}) {
  const url = new URL(apiUrl);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new Error('API_URL must be an HTTP(S) gateway origin.');
  const loopback = ['localhost', '[::1]'].includes(url.hostname) || /^127\./.test(url.hostname);
  if (!loopback) return undefined;
  if (interactive)
    throw new Error(
      'API local: dung adb devices, roi npm run android -- --device SERIAL thay cho --list-devices/--interactive.',
    );
  const devices = execute(adbPath, ['devices'])
    .split(/\r?\n/)
    .map((line) => {
      const match = /^(\S+)\s+device(?:\s|$)/.exec(line);
      return match ? match[1] : undefined;
    })
    .filter(Boolean);
  let serial = deviceId;
  if (!serial && devices.length === 1) serial = devices[0];
  if (!serial && devices.length > 1)
    throw new Error('Nhieu thiet bi: chon bang npm run android -- --device SERIAL.');
  if (!serial)
    throw new Error(
      'Mo LDPlayer hoac Android Studio Emulator truoc, roi chay lai npm run android.',
    );
  if (!devices.includes(serial))
    throw new Error(`Thiet bi ${serial} chua san sang. Kiem tra adb devices.`);
  const apiPort = url.port || (url.protocol === 'https:' ? '443' : '80');
  for (const port of new Set([apiPort, '8091']))
    execute(adbPath, ['-s', serial, 'reverse', `tcp:${port}`, `tcp:${port}`]);
  return serial;
}

function findAdb(env = process.env) {
  const executable = process.platform === 'win32' ? 'adb.exe' : 'adb';
  const roots = [env.ANDROID_HOME, env.ANDROID_SDK_ROOT];
  if (env.LOCALAPPDATA) roots.push(path.join(env.LOCALAPPDATA, 'Android', 'Sdk'));
  return (
    roots
      .filter(Boolean)
      .map((root) => path.join(root, 'platform-tools', executable))
      .find((candidate) => fs.existsSync(candidate)) || executable
  );
}

function requestedDevice(args) {
  for (let i = 0; i < args.length; i++) {
    if (['--device', '--deviceId'].includes(args[i])) {
      if (!args[i + 1] || args[i + 1].startsWith('--'))
        throw new Error('Truyen SERIAL sau --device.');
      return args[i + 1];
    }
    const match = /^--(?:device|deviceId)=(.+)$/.exec(args[i]);
    if (match) return match[1];
  }
  return undefined;
}

function cliPath() {
  return path.join(path.dirname(require.resolve('react-native/package.json')), 'cli.js');
}

function main() {
  const root = path.resolve(__dirname, '..');
  require('dotenv').config({ path: path.join(root, '.env'), quiet: true });
  const args = process.argv.slice(2);
  const deviceId = requestedDevice(args);
  const serial = prepareConnection({
    apiUrl: process.env.API_URL || 'http://10.0.2.2:8080',
    adbPath: findAdb(),
    deviceId: deviceId || process.env.ANDROID_SERIAL,
    interactive: args.includes('--list-devices') || args.includes('--interactive'),
  });
  if (serial) {
    console.log(`Da noi gateway va Metro cho ${serial}.`);
    if (!deviceId) args.push('--device', serial);
  }
  const result = spawnSync(
    process.execPath,
    [cliPath(), 'run-android', '--port', '8091', '--active-arch-only', ...args],
    { cwd: root, stdio: 'inherit', windowsHide: true },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status === null ? 1 : result.status;
}

module.exports = { prepareConnection, findAdb, requestedDevice, cliPath };
if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
