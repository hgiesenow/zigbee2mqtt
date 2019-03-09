const sinon = require('sinon');
const Controller = require('../lib/controller');
const settings = require('../lib/util/settings');
const mqtt = require('../lib/mqtt');
const utils = require('./utils');

describe('Controller', () => {
    let controller;
    let mqttPublish;

    beforeEach(() => {
        utils.stubLogger(sinon);
        sinon.stub(settings, 'getDevice').callsFake((ieeeAddr) => {
            return {friendly_name: 'test'};
        });
        mqttPublish = sinon.stub(mqtt.prototype, 'publish').callsFake(() => {});
        controller = new Controller();
        controller.zigbee = {
            getDevice: () => {
                return {
                    modelId: 'TRADFRI bulb E27 CWS opal 600lm',
                    manufName: 'IKEA',
                };
            },
        };
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('Handling zigbee messages', () => {
        it('Should handle a zigbee message', () => {
            const device = {ieeeAddr: '0x12345678', modelId: 'TRADFRI bulb E27 CWS opal 600lm'};
            const message = utils.zigbeeMessage(device, 'genOnOff', 'devChange', {onOff: 1}, 1);
            controller.onZigbeeMessage(message);
            expect(mqttPublish.calledOnce).toBe(true);
            expect(mqttPublish.getCall(0).args[1]).toBe(JSON.stringify({state: 'ON'}));
        });

        it('Should handle a zigbee message when include_device_information is set', () => {
            sinon.stub(settings, 'get').callsFake(() => {
                return {
                    mqtt: {
                        include_device_information: true,
                    },
                    advanced: {
                        cache_state: false,
                    },
                    experimental: {
                        output: 'json',
                    },
                };
            });

            const device = {ieeeAddr: '0x12345678', modelId: 'TRADFRI bulb E27 CWS opal 600lm'};
            const message = utils.zigbeeMessage(device, 'genOnOff', 'devChange', {onOff: 1}, 1);
            controller.onZigbeeMessage(message);
            expect(mqttPublish.calledOnce).toBe(true);
            expect(mqttPublish.getCall(0).args[1]).toBe(
                `{"state":"ON","device":{"ieeeAddr":"0x12345678","friendlyName":"test",` +
                `"manufName":"IKEA","modelId":"TRADFRI bulb E27 CWS opal 600lm"}}`
            );
        }
        );

        it('Should output to json by default', () => {
            const payload = {temperature: 1, humidity: 2};
            controller.publishEntityState('0x12345678', payload);
            expect(mqttPublish.calledOnce).toBe(true);
            expect(JSON.parse(mqttPublish.getCall(0).args[1])).toEqual(payload);
        });

        it('Should output to attribute', () => {
            sinon.stub(settings, 'get').callsFake(() => {
                return {
                    mqtt: {
                        include_device_information: false,
                    },
                    advanced: {
                        cache_state: false,
                    },
                    experimental: {
                        output: 'attribute',
                    },
                };
            });

            const payload = {temperature: 1, humidity: 2};
            controller.publishEntityState('0x12345678', payload);
            expect(mqttPublish.calledTwice).toBe(true);
            expect(mqttPublish.getCall(0).args[0]).toEqual('test/temperature');
            expect(mqttPublish.getCall(0).args[1]).toEqual('1');
            expect(mqttPublish.getCall(1).args[0]).toEqual('test/humidity');
            expect(mqttPublish.getCall(1).args[1]).toEqual('2');
        });
    });
});
