import WS from 'ws';
import { Mw, RequestParameters } from '../../mw/Mw';
import { ControlCenterCommand } from '../../../common/ControlCenterCommand';
import { ACTION } from '../../../common/Action';
import { HjhDeviceTrackerEvent } from '../../../types/HjhDeviceTrackerEvent';
import { HjhDeviceTrackerEventList } from '../../../types/HjhDeviceTrackerEventList';
import { ControlCenter } from '../services/ControlCenter';
import ApplHjhDeviceDescriptor from '../../../types/ApplHjhDeviceDescriptor';
import { Multiplexer } from '../../../packages/multiplexer/Multiplexer';
import { ChannelCode } from '../../../common/ChannelCode';

export class HjhDeviceTracker extends Mw {
    public static readonly TAG = 'IosHjhDeviceTracker';
    public static readonly type = 'ios';
    private icc: ControlCenter = ControlCenter.getInstance();
    private readonly id: string;

    public static processChannel(ws: Multiplexer, code: string): Mw | undefined {
        if (code !== ChannelCode.ATRC) {
            return;
        }
        return new HjhDeviceTracker(ws);
    }

    public static processRequest(ws: WS, params: RequestParameters): HjhDeviceTracker | undefined {
        if (params.action !== ACTION.APPL_DEVICE_LIST) {
            return;
        }
        return new HjhDeviceTracker(ws);
    }

    constructor(ws: WS | Multiplexer) {
        super(ws);

        this.id = this.icc.getId();
        this.icc
            .init()
            .then(() => {
                this.icc.on('device', this.sendHjhDeviceMessage);
                this.buildAndSendMessage(this.icc.getHjhDevices());
            })
            .catch((error: Error) => {
                console.error(`[${HjhDeviceTracker.TAG}] Error: ${error.message}`);
            });
    }

    private sendHjhDeviceMessage = (device: ApplHjhDeviceDescriptor): void => {
        const data: HjhDeviceTrackerEvent<ApplHjhDeviceDescriptor> = {
            device,
            id: this.id,
            name: this.icc.getName(),
        };
        this.sendMessage({
            id: -1,
            type: 'device',
            data,
        });
    };

    private buildAndSendMessage = (list: ApplHjhDeviceDescriptor[]): void => {
        const data: HjhDeviceTrackerEventList<ApplHjhDeviceDescriptor> = {
            list,
            id: this.id,
            name: this.icc.getName(),
        };
        this.sendMessage({
            id: -1,
            type: 'devicelist',
            data,
        });
    };

    protected onSocketMessage(event: WS.MessageEvent): void {
        let command: ControlCenterCommand;
        try {
            command = ControlCenterCommand.fromJSON(event.data.toString());
        } catch (error: any) {
            console.error(`[${HjhDeviceTracker.TAG}], Received message: ${event.data}. Error: ${error.message}`);
            return;
        }
        this.icc.runCommand(command).catch((error) => {
            console.error(`[${HjhDeviceTracker.TAG}], Received message: ${event.data}. Error: ${error.message}`);
        });
    }

    public release(): void {
        super.release();
        this.icc.off('device', this.sendHjhDeviceMessage);
    }
}
