const logger = require('log4js').getLogger('main');
const TuyAPI = require('tuyapi');

const tuyaPayloads = require('../tools/tuya_payloads');
const bulbsConfig = require('../config/bulbs');
const storage = require('../db/storage');
const { Device } = require('../models/device');

function refreshTuya() {
    for (bulb of bulbsConfig) {
        refreshBulb(bulb).then(async refreshedBulb => {
            logger.info(
                '[tuya] Refreshed name=%s is_on=%s',
                refreshedBulb.alias,
                refreshedBulb.is_on
            );
            storage.updateDevice(refreshedBulb);
        });
    }

    return;
}

async function refreshBulb(bulb) {
    let refreshedBulb = new Device();
    refreshedBulb.alias = bulb['name'];
    refreshedBulb.id = bulb['device_id'];
    refreshedBulb.domain = {
        key: bulb['key']
    };
    refreshedBulb.type = 'tuya';

    try {
        const device = new TuyAPI({
            id: refreshedBulb.id,
            key: refreshedBulb.domain.key
        });

        await device.find();
        await device.connect();

        let status = await device.get({
            schema: true
        });

        refreshedBulb['is_on'] = status['dps']['1'];
        refreshedBulb['domain']['mode'] = status['dps']['2'];
        refreshedBulb['domain']['brightness'] = status['dps']['3'];
        refreshedBulb['domain']['dps_payload'] = status['dps'];

        await device.disconnect();
    } catch (error) {
        logger.error(error);
    }

    return refreshedBulb;
}

/**
 * setTuya:
 * Sets the power state of a Tuya Device.
 * If is_on is null, the power state is toggled.
 * @param {*} device 
 * @param {*} is_on 
 */
async function setTuya(device, is_on) {
    try {
        let tuyaDevice = new TuyAPI({
            id: device['id'],
            key: device['domain']['key']
        });

        await tuyaDevice.find();

        await tuyaDevice.connect();

        if(is_on == null){
            status = await tuyaDevice.get();
            await tuyaDevice.set({ set: !status });
        } else {
            await tuyaDevice.set({ set: is_on });
        }

        status = await tuyaDevice.get();

        device.is_on = status;

        tuyaDevice.disconnect();
    } catch (error) {
        logger.error(error);
    }

    storage.updateDevice(device);

    return device;
}

module.exports = {
    refreshTuya,
    setTuya
};
