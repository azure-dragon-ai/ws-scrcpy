import '../../../style/devicelist.css';
import { BaseHjhDeviceTracker } from '../../client/BaseHjhDeviceTracker';
import { SERVER_PORT } from '../../../common/Constants';
import { ACTION } from '../../../common/Action';
import GoogHjhDeviceDescriptor from '../../../types/GoogHjhDeviceDescriptor';
import { ControlCenterCommand } from '../../../common/ControlCenterCommand';
import { StreamClientScrcpy } from './StreamClientScrcpy';
import SvgImage from '../../ui/SvgImage';
import { html } from '../../ui/HtmlTag';
import Util from '../../Util';
import { Attribute } from '../../Attribute';
import { HjhDeviceState } from '../../../common/HjhDeviceState';
import { Message } from '../../../types/Message';
import { ParamsHjhDeviceTracker } from '../../../types/ParamsHjhDeviceTracker';
import { HostItem } from '../../../types/Configuration';
import { ChannelCode } from '../../../common/ChannelCode';
import { Tool } from '../../client/Tool';

type Field = keyof GoogHjhDeviceDescriptor | ((descriptor: GoogHjhDeviceDescriptor) => string);
type DescriptionColumn = { title: string; field: Field };

const DESC_COLUMNS: DescriptionColumn[] = [
    {
        title: 'Net Interface',
        field: 'interfaces',
    },
    {
        title: 'Server PID',
        field: 'pid',
    },
];

export class HjhDeviceTracker extends BaseHjhDeviceTracker<GoogHjhDeviceDescriptor, never> {
    public static readonly ACTION = ACTION.GOOG_DEVICE_LIST;
    public static readonly CREATE_DIRECT_LINKS = true;
    private static instancesByUrl: Map<string, HjhDeviceTracker> = new Map();
    protected static tools: Set<Tool> = new Set();
    protected tableId = 'goog_device_list';

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

    protected constructor(params: HostItem, directUrl: string) {
        super({ ...params, action: HjhDeviceTracker.ACTION }, directUrl);
        HjhDeviceTracker.instancesByUrl.set(directUrl, this);
        this.buildHjhDeviceTable();
        this.openNewConnection();
    }

    protected onSocketOpen(): void {
        // nothing here;
    }

    protected setIdAndHostName(id: string, hostName: string): void {
        super.setIdAndHostName(id, hostName);
        for (const value of HjhDeviceTracker.instancesByUrl.values()) {
            if (value.id === id && value !== this) {
                console.warn(
                    `Tracker with url: "${this.url}" has the same id(${this.id}) as tracker with url "${value.url}"`,
                );
                console.warn(`This tracker will shut down`);
                this.destroy();
            }
        }
    }

    onInterfaceSelected = (event: Event): void => {
        const selectElement = event.currentTarget as HTMLSelectElement;
        const option = selectElement.selectedOptions[0];
        const url = decodeURI(option.getAttribute(Attribute.URL) || '');
        const name = option.getAttribute(Attribute.NAME) || '';
        const fullName = decodeURIComponent(selectElement.getAttribute(Attribute.FULL_NAME) || '');
        const udid = selectElement.getAttribute(Attribute.UDID) || '';
        this.updateLink({ url, name, fullName, udid, store: true });
    };

    private updateLink(params: { url: string; name: string; fullName: string; udid: string; store: boolean }): void {
        const { url, name, fullName, udid, store } = params;
        const playerTds = document.getElementsByName(
            encodeURIComponent(`${HjhDeviceTracker.AttributePrefixPlayerFor}${fullName}`),
        );
        if (typeof udid !== 'string') {
            return;
        }
        if (store) {
            const localStorageKey = HjhDeviceTracker.getLocalStorageKey(fullName || '');
            if (localStorage && name) {
                localStorage.setItem(localStorageKey, name);
            }
        }
        const action = ACTION.STREAM_SCRCPY;
        playerTds.forEach((item) => {
            item.innerHTML = '';
            const playerFullName = item.getAttribute(HjhDeviceTracker.AttributePlayerFullName);
            const playerCodeName = item.getAttribute(HjhDeviceTracker.AttributePlayerCodeName);
            if (!playerFullName || !playerCodeName) {
                return;
            }
            const link = HjhDeviceTracker.buildLink(
                {
                    action,
                    udid,
                    player: decodeURIComponent(playerCodeName),
                    ws: url,
                },
                decodeURIComponent(playerFullName),
                this.params,
            );
            item.appendChild(link);
        });
    }

