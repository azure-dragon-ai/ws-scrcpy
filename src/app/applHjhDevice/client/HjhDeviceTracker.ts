import { BaseHjhDeviceTracker } from '../../client/BaseHjhDeviceTracker';
import { ACTION } from '../../../common/Action';
import ApplHjhDeviceDescriptor from '../../../types/ApplHjhDeviceDescriptor';
import Util from '../../Util';
import { html } from '../../ui/HtmlTag';
import { HjhDeviceState } from '../../../common/HjhDeviceState';
import { HostItem } from '../../../types/Configuration';
import { ChannelCode } from '../../../common/ChannelCode';
import { Tool } from '../../client/Tool';

export class HjhDeviceTracker extends BaseHjhDeviceTracker<ApplHjhDeviceDescriptor, never> {
    public static ACTION = ACTION.APPL_DEVICE_LIST;
    protected static tools: Set<Tool> = new Set();
    private static instancesByUrl: Map<string, HjhDeviceTracker> = new Map();

    public static start(hostItem: HostItem): HjhDeviceTracker {
        const url = this.buildUrlForTracker(hostItem).toString();
        let instance = this.instancesByUrl.get(url);
        if (!instance) {
            instance = new HjhDeviceTracker(hostItem, url);
        }
        return instance;
    }

    public static getInstance(hostItem: HostItem): HjhDeviceTracker {
        return this.start(hostItem);
    }
    protected tableId = 'appl_devices_list';
    constructor(params: HostItem, directUrl: string) {
        super({ ...params, action: HjhDeviceTracker.ACTION }, directUrl);
        HjhDeviceTracker.instancesByUrl.set(directUrl, this);
        this.buildHjhDeviceTable();
        this.openNewConnection();
    }

    protected onSocketOpen(): void {
        // do nothing;
    }

    protected buildHjhDeviceRow(tbody: Element, device: ApplHjhDeviceDescriptor): void {
        const blockClass = 'desc-block';
        const fullName = `${this.id}_${Util.escapeUdid(device.udid)}`;
        const isActive = device.state === HjhDeviceState.CONNECTED;
        const servicesId = `device_services_${fullName}`;
        const row = html`<div class="device ${isActive ? 'active' : 'not-active'}">
            <div class="device-header">
                <div class="device-name">"${device.name}"</div>
                <div class="device-model">${device.model}</div>
                <div class="device-serial">${device.udid}</div>
                <div class="device-version">
                    <div class="release-version">${device.version}</div>
                </div>
                <div class="device-state" title="State: ${device.state}"></div>
            </div>
            <div id="${servicesId}" class="services"></div>
        </div>`.content;
        const services = row.getElementById(servicesId);
        if (!services) {
            return;
        }

        HjhDeviceTracker.tools.forEach((tool) => {
            const entry = tool.createEntryForHjhDeviceList(device, blockClass, this.params);
            if (entry) {
                if (Array.isArray(entry)) {
                    entry.forEach((item) => {
                        item && services.appendChild(item);
                    });
                } else {
                    services.appendChild(entry);
                }
            }
        });
        tbody.appendChild(row);
    }

    protected getChannelCode(): string {
        return ChannelCode.ATRC;
    }
}
