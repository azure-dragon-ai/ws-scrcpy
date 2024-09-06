import GoogHjhDeviceDescriptor from '../../types/GoogHjhDeviceDescriptor';

export const Properties: ReadonlyArray<keyof GoogHjhDeviceDescriptor> = [
    'ro.product.cpu.abi',
    'ro.product.manufacturer',
    'ro.product.model',
    'ro.build.version.release',
    'ro.build.version.sdk',
    'wifi.interface',
];