    onActionButtonClick = (event: MouseEvent): void => {
        const button = event.currentTarget as HTMLButtonElement;
        const udid = button.getAttribute(Attribute.UDID);
        const pidString = button.getAttribute(Attribute.PID) || '';
        const command = button.getAttribute(Attribute.COMMAND) as string;
        const pid = parseInt(pidString, 10);
        const data: Message = {
            id: this.getNextId(),
            type: command,
            data: {
                udid: typeof udid === 'string' ? udid : undefined,
                pid: isNaN(pid) ? undefined : pid,
            },
        };

        if (this.ws && this.ws.readyState === this.ws.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    };

    private static getLocalStorageKey(udid: string): string {
        return `device_list::${udid}::interface`;
    }

    protected static createUrl(params: ParamsHjhDeviceTracker, udid = ''): URL {
        const secure = !!params.secure;
        const hostname = params.hostname || location.hostname;
        const port = typeof params.port === 'number' ? params.port : secure ? 443 : 80;
        const pathname = params.pathname || location.pathname;
        const urlObject = this.buildUrl({ ...params, secure, hostname, port, pathname });
        if (udid) {
            urlObject.searchParams.set('action', ACTION.PROXY_ADB);
            urlObject.searchParams.set('remote', `tcp:${SERVER_PORT.toString(10)}`);
            urlObject.searchParams.set('udid', udid);
        }
        return urlObject;
    }

    protected static createInterfaceOption(name: string, url: string): HTMLOptionElement {
        const optionElement = document.createElement('option');
        optionElement.setAttribute(Attribute.URL, url);
        optionElement.setAttribute(Attribute.NAME, name);
        optionElement.innerText = `基于adb的代理`;
        return optionElement;
    }

    private static titleToClassName(title: string): string {
        return title.toLowerCase().replace(/\s/g, '_');
    }

    protected buildHjhDeviceRow(tbody: Element, device: GoogHjhDeviceDescriptor): void {
        let selectedInterfaceUrl = '';
        let selectedInterfaceName = '';
        const blockClass = 'desc-block';
        const fullName = `${this.id}_${Util.escapeUdid(device.udid)}`;
        const isActive = device.state === HjhDeviceState.DEVICE;
        let hasPid = false;
        const servicesId = `device_services_${fullName}`;
        const row = html`<div class="device ${isActive ? 'active' : 'not-active'}">
            <div class="device-header">
                <div class="device-name">${device['ro.product.manufacturer']} ${device['ro.product.model']}</div>
                <div class="device-serial">${device.udid}</div>
                <div class="device-version">
                    <div class="release-version">${device['ro.build.version.release']}</div>
                    <div class="sdk-version">${device['ro.build.version.sdk']}</div>
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

        const streamEntry = StreamClientScrcpy.createEntryForHjhDeviceList(device, blockClass, fullName, this.params);
        streamEntry && services.appendChild(streamEntry);

        DESC_COLUMNS.forEach((item) => {
            const { title } = item;
            const fieldName = item.field;
            let value: string;
            if (typeof item.field === 'string') {
                value = '' + device[item.field];
            } else {
                value = item.field(device);
            }
            const td = document.createElement('div');
            td.classList.add(HjhDeviceTracker.titleToClassName(title), blockClass);
            services.appendChild(td);
            if (fieldName === 'pid') {
                hasPid = value !== '-1';
                const actionButton = document.createElement('button');
                actionButton.className = 'action-button kill-server-button';
                actionButton.setAttribute(Attribute.UDID, device.udid);
                actionButton.setAttribute(Attribute.PID, value);
                let command: string;
                if (isActive) {
                    actionButton.classList.add('active');
                    actionButton.onclick = this.onActionButtonClick;
                    if (hasPid) {
                        command = ControlCenterCommand.KILL_SERVER;
                        actionButton.title = '结束服务';
                        actionButton.appendChild(SvgImage.create(SvgImage.Icon.CANCEL));
                    } else {
                        command = ControlCenterCommand.START_SERVER;
                        actionButton.title = '开始服务';
                        actionButton.appendChild(SvgImage.create(SvgImage.Icon.REFRESH));
                    }
                    actionButton.setAttribute(Attribute.COMMAND, command);
                } else {
                    const timestamp = device['last.update.timestamp'];
                    if (timestamp) {
                        const date = new Date(timestamp);
                        actionButton.title = `最后更新 ${date.toLocaleDateString()} at ${date.toLocaleTimeString()}`;
                    } else {
                        actionButton.title = `不活跃的`;
                    }
                    actionButton.appendChild(SvgImage.create(SvgImage.Icon.OFFLINE));
                }
                const span = document.createElement('span');
                span.innerText = value;
                actionButton.appendChild(span);
                td.appendChild(actionButton);
            } else if (fieldName === 'interfaces') {
                const proxyInterfaceUrl = HjhDeviceTracker.createUrl(this.params, device.udid).toString();
                const proxyInterfaceName = 'proxy';
                const localStorageKey = HjhDeviceTracker.getLocalStorageKey(fullName);
                const lastSelected = localStorage && localStorage.getItem(localStorageKey);
                const selectElement = document.createElement('select');
                selectElement.setAttribute(Attribute.UDID, device.udid);
                selectElement.setAttribute(Attribute.FULL_NAME, fullName);
                selectElement.setAttribute(
                    'name',
                    encodeURIComponent(`${HjhDeviceTracker.AttributePrefixInterfaceSelectFor}${fullName}`),
                );
                /// #if SCRCPY_LISTENS_ON_ALL_INTERFACES
                device.interfaces.forEach((value) => {
                    const params = {
                        ...this.params,
                        secure: false,
                        hostname: value.ipv4,
                        port: SERVER_PORT,
                    };
                    const url = HjhDeviceTracker.createUrl(params).toString();
                    const optionElement = HjhDeviceTracker.createInterfaceOption(value.name, url);
                    optionElement.innerText = `${value.name}: ${value.ipv4}`;
                    selectElement.appendChild(optionElement);
                    if (lastSelected) {
                        if (lastSelected === value.name || !selectedInterfaceName) {
                            optionElement.selected = true;
                            selectedInterfaceUrl = url;
                            selectedInterfaceName = value.name;
                        }
                    } else if (device['wifi.interface'] === value.name) {
                        optionElement.selected = true;
                    }
                });
                /// #else
                selectedInterfaceUrl = proxyInterfaceUrl;
                selectedInterfaceName = proxyInterfaceName;
                td.classList.add('hidden');
                /// #endif
                if (isActive) {
                    const adbProxyOption = HjhDeviceTracker.createInterfaceOption(proxyInterfaceName, proxyInterfaceUrl);
                    if (lastSelected === proxyInterfaceName || !selectedInterfaceName) {
                        adbProxyOption.selected = true;
                        selectedInterfaceUrl = proxyInterfaceUrl;
                        selectedInterfaceName = proxyInterfaceName;
                    }
                    selectElement.appendChild(adbProxyOption);
                    const actionButton = document.createElement('button');
                    actionButton.className = 'action-button update-interfaces-button active';
                    actionButton.title = `更新信息`;
                    actionButton.appendChild(SvgImage.create(SvgImage.Icon.REFRESH));
                    actionButton.setAttribute(Attribute.UDID, device.udid);
                    actionButton.setAttribute(Attribute.COMMAND, ControlCenterCommand.UPDATE_INTERFACES);
                    actionButton.onclick = this.onActionButtonClick;
                    td.appendChild(actionButton);
                }
                selectElement.onchange = this.onInterfaceSelected;
                td.appendChild(selectElement);
            } else {
                td.innerText = value;
            }
        });

        if (HjhDeviceTracker.CREATE_DIRECT_LINKS) {
            const name = `${HjhDeviceTracker.AttributePrefixPlayerFor}${fullName}`;
            StreamClientScrcpy.getPlayers().forEach((playerClass) => {
                const { playerCodeName, playerFullName } = playerClass;
                const playerTd = document.createElement('div');
                playerTd.classList.add(blockClass);
                playerTd.setAttribute('name', encodeURIComponent(name));
                playerTd.setAttribute(HjhDeviceTracker.AttributePlayerFullName, encodeURIComponent(playerFullName));
                playerTd.setAttribute(HjhDeviceTracker.AttributePlayerCodeName, encodeURIComponent(playerCodeName));
                services.appendChild(playerTd);
            });
        }

        tbody.appendChild(row);
        if (HjhDeviceTracker.CREATE_DIRECT_LINKS && hasPid && selectedInterfaceUrl) {
            this.updateLink({
                url: selectedInterfaceUrl,
                name: selectedInterfaceName,
                fullName,
                udid: device.udid,
                store: false,
            });
        }
    }

    protected getChannelCode(): string {
        return ChannelCode.GTRC;
    }

    public destroy(): void {
        super.destroy();
        HjhDeviceTracker.instancesByUrl.delete(this.url.toString());
        if (!HjhDeviceTracker.instancesByUrl.size) {
            const holder = document.getElementById(BaseHjhDeviceTracker.HOLDER_ELEMENT_ID);
            if (holder && holder.parentElement) {
                holder.parentElement.removeChild(holder);
            }
        }
    }
}