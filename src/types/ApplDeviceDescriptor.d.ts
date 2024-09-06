import { BaseHjhDeviceDescriptor } from './BaseHjhDeviceDescriptor';

export default interface ApplHjhDeviceDescriptor extends BaseHjhDeviceDescriptor {
    name: string;
    model: string;
    version: string;
    'last.update.timestamp': number;
}
