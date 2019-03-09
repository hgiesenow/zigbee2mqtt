const sinon = require('sinon');
const objectAssignDeep = require('object-assign-deep');

const data = require('../lib/util/data');
const settings = require('../lib/util/settings.js');
const fs = require('../lib/util/fs');

const configurationFile = data.joinPath('configuration.yaml');
const devicesFile = data.joinPath('devices.yaml');
const groupsFile = data.joinPath('groups.yaml');

describe('Settings', () => {
    const write = (file, json) => fs.writeYaml(file, json);

    const read = (file) => fs.readYaml(file);

    const files = new Map();

    beforeAll(() => {
        sinon.stub(fs, 'readYaml').callsFake((file) => {
            if (files.has(file)) return objectAssignDeep.noMutate(files.get(file));
            throw new Error(`Fake file not found: ${file}`);
        });
        sinon.stub(fs, 'readYamlIfExists').callsFake((file) => {
            if (files.has(file)) return objectAssignDeep.noMutate(files.get(file));
            return null;
        });
        sinon.stub(fs, 'writeYaml').callsFake((file, content) => {
            files.set(file, objectAssignDeep.noMutate(content));
        });
    });

    beforeEach(() => {
        settings._clear();
        files.clear();
    });

    afterAll(() => {
        fs.readYaml.restore();
        fs.readYamlIfExists.restore();
        fs.writeYaml.restore();
    });

    describe('Settings', () => {
        it('Should return default settings', () => {
            write(configurationFile, {});
            const s = settings.get();
            expect(s).toEqual(settings._getDefaults());
        });

        it('Should return settings', () => {
            write(configurationFile, {permit_join: true});
            const s = settings.get();
            const expected = settings._getDefaults();
            expected.permit_join = true;
            expect(s).toEqual(expected);
        });

        it('Should add devices', () => {
            write(configurationFile, {});
            settings.addDevice('0x12345678');

            const actual = read(configurationFile);
            const expected = {
                devices: {
                    '0x12345678': {
                        friendly_name: '0x12345678',
                        retain: false,
                    },
                },
            };

            expect(actual).toEqual(expected);
        });

        it('Should read devices', () => {
            const content = {
                devices: {
                    '0x12345678': {
                        friendly_name: '0x12345678',
                        retain: false,
                    },
                },
            };

            write(configurationFile, content);

            const device = settings.getDevice('0x12345678');
            const expected = {
                friendly_name: '0x12345678',
                retain: false,
            };

            expect(device).toEqual(expected);
        });

        it('Should read devices form a separate file', () => {
            const contentConfiguration = {
                devices: 'devices.yaml',
            };

            const contentDevices = {
                '0x12345678': {
                    friendly_name: '0x12345678',
                    retain: false,
                },
            };

            write(devicesFile, contentDevices);
            write(configurationFile, contentConfiguration);

            const device = settings.getDevice('0x12345678');
            const expected = {
                friendly_name: '0x12345678',
                retain: false,
            };

            expect(device).toEqual(expected);
        });

        it('Should add devices to a separate file', () => {
            const contentConfiguration = {
                devices: 'devices.yaml',
            };

            const contentDevices = {
                '0x12345678': {
                    friendly_name: '0x12345678',
                    retain: false,
                },
            };

            write(devicesFile, contentDevices);
            write(configurationFile, contentConfiguration);

            settings.addDevice('0x1234');

            expect(read(configurationFile)).toEqual({devices: 'devices.yaml'});

            const expected = {
                '0x12345678': {
                    friendly_name: '0x12345678',
                    retain: false,
                },
                '0x1234': {
                    friendly_name: '0x1234',
                    retain: false,
                },
            };

            expect(read(devicesFile)).toEqual(expected);
        });

        it('Should add devices to a separate file if devices.yaml doesnt exist', () => {
            const contentConfiguration = {
                devices: 'devices.yaml',
            };

            write(configurationFile, contentConfiguration);

            settings.addDevice('0x1234');

            expect(read(configurationFile)).toEqual({devices: 'devices.yaml'});

            const expected = {
                '0x1234': {
                    friendly_name: '0x1234',
                    retain: false,
                },
            };

            expect(read(devicesFile)).toEqual(expected);
        }
        );

        it('Should add and remove devices to a separate file if devices.yaml doesnt exist', () => {
            const contentConfiguration = {
                devices: 'devices.yaml',
            };

            write(configurationFile, contentConfiguration);

            settings.addDevice('0x1234');
            expect(read(configurationFile)).toEqual({devices: 'devices.yaml'});

            settings.removeDevice('0x1234');
            expect(read(configurationFile)).toEqual({devices: 'devices.yaml'});

            expect(read(devicesFile)).toEqual({});
        }
        );

        it('Should read groups', () => {
            const content = {
                groups: {
                    '1': {
                        friendly_name: '123',
                    },
                },
            };

            write(configurationFile, content);

            const group = settings.getGroup('1');
            const expected = {
                friendly_name: '123',
            };

            expect(group).toEqual(expected);
        });

        it('Should read groups form a separate file', () => {
            const contentConfiguration = {
                groups: 'groups.yaml',
            };

            const contentGroups = {
                '1': {
                    friendly_name: '123',
                },
            };

            write(groupsFile, contentGroups);
            write(configurationFile, contentConfiguration);

            const group = settings.getGroup('1');
            const expected = {
                friendly_name: '123',
            };

            expect(group).toEqual(expected);
        });

        it('Combine everything! groups and devices from separate file :)', () => {
            const contentConfiguration = {
                devices: 'devices.yaml',
                groups: 'groups.yaml',
            };

            const contentGroups = {
                '1': {
                    friendly_name: '123',
                },
            };

            write(groupsFile, contentGroups);
            write(configurationFile, contentConfiguration);

            const expectedConfiguration = {
                devices: 'devices.yaml',
                groups: 'groups.yaml',
            };

            expect(read(configurationFile)).toEqual(expectedConfiguration);

            settings.addDevice('0x1234');

            expect(read(configurationFile)).toEqual(expectedConfiguration);

            const expectedDevice = {
                '0x1234': {
                    friendly_name: '0x1234',
                    retain: false,
                },
            };

            expect(read(devicesFile)).toEqual(expectedDevice);

            const group = settings.getGroup('1');
            const expectedGroup = {
                friendly_name: '123',
            };

            expect(group).toEqual(expectedGroup);

            expect(read(configurationFile)).toEqual(expectedConfiguration);

            const expectedDevice2 = {
                friendly_name: '0x1234',
                retain: false,
            };

            expect(settings.getDevice('0x1234')).toEqual(expectedDevice2);
        });
    });
});
