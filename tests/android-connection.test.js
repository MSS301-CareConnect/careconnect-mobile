const { describe, expect, jest, test } = require('@jest/globals');
const { existsSync } = require('node:fs');
const { prepareConnection, requestedDevice, cliPath } = require('../scripts/run-android.cjs');

function deviceAdb(devices = 'emulator-5554\tdevice\n') {
  return jest.fn((_path, args) =>
    args[0] === 'devices' ? `List of devices attached\n${devices}` : '',
  );
}

describe('Android local gateway connection', () => {
  test('resolves the installed native CLI entry and forwards explicit device selection', () => {
    expect(existsSync(cliPath())).toBe(true);
    expect(requestedDevice(['--device', 'emulator-5554'])).toBe('emulator-5554');
    expect(requestedDevice(['--device=emulator-5556'])).toBe('emulator-5556');
    expect(() => requestedDevice(['--device'])).toThrow('SERIAL');
  });
  test('prepares gateway and Metro on every run for the connected emulator', () => {
    const runAdb = deviceAdb();
    const options = { apiUrl: 'http://127.0.0.1:8080', adbPath: 'adb', runAdb };
    expect(prepareConnection(options)).toBe('emulator-5554');
    expect(prepareConnection(options)).toBe('emulator-5554');
    expect(runAdb.mock.calls.filter(([, args]) => args.includes('tcp:8080'))).toEqual([
      ['adb', ['-s', 'emulator-5554', 'reverse', 'tcp:8080', 'tcp:8080']],
      ['adb', ['-s', 'emulator-5554', 'reverse', 'tcp:8080', 'tcp:8080']],
    ]);
    expect(runAdb).toHaveBeenCalledWith('adb', [
      '-s',
      'emulator-5554',
      'reverse',
      'tcp:8091',
      'tcp:8091',
    ]);
  });

  test('uses the configured local gateway port', () => {
    const runAdb = deviceAdb();
    prepareConnection({ apiUrl: 'http://localhost:8180', adbPath: 'adb', runAdb });
    expect(runAdb).toHaveBeenCalledWith('adb', [
      '-s',
      'emulator-5554',
      'reverse',
      'tcp:8180',
      'tcp:8180',
    ]);
  });

  test('rejects an interactive target change before preparing the wrong loopback device', () => {
    const runAdb = deviceAdb();
    expect(() =>
      prepareConnection({
        apiUrl: 'http://127.0.0.1:8080',
        adbPath: 'adb',
        interactive: true,
        runAdb,
      }),
    ).toThrow('--device SERIAL');
    expect(runAdb).not.toHaveBeenCalled();
    expect(
      prepareConnection({
        apiUrl: 'http://10.0.2.2:8080',
        adbPath: 'adb',
        interactive: true,
        runAdb,
      }),
    ).toBeUndefined();
  });

  test('preserves direct emulator-host or remote API connections', () => {
    const runAdb = deviceAdb();
    expect(
      prepareConnection({ apiUrl: 'http://10.0.2.2:8080', adbPath: 'adb', runAdb }),
    ).toBeUndefined();
    expect(
      prepareConnection({ apiUrl: 'https://api.example.test', adbPath: 'adb', runAdb }),
    ).toBeUndefined();
    expect(runAdb).not.toHaveBeenCalled();
  });

  test('requires an explicit device when several devices are connected', () => {
    const runAdb = deviceAdb('emulator-5554\tdevice\nemulator-5556\tdevice\n');
    expect(() =>
      prepareConnection({ apiUrl: 'http://127.0.0.1:8080', adbPath: 'adb', runAdb }),
    ).toThrow('--device');
    expect(runAdb).toHaveBeenCalledTimes(1);
    expect(
      prepareConnection({
        apiUrl: 'http://127.0.0.1:8080',
        adbPath: 'adb',
        deviceId: 'emulator-5556',
        runAdb,
      }),
    ).toBe('emulator-5556');
    expect(runAdb).toHaveBeenCalledWith('adb', [
      '-s',
      'emulator-5556',
      'reverse',
      'tcp:8080',
      'tcp:8080',
    ]);
  });

  test('does not route a different device when the requested device is offline', () => {
    const runAdb = deviceAdb('emulator-5554\tdevice\nemulator-5556\toffline\n');
    expect(() =>
      prepareConnection({
        apiUrl: 'http://127.0.0.1:8080',
        adbPath: 'adb',
        deviceId: 'emulator-5556',
        runAdb,
      }),
    ).toThrow('emulator-5556');
    expect(runAdb).toHaveBeenCalledTimes(1);
  });

  test('stops if the gateway reverse fails instead of launching with broken networking', () => {
    const runAdb = deviceAdb();
    runAdb.mockImplementation((_path, args) => {
      if (args[0] === 'devices') return 'List of devices attached\nemulator-5554\tdevice\n';
      throw new Error('reverse unavailable');
    });
    expect(() =>
      prepareConnection({ apiUrl: 'http://127.0.0.1:8080', adbPath: 'adb', runAdb }),
    ).toThrow('reverse unavailable');
    expect(runAdb).toHaveBeenCalledTimes(2);
  });
});
