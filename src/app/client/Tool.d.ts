import { ParamsHjhDeviceTracker } from '../../types/ParamsHjhDeviceTracker';
import { BaseHjhDeviceDescriptor } from '../../types/BaseHjhDeviceDescriptor';

type Entry = HTMLElement | DocumentFragment;

export interface Tool {
    createEntryForHjhDeviceList(
        descriptor: BaseHjhDeviceDescriptor,
        blockClass: string,
        params: ParamsHjhDeviceTracker,
    ): Array<Entry | undefined> | Entry | undefined;
}
